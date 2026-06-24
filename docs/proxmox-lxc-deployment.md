# Proxmox LXC deployment

This app suite is best deployed in a dedicated Debian LXC that owns the host audio device. Jellyfin stays in its existing LXC and is reached over the LAN.

## Recommended LXC settings

- **Template:** Debian 13 standard
- **Hostname:** `jf-remote-audio` or similar
- **CPU:** 1-2 cores
- **Memory:** 1 GiB minimum, 2 GiB comfortable
- **Swap:** 512 MiB-1 GiB
- **Disk:** 8 GiB minimum, 16 GiB comfortable
- **Network:** static DHCP reservation or static IP
- **Features:** nesting off unless you need it for unrelated tooling
- **Privilege:** prefer unprivileged first; use privileged only if your audio passthrough requires it
- **Startup:** start on boot after the Jellyfin LXC

## Audio passthrough

On the Proxmox host, add sound device passthrough to the LXC config at `/etc/pve/lxc/<vmid>.conf`.

Common lines:

```text
lxc.cgroup2.devices.allow: c 116:* rwm
lxc.mount.entry: /dev/snd dev/snd none bind,optional,create=dir
```

After starting the LXC, verify inside the container:

```bash
aplay -L
```

Pick the desired ALSA device in the renderer admin UI or `/etc/jf-audio/config.yaml`, for example `alsa/iec958` for S/PDIF when available.

## Fresh install

Run inside the LXC as root:

```bash
apt-get update && apt-get install -y ca-certificates curl
curl -fsSL https://raw.githubusercontent.com/seanbrown-com/jellyfin-remote/main/scripts/install-lxc-suite.sh | bash
```

The installer clones the repo to `/opt/jellyfin-remote-src`, deploys:

- `/opt/jf-audio-renderer`
- `/opt/jf-music-controller`

and preserves configuration under:

- `/etc/jf-audio`
- `/etc/jf-music`

## Configure

Open:

```text
http://<lxc-ip>:8787/admin/
http://<lxc-ip>:8088/admin/
```

Use your Jellyfin LXC URL, for example:

```text
http://<jellyfin-lxc-ip>:8096
```

For the controller, set the renderer URL to:

```text
http://127.0.0.1:8787
```

Then restart:

```bash
systemctl restart jf-audio-renderer jf-music-controller
```

## Update

Run inside the LXC as root:

```bash
/opt/jellyfin-remote-src/scripts/update-lxc-suite.sh
```

The updater pulls the configured branch, rebuilds the web UI, reinstalls both Python packages, keeps `/etc/jf-audio` and `/etc/jf-music`, then restarts both services.

## Troubleshooting

Check services:

```bash
systemctl status jf-audio-renderer --no-pager
systemctl status jf-music-controller --no-pager
```

Follow logs:

```bash
journalctl -u jf-audio-renderer -u jf-music-controller -f
```

Check audio:

```bash
aplay -L
speaker-test -D default -c 2
```
