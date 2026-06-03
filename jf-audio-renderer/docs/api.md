# HTTP API (playback)

Base URL: `http://<host>:<port>/` (default port **8787**).

## Health

- `GET /health` — JSON `{ "status": "ok" | "degraded", "player": true | false }`. `degraded` means Jellyfin is not configured (player routes are not mounted).

## Playback and queue

When Jellyfin **is** configured, the following match the whole-home plan (see also [`jellyfin_wholehome_audio_plan.md`](../../../jellyfin_wholehome_audio_plan.md) in the parent workspace):

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/player/state` | Current player snapshot (camelCase JSON) |
| `GET` | `/player/queue` | `{ "itemIds": [...], "index": n }` |
| `POST` | `/player/play` | Body: `itemId` (optional), `mode` (`replaceQueue` \| `append` \| `playNow`), `queue` (Jellyfin item id strings) |
| `POST` | `/player/pause`, `/player/resume`, `/player/stop` | |
| `POST` | `/player/next`, `/player/previous` | |
| `POST` | `/player/seek` | `{ "seconds": number }` |
| `POST` | `/player/volume` | `{ "volume": 0–100 }` |
| `POST` | `/player/queue` | Replace queue: `{ "itemIds": [...] }` |
| `DELETE` | `/player/queue/{index}` | Remove one entry |
| `POST` | `/player/queue/reorder` | `{ "fromIndex", "toIndex" }` |
| `POST` | `/player/shuffle` | Optional `{ "enabled": bool }`; omit body to toggle |
| `POST` | `/player/repeat` | `{ "mode": "none" \| "one" \| "all" }` |
| `GET` | `/player/events` | **Server-Sent Events** stream of player state JSON |

## Authentication (optional)

If `renderer.api_token` is non-empty, mutating player requests must include that token (see [admin-and-security.md](admin-and-security.md)).

## Jellyfin streaming (internal)

The service resolves Jellyfin item ids to stream URLs via the server REST API (`PlaybackInfo` + audio stream URL). Clients only need Jellyfin **item ids** in the queue; they do not talk to Jellyfin directly for playback.
