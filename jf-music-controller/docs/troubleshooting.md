# Troubleshooting

## `503` or “Web UI not built”

- Run `npm ci && npm run build` in `web/` or set `controller.static_dir` to an existing `dist` directory.
- Ensure the process **current working directory** matches paths if you use relative `static_dir`.

## API calls fail with connection errors

- Confirm the BFF is listening (`GET /health`).
- In **dev**, confirm Vite is running and proxy target matches your BFF port.
- Check Jellyfin `base_url` from the server running the controller (DNS, TLS, firewall).

## Playback proxy errors (502 / empty from renderer)

- Verify **JF Audio Renderer** is up: `curl http://<renderer>:8787/health`
- Match `renderer.base_url` (no trailing slash issues) and `renderer.token` with the renderer’s `renderer.api_token` if used.
- Renderer **GET** routes do not need the token; **POST** mutating routes do when token is set.

## Jellyfin search or images empty

- Validate `user_id` and `api_key` in config.
- Inspect Jellyfin logs for permission issues on the chosen user’s library.

## Admin cannot save

- Check write permissions on `JF_MUSIC_DATA_DIR` (or the default data directory).
- Ensure cookies are enabled for the site (session middleware).

## Python 3.9 type errors on import

- Keep `eval-type-backport` installed per [`pyproject.toml`](../pyproject.toml), or move to Python 3.10+.
