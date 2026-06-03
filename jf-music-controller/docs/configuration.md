# Configuration

## Load order

Same pattern as the renderer:

1. **`config.enc` + `key.bin`** in the data directory → decrypted YAML-equivalent dict.
2. Else **`CONFIG_PATH`** plaintext YAML if the file exists.
3. Else empty → Jellyfin unset until `/admin/setup` or a YAML file is provided.

## Data directory

| Variable | Description |
|----------|-------------|
| `JF_MUSIC_DATA_DIR` | Preferred directory for `config.enc`, `key.bin`, `admin.bcrypt`, `session.secret` |
| `JF_DATA_DIR` | Generic fallback |
| *(default)* | Parent directory of the `CONFIG_PATH` file |

## Plaintext YAML (`config.example.yaml`)

### `jellyfin`

| Key | Required | Description |
|-----|----------|-------------|
| `base_url` | Yes | Jellyfin server URL (no trailing slash) |
| `api_key` | Yes | API key (never sent to the browser; used only server-side) |
| `user_id` | Yes | UUID of the user whose library is browsed |

### `controller`

| Key | Default | Description |
|-----|---------|-------------|
| `host` | `0.0.0.0` | BFF / static bind address |
| `port` | `8088` | Listen port |
| `static_dir` | `web/dist` | Path to Vite production output (relative to cwd or absolute) |

### `renderer` (upstream JF Audio Renderer)

| Key | Default | Description |
|-----|---------|-------------|
| `base_url` | `http://127.0.0.1:8787` | Base URL of the renderer HTTP API |
| `token` | *(empty)* | If set, sent as `X-Renderer-Token` on every proxied request to the renderer |

## Environment overrides

| Variable | Overrides |
|----------|-----------|
| `CONFIG_PATH` | Legacy YAML path (and default data dir parent) |
| `JF_MUSIC_DATA_DIR`, `JF_DATA_DIR` | Encrypted + admin storage |
| `CONTROLLER_HOST`, `CONTROLLER_PORT` | Listen bind without editing files |

## Behavior when Jellyfin is missing

If Jellyfin is not configured at startup, the music **API** and **SPA** are not mounted; **`/`** redirects to **`/admin/setup`**. `GET /health` reports `"jellyfin": false`. After fixing configuration, **restart** the process.
