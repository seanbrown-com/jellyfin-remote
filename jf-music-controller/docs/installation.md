# Installation

## Local development (two terminals)

### Backend (Python)

From [`jf-music-controller/`](../):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e .
cp config.example.yaml config.yaml
# Edit jellyfin.* and renderer.base_url (point at running JF Audio Renderer)
export CONFIG_PATH="$PWD/config.yaml"
jf-music-controller
```

Default listen: `0.0.0.0:8088` (`controller.host` / `controller.port`), overridable with `CONTROLLER_HOST` and `CONTROLLER_PORT`.

### Frontend (Vite)

```bash
cd web
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8088`. Open the dev URL (commonly port **5173**). Details: [frontend.md](frontend.md).

## Production (single Python process)

Build static assets from the repo root:

```bash
cd web && npm ci && npm run build && cd ..
export CONFIG_PATH="$PWD/config.yaml"
jf-music-controller
```

Then open `http://<host>:8088`. The BFF serves `web/dist` from `controller.static_dir` (see [configuration.md](configuration.md)).

## Proxmox LXC (Debian)

Script (run **inside** the LXC as root): [`scripts/lxc-setup-debian.sh`](../scripts/lxc-setup-debian.sh)

```bash
./scripts/lxc-setup-debian.sh /path/to/jf-music-controller-source
```

Installs Python + Node, runs `npm ci && npm run build` in `web/`, copies to `/opt/jf-music-controller`, seeds `/etc/jf-music/config.yaml` if missing, installs systemd.

This container does **not** need `/dev/snd` (only the renderer does).

## systemd

Example: [`scripts/systemd/jf-music-controller.service`](../scripts/systemd/jf-music-controller.service).

Useful environment variables:

- `CONFIG_PATH=/etc/jf-music/config.yaml`
- `JF_MUSIC_DATA_DIR=/etc/jf-music`
- `CONTROLLER_HOST`, `CONTROLLER_PORT`

Restart after changing listen bind, static directory, Jellyfin, or renderer URL in config or `/admin/`.

## Encrypted configuration

Optional web setup at `/admin/`; see [admin-and-security.md](admin-and-security.md).
