from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from pydantic import BaseModel

from jf_audio_renderer.admin_portal import register_admin
from jf_audio_renderer.config import AppConfig
from jf_audio_renderer.jellyfin_client import JellyfinClient
from jf_audio_renderer.models import (
    PlayRequest,
    QueueReorderRequest,
    QueueSetRequest,
    RepeatMode,
    SeekRequest,
    VolumeRequest,
)
from jf_audio_renderer.secure_store import SecurePaths
from jf_audio_renderer.state import PlayerRuntime

logger = logging.getLogger(__name__)


class RepeatBody(BaseModel):
    mode: RepeatMode


def create_app(cfg: AppConfig, paths: SecurePaths) -> FastAPI:
    has_player = cfg.jellyfin is not None
    jf: JellyfinClient | None = None
    runtime: PlayerRuntime | None = None
    token = ""

    if has_player:
        assert cfg.jellyfin is not None
        jf = JellyfinClient(cfg.jellyfin)
        runtime = PlayerRuntime(cfg, jf)
        token = (cfg.renderer.api_token or "").strip()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if runtime is not None:
            await runtime.start()
            try:
                yield
            finally:
                await runtime.shutdown()
                if jf is not None:
                    await jf.aclose()
        else:
            yield

    app = FastAPI(title="JF Audio Renderer", lifespan=lifespan)
    register_admin(app, paths)

    @app.get("/admin")
    async def admin_redirect_slash():
        return RedirectResponse("/admin/", status_code=307)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.cfg = cfg
    app.state.paths = paths
    app.state.jf = jf
    app.state.runtime = runtime
    app.state.token = token

    @app.middleware("http")
    async def guard(request: Request, call_next):
        p = request.url.path
        if p.startswith("/admin"):
            return await call_next(request)
        if not app.state.token:
            return await call_next(request)
        if p == "/health":
            return await call_next(request)
        if request.method == "GET":
            return await call_next(request)
        hdr = request.headers.get("x-renderer-token") or ""
        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer "):
            hdr = auth.split(" ", 1)[1].strip()
        if hdr != app.state.token:
            return JSONResponse({"detail": "unauthorized"}, status_code=401)
        return await call_next(request)

    @app.get("/health")
    async def health():
        return {"status": "ok" if has_player else "degraded", "player": has_player}

    if not has_player or runtime is None:
        return app

    rt = runtime

    @app.get("/player/state")
    async def player_state():
        return (await rt.build_state()).model_dump(by_alias=True)

    @app.get("/player/queue")
    async def player_queue():
        items, idx, next_idx = await rt.queue.snapshot_with_next()
        return {"itemIds": items, "index": idx, "nextIndex": next_idx}

    @app.post("/player/play")
    async def player_play(body: PlayRequest):
        await rt.play(body.item_id, body.mode.value, body.queue)
        return {"ok": True}

    @app.post("/player/pause")
    async def player_pause():
        await rt.pause()
        return {"ok": True}

    @app.post("/player/resume")
    async def player_resume():
        await rt.resume()
        return {"ok": True}

    @app.post("/player/stop")
    async def player_stop():
        await rt.stop()
        return {"ok": True}

    @app.post("/player/next")
    async def player_next():
        await rt.next()
        return {"ok": True}

    @app.post("/player/previous")
    async def player_previous():
        await rt.previous()
        return {"ok": True}

    @app.post("/player/seek")
    async def player_seek(body: SeekRequest):
        await rt.seek(body.seconds)
        return {"ok": True}

    @app.post("/player/volume")
    async def player_volume(body: VolumeRequest):
        await rt.volume(body.volume)
        return {"ok": True}

    @app.post("/player/queue")
    async def player_queue_set(body: QueueSetRequest):
        await rt.set_queue(body.item_ids)
        return {"ok": True}

    @app.delete("/player/queue/{index}")
    async def player_queue_delete(index: int):
        await rt.remove_queue_item(index)
        return {"ok": True}

    @app.post("/player/queue/reorder")
    async def player_queue_reorder(body: QueueReorderRequest):
        await rt.reorder_queue(body.from_index, body.to_index)
        return {"ok": True}

    @app.post("/player/shuffle")
    async def player_shuffle(payload: dict | None = Body(default=None)):
        en = None
        if payload and "enabled" in payload:
            en = bool(payload["enabled"])
        await rt.shuffle(en)
        return {"ok": True}

    @app.post("/player/repeat")
    async def player_repeat(body: RepeatBody):
        await rt.set_repeat(body.mode)
        return {"ok": True}

    @app.get("/player/events")
    async def player_events():
        async def gen() -> AsyncIterator[bytes]:
            q = rt.subscribe()
            try:
                while True:
                    st = await q.get()
                    line = "data: " + st.model_dump_json(by_alias=True) + "\n\n"
                    yield line.encode()
            finally:
                rt.unsubscribe(q)

        return StreamingResponse(gen(), media_type="text/event-stream")

    return app
