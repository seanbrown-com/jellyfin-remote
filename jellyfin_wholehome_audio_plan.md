# Jellyfin Whole-Home Audio Plan

## Goal

Create a whole-home Jellyfin music playback system with two new services:

1. **Music playback service**  
   A headless renderer inspired by MPV Shim, but designed specifically for music playback.

2. **Finamp-like web controller app**  
   A touch-friendly web interface for browsing the Jellyfin music catalog and controlling playback.

The playback service will run inside a Debian LXC on Proxmox and output audio through the host PC's motherboard S/PDIF output.

---

## High-Level Architecture

```text
Proxmox host
  └─ Debian LXC: jellyfin-audio-player
       ├─ Service 1: Music playback service
       │    - controls mpv
       │    - owns audio output / S/PDIF
       │    - owns playback queue
       │    - reports now-playing state
       │
       └─ Service 2: Finamp-like web controller
            - browses Jellyfin music
            - displays artists / albums / tracks / playlists
            - sends commands to playback service

Jellyfin server VM/LXC
  - library
  - metadata
  - images
  - stream URLs
  - authentication
```

Conceptually:

```text
Kitchen Raspberry Pi browser
  ↓
Finamp-like web controller
  ↓
Music playback service
  ↓
mpv
  ↓
ALSA S/PDIF output
  ↓
Whole-home audio system
```

---

# Service 1: Music Playback Service

## Purpose

The music playback service is the Jellyfin music renderer. It should behave like a lightweight, headless playback endpoint, similar in spirit to Spotify Connect or MPV Shim, but optimized for music.

It should not render a rich UI. Its job is to:

```text
Receive command → resolve Jellyfin item → play through mpv → output S/PDIF
```

Suggested names:

```text
jellyfin-music-renderer
jf-audio-renderer
```

---

## Recommended Runtime

Recommended stack:

```text
Python + FastAPI
mpv for playback
ALSA for audio output
systemd for service management
```

Alternative stack:

```text
Node.js + Fastify
mpv for playback
ALSA for audio output
```

Python/FastAPI is recommended because it is straightforward for controlling local processes, UNIX sockets, systemd services, and mpv JSON IPC.

---

## Core Responsibilities

The playback service should:

1. Authenticate to Jellyfin.
2. Maintain a configured Jellyfin user/session.
3. Accept playback commands from the controller.
4. Resolve Jellyfin item IDs to playable stream URLs.
5. Launch and control mpv.
6. Maintain an internal playback queue.
7. Expose now-playing state over HTTP and/or WebSocket/SSE.
8. Optionally report playback progress back to Jellyfin.
9. Output audio to the LXC's ALSA S/PDIF device.

---

## Internal Components

Recommended service structure:

```text
jellyfin_client.py
  - login/auth
  - item lookup
  - stream URL generation
  - image URL generation
  - playback progress reporting

mpv_controller.py
  - starts mpv
  - connects to mpv JSON IPC socket
  - sends loadfile, pause, seek, stop, next, previous
  - observes properties: time-pos, duration, pause, metadata, volume

queue_manager.py
  - current queue
  - shuffle/repeat
  - play next
  - remove/reorder items

api.py
  - REST endpoints
  - WebSocket or Server-Sent Events for now-playing updates

config.py
  - Jellyfin URL
  - API token
  - audio device
  - mpv options
```

---

## Playback Flow

```text
1. Controller sends:
   POST /player/play
   { "itemId": "abc123", "queue": [...] }

2. Renderer asks Jellyfin:
   - What is this item?
   - Is it playable?
   - What is the stream URL?

3. Renderer tells mpv:
   loadfile "https://jellyfin/.../Audio/abc123/stream?..."

4. mpv outputs decoded PCM to ALSA S/PDIF.

5. Renderer emits state updates:
   {
     "state": "playing",
     "track": "...",
     "artist": "...",
     "album": "...",
     "position": 12.3,
     "duration": 245.0
   }
```

---

## Renderer API Design

Minimum REST API:

```http
GET /health
GET /player/state
GET /player/queue

POST /player/play
POST /player/pause
POST /player/resume
POST /player/stop
POST /player/next
POST /player/previous
POST /player/seek
POST /player/volume
POST /player/queue
DELETE /player/queue/{index}
POST /player/queue/reorder
POST /player/shuffle
POST /player/repeat
```

Example play command:

```json
POST /player/play
{
  "itemId": "JELLYFIN_TRACK_ID",
  "mode": "replaceQueue",
  "queue": ["track1", "track2", "track3"]
}
```

Example seek command:

```json
POST /player/seek
{
  "seconds": 93
}
```

Example volume command:

```json
POST /player/volume
{
  "volume": 80
}
```

---

## Live State Updates

Use either WebSocket or Server-Sent Events.

Suggested endpoint:

```http
GET /player/events
```

Example event payload:

```json
{
  "state": "playing",
  "itemId": "abc123",
  "title": "Song Title",
  "album": "Album Name",
  "artists": ["Artist"],
  "position": 123.4,
  "duration": 245.0,
  "volume": 80,
  "shuffle": false,
  "repeat": "none"
}
```

---

## mpv Configuration

Run mpv headless:

```bash
mpv \
  --no-video \
  --idle=yes \
  --input-ipc-server=/run/jf-audio-renderer/mpv.sock \
  --audio-device=alsa/<your-spdif-device>
```

The mpv JSON IPC socket should remain local inside the container. Do not expose mpv IPC directly over the network. Expose only your own authenticated playback API.

---

## Audio Output

The goal is:

```text
Proxmox host audio device
  → /dev/snd passed into LXC
  → ALSA inside LXC
  → mpv outputs to iec958/S/PDIF
```

Inside the LXC, initial packages:

```bash
apt update
apt install -y mpv alsa-utils
```

Check available audio devices:

```bash
aplay -l
aplay -L
```

Test S/PDIF output:

```bash
speaker-test -D iec958 -c 2
```

Test FLAC playback:

```bash
mpv --no-video --audio-device=alsa/iec958 test.flac
```

The exact ALSA device name may differ. Use `aplay -L` as the source of truth.

---

# Service 2: Finamp-Like Web Controller App

## Purpose

The web controller is the kitchen Pi UI.

It should be a responsive, touch-friendly web app optimized for kiosk-style use:

```text
Browse → select album/track/playlist → play on renderer
```

It does not decode or play audio itself.

Suggested names:

```text
jellyfin-music-controller
wholehome-music-ui
```

---

## Recommended Runtime

Recommended stack:

```text
Frontend: React + Vite
Backend/BFF: FastAPI or Node.js
```

For MVP simplicity, the web UI can be served by the same FastAPI process as the playback API. Later, the controller and renderer can be split into separate services.

---

## UI Goals

The UI should feel like a simplified Finamp, Spotify, or Plexamp-style music controller.

### Home

- Recently added albums
- Favorite albums
- Recently played
- Playlists
- Random album / instant mix

### Library

- Artists
- Albums
- Songs
- Genres
- Playlists

### Album View

- Album art
- Track list
- Play album
- Shuffle album
- Add to queue

### Now Playing

- Large artwork
- Title / artist / album
- Play / pause
- Next / previous
- Seek bar
- Queue
- Volume
- Repeat / shuffle

### Search

- Artists
- Albums
- Tracks
- Playlists

---

## Controller Architecture

The controller talks to two APIs:

```text
Jellyfin API
  - browse catalog
  - search
  - artwork
  - playlists
  - favorites

Renderer API
  - play / pause / seek / queue / volume
  - now-playing state
```

Recommended pattern:

```text
Browser UI
  ↓
Controller backend
  ↓
Jellyfin API + Renderer API
```

This keeps Jellyfin credentials server-side instead of exposing long-lived tokens in the browser.

---

## Controller Backend Endpoints

Suggested normalized music endpoints:

```http
GET /api/library/views
GET /api/artists
GET /api/artists/{id}/albums
GET /api/albums
GET /api/albums/{id}
GET /api/albums/{id}/tracks
GET /api/tracks/{id}
GET /api/playlists
GET /api/playlists/{id}/tracks
GET /api/search?q=...
GET /api/image/{itemId}
```

Playback endpoints can proxy to the renderer:

```http
GET /api/player/state
POST /api/player/play
POST /api/player/pause
POST /api/player/queue
POST /api/player/next
POST /api/player/previous
POST /api/player/seek
POST /api/player/volume
```

---

## Frontend Data Model

Normalize Jellyfin objects into clean frontend types.

```ts
type Artist = {
  id: string;
  name: string;
  imageUrl?: string;
};

type Album = {
  id: string;
  name: string;
  artist: string;
  artistId?: string;
  year?: number;
  imageUrl?: string;
  trackCount?: number;
};

type Track = {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumId: string;
  indexNumber?: number;
  discNumber?: number;
  durationTicks?: number;
  imageUrl?: string;
};
```

Do normalization in the backend rather than scattering Jellyfin-specific shapes across the React app.

---

# LXC Deployment Plan

## Container Layout

One Debian LXC is enough for MVP:

```text
LXC: jellyfin-audio
  /opt/jf-audio-renderer
  /opt/jf-music-controller
  /etc/jf-audio/config.yaml
  /var/lib/jf-audio/cache
  /run/jf-audio/mpv.sock
```

Run both services through systemd:

```text
systemd
  ├─ jf-audio-renderer.service
  └─ jf-music-controller.service
```

For MVP, these can also be combined into one service:

```text
systemd
  └─ jf-music.service
       - serves web app
       - controls mpv
       - talks to Jellyfin
```

---

## Proxmox LXC Requirements

Recommended container:

```text
Debian 12 LXC
Unprivileged if possible
/dev/snd passthrough
Static DHCP lease or static IP
systemd enabled
No desktop environment required
```

Conceptual LXC config additions:

```text
lxc.cgroup2.devices.allow: c 116:* rwm
lxc.mount.entry: /dev/snd dev/snd none bind,optional,create=dir
```

Exact config may vary by Proxmox version and whether the container is privileged or unprivileged. The first milestone is simply proving `/dev/snd` is visible inside the LXC.

---

## Packages

Inside the LXC:

```bash
apt update
apt install -y \
  python3 python3-venv python3-pip \
  mpv alsa-utils \
  nginx \
  curl jq
```

If using Node for the UI build:

```bash
apt install -y nodejs npm
```

---

# MVP Build Sequence

## Phase 0 — Prove S/PDIF from LXC

Goal: no Jellyfin, no UI, just sound.

Tasks:

1. Pass `/dev/snd` into the LXC.
2. Install `alsa-utils` and `mpv`.
3. Confirm `aplay -L` shows S/PDIF or `iec958`.
4. Play a local FLAC file through S/PDIF.

Success criteria:

```text
A FLAC file plays from inside the LXC through the whole-home audio system.
```

Do not proceed until this works.

---

## Phase 1 — Minimal Renderer

Build only the playback service.

Features:

- Config file with Jellyfin URL and API key.
- `POST /player/play` with Jellyfin item ID.
- `GET /player/state`.
- `POST /player/pause`.
- `POST /player/stop`.
- mpv JSON IPC control.

Success criteria:

```bash
curl -X POST http://jellyfin-audio.local:8787/player/play \
  -H 'Content-Type: application/json' \
  -d '{"itemId":"JELLYFIN_TRACK_ID"}'
```

starts music over S/PDIF.

---

## Phase 2 — Queue and Now Playing

Add:

- Queue list.
- Next / previous.
- Position polling from mpv.
- WebSocket or Server-Sent Events state stream.
- Album art URL.
- Basic Jellyfin playback progress reporting.

Success criteria:

```text
A browser can show current song, position, pause/play state, and queue.
```

---

## Phase 3 — Basic Web Controller

Build a simple UI:

- Search box.
- Album page.
- Track list.
- Play track.
- Play album.
- Now-playing bar.

Success criteria:

```text
From the kitchen Pi browser, you can search Jellyfin, choose an album, and play it through the closet S/PDIF output.
```

---

## Phase 4 — Finamp-Like Polish

Add:

- Artist browsing.
- Album grid.
- Recently added.
- Favorites.
- Playlists.
- Queue editing.
- Shuffle / repeat.
- Touch-friendly now-playing screen.
- Kiosk layout for the kitchen Pi.

---

## Phase 5 — Appliance Hardening

Add:

- systemd auto-restart.
- Health checks.
- Structured logs.
- Persistent queue restore.
- Jellyfin reconnect handling.
- mpv crash recovery.
- Config UI or environment-based config.
- Local auth or LAN allowlist.
- Optional HTTPS via reverse proxy.

---

# Recommended Repository Structure

```text
jellyfin-wholehome-audio/
  README.md
  docker-compose.yml          # optional later, not required for LXC
  config.example.yaml

  renderer/
    pyproject.toml
    app/
      main.py
      config.py
      jellyfin_client.py
      mpv_controller.py
      queue_manager.py
      state.py
      models.py

  controller/
    package.json
    vite.config.ts
    src/
      App.tsx
      api/
        jellyfin.ts
        player.ts
      components/
        AlbumGrid.tsx
        ArtistList.tsx
        NowPlaying.tsx
        QueuePanel.tsx
      pages/
        Home.tsx
        Search.tsx
        Album.tsx
        Artist.tsx
        NowPlaying.tsx

  deploy/
    systemd/
      jf-audio-renderer.service
      jf-music-controller.service
    nginx/
      jf-music-controller.conf
```

---

# Example Configuration

```yaml
jellyfin:
  base_url: "http://jellyfin.local:8096"
  api_key: "REPLACE_ME"
  user_id: "JELLYFIN_USER_ID"
  device_name: "Whole Home Audio"

renderer:
  host: "0.0.0.0"
  port: 8787
  mpv_socket: "/run/jf-audio/mpv.sock"
  audio_device: "alsa/iec958"
  default_volume: 80

controller:
  host: "0.0.0.0"
  port: 8088

security:
  lan_only: true
  controller_token: "optional-shared-secret"
```

---

# Design Notes

## Do Not Clone MPV Shim Too Literally

"Based on MPV Shim, but for music" is a good conceptual target, but the better implementation is a purpose-built music renderer.

MPV Shim is useful as inspiration for:

- Jellyfin authentication/session behavior.
- mpv control patterns.
- Cast-target thinking.
- Background renderer behavior.

But this project should focus on:

```text
Jellyfin catalog + custom queue + mpv audio endpoint
```

rather than forcing MPV Shim's video/cast assumptions into a music-first product.

---

# Biggest Risks

## 1. LXC Audio Permissions

This is the first thing to test. If `/dev/snd` passthrough is unreliable, switch to either:

- running the renderer directly on the Proxmox host, or
- using a tiny external endpoint such as a Raspberry Pi or mini PC.

## 2. S/PDIF Device Naming

The ALSA device name may not simply be `iec958`. You may need to pin it with an `.asoundrc` file or an mpv config.

## 3. Jellyfin Auth/Session Semantics

For the MVP, use an API key. Later, implement a proper login/device flow if you want multiple users.

## 4. Playback Progress and Scrobbling

Basic playback does not require full Jellyfin session emulation. But if you want Jellyfin to show now playing, recently played, resume state, and play counts accurately, the renderer should report playback start/progress/stop events back to Jellyfin.

## 5. Gapless Playback

mpv can handle playlists, but the queue strategy matters. For better gapless behavior, prefer feeding mpv a playlist or next item ahead of time rather than stopping and loading each track from scratch.

---

# Final Recommended Plan

Build in this order:

```text
1. LXC audio proof-of-concept.
2. Minimal FastAPI renderer controlling mpv.
3. Jellyfin item ID → stream URL → mpv playback.
4. Queue + now-playing state.
5. React Finamp-like controller.
6. Jellyfin playlist/favorites/recently-added support.
7. Appliance hardening.
```

The MVP target should be concrete:

```text
From the kitchen Pi, open http://jellyfin-audio.local:8088,
search for an album,
tap Play,
and hear FLAC playback through the motherboard S/PDIF output.
```

