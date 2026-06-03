# Troubleshooting

## No playback starts

- Confirm `input_text.jf_renderer_base_url` is correct and reachable from HA.
- If renderer token is enabled, verify `input_text.jf_renderer_api_token` matches renderer config.
- Call a transport script (for example `script.jf_renderer_pause`) and inspect HA logs for HTTP status.

## Search returns no matches

- Confirm Jellyfin `base_url`, `user_id`, and API key helpers are correct.
- Test with a broad query (artist name) to validate API connectivity.
- Check Jellyfin user permissions and library visibility.

## YAML/template errors

- Validate package YAML with Home Assistant configuration check.
- Ensure your package loading mode matches the file shape (`jf_wholehome:` top-level mapping).
- Verify Home Assistant version is 2024.2+ for `response_variable` script usage.

## Response parsing issues

- If REST responses are not parsed as JSON, inspect returned content type and payload in logs.
- Keep query text simple during initial verification (no punctuation-heavy strings).

## Alexa phrase works for pause but not play-by-name

This is expected under stock Alexa Smart Home exposure. Use Assist sentence flow for dynamic free-text song requests.
