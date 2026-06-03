# Dependencies

## Runtime (Python)

Declared in [`pyproject.toml`](../pyproject.toml) and installed with `pip install -e .`:

| Package | Role |
|---------|------|
| `fastapi`, `uvicorn[standard]` | HTTP API and ASGI server |
| `httpx` | Jellyfin REST calls |
| `pydantic`, `pydantic-settings` | Configuration models |
| `pyyaml` | YAML parsing for legacy/plaintext config |
| `cryptography` | Fernet encryption for `config.enc` |
| `bcrypt` | Admin password hashing (`admin.bcrypt`) |
| `jinja2` | Admin HTML templates |
| `python-multipart` | Form posts for admin UI |
| `itsdangerous` | Session signing (used by Starlette sessions) |
| `eval-type-backport` | Python 3.9 compatibility for Pydantic v2 union types |

**Python version:** `>=3.9` (3.10+ recommended if you drop `eval-type-backport` and use modern union syntax everywhere).

## System (host or container)

| Component | Purpose |
|-----------|---------|
| **`mpv`** | Actual audio decode and output; controlled via JSON IPC over a Unix socket |
| **ALSA** (`alsa-utils`, `/dev/snd`) | Typical path to S/PDIF / `iec958`; device names vary by hardware |
| **`curl` / `jq`** (optional) | Manual API testing |

There is **no** bundled `ffmpeg` requirement in the renderer itself; Jellyfin may transcode depending on server settings.

## Development-only

- A working Jellyfin server and a user **API key** for testing streams.
- For editing: any editor; optional `ruff`/`mypy` if you extend the project.

## Related repository

The renderer does **not** bundle the Jellyfin server. See the [Jellyfin server](https://github.com/jellyfin/jellyfin) repository for server dependencies.
