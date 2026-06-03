# Dependencies

## Python (backend / BFF)

From [`pyproject.toml`](../pyproject.toml), installed with `pip install -e .`:

| Package | Role |
|---------|------|
| `fastapi`, `uvicorn[standard]` | HTTP API, static file hosting for `web/dist`, ASGI server |
| `httpx` | Server-side calls to Jellyfin and to the JF Audio Renderer |
| `pydantic`, `pydantic-settings` | Configuration models |
| `pyyaml` | Legacy plaintext YAML |
| `cryptography`, `bcrypt`, `jinja2`, `python-multipart`, `itsdangerous`, `eval-type-backport` | Admin UI, encrypted config (same stack as the renderer) |

**Python:** `>=3.9` (see renderer docs for `eval-type-backport` rationale).

## Node.js (frontend build)

Required to **build** the React/Vite UI under [`web/`](../web/):

| Tool | Typical version | Role |
|------|-----------------|------|
| **Node.js** | 18+ (Debian 12 ships a usable default) | `npm ci`, `npm run build` |
| **npm** | Bundled with Node | Lockfile installs |

Runtime **does not** require Node if you only deploy prebuilt `web/dist` from CI or another machine.

## System

- **curl** (optional): smoke tests against `/health` and `/api/...`
- **Network** reachability to **Jellyfin** and to **JF Audio Renderer** from the host running this service

## Related repositories

- [Jellyfin server](https://github.com/jellyfin/jellyfin) — library and REST API  
- [JF Audio Renderer](../../jf-audio-renderer/) — playback engine this UI controls  
