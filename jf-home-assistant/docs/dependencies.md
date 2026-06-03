# Dependencies

## Home Assistant

- Home Assistant **2024.2+** is required because `rest_command` responses are consumed via `response_variable` in scripts.
- YAML packages must be enabled in `configuration.yaml` (`homeassistant.packages`).

## Network reachability

The HA instance must reach:

- Jellyfin HTTP API (example: `http://192.168.1.10:8096`)
- `jf-audio-renderer` API (example: `http://192.168.1.20:8787`)

## Service-level requirements

- A valid Jellyfin `user_id` and API key (`X-Emby-Token`) for library search calls.
- Optional renderer token (`X-Renderer-Token`) if `renderer.api_token` is configured.

## Optional capabilities

- Home Assistant Assist sentence triggers for natural-language command capture.
- Alexa routines for fixed transport controls (pause, next, stop), noting free-text song queries are not passed to HA scripts by stock Alexa Smart Home.
