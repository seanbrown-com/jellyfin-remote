# Installation

## 1) Copy package file

Copy `packages/jf_wholehome.yaml` into your Home Assistant config, for example:

- `config/packages/jf_wholehome.yaml`

The file contains a top-level key `jf_wholehome:` and is intended for merge-style package loading.

## 2) Enable package loading

In `configuration.yaml`:

```yaml
homeassistant:
  packages: !include_dir_merge_named packages/
```

If you already use `homeassistant.packages` as a mapping, merge the `jf_wholehome` key into that mapping.

## 3) Restart Home Assistant

Restart HA so new package entities and scripts are registered.

## 4) Configure helpers

Set values for:

- `input_text.jf_jellyfin_base_url`
- `input_text.jf_jellyfin_user_id`
- `input_text.jf_jellyfin_api_key`
- `input_text.jf_renderer_base_url`
- `input_text.jf_renderer_api_token` (optional)

## 5) Validate playback path

From Developer Tools -> Services:

- Run `script.jf_play_search` with data: `query: "artist or track name"`
- Confirm playback starts on `jf-audio-renderer`

## 6) Optional dashboard wiring

- Bind a text card to `input_text.jf_voice_query`
- Add a button to run `script.jf_play_from_input_query`
