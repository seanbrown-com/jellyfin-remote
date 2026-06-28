export type Artist = { id: string; name: string; imageUrl?: string | null };
export type Album = {
  id: string;
  name: string;
  artist: string;
  artistId?: string | null;
  year?: number | null;
  imageUrl?: string | null;
  trackCount?: number | null;
};
export type Track = {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumId: string;
  indexNumber?: number | null;
  discNumber?: number | null;
  durationTicks?: number | null;
  imageUrl?: string | null;
};

export type PlayerState = {
  state: "idle" | "playing" | "paused" | "stopped";
  itemId?: string | null;
  title?: string | null;
  album?: string | null;
  artists?: string[];
  position?: number;
  duration?: number | null;
  volume?: number;
  shuffle?: boolean;
  repeat?: "none" | "one" | "all";
  imageTag?: string | null;
};

export type PlayerQueue = {
  itemIds: string[];
  index: number;
};

export type PlayerQueueDetails = PlayerQueue & {
  currentIndex: number;
  current?: Track | null;
  next?: Track | null;
  tracks?: Track[];
};

export type Page<T> = {
  items: T[];
  total?: number | null;
};

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${r.status} ${t}`);
  }
  return (await r.json()) as T;
}

export async function fetchLibraryViews() {
  return j<{
    recentlyAddedAlbums: Album[];
    favoriteAlbums: Album[];
    recentlyPlayed: (Album | Track)[];
    playlists: { id: string; name: string; imageUrl?: string | null }[];
    randomAlbum: Album | null;
  }>("/api/library/views");
}

export async function searchMusic(q: string) {
  const p = new URLSearchParams({ q, limit: "40" });
  return j<{
    artists: Artist[];
    albums: Album[];
    tracks: Track[];
    playlists: { id: string; name: string; imageUrl?: string | null }[];
  }>(`/api/search?${p}`);
}

export async function fetchAlbum(albumId: string) {
  return j<Album>(`/api/albums/${albumId}`);
}

export async function fetchAlbumTracks(albumId: string) {
  return j<Track[]>(`/api/albums/${albumId}/tracks`);
}

export async function fetchTrack(trackId: string) {
  return j<Track>(`/api/tracks/${trackId}`);
}

export async function fetchArtists(start = 0, limit = 100, letter?: string | null) {
  const p = new URLSearchParams({ start: String(start), limit: String(limit) });
  if (letter) p.set("letter", letter);
  return j<Page<Artist>>(`/api/artists?${p}`);
}

export async function fetchArtistAlbums(artistId: string) {
  return j<Album[]>(`/api/artists/${artistId}/albums`);
}

export async function fetchArtistTracks(artistId: string) {
  return j<Track[]>(`/api/artists/${artistId}/tracks`);
}

export async function fetchAlbums(start = 0, limit = 100, letter?: string | null) {
  const p = new URLSearchParams({ start: String(start), limit: String(limit) });
  if (letter) p.set("letter", letter);
  return j<Page<Album>>(`/api/albums?${p}`);
}

export async function fetchSongs(start = 0, limit = 100, letter?: string | null) {
  const p = new URLSearchParams({ start: String(start), limit: String(limit) });
  if (letter) p.set("letter", letter);
  return j<Page<Track>>(`/api/songs?${p}`);
}

export async function fetchPlaylists() {
  return j<{ id: string; name: string; imageUrl?: string | null }[]>("/api/playlists");
}

export async function fetchPlaylistTracks(id: string) {
  return j<Track[]>(`/api/playlists/${id}/tracks`);
}

export async function playerPlay(body: {
  itemId?: string | null;
  mode: "replaceQueue" | "append" | "playNow";
  queue: string[];
}) {
  await j("/api/player/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function playerEnqueue(body: { itemId?: string | null; queue?: string[] }) {
  await j("/api/player/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function playerPause() {
  await j("/api/player/pause", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

export async function playerResume() {
  await j("/api/player/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

export async function playerNext() {
  await j("/api/player/next", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

export async function playerPrevious() {
  await j("/api/player/previous", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

export async function playerSeek(seconds: number) {
  await j("/api/player/seek", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seconds }),
  });
}

export async function playerVolume(volume: number) {
  await j("/api/player/volume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volume }),
  });
}

export async function fetchPlayerState() {
  return j<PlayerState>("/api/player/state");
}

export async function fetchPlayerQueue() {
  return j<PlayerQueue>("/api/player/queue");
}

export async function fetchPlayerQueueDetails(currentId?: string | null) {
  const p = new URLSearchParams();
  if (currentId) p.set("currentId", currentId);
  const query = p.toString();
  return j<PlayerQueueDetails>(`/api/player/queue/details${query ? `?${query}` : ""}`);
}

export async function playerShuffle(enabled?: boolean) {
  await j("/api/player/shuffle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enabled == null ? {} : { enabled }),
  });
}

export async function playerRepeat(mode: "none" | "one" | "all") {
  await j("/api/player/repeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
}

export function ticksToSeconds(ticks?: number | null) {
  if (!ticks) return 0;
  return ticks / 10_000_000;
}

export function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
