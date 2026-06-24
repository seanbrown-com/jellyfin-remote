import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Album, Artist, Track } from "../api";
import { fetchAlbums, fetchArtists, fetchPlaylistTracks, fetchPlaylists, fetchSongs, playerPlay } from "../api";

type Tab = "artists" | "albums" | "songs" | "playlists";

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
        <div className="grid">
          {albums.map((a) => (
            <Link className="card" key={a.id} to={`/album/${a.id}`}>
              <img className="cover" src={a.imageUrl || `/api/image/${a.id}?maxWidth=320`} alt="" loading="lazy" />
              <div className="meta">
                <div className="title">{a.name}</div>
                <div className="sub">{a.artist}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {tab === "artists" && artists ? (
        <div className="tracklist">
          {artists.map((a) => (
            <Link key={a.id} to={`/artist/${a.id}`} style={{ display: "block" }}>
              <div className="track" style={{ gridTemplateColumns: "1fr auto" }}>
                <div className="name">{a.name}</div>
                <span className="muted">→</span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {tab === "songs" && songs ? (
        <div className="tracklist">
          {songs.map((t) => (
            <div key={t.id} className="track" style={{ gridTemplateColumns: "1fr auto" }}>
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
                  void playerPlay({ itemId: t.id, mode: "replaceQueue", queue: [t.id] }).then(() => navigate("/now"));
                }}
              >
                Play
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "playlists" && playlists && !playlistId ? (
        <div className="tracklist">
          {playlists.map((p) => (
            <button
              key={p.id}
              type="button"
              className="track"
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
          <div className="tracklist">
            {plTracks.map((t, idx) => (
              <div key={t.id} className="track">
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
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
