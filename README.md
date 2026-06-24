# Jellyfin whole-home audio (local workspace)

This folder contains three cooperating components for the plan in [`jellyfin_wholehome_audio_plan.md`](jellyfin_wholehome_audio_plan.md):

| Directory | Role | Documentation |
|-----------|------|----------------|
| [`jf-audio-renderer/`](jf-audio-renderer/) | Headless Jellyfin → **mpv** (ALSA / S/PDIF, queues, SSE) | [README](jf-audio-renderer/README.md) · [docs/](jf-audio-renderer/docs/README.md) |
| [`jf-music-controller/`](jf-music-controller/) | **Web UI + BFF** (browse Jellyfin, proxy playback to the renderer) | [README](jf-music-controller/README.md) · [docs/](jf-music-controller/docs/README.md) |
| [`jf-home-assistant/`](jf-home-assistant/) | **Home Assistant package** (REST + scripts: Jellyfin search, play on renderer, transport) | [README](jf-home-assistant/README.md) · [docs/](jf-home-assistant/docs/README.md) |

Upstream references: [jellyfin](https://github.com/jellyfin/jellyfin), [jellyfin-web](https://github.com/jellyfin/jellyfin-web), [jellyfin-androidtv](https://github.com/jellyfin/jellyfin-androidtv), [jellyfin-mpv-shim](https://github.com/jellyfin/jellyfin-mpv-shim).

## Proxmox LXC deployment

For a dedicated Debian LXC that runs both the renderer and controller, see [`docs/proxmox-lxc-deployment.md`](docs/proxmox-lxc-deployment.md).

Fresh install inside the LXC:

```bash
apt-get update && apt-get install -y ca-certificates curl
curl -fsSL https://raw.githubusercontent.com/seanbrown-com/jellyfin-remote/main/scripts/install-lxc-suite.sh | bash
```

Update later:

```bash
/opt/jellyfin-remote-src/scripts/update-lxc-suite.sh
```
