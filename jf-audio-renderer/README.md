# JF Audio Renderer

Headless Jellyfin music renderer: **FastAPI** controls **mpv** over JSON IPC and plays Jellyfin audio streams (for example to ALSA S/PDIF).

## Documentation

The full guide is under [`docs/`](docs/README.md): [dependencies](docs/dependencies.md), [installation](docs/installation.md), [configuration](docs/configuration.md), [admin and security](docs/admin-and-security.md), [HTTP API](docs/api.md), [troubleshooting](docs/troubleshooting.md).

See also `config.example.yaml` and `scripts/lxc-setup-debian.sh`.

## Quick start (development)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp config.example.yaml config.yaml
# edit config.yaml — set jellyfin.base_url, api_key, user_id, renderer.audio_device
export CONFIG_PATH=$PWD/config.yaml
jf-audio-renderer
```

Defaults: listen on `0.0.0.0:8787`. Override with `RENDERER_HOST` / `RENDERER_PORT`.

## API

See `jellyfin_wholehome_audio_plan.md` in the parent folder for the full endpoint list. `GET /player/events` streams **Server-Sent Events** (`text/event-stream`).

If `renderer.api_token` is set in config, **mutating** requests (`POST`, `DELETE`, …) must send `X-Renderer-Token` or `Authorization: Bearer …`. `GET` (including state, queue, and SSE) stays open for LAN/kiosk use.

## Encrypted configuration and admin UI

- **Web admin:** `http://<host>:<port>/admin/` — first visit uses **Setup** (admin password + full settings). After that, use **Sign in** to edit and **Save** (writes encrypted blobs only).
- **Data directory** (default: same directory as `CONFIG_PATH`): set explicitly with `JF_AUDIO_DATA_DIR` or generic `JF_DATA_DIR`.
- **On-disk secrets (not human-readable):**
  - `config.enc` — Fernet-encrypted YAML payload (opaque binary).
  - `key.bin` — 32 random bytes used to derive the Fernet key (`chmod 600`).
  - `admin.bcrypt` — bcrypt password hash (binary).
  - `session.secret` — cookie signing secret for the admin session.
- **Plaintext `config.yaml`:** still supported for first boot; once you save from the admin UI, remove `config.yaml` if you want everything only in encrypted form.
- **Restart** after changing listen address/port or Jellyfin settings: use **Restart service** on `/admin/` (Unix/macOS/Linux) or restart the systemd unit / process manually.
