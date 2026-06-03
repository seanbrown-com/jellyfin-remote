# Operations

## Day-to-day usage

- Invoke `script.jf_play_search` with a query to start playback from library search.
- Use transport scripts for immediate control:
  - `script.jf_renderer_pause`
  - `script.jf_renderer_resume`
  - `script.jf_renderer_next`
  - `script.jf_renderer_previous`
  - `script.jf_renderer_stop`
- Use `script.jf_renderer_volume` with a `volume` value (`0..100`).

## Suggested monitoring checks

- Verify renderer health endpoint responds (`/health`).
- Confirm Jellyfin and renderer base URL helpers still point to reachable hosts.
- Watch Home Assistant logs for REST command status codes.

## Safe update pattern

When changing helper values (URLs, keys, tokens):

1. Update helper state.
2. Run a test search call (`script.jf_play_search`).
3. Validate response behavior before exposing commands to household automations.
