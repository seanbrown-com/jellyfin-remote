# Voice and Alexa behavior

## Natural language in this project

This integration uses Home Assistant-side REST + script logic for query handling:

1. Receive a text query (`script.jf_play_search` input).
2. Search Jellyfin library.
3. Select strongest practical match (track-first fallback strategy).
4. Send `POST /player/play` to `jf-audio-renderer`.

## Assist (recommended for free text)

Use Assist sentence triggers or Assist-enabled UI/device input to pass arbitrary song text into `script.jf_play_search`.

Practical examples:

- "play this is how we do it"
- "play daft punk get lucky"

These map naturally to a free-text `query`.

## Alexa limitations (stock smart home path)

Alexa routines/entities exposed through standard Home Assistant integration are effective for **fixed actions**:

- pause
- resume
- next
- stop

But stock Alexa Smart Home does **not** pass arbitrary free-text song names into HA script parameters. For fully dynamic "play <song>" voice slots with Echo, an external skill/bridge path is still required.

## Recommended split

- Use Alexa for fixed transport controls.
- Use Assist for dynamic library search requests.
