# Troubleshooting

## No sound from mpv inside LXC

1. On the **Proxmox host**, confirm the container has `/dev/snd` (or the right device nodes) passed through.
2. Inside the container: `aplay -L` and `aplay -l` — pick the device string that matches S/PDIF / IEC958.
3. Test outside the renderer: `mpv --no-video --audio-device=alsa/<name> /path/to/file.flac`
4. Align `renderer.audio_device` in [configuration.md](configuration.md) with the working mpv string.

## `mpv` fails to create IPC socket

- Ensure the directory for `renderer.mpv_socket` exists and is writable by the service user (systemd `RuntimeDirectory=jf-audio` matches the default path under `/run/jf-audio/`).

## Jellyfin returns 401 / empty `PlaybackInfo`

- Verify `jellyfin.api_key` and `jellyfin.user_id` in config or `/admin/`.
- Confirm `jellyfin.base_url` is reachable from the renderer host (DNS, firewall, HTTPS certs).

## Player API returns 404

- Check `GET /health`: if `"player": false`, Jellyfin was not configured at startup—complete `/admin/setup` or fix `config.yaml` / `config.enc`, then **restart**.

## Admin UI loops or cannot save

- Ensure the browser allows **cookies** for the site (session middleware).
- Check filesystem permissions on the data directory (`0700` / `0600` files).
- If decrypt fails after copying `key.bin` from another machine, regenerate by deleting `config.enc` and `key.bin` and restoring from backup YAML only in a controlled recovery scenario.

## Python 3.9 import errors about union types

- Install `eval-type-backport` (already listed in [`pyproject.toml`](../pyproject.toml)) or upgrade to Python 3.10+ and align type hints project-wide.
