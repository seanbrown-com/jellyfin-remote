# HTTP API (BFF)

All routes are relative to the controller base URL (default **`http://<host>:8088`**).

## Health

- `GET /health` — `{ "status": "ok" | "degraded", "jellyfin": true | false }`

## Library (normalized JSON)

These aggregate Jellyfin responses into stable shapes for the web UI:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/library/views` | Recently added, favorites, recently played, playlists, random album |
| `GET` | `/api/artists` | Query params: `start`, `limit` |
| `GET` | `/api/artists/{id}/albums` | |
| `GET` | `/api/albums` | `start`, `limit` |
| `GET` | `/api/albums/{id}` | Album metadata |
| `GET` | `/api/albums/{id}/tracks` | |
| `GET` | `/api/tracks/{id}` | |
| `GET` | `/api/songs` | `start`, `limit` |
| `GET` | `/api/genres` | |
| `GET` | `/api/genres/{id}/albums` | `limit` |
| `GET` | `/api/playlists` | |
| `GET` | `/api/playlists/{id}/tracks` | |
| `GET` | `/api/search?q=...&limit=...` | Buckets: artists, albums, tracks, playlists |
| `GET` | `/api/image/{itemId}?maxWidth=...` | Proxied Jellyfin primary image bytes |

## Player proxy

Forwards to **JF Audio Renderer** (`renderer.base_url`), adding `X-Renderer-Token` when configured:

| Method | Path | Upstream |
|--------|------|----------|
| `GET` | `/api/player/state` | `GET /player/state` |
| `GET` | `/api/player/queue` | `GET /player/queue` |
| `GET` | `/api/player/events` | `GET /player/events` (SSE stream) |
| `POST` | `/api/player/play` | `POST /player/play` (body forwarded) |
| `POST` | `/api/player/pause` | … |
| `POST` | `/api/player/resume` | … |
| `POST` | `/api/player/stop` | … |
| `POST` | `/api/player/next` | … |
| `POST` | `/api/player/previous` | … |
| `POST` | `/api/player/seek` | … |
| `POST` | `/api/player/volume` | … |
| `POST` | `/api/player/queue` | … |
| `DELETE` | `/api/player/queue/{index}` | … |
| `POST` | `/api/player/queue/reorder` | … |
| `POST` | `/api/player/shuffle` | … |
| `POST` | `/api/player/repeat` | … |

Request and response bodies are passed through unchanged where possible so the web client matches the renderer contract described in [jf-audio-renderer docs](../../jf-audio-renderer/docs/api.md).

## SPA fallback

Non-API paths serve the Vite `index.html` and static assets from `controller.static_dir`, except paths under `admin` which return 404 from the SPA handler (admin is served by FastAPI templates).
