# Configuration

## Sources (priority)

1. **Encrypted bundle** (preferred once set up): if `config.enc` and `key.bin` exist under the [data directory](#data-directory), their contents replace YAML on load.
2. **Plaintext YAML**: if `CONFIG_PATH` points to an existing file, it is parsed when encrypted files are absent or incomplete.
3. **Empty defaults**: if neither is present, Jellyfin is unset until you complete [`/admin/setup`](../README.md) or add a file.

Runtime still reads **environment overrides** for listen bind (`RENDERER_HOST`, `RENDERER_PORT`) as implemented in [`main.py`](../src/jf_audio_renderer/main.py).

## Data directory

Controls where `config.enc`, `key.bin`, `admin.bcrypt`, and `session.secret` live.

| Variable | Purpose |
|----------|---------|
| `JF_AUDIO_DATA_DIR` | Preferred explicit directory for encrypted + admin files |
| `JF_DATA_DIR` | Generic fallback if the service-specific variable is unset |
| *(default)* | Parent directory of the `CONFIG_PATH` file (e.g. `/etc/jf-audio` for `/etc/jf-audio/config.yaml`) |

## Plaintext YAML schema

Reference template: [`config.example.yaml`](../config.example.yaml).

### `jellyfin`

| Key | Required | Description |
|-----|----------|-------------|
| `base_url` | Yes | Jellyfin root URL (no trailing slash), e.g. `http://jellyfin:8096` |
| `api_key` | Yes | Long-lived API token from the Jellyfin dashboard |
| `user_id` | Yes | UUID of the Jellyfin user whose library you stream |
| `device_id` | No | Client device id string (default in example) |
| `device_name` | No | Display name for Jellyfin session metadata |

### `renderer`

| Key | Default | Description |
|-----|---------|-------------|
| `host` | `0.0.0.0` | Bind address for the FastAPI/uvicorn HTTP server |
| `port` | `8787` | Listen port |
| `mpv_socket` | `/run/jf-audio/mpv.sock` | mpv `--input-ipc-server` Unix socket path |
| `audio_device` | `alsa/default` | mpv `--audio-device` (use `aplay -L` to pick S/PDIF, e.g. `alsa/iec958`) |
| `default_volume` | `80` | Initial mpv volume 0–100 |
| `api_token` | *(empty)* | If set, **mutating** `/player/*` `POST`/`DELETE` require `X-Renderer-Token` or `Authorization: Bearer …`; `GET` and `/admin` are exempt from this check by design |

## Encrypted files (same logical schema)

The in-memory structure after decrypting `config.enc` matches the YAML sections above. Saving from `/admin/` rewrites `config.enc` only (plus credential sidecars as needed). See [admin-and-security.md](admin-and-security.md).

## Environment variables (summary)

| Variable | Description |
|----------|-------------|
| `CONFIG_PATH` | Path to legacy `config.yaml` (also anchors default data dir) |
| `JF_AUDIO_DATA_DIR`, `JF_DATA_DIR` | Encrypted + admin storage directory |
| `RENDERER_HOST`, `RENDERER_PORT` | Override listen bind without editing config |

`JF_AUDIO_*` nested env vars may also be consumed by `pydantic-settings` for `AppConfig` if you extend env binding (current focus is file + the variables above).
