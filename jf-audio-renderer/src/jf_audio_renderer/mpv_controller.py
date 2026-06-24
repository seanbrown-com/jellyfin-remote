from __future__ import annotations

import asyncio
import json
import logging
import shutil
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class MpvController:
    """Control a headless mpv instance via JSON IPC over a Unix socket."""

    def __init__(
        self,
        mpv_socket: str,
        audio_device: str,
        on_end_file: Callable[[], Awaitable[None]] | None = None,
    ) -> None:
        self._mpv_socket = mpv_socket
        self._audio_device = audio_device
        self._on_end_file = on_end_file
        self._proc: asyncio.subprocess.Process | None = None
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self._next_id = 1
        self._pending: dict[int, asyncio.Future[Any]] = {}
        self._reader_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    @property
    def socket_path(self) -> str:
        return self._mpv_socket

    async def start(self) -> None:
        sock = Path(self._mpv_socket)
        sock.parent.mkdir(parents=True, exist_ok=True)
        if sock.exists():
            sock.unlink()

        mpv_bin = shutil.which("mpv") or "mpv"
        args = [
            mpv_bin,
            "--no-video",
            "--idle=yes",
            "--no-terminal",
            f"--input-ipc-server={self._mpv_socket}",
            f"--audio-device={self._audio_device}",
            "--keep-open=yes",
        ]
        self._proc = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )

        deadline = asyncio.get_event_loop().time() + 15.0
        while not sock.exists():
            if self._proc.returncode is not None:
                err = (await self._proc.stderr.read()).decode() if self._proc.stderr else ""
                raise RuntimeError(f"mpv exited early (code {self._proc.returncode}): {err}")
            if asyncio.get_event_loop().time() > deadline:
                raise TimeoutError("mpv did not create IPC socket in time")
            await asyncio.sleep(0.05)

        self._reader, self._writer = await asyncio.open_unix_connection(path=str(sock))
        self._reader_task = asyncio.create_task(self._read_loop())

    async def shutdown(self) -> None:
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
            self._reader_task = None
        if self._writer:
            self._writer.close()
            try:
                await self._writer.wait_closed()
            except Exception:  # noqa: BLE001
                pass
            self._writer = None
            self._reader = None
        if self._proc and self._proc.returncode is None:
            self._proc.terminate()
            try:
                await asyncio.wait_for(self._proc.wait(), timeout=5)
            except TimeoutError:
                self._proc.kill()
        self._proc = None

    async def _read_loop(self) -> None:
        assert self._reader is not None
        try:
            while True:
                line = await self._reader.readline()
                if not line:
                    break
                try:
                    msg: dict[str, Any] = json.loads(line.decode())
                except json.JSONDecodeError:
                    continue
                if "request_id" in msg:
                    rid = int(msg["request_id"])
                    fut = self._pending.pop(rid, None)
                    if fut and not fut.done():
                        err = msg.get("error")
                        if err and err != "success":
                            fut.set_exception(RuntimeError(err))
                        else:
                            fut.set_result(msg.get("data"))
                elif msg.get("event") == "end-file":
                    reason = (msg.get("reason") or "").lower()
                    if reason in ("eof", "stop", "") and self._on_end_file:
                        asyncio.create_task(self._on_end_file())
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("mpv read loop error: %s", exc)

    async def request(self, command: list[Any], timeout: float = 15.0) -> Any:
        async with self._lock:
            if self._writer is None:
                raise RuntimeError("mpv not started")
            rid = self._next_id
            self._next_id += 1
            fut: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
            self._pending[rid] = fut
            payload = json.dumps({"command": command, "request_id": rid}) + "\n"
            self._writer.write(payload.encode())
            await self._writer.drain()
        return await asyncio.wait_for(fut, timeout=timeout)

    async def loadfile(self, url: str, mode: str = "replace") -> None:
        """mode: replace | append | replace-play"""
        await self.request(["loadfile", url, mode])

    async def pause(self, paused: bool) -> None:
        await self.request(["set_property", "pause", paused])

    async def stop(self) -> None:
        await self.request(["stop"])

    async def seek(self, seconds: float, absolute: str = "absolute") -> None:
        await self.request(["seek", seconds, absolute])

    async def set_volume(self, level: int) -> None:
        await self.request(["set_property", "volume", float(max(0, min(100, level)))])

    async def get_pause(self) -> bool:
        return bool(await self.request(["get_property", "pause"]))

    async def get_time_pos(self) -> float | None:
        v = await self.request(["get_property", "time-pos"])
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    async def get_duration(self) -> float | None:
        v = await self.request(["get_property", "duration"])
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    async def get_metadata(self) -> dict[str, Any]:
        meta = await self.request(["get_property", "metadata"])
        if isinstance(meta, dict):
            return meta
        return {}

    async def observe_time_pos(self) -> None:
        await self.request(["observe_property", 1, "time-pos"])
        await self.request(["observe_property", 2, "pause"])
        await self.request(["observe_property", 3, "duration"])
