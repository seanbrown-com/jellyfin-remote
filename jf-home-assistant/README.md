# jellyfin-remote (Home Assistant + `jf-audio-renderer`)

YAML package for [Home Assistant](https://www.home-assistant.io/) that drives your **[JF Audio Renderer](../jf-audio-renderer/)** over HTTP and runs **Jellyfin library search** (REST + scripts) so you can play by query from HA.

## Documentation

Full handoff docs are in [`docs/`](docs/README.md):

- [dependencies](docs/dependencies.md)
- [installation](docs/installation.md)
- [configuration](docs/configuration.md)
- [voice and alexa behavior](docs/voice-and-alexa.md)
- [operations](docs/operations.md)
- [troubleshooting](docs/troubleshooting.md)

## Requirements

- Home Assistant **2024.2+** (uses `response_variable` on `rest_command` to parse Jellyfin JSON in scripts).
- Network path from HA to **Jellyfin** and to **`jf-audio-renderer`** (same LAN is typical).
- Renderer optional **`X-Renderer-Token`** if you set `renderer.api_token` on the renderer.

## Install

1. Copy [`packages/jf_wholehome.yaml`](packages/jf_wholehome.yaml) into your HA config, e.g. `config/packages/jf_wholehome.yaml` (keep the `jf_wholehome:` top key), **or** place the file under a folder referenced by `!include_dir_merge_named`.
2. Enable packages in `configuration.yaml`:

```yaml
homeassistant:
  packages: !include_dir_merge_named packages/
```

If you already define `homeassistant: packages:` as a mapping, merge the `jf_wholehome` key from this file into that mapping instead of duplicating the `homeassistant:` key.

3. **Restart Home Assistant**.

4. Open **Settings → Devices & services → Helpers** and set the **JF / …** `input_text` values:

| Helper | Example |
|--------|---------|
| `input_text.jf_jellyfin_base_url` | `http://192.168.1.10:8096` (no trailing slash) |
| `input_text.jf_jellyfin_user_id` | Jellyfin user UUID |
| `input_text.jf_jellyfin_api_key` | API key (`X-Emby-Token`) |
| `input_text.jf_renderer_base_url` | `http://192.168.1.20:8787` |
| `input_text.jf_renderer_api_token` | Same as renderer `api_token`, or leave empty if unused |

5. **Developer tools → Services →** `script.jf_play_search` with data `query: "song title"` to verify search + play.

## Natural language (inside HA)

This package uses **REST + scripts only** (no custom Alexa skill, no external webhook):

- **Assist / sentence triggers:** Add an automation with a [sentence trigger](https://www.home-assistant.io/docs/automation/trigger/#sentence) (or your HA version’s equivalent) that calls `script.jf_play_search` with a `query` slot.
- **Dashboard:** Bind a text field to `input_text.jf_voice_query` and a button that runs `script.jf_play_from_input_query`.
- **Alexa (stock Smart Home):** Echo still cannot pass arbitrary song text into HA scripts. Expose `script.jf_renderer_pause` (and similar) to Alexa for fixed commands, or use **Assist** on a device that supports it for free-text search.

## Scripts

| Entity | Purpose |
|--------|---------|
| `script.jf_play_search` | Field `query`: Jellyfin search → first **Audio** track, else first **MusicAlbum** (queue all tracks) → `POST /player/play` on the renderer. |
| `script.jf_play_from_input_query` | Uses `input_text.jf_voice_query` then runs the same search/play pipeline. |
| `script.jf_renderer_pause` / `resume` / `stop` / `next` / `previous` | Transport controls. |
| `script.jf_renderer_volume` | Field `volume` (0–100). |

## Security

- Helpers for API keys live in HA’s database; restrict HA access and use disk encryption where possible.
- Keep Jellyfin and the renderer on a trusted LAN.

## Optional: `!secret` workflow

If you prefer not to store keys in helpers, refactor `rest_command` URLs and headers to use `!secret` static fragments (see [`secrets.yaml.example`](secrets.yaml.example)). You will lose runtime-editable URLs unless you use `template` entities or similar.

## Parent project

[Workspace README](../README.md) · [Renderer HTTP API](../jf-audio-renderer/docs/api.md)
