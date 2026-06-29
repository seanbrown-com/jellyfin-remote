import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Album, Artist, Track } from "../api";
import { fetchAlbumTracks, fetchArtistTracks, playerEnqueue, playerPlay, searchMusic } from "../api";

export function Search() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof searchMusic>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const debounced = useMemo(() => {
    let t: number | undefined;
    return (value: string) => {
      window.clearTimeout(t);
      t = window.setTimeout(async () => {
        if (!value.trim()) {
          setRes(null);
          return;
        }
        try {
          setErr(null);
          setRes(await searchMusic(value));
        } catch (e) {
          setErr((e as Error).message);
        }
      }, 250);
    };
  }, []);

  useEffect(() => {
    debounced(q);
  }, [q, debounced]);

  const playQueue = async (ids: string[], label: string) => {
    if (!ids.length) return;
    setBusy(label);
    try {
      await playerPlay({ itemId: ids[0]!, mode: "replaceQueue", queue: ids });
      navigate("/now");
    } finally {
      setBusy(null);
    }
  };

  const enqueue = async (ids: string[], label: string) => {
    if (!ids.length) return;
    setBusy(label);
    try {
      await playerEnqueue({ queue: ids });
      setToast(ids.length === 1 ? "Track queued" : `${ids.length} tracks queued`);
      window.setTimeout(() => setToast(null), 1800);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h1>Search</h1>
      <input className="searchbar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artists, albums, tracks…" />
      {err ? <div className="muted" style={{ marginTop: 10 }}>{err}</div> : null}
      {toast ? <div className="toast">{toast}</div> : null}
      {!res ? (
        <div className="muted" style={{ marginTop: 12 }}>
          Type to search your library.
        </div>
      ) : (
        <>
          <div className="section">
            <h2>Artists</h2>
            <div className="grid">
              {res.artists.map((a: Artist) => (
                <ArtistCard
                  key={a.id}
                  a={a}
                  busy={busy}
                  onPlay={() => {
                    setBusy(`play-artist-${a.id}`);
                    void fetchArtistTracks(a.id)
                      .then((tracks) => playQueue(tracks.map((t) => t.id), `play-artist-${a.id}`))
                      .finally(() => setBusy(null));
                  }}
                  onQueue={() => {
                    setBusy(`queue-artist-${a.id}`);
                    void fetchArtistTracks(a.id)
                      .then((tracks) => enqueue(tracks.map((t) => t.id), `queue-artist-${a.id}`))
                      .finally(() => setBusy(null));
                  }}
                />
              ))}
            </div>
            {!res.artists.length ? <div className="muted" style={{ padding: 12 }}>No artists</div> : null}
          </div>
          <div className="section">
            <h2>Albums</h2>
            <div className="grid">
              {res.albums.map((a: Album) => (
                <AlbumCard
                  key={a.id}
                  a={a}
                  busy={busy}
                  onPlay={() => {
                    setBusy(`play-album-${a.id}`);
                    void fetchAlbumTracks(a.id)
                      .then((tracks) => playQueue(tracks.map((t) => t.id), `play-album-${a.id}`))
                      .finally(() => setBusy(null));
                  }}
                  onQueue={() => {
                    setBusy(`queue-album-${a.id}`);
                    void fetchAlbumTracks(a.id)
                      .then((tracks) => enqueue(tracks.map((t) => t.id), `queue-album-${a.id}`))
                      .finally(() => setBusy(null));
                  }}
                />
              ))}
            </div>
          </div>
          <div className="section">
            <h2>Tracks</h2>
            <div className="tracklist">
              {res.tracks.map((t: Track) => (
                <div key={t.id} className="track" style={{ gridTemplateColumns: "1fr auto auto" }}>
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
                      void playQueue([t.id], `play-track-${t.id}`);
                    }}
                    disabled={busy === `play-track-${t.id}`}
                  >
                    {busy === `play-track-${t.id}` ? "Playing..." : "Play"}
                  </button>
                  <button className="btn ghost" type="button" disabled={busy === `queue-track-${t.id}`} onClick={() => void enqueue([t.id], `queue-track-${t.id}`)}>
                    {busy === `queue-track-${t.id}` ? "Queueing..." : "Queue"}
                  </button>
                </div>
              ))}
              {!res.tracks.length ? <div className="muted" style={{ padding: 12 }}>No tracks</div> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AlbumCard({ a, busy, onPlay, onQueue }: { a: Album; busy: string | null; onPlay: () => void; onQueue: () => void }) {
  const img = a.imageUrl || "/cover-placeholder.svg";
  return (
    <div className="card">
      <Link to={`/album/${a.id}`}>
        <img className="cover" src={img} alt="" loading="lazy" onError={imageFallback("/cover-placeholder.svg")} />
        <div className="meta">
          <div className="title">{a.name}</div>
          <div className="sub">{a.artist}</div>
        </div>
      </Link>
      <div className="card-actions">
        <button className="btn" type="button" disabled={busy === `play-album-${a.id}`} onClick={onPlay}>
          {busy === `play-album-${a.id}` ? "Playing..." : "Play"}
        </button>
        <button className="btn ghost" type="button" disabled={busy === `queue-album-${a.id}`} onClick={onQueue}>
          {busy === `queue-album-${a.id}` ? "Queueing..." : "Queue"}
        </button>
      </div>
    </div>
  );
}

function ArtistCard({ a, busy, onPlay, onQueue }: { a: Artist; busy: string | null; onPlay: () => void; onQueue: () => void }) {
  const img = a.imageUrl || "/artist-placeholder.svg";
  return (
    <div className="card">
      <Link to={`/artist/${a.id}`}>
        <img className="cover" src={img} alt="" loading="lazy" onError={imageFallback("/artist-placeholder.svg")} />
        <div className="meta">
          <div className="title">{a.name}</div>
          <div className="sub">Artist</div>
        </div>
      </Link>
      <div className="card-actions">
        <button className="btn" type="button" disabled={busy === `play-artist-${a.id}`} onClick={onPlay}>
          {busy === `play-artist-${a.id}` ? "Playing..." : "Play"}
        </button>
        <button className="btn ghost" type="button" disabled={busy === `queue-artist-${a.id}`} onClick={onQueue}>
          {busy === `queue-artist-${a.id}` ? "Queueing..." : "Queue"}
        </button>
      </div>
    </div>
  );
}

function imageFallback(src: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.src.endsWith(src)) return;
    img.src = src;
  };
}
