# Configuration reference

## Helper entities

The package defines editable `input_text` helpers:

| Entity | Purpose |
|--------|---------|
| `input_text.jf_jellyfin_base_url` | Jellyfin base URL (no trailing slash preferred) |
| `input_text.jf_jellyfin_user_id` | Jellyfin user UUID used for library search |
| `input_text.jf_jellyfin_api_key` | Jellyfin API key used in `X-Emby-Token` |
| `input_text.jf_renderer_base_url` | `jf-audio-renderer` API base URL |
| `input_text.jf_renderer_api_token` | Optional renderer token (`X-Renderer-Token`) |
| `input_text.jf_voice_query` | Query text used by helper-driven play script |

## Scripts

| Script | Input | Behavior |
|--------|-------|----------|
| `script.jf_play_search` | `query` | Search Jellyfin, pick top track match first, fallback to album track queue |
| `script.jf_play_from_input_query` | none | Reads `input_text.jf_voice_query` then delegates to `script.jf_play_search` |
| `script.jf_renderer_pause/resume/stop/next/previous` | none | Transport controls |
| `script.jf_renderer_volume` | `volume` 0-100 | Sets renderer volume |

## REST commands

The package includes REST calls for:

- Jellyfin search by query
- Jellyfin album tracks by album id
- Renderer play/transport/volume endpoints

URLs and auth values are templated from helpers, so values can be changed at runtime without editing YAML.
