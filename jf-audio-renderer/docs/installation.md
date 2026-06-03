# Installation

## Local development (Python venv)

From the [`jf-audio-renderer`](../) directory:

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -e .
```

Copy and edit configuration:

```bash
cp config.example.yaml config.yaml
# Edit jellyfin.* and renderer.audio_device at minimum
export CONFIG_PATH="$PWD/config.yaml"
jf-audio-renderer
```

The process listens on `0.0.0.0:8787` by default (`renderer.host` / `renderer.port`), overridable with `RENDERER_HOST` and `RENDERER_PORT`.

See [configuration.md](configuration.md) for all keys and [admin-and-security.md](admin-and-security.md) for the optional encrypted store and `/admin/` UI.

## Production (manual)

1. Install system packages: `mpv`, ALSA libraries / `alsa-utils`, Python 3.9+.
2. Install the app in a venv under e.g. `/opt/jf-audio-renderer` (`pip install -e .` from a copy of the source tree).
3. Set `CONFIG_PATH` (and optionally `JF_AUDIO_DATA_DIR`) in the environment or systemd unit.
4. Ensure the mpv IPC socket parent directory exists and is writable (see `renderer.mpv_socket` in [configuration.md](configuration.md)).
5. Run `jf-audio-renderer` behind systemd (see below).

## Proxmox LXC (Debian)

Use the scripted install (run **inside** the LXC as root):

- Script: [`scripts/lxc-setup-debian.sh`](../scripts/lxc-setup-debian.sh)
- Usage: `./scripts/lxc-setup-debian.sh /path/to/jf-audio-renderer-source`

The script installs APT dependencies, creates a venv, copies the tree to `/opt/jf-audio-renderer`, seeds `/etc/jf-audio/config.yaml` from `config.example.yaml` if missing, and installs the systemd unit.

**Host prerequisites:** pass `/dev/snd` (or equivalent) into the LXC; exact Proxmox `lxc.conf` lines depend on your version—comments in the script summarize the idea. Validate with `aplay -L` inside the container before relying on Jellyfin playback.

## systemd

Example unit: [`scripts/systemd/jf-audio-renderer.service`](../scripts/systemd/jf-audio-renderer.service).

Typical environment variables:

- `CONFIG_PATH=/etc/jf-audio/config.yaml` (legacy plaintext path; still used to resolve the default data directory)
- `JF_AUDIO_DATA_DIR=/etc/jf-audio` (encrypted files + admin material)
- `RENDERER_HOST`, `RENDERER_PORT` (optional overrides)

After changing listen address or Jellyfin-related settings via the admin UI or files, **restart** the unit.

## First-time admin / encrypted config

If you use the web admin at `/admin/` to create encrypted storage, you can remove plaintext `config.yaml` once you have verified a restart with `config.enc` + `key.bin` present. Details: [admin-and-security.md](admin-and-security.md).
