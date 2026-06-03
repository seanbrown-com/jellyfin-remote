# Admin UI and security

## URLs

| Path | Purpose |
|------|---------|
| `/admin/setup` | First-time bootstrap when `admin.bcrypt` does not exist: set admin password + full configuration; writes encrypted store |
| `/admin/login` | Sign in with admin password |
| `/admin/` | Dashboard: edit all settings; optional password change |
| `/admin/logout` | Clear session cookie |
| `/admin` | Redirects to `/admin/` |
| `POST /admin/save` | Persist dashboard form to encrypted store |
| `POST /admin/restart` | After a signed-in session: re-exec the same process (Unix/macOS/Linux) so listen address, Jellyfin, mpv socket, etc. reload from disk; brief playback interruption |

## On-disk artifacts (data directory)

All are intended to be **non-plaintext** for secrets or opaque for configuration:

| File | Permissions | Description |
|------|-------------|-------------|
| `config.enc` | `0600` | Fernet-encrypted YAML payload |
| `key.bin` | `0600` | 32 raw bytes; Fernet key is derived as URL-safe base64 of these bytes |
| `admin.bcrypt` | `0600` | bcrypt hash of the admin password |
| `session.secret` | `0600` | Random string used to sign the Starlette session cookie |

The data directory is created mode `0700` when first written. See [configuration.md](configuration.md) for how the directory is chosen.

## Session cookies

The admin UI uses **signed server-side sessions** (`SessionMiddleware`). The signing secret is **not** the admin password; it lives in `session.secret`. Rotate by deleting that file and restarting (a new secret will be generated on next request that needs it—users will need to sign in again).

## Restart from the admin dashboard

After **Save** on `/admin/`, startup-bound settings (listen host/port, Jellyfin, mpv IPC socket, audio device, etc.) are only read when the process starts. Use **Restart service now** on the dashboard: the app finishes the HTTP response, then replaces itself with the same command line (`os.execvp`), which matches typical `jf-audio-renderer` / systemd deployments.

- **Windows:** the button is shown, but in-process restart is not supported; stop and start the service manually.
- **Alternative:** `systemctl restart jf-audio-renderer` (or equivalent) still works if you prefer the supervisor to recycle the process.

## Renderer playback token (`renderer.api_token`)

If `renderer.api_token` is set in configuration:

- **GET** routes (including `/player/state`, `/player/queue`, `/player/events` SSE) do **not** require the token (LAN / kiosk / browser `EventSource` without custom headers).
- **POST** / **DELETE** on `/player/*` require `X-Renderer-Token: <token>` or `Authorization: Bearer <token>`.

`/admin` routes are **not** gated by this token (they use the separate admin session).

## Operational notes

- After saving configuration in `/admin/`, use **Restart service** on the dashboard (or `systemctl restart …`) so uvicorn, Jellyfin client, and mpv pick up listen address, Jellyfin URL, and device/socket changes.
- You may delete plaintext `config.yaml` after confirming encrypted startup, if you no longer want a readable file on disk.

## Threat model (short)

This stack assumes a **trusted LAN** or VPN. It does not implement rate limiting on admin login, HTTPS termination, or CSRF tokens for the admin forms. Put the service behind a reverse proxy with TLS and access control if it is exposed beyond your home network.
