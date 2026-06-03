# JF Music Controller

Touch-first web UI (Finamp-inspired) plus a small **FastAPI BFF** that:

- talks to your [Jellyfin](https://github.com/jellyfin/jellyfin) server with the API key **server-side**, and  
- proxies playback commands to **[JF Audio Renderer](../jf-audio-renderer/)** on the LAN.

## Documentation

The full guide is under [`docs/`](docs/README.md): [dependencies](docs/dependencies.md), [installation](docs/installation.md) (dev, production, LXC, systemd), [configuration](docs/configuration.md), [admin and security](docs/admin-and-security.md), [BFF API](docs/api.md), [frontend / Vite](docs/frontend.md), [troubleshooting](docs/troubleshooting.md).

## Development

Terminal A (from `jf-music-controller/`, after `cp config.example.yaml config.yaml` and editing it):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
export CONFIG_PATH=$PWD/config.yaml
jf-music-controller
```

Terminal B:

```bash
cd web
npm install
npm run dev
```

Vite proxies `/api` → `http://127.0.0.1:8088`. Open the URL Vite prints (usually `http://127.0.0.1:5173`).

## Production (single process)

Build the UI and run the app from the repo root so `web/dist` matches `controller.static_dir`:

```bash
(cd web && npm ci && npm run build)
export CONFIG_PATH=$PWD/config.yaml
jf-music-controller
```

Then open `http://<host>:8088`.

## LXC / appliance

See `scripts/lxc-setup-debian.sh` and `scripts/systemd/jf-music-controller.service`.

## Encrypted configuration and admin UI

- **Web admin:** `http://<host>:<port>/admin/` — **Setup** creates the admin password and encrypted store; **Sign in** edits Jellyfin, controller listen/static paths, and renderer URL/token.
- **Data directory:** `JF_MUSIC_DATA_DIR` or `JF_DATA_DIR` (default: directory containing `CONFIG_PATH`).
- **Files:** `config.enc` (Fernet ciphertext), `key.bin` (32-byte key material), `admin.bcrypt` (bcrypt hash), `session.secret` (cookie signing). All are non-plaintext on disk.
- Remove legacy `config.yaml` after you confirm encrypted startup. **Restart** after changing listen host/port or static directory: use **Restart service** on `/admin/` (Unix/macOS/Linux) or restart the process manually.
