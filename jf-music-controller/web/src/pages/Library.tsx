import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Album, Artist, Track } from "../api";
import { fetchAlbums, fetchArtists, fetchPlaylistTracks, fetchPlaylists, fetchSongs, playerEnqueue, playerPlay } from "../api";

type Tab = "artists" | "albums" | "songs" | "playlists";
type Indexed = { id: string; name: string };

const INDEX_KEYS = ["0", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

function indexKey(name: string) {
  const first = name.trim().charAt(0).toUpperCase();
  if (!first) return "0";
  if (first >= "0" && first <= "9") return "0";
  if (first >= "A" && first <= "Z") return first;
  return "0";
}

function itemId(prefix: string, id: string) {
  return `${prefix}-${id}`;
}

function AlphabetIndex({ items, prefix }: { items: Indexed[]; prefix: string }) {
  const jump = (key: string) => {
    const wanted = INDEX_KEYS.indexOf(key);
    const target =
      items.find((item) => {
        const current = INDEX_KEYS.indexOf(indexKey(item.name));
        return key === "0" ? current === wanted : current >= wanted;
      }) || null;
    if (!target) return;
    document.getElementById(itemId(prefix, target.id))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="az-index" aria-label="Jump by first character">
      {INDEX_KEYS.map((key) => (
        <button key={key} type="button" onClick={() => jump(key)}>
          {key}
        </button>
      ))}
    </div>
  );
}

export function Library() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as Tab | null) || "albums";
  const playlistId = sp.get("playlist");

  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [songs, setSongs] = useState<Track[] | null>(null);
  const [playlists, setPlaylists] = useState<{ id: string; name: string; imageUrl?: string | null }[] | null>(null);
  const [plTracks, setPlTracks] = useState<Track[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    if (tab === "artists") {
      fetchArtists()
        .then(setArtists)
        .catch((e: Error) => setErr(e.message));
    } else if (tab === "albums") {
      fetchAlbums()
        .then(setAlbums)
        .catch((e: Error) => setErr(e.message));
    } else if (tab === "songs") {
      fetchSongs()
        .then(setSongs)
        .catch((e: Error) => setErr(e.message));
    } else if (tab === "playlists") {
      fetchPlaylists()
        .then(setPlaylists)
        .catch((e: Error) => setErr(e.message));
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== "playlists" || !playlistId) {
      setPlTracks(null);
      return;
    }
    fetchPlaylistTracks(playlistId)
      .then(setPlTracks)
      .catch((e: Error) => setErr(e.message));
  }, [tab, playlistId]);

  const setTab = (t: Tab) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", t);
      next.delete("playlist");
      return next;
    });
  };

  const chips = (["albums", "artists", "songs", "playlists"] as const).map((t) => (
    <button key={t} className={`btn ${tab === t ? "primary" : ""}`} type="button" onClick={() => setTab(t)}>
      {t[0]!.toUpperCase() + t.slice(1)}
    </button>
  ));

  return (
    <div>
      <h1>Library</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        {chips}
      </div>
      {err ? <div className="muted">{err}</div> : null}

      {tab === "albums" && albums ? (
        <>
          <AlphabetIndex prefix="library-album" items={albums.map((a) => ({ id: a.id, name: a.name }))} />
          <div className="grid">
            {albums.map((a) => (
              <Link id={itemId("library-album", a.id)} className="card scroll-target" key={a.id} to={`/album/${a.id}`}>
                <img className="cover" src={a.imageUrl || "/cover-placeholder.svg"} alt="" loading="lazy" />
                <div className="meta">
                  <div className="title">{a.name}</div>
                  <div className="sub">{a.artist}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {tab === "artists" && artists ? (
        <>
          <AlphabetIndex prefix="library-artist" items={artists.map((a) => ({ id: a.id, name: a.name }))} />
          <div className="grid">
            {artists.map((a) => (
              <Link id={itemId("library-artist", a.id)} className="card scroll-target" key={a.id} to={`/artist/${a.id}`}>
                <img className="cover" src={a.imageUrl || "/artist-placeholder.svg"} alt="" loading="lazy" />
                <div className="meta">
                  <div className="title">{a.name}</div>
                  <div className="sub">Artist</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {tab === "songs" && songs ? (
        <>
          <AlphabetIndex prefix="library-song" items={songs.map((t) => ({ id: t.id, name: t.name }))} />
          <div className="tracklist">
            {songs.map((t) => (
              <div id={itemId("library-song", t.id)} key={t.id} className="track scroll-target" style={{ gridTemplateColumns: "1fr auto auto" }}>
                <div>
                  <div className="name">{t.name}</div>
                  <div className="sub">
                    {t.artists.join(", ")} · {t.album}
                  </div>
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    void playerPlay({ itemId: t.id, mode: "replaceQueue", queue: [t.id], defaultQueue: true }).then(() => navigate("/now"));
                  }}
                >
                  Play
                </button>
                <button className="btn ghost" type="button" onClick={() => void playerEnqueue({ itemId: t.id })}>
                  Queue
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "playlists" && playlists && !playlistId ? (
        <>
          <AlphabetIndex prefix="library-playlist" items={playlists.map((p) => ({ id: p.id, name: p.name }))} />
          <div className="tracklist">
            {playlists.map((p) => (
              <button
                id={itemId("library-playlist", p.id)}
                key={p.id}
                type="button"
                className="track scroll-target"
                style={{ width: "100%", border: "none", background: "transparent", color: "inherit", cursor: "pointer" }}
                onClick={() => {
                  const next = new URLSearchParams(sp);
                  next.set("tab", "playlists");
                  next.set("playlist", p.id);
                  setSp(next);
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div className="name">{p.name}</div>
                  <div className="sub">Playlist</div>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {tab === "playlists" && playlistId && plTracks ? (
        <div>
          <div className="row" style={{ marginBottom: 10 }}>
            <button
              className="btn"
              type="button"
              disabled={!plTracks.length}
              onClick={() => {
                if (!plTracks.length) return;
                void playerPlay({
                  itemId: plTracks[0]!.id,
                  mode: "replaceQueue",
                  queue: plTracks.map((t) => t.id),
                }).then(() => navigate("/now"));
              }}
            >
              Play playlist
            </button>
            <button className="btn ghost" type="button" onClick={() => setTab("playlists")}>
              Back
            </button>
          </div>
          <AlphabetIndex prefix="library-playlist-track" items={plTracks.map((t) => ({ id: t.id, name: t.name }))} />
          <div className="tracklist">
            {plTracks.map((t, idx) => (
              <div id={itemId("library-playlist-track", t.id)} key={t.id} className="track scroll-target" style={{ gridTemplateColumns: "44px 1fr auto auto" }}>
                <div className="idx">{idx + 1}</div>
                <div>
                  <div className="name">{t.name}</div>
                  <div className="sub">{t.artists.join(", ")}</div>
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    void playerPlay({ itemId: t.id, mode: "replaceQueue", queue: plTracks.map((x) => x.id) }).then(() => navigate("/now"));
                  }}
                >
                  Play
                </button>
                <button className="btn ghost" type="button" onClick={() => void playerEnqueue({ itemId: t.id })}>
                  Queue
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
