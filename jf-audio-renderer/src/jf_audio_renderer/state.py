from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any

from jf_audio_renderer.jellyfin_client import JellyfinClient
from jf_audio_renderer.models import PlayerState, RepeatMode
from jf_audio_renderer.mpv_controller import MpvController
from jf_audio_renderer.queue_manager import QueueManager

if TYPE_CHECKING:
    from jf_audio_renderer.config import AppConfig

logger = logging.getLogger(__name__)


class PlayerRuntime:
    """Coordinates Jellyfin metadata, queue, mpv, and SSE subscribers."""

    def __init__(self, cfg: AppConfig, jf: JellyfinClient) -> None:
        self._cfg = cfg
        self._jf = jf
        self.queue = QueueManager()
        self._mpv = MpvController(
            mpv_socket=cfg.renderer.mpv_socket,
            audio_device=cfg.renderer.audio_device,
            on_end_file=self._on_end_file,
        )
        self._volume = cfg.renderer.default_volume
        self._sse_subscribers: list[asyncio.Queue[PlayerState]] = []
        self._poll_task: asyncio.Task[None] | None = None
        self._mpv_lock = asyncio.Lock()
        self._advance_lock = asyncio.Lock()
        self._last_item: dict[str, Any] | None = None

    async def start(self) -> None:
        await self._mpv.start()
        async with self._mpv_lock:
            await self._mpv.set_volume(self._volume)
        try:
            await self._mpv.observe_time_pos()
        except Exception as exc:  # noqa: BLE001
            logger.debug("observe_property failed (non-fatal): %s", exc)
        self._poll_task = asyncio.create_task(self._poll_loop())

    async def shutdown(self) -> None:
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
        await self._mpv.shutdown()

    def subscribe(self) -> asyncio.Queue[PlayerState]:
        q: asyncio.Queue[PlayerState] = asyncio.Queue(maxsize=64)
        self._sse_subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[PlayerState]) -> None:
        if q in self._sse_subscribers:
            self._sse_subscribers.remove(q)

    async def _broadcast(self, state: PlayerState) -> None:
        dead: list[asyncio.Queue[PlayerState]] = []
        for q in self._sse_subscribers:
            try:
                q.put_nowait(state)
            except asyncio.QueueFull:
                try:
                    _ = q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(state)
                except asyncio.QueueFull:
                    dead.append(q)
        for q in dead:
            self.unsubscribe(q)

    async def _emit(self, state: PlayerState) -> None:
        await self._broadcast(state)

    async def _poll_loop(self) -> None:
        while True:
            try:
                st = await self.build_state()
                await self._emit(st)
                if st.item_id:
                    try:
                        if await self._mpv.get_eof_reached():
                            asyncio.create_task(self._on_end_file())
                    except Exception as exc:  # noqa: BLE001
                        logger.debug("failed to poll eof state: %s", exc)
                await asyncio.sleep(0.4)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                logger.exception("poll loop: %s", exc)
                await asyncio.sleep(1.0)

    async def build_state(self) -> PlayerState:
        pause = True
        pos = 0.0
        dur = None
        try:
            pause = await self._mpv.get_pause()
            pos = (await self._mpv.get_time_pos()) or 0.0
            dur = await self._mpv.get_duration()
        except Exception:  # noqa: BLE001
            pass

        item_id = await self.queue.current()
        title = album = None
        artists: list[str] = []
        image_tag = None
        shuf, rep = await self.queue.get_flags()

        if item_id is None:
            return PlayerState(
                state="idle",
                itemId=None,
                title=None,
                album=None,
                artists=[],
                position=0.0,
                duration=None,
                volume=self._volume,
                shuffle=shuf,
                repeat=rep,
                imageTag=None,
            )

        if item_id and (not self._last_item or self._last_item.get("Id") != item_id):
            try:
                self._last_item = await self._jf.get_item(item_id)
            except Exception as exc:  # noqa: BLE001
                logger.debug("failed to refresh current item metadata: %s", exc)

        if item_id and self._last_item and self._last_item.get("Id") == item_id:
            title = self._last_item.get("Name")
            album = (self._last_item.get("Album") or "") or None
            raw_artists = self._last_item.get("AlbumArtist") or self._last_item.get("Artists") or []
            if isinstance(raw_artists, str):
                artists = [raw_artists]
            elif isinstance(raw_artists, list):
                artists = [str(a) for a in raw_artists]
            image_tag = (self._last_item.get("ImageTags") or {}).get("Primary")

        playing = (not pause) and item_id is not None
        st2 = "playing" if playing else "paused"
        return PlayerState(
            state=st2,  # type: ignore[arg-type]
            itemId=item_id,
            title=title,
            album=album,
            artists=artists,
            position=pos,
            duration=dur,
            volume=self._volume,
            shuffle=shuf,
            repeat=rep,
            imageTag=image_tag,
        )

    async def _on_end_file(self) -> None:
        if self._advance_lock.locked():
            return
        async with self._advance_lock:
            nxt = await self.queue.next_track()
            if nxt is None:
                async with self._mpv_lock:
                    await self._mpv.stop()
                self._last_item = None
                return
            logger.info("advancing playback to next queued item %s", nxt)
            await self._play_item(nxt)

    async def _play_item(self, item_id: str) -> None:
        url, item = await self._jf.get_audio_stream_url(item_id)
        async with self._mpv_lock:
            self._last_item = item
            try:
                await self._mpv.loadfile(url, "replace")
            except (TimeoutError, RuntimeError) as exc:
                logger.warning("mpv loadfile failed; restarting mpv and retrying: %s", exc)
                await self._mpv.shutdown()
                await self._mpv.start()
                await self._mpv.set_volume(self._volume)
                try:
                    await self._mpv.observe_time_pos()
                except Exception as observe_exc:  # noqa: BLE001
                    logger.debug("observe_property failed after mpv restart (non-fatal): %s", observe_exc)
                await self._mpv.loadfile(url, "replace")
            await self._mpv.pause(False)

    async def play(self, item_id: str | None, mode: str, queue: list[str]) -> None:
        if mode == "replaceQueue":
            ids = list(queue)
            if item_id:
                if not ids:
                    ids = [item_id]
                    idx = 0
                elif item_id in ids:
                    idx = ids.index(item_id)
                else:
                    ids = [item_id] + ids
                    idx = 0
                await self.queue.replace_with(ids, idx)
            elif ids:
                await self.queue.replace_with(ids, 0)
            else:
                await self.queue.replace_with([], 0)
        elif mode == "append":
            if queue:
                await self.queue.append(queue)
            if item_id:
                await self.queue.append([item_id])
        elif mode == "playNow":
            if item_id:
                cur_list, cur_i = await self.queue.snapshot()
                head = cur_list[: cur_i + 1]
                tail = cur_list[cur_i + 1 :]
                new_list = head + [item_id] + [x for x in tail if x != item_id]
                new_idx = len(head)
                await self.queue.replace_with(new_list, new_idx)
            elif queue:
                await self.queue.replace_with(list(queue), 0)

        cur = await self.queue.current()
        if cur:
            await self._play_item(cur)

    async def pause(self) -> None:
        async with self._mpv_lock:
            await self._mpv.pause(True)

    async def resume(self) -> None:
        async with self._mpv_lock:
            await self._mpv.pause(False)

    async def stop(self) -> None:
        async with self._mpv_lock:
            await self._mpv.stop()
        self._last_item = None

    async def next(self) -> None:
        nxt = await self.queue.next_track()
        if nxt:
            await self._play_item(nxt)
        else:
            async with self._mpv_lock:
                await self._mpv.stop()
            self._last_item = None

    async def previous(self) -> None:
        pos = (await self._mpv.get_time_pos()) or 0.0
        if pos > 3:
            async with self._mpv_lock:
                await self._mpv.seek(0, "absolute")
            return
        prev = await self.queue.previous_track()
        if prev:
            await self._play_item(prev)

    async def seek(self, seconds: float) -> None:
        async with self._mpv_lock:
            await self._mpv.seek(seconds, "absolute")

    async def volume(self, level: int) -> None:
        async with self._mpv_lock:
            self._volume = max(0, min(100, level))
            await self._mpv.set_volume(self._volume)

    async def set_queue(self, item_ids: list[str]) -> None:
        current = await self.queue.current()
        start_index = item_ids.index(current) if current in item_ids else 0
        await self.queue.set_queue(item_ids, start_index)

    async def remove_queue_item(self, index: int) -> None:
        await self.queue.remove_at(index)

    async def reorder_queue(self, from_index: int, to_index: int) -> None:
        await self.queue.reorder(from_index, to_index)

    async def shuffle(self, enabled: bool | None = None) -> None:
        shuf, _ = await self.queue.get_flags()
        if enabled is None:
            await self.queue.set_shuffle(not shuf)
        else:
            await self.queue.set_shuffle(enabled)

    async def set_repeat(self, mode: RepeatMode) -> None:
        await self.queue.set_repeat(mode)
