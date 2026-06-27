import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { Album, Track } from "../api";
import { fetchAlbumTracks, fetchLibraryViews, playerEnqueue, playerPlay } from "../api";

function AlbumCard({ a, busy, onPlay, onQueue }: { a: Album; busy: string | null; onPlay: () => void; onQueue: () => void }) {
  const img = a.imageUrl || "/cover-placeholder.svg";
  return (
    <div className="card">
      <Link to={`/album/${a.id}`}>
        <img className="cover" src={img} alt="" loading="lazy" />
        <div className="meta">
          <div className="title">{a.name}</div>
          <div className="sub">
            {a.artist}
            {a.year ? ` · ${a.year}` : ""}
          </div>
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

function shuffleIds(ids: string[]) {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function isTrack(x: Album | Track): x is Track {
  return Array.isArray((x as Track).artists);
}

export function Home() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchLibraryViews>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchLibraryViews()
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const playAlbum = useMemo(
    () => async (album: Album, shuffle: boolean) => {
      setBusy(shuffle ? `shuffle-album-${album.id}` : `play-album-${album.id}`);
      try {
        const ids = (await fetchAlbumTracks(album.id)).map((t) => t.id);
        if (!ids.length) return;
        const queue = shuffle ? shuffleIds(ids) : ids;
        await playerPlay({ itemId: queue[0]!, mode: "replaceQueue", queue });
        navigate("/now");
      } finally {
        setBusy(null);
      }
    },
    [navigate],
  );

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

  const queueAlbum = async (album: Album) => {
    const ids = (await fetchAlbumTracks(album.id)).map((t) => t.id);
    await enqueue(ids, `queue-album-${album.id}`);
  };

  if (err) return <div className="muted">Failed to load home: {err}</div>;
  if (!data) return <div className="muted">Loading…</div>;

  return (
    <div>
      <h1>Music</h1>
      {toast ? <div className="toast">{toast}</div> : null}
      <div className="row" style={{ marginBottom: 12 }}>
        {data.randomAlbum ? (
          <>
            <button className="btn primary" type="button" disabled={busy === `play-album-${data.randomAlbum.id}`} onClick={() => void playAlbum(data.randomAlbum!, false)}>
              {busy === `play-album-${data.randomAlbum.id}` ? "Playing..." : "Random album"}
            </button>
            <button className="btn" type="button" disabled={busy === `shuffle-album-${data.randomAlbum.id}`} onClick={() => void playAlbum(data.randomAlbum!, true)}>
              {busy === `shuffle-album-${data.randomAlbum.id}` ? "Shuffling..." : "Shuffle album"}
            </button>
          </>
        ) : null}
      </div>

      <div className="section">
        <h2>Recently added</h2>
        <div className="grid">{data.recentlyAddedAlbums.map((a) => <AlbumCard key={a.id} a={a} busy={busy} onPlay={() => void playAlbum(a, false)} onQueue={() => void queueAlbum(a)} />)}</div>
      </div>

      <div className="section">
        <h2>Favorites</h2>
        <div className="grid">{data.favoriteAlbums.map((a) => <AlbumCard key={a.id} a={a} busy={busy} onPlay={() => void playAlbum(a, false)} onQueue={() => void queueAlbum(a)} />)}</div>
      </div>

      <div className="section">
        <h2>Recently played</h2>
        <div className="tracklist">
          {data.recentlyPlayed.map((x) => {
            if (isTrack(x)) {
              const t = x;
              return (
                <div key={`t-${t.id}`} className="track" style={{ gridTemplateColumns: "1fr auto auto" }}>
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
                      setBusy(`play-track-${t.id}`);
                      void playerPlay({ itemId: t.id, mode: "replaceQueue", queue: [t.id] })
                        .then(() => navigate("/now"))
                        .finally(() => setBusy(null));
                    }}
                    disabled={busy === `play-track-${t.id}`}
                  >
                    {busy === `play-track-${t.id}` ? "Playing..." : "Play"}
                  </button>
                  <button className="btn ghost" type="button" disabled={busy === `queue-track-${t.id}`} onClick={() => void enqueue([t.id], `queue-track-${t.id}`)}>
                    {busy === `queue-track-${t.id}` ? "Queueing..." : "Queue"}
                  </button>
                </div>
              );
            }
            const a = x as Album;
            return (
              <Link key={`a-${a.id}`} to={`/album/${a.id}`} style={{ display: "block" }}>
                <div className="track" style={{ gridTemplateColumns: "1fr auto" }}>
                  <div>
                    <div className="name">{a.name}</div>
                    <div className="sub">{a.artist}</div>
                  </div>
                  <span className="muted" style={{ alignSelf: "center" }}>
                    Album →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="section">
        <h2>Playlists</h2>
        <div className="tracklist">
          {data.playlists.map((p) => (
            <Link key={p.id} to={`/library?tab=playlists&playlist=${encodeURIComponent(p.id)}`} style={{ display: "block" }}>
              <div className="track" style={{ gridTemplateColumns: "1fr auto" }}>
                <div>
                  <div className="name">{p.name}</div>
                  <div className="sub">Playlist</div>
                </div>
                <span className="muted" style={{ alignSelf: "center" }}>
                  Open →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
