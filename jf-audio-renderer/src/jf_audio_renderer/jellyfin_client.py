from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote

import httpx

from jf_audio_renderer.config import JellyfinConfig

logger = logging.getLogger(__name__)


class JellyfinClient:
    def __init__(self, cfg: JellyfinConfig) -> None:
        self._cfg = cfg
        self._base = cfg.base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base,
            headers={
                "X-Emby-Token": cfg.api_key,
                "X-Emby-Authorization": (
                    f'MediaBrowser Client="JF Audio Renderer", '
                    f'Device="{cfg.device_name}", DeviceId="{cfg.device_id}", Version="0.1"'
                ),
            },
            timeout=httpx.Timeout(60.0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def get_item(self, item_id: str) -> dict[str, Any]:
        r = await self._client.get(
            f"/Items/{item_id}",
            params={
                "UserId": self._cfg.user_id,
                "Fields": "MediaSources,Path,Overview,PrimaryImageTag,ParentId,Album,Artists,AlbumArtist,ImageTags",
            },
        )
        r.raise_for_status()
        return r.json()

    def build_image_url(self, item_id: str, image_tag: str | None, max_width: int = 480) -> str:
        tag = image_tag or ""
        q = f"tag={quote(tag)}&format=Webp&maxWidth={max_width}" if tag else f"format=Webp&maxWidth={max_width}"
        return f"{self._base}/Items/{item_id}/Images/Primary?{q}&api_key={quote(self._cfg.api_key)}"

    async def get_audio_stream_url(self, item_id: str) -> tuple[str, dict[str, Any]]:
        """
        Resolve a playable HTTP URL for Jellyfin item_id (music track).
        Uses PlaybackInfo to pick a MediaSource, then builds /Audio/.../stream URL.
        """
        item = await self.get_item(item_id)
        if item.get("IsFolder"):
            raise ValueError("Item is a folder, not playable audio")

        body: dict[str, Any] = {
            "UserId": self._cfg.user_id,
            "DeviceProfile": {
                "Name": "JF Audio Renderer",
                "MaxStaticBitrate": 1_400_000_000,
                "MusicStreamingTranscodingBitrate": 384_000,
                "DirectPlayProfiles": [{"Type": "Audio"}],
                "TranscodingProfiles": [],
            },
        }
        r = await self._client.post(
            f"/Items/{item_id}/PlaybackInfo",
            params={"UserId": self._cfg.user_id},
            json=body,
        )
        r.raise_for_status()
        info = r.json()
        sources: list[dict[str, Any]] = info.get("MediaSources") or []
        if not sources:
            raise RuntimeError("No media sources returned for item")

        src = sources[0]
        ms_id = src.get("Id") or ""
        container = (src.get("Container") or "mp3").split(",")[0].strip() or "mp3"

        # Direct stream URL (server transcodes if needed based on profile)
        path = (
            f"/Audio/{item_id}/stream.{container}"
            f"?UserId={quote(self._cfg.user_id)}"
            f"&DeviceId={quote(self._cfg.device_id)}"
            f"&Static=true"
        )
        if ms_id:
            path += f"&MediaSourceId={quote(ms_id)}"

        url = f"{self._base}{path}&api_key={quote(self._cfg.api_key)}"
        return url, item

    async def report_progress(
        self,
        item_id: str,
        position_ticks: int,
        is_paused: bool,
        is_stopped: bool,
        session_id: str | None = None,
        media_source_id: str | None = None,
    ) -> None:
        """Best-effort playback progress to Jellyfin (updates dashboard / continue watching)."""
        body: dict[str, Any] = {
            "VolumeLevel": 100,
            "IsMuted": False,
            "IsPaused": is_paused,
            "ShuffleMode": "Sorted",
            "RepeatMode": "RepeatNone",
            "MaxStreamingBitrate": 1_400_000_000,
            "PositionTicks": position_ticks,
            "PlaybackStartTimeTicks": 0,
            "SubtitleStreamIndex": 0,
            "AudioStreamIndex": 0,
            "PlayMethod": "DirectStream",
            "MediaSourceId": media_source_id or "",
            "CanSeek": True,
            "ItemId": item_id,
            "EventName": "timeupdate" if not is_stopped else "stop",
        }
        if session_id:
            body["PlaySessionId"] = session_id
        try:
            pr = await self._client.post(
                "/Sessions/Playing/Progress",
                json=body,
            )
            pr.raise_for_status()
        except Exception as exc:  # noqa: BLE001
            logger.debug("progress report failed: %s", exc)
