# Admin UI and security

## Routes

| Path | Purpose |
|------|---------|
| `/admin/setup` | Initial bootstrap: admin password + Jellyfin + controller + renderer fields → encrypted store |
| `/admin/login` | Password sign-in |
| `/admin/` | Dashboard (edit all settings; optional new admin password) |
| `/admin/logout` | Clear session |
| `/admin` | Redirect to `/admin/` |
| `POST /admin/save` | Persist dashboard form to encrypted store |
| `POST /admin/restart` | Signed-in only: re-exec the process on Unix/macOS/Linux so listen address, static root, Jellyfin, and renderer URL reload from disk |

## Restart from the admin dashboard

After **Save**, settings that are read only at startup require a process restart. Use **Restart service now** on the dashboard (same mechanism as the renderer: `os.execvp` after the HTTP response completes). **Windows:** in-process restart is not supported; stop and start manually. **`systemctl restart jf-music-controller`** remains valid on Linux appliances.

## On-disk files (data directory)

| File | Description |
|------|-------------|
| `config.enc` | Fernet-encrypted configuration blob |
| `key.bin` | 32-byte key material for Fernet |
| `admin.bcrypt` | bcrypt password hash |
| `session.secret` | Session cookie signing secret |

See [configuration.md](configuration.md) for directory selection. Files are written with restrictive permissions (`0600` / `0700` on directories).

## Credentials and secrets

- **Jellyfin API key** exists only in encrypted or YAML config and in process memory; the React app calls **`/api/*`** on this BFF only, not Jellyfin directly with the key.
- **Renderer token** is stored the same way and forwarded as `X-Renderer-Token` when non-empty.
- **Admin password** is never stored in plaintext; only `admin.bcrypt`.

## Session scope

The Starlette session protects **admin** pages only. It does not replace Jellyfin authentication for end users (the kiosk/browser uses this service as a shared appliance; tighten with network controls or future auth if needed).

## Hardening

For internet exposure, terminate TLS at a reverse proxy, restrict source IPs, and consider adding rate limits and CSRF protection to `/admin` forms (not implemented in the current MVP).
