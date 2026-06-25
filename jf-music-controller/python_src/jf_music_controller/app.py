from __future__ import annotations

import random
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response, StreamingResponse

from jf_music_controller.admin_portal import register_admin
from jf_music_controller.config import AppConfig
from jf_music_controller.jellyfin import JellyfinBrowser
from jf_music_controller.secure_store import SecurePaths


def create_app(cfg: AppConfig, paths: SecurePaths) -> FastAPI:
    has = cfg.jellyfin is not None
    jf: JellyfinBrowser | None = None
    render: httpx.AsyncClient | None = None
    rh: dict[str, str] = {}

    if has:
        assert cfg.jellyfin is not None
        jf = JellyfinBrowser(cfg.jellyfin)
        render = httpx.AsyncClient(base_url=cfg.renderer.base_url.rstrip("/"), timeout=httpx.Timeout(120.0))
        tok = cfg.renderer.token.strip()
        if tok:
            rh["X-Renderer-Token"] = tok

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.cfg = cfg
        app.state.manual_queue = []
        if has and jf is not None and render is not None:
            app.state.jf = jf
            app.state.render = render
            app.state.render_headers = rh
        try:
            yield
        finally:
            if jf is not None:
                await jf.aclose()
            if render is not None:
                await render.aclose()

    app = FastAPI(title="JF Music Controller", lifespan=lifespan)
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

    @app.get("/health")
    async def health():
        return {"status": "ok" if has else "degraded", "jellyfin": has}

    if not has or jf is None or render is None:

        @app.get("/")
        async def root_redirect():
            return RedirectResponse("/admin/setup", status_code=302)

        return app

    static_dir = Path(cfg.controller.static_dir)
    index = static_dir / "index.html"

    @app.get("/api/library/views")
    async def library_views():
        recent_albums = await jf.recently_added_albums(24)
        favorite_albums = await jf.favorite_albums(24)
        recently_played = await jf.recently_played(16)
        playlists = await jf.playlists()
        pool = await jf.albums(limit=80)
        random_album = random.choice(pool) if pool else None
        return {
            "recentlyAddedAlbums": recent_albums,
            "favoriteAlbums": favorite_albums,
            "recentlyPlayed": recently_played,
            "playlists": playlists,
            "randomAlbum": random_album,
        }

    @app.get("/api/artists")
    async def api_artists(start: int = 0, limit: int = 100):
        return await jf.artists(start_index=start, limit=limit)

    @app.get("/api/artists/{artist_id}/albums")
    async def api_artist_albums(artist_id: str):
        return await jf.artist_albums(artist_id)

    @app.get("/api/albums")
    async def api_albums(start: int = 0, limit: int = 48):
        return await jf.albums(start_index=start, limit=limit)

    @app.get("/api/albums/{album_id}")
    async def api_album(album_id: str):
        return await jf.album_detail(album_id)

    @app.get("/api/albums/{album_id}/tracks")
    async def api_album_tracks(album_id: str):
        return await jf.album_tracks(album_id)

    @app.get("/api/tracks/{track_id}")
    async def api_track(track_id: str):
        return await jf.track_detail(track_id)

    @app.get("/api/songs")
    async def api_songs(start: int = 0, limit: int = 100):
        return await jf.songs(start_index=start, limit=limit)

    @app.get("/api/genres")
    async def api_genres():
        return await jf.genres()

    @app.get("/api/genres/{genre_id}/albums")
    async def api_genre_albums(genre_id: str, limit: int = 100):
        return await jf.genre_items(genre_id, limit=limit)

    @app.get("/api/playlists")
    async def api_playlists():
        return await jf.playlists()

    @app.get("/api/playlists/{playlist_id}/tracks")
    async def api_playlist_tracks(playlist_id: str):
        return await jf.playlist_tracks(playlist_id)

    @app.get("/api/search")
    async def api_search(q: str, limit: int = 30):
        return await jf.search(q, limit=limit)

    @app.get("/api/image/{item_id}")
    async def api_image(item_id: str, maxWidth: int = 480):
        data, ct = await jf.fetch_primary_image(item_id, max_width=maxWidth)
        return Response(content=data, media_type=ct)

    @app.get("/api/player/state")
    async def api_player_state():
        r = await render.get("/player/state", headers=rh)
        return Response(r.content, status_code=r.status_code, media_type="application/json")

    @app.get("/api/player/queue")
    async def api_player_queue():
        r = await render.get("/player/queue", headers=rh)
        return Response(r.content, status_code=r.status_code, media_type="application/json")

    @app.get("/api/player/events")
    async def api_player_events():
        async def gen():
            async with render.stream("GET", "/player/events", headers=rh) as upstream:
                async for chunk in upstream.aiter_bytes():
                    yield chunk

        return StreamingResponse(gen(), media_type="text/event-stream")

    async def _proxy_player_post(request: Request, upstream_path: str) -> Response:
        body = await request.body()
        ct = request.headers.get("content-type", "application/json")
        r = await render.post(upstream_path, content=body, headers={**rh, "content-type": ct})
        return Response(r.content, status_code=r.status_code, media_type="application/json")

    @app.post("/api/player/play")
    async def api_player_play(request: Request):
        payload = await request.json()
        item_id = payload.get("itemId")
        if payload.get("defaultQueue") and item_id and payload.get("mode") == "replaceQueue":
            payload["queue"] = await jf.default_queue_for_track(str(item_id))
            payload.pop("defaultQueue", None)
        if payload.get("mode") == "replaceQueue":
            request.app.state.manual_queue = []
        r = await render.post("/player/play", json=payload, headers=rh)
        return Response(r.content, status_code=r.status_code, media_type="application/json")

    @app.post("/api/player/enqueue")
    async def api_player_enqueue(request: Request):
        payload = await request.json()
        item_ids = [str(x) for x in payload.get("queue") or [] if x]
        item_id = payload.get("itemId")
        if item_id and str(item_id) not in item_ids:
            item_ids = [str(item_id)] + item_ids
        if not item_ids:
            return JSONResponse({"ok": False, "detail": "No item ids supplied."}, status_code=400)

        qr = await render.get("/player/queue", headers=rh)
        if qr.status_code >= 400:
            return Response(qr.content, status_code=qr.status_code, media_type="application/json")
        current = qr.json()
        existing = [str(x) for x in current.get("itemIds") or []]
        index = int(current.get("index") or 0)
        if not existing:
            next_items = item_ids
            request.app.state.manual_queue = item_ids
        else:
            insert_at = max(0, min(index + 1, len(existing)))
            head = existing[:insert_at]
            remaining = existing[insert_at:]
            manual = [x for x in request.app.state.manual_queue if x in remaining and x not in item_ids]
            manual.extend(item_ids)
            manual_set = set(manual)
            tail = [x for x in remaining if x not in manual_set]
            next_items = head + manual + tail
            request.app.state.manual_queue = manual

        r = await render.post("/player/queue", json={"itemIds": next_items}, headers=rh)
        return Response(r.content, status_code=r.status_code, media_type="application/json")

    @app.post("/api/player/pause")
    async def api_player_pause(request: Request):
        return await _proxy_player_post(request, "/player/pause")

    @app.post("/api/player/resume")
    async def api_player_resume(request: Request):
        return await _proxy_player_post(request, "/player/resume")

    @app.post("/api/player/stop")
    async def api_player_stop(request: Request):
        return await _proxy_player_post(request, "/player/stop")

    @app.post("/api/player/next")
    async def api_player_next(request: Request):
        return await _proxy_player_post(request, "/player/next")

    @app.post("/api/player/previous")
    async def api_player_previous(request: Request):
        return await _proxy_player_post(request, "/player/previous")

    @app.post("/api/player/seek")
    async def api_player_seek(request: Request):
        return await _proxy_player_post(request, "/player/seek")

    @app.post("/api/player/volume")
    async def api_player_volume(request: Request):
        return await _proxy_player_post(request, "/player/volume")

    @app.post("/api/player/queue")
    async def api_player_queue_set(request: Request):
        return await _proxy_player_post(request, "/player/queue")

    @app.delete("/api/player/queue/{index}")
    async def api_player_queue_delete(index: int):
        r = await render.delete(f"/player/queue/{index}", headers=rh)
        return Response(r.content, status_code=r.status_code, media_type="application/json")

    @app.post("/api/player/queue/reorder")
    async def api_player_queue_reorder(request: Request):
        return await _proxy_player_post(request, "/player/queue/reorder")

    @app.post("/api/player/shuffle")
    async def api_player_shuffle(request: Request):
        return await _proxy_player_post(request, "/player/shuffle")

    @app.post("/api/player/repeat")
    async def api_player_repeat(request: Request):
        return await _proxy_player_post(request, "/player/repeat")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        if full_path.startswith("admin"):
            return Response("Not Found", status_code=404, media_type="text/plain")
        if not index.is_file():
            return Response(
                "Web UI not built. Run `npm ci && npm run build` in web/ or point controller.static_dir to dist.",
                media_type="text/plain",
                status_code=503,
            )
        target = static_dir / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        return FileResponse(index)

    return app
