import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { Album, Track } from "../api";
import { fetchAlbumTracks, fetchLibraryViews, playerEnqueue, playerPlay } from "../api";

function AlbumCard({ a }: { a: Album }) {
  const img = a.imageUrl || "/cover-placeholder.svg";
  return (
    <Link className="card" to={`/album/${a.id}`}>
      <img className="cover" src={img} alt="" loading="lazy" />
      <div className="meta">
        <div className="title">{a.name}</div>
        <div className="sub">
          {a.artist}
          {a.year ? ` · ${a.year}` : ""}
        </div>
      </div>
    </Link>
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

  useEffect(() => {
    fetchLibraryViews()
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const playAlbum = useMemo(
    () => async (album: Album, shuffle: boolean) => {
      const ids = (await fetchAlbumTracks(album.id)).map((t) => t.id);
      if (!ids.length) return;
      const queue = shuffle ? shuffleIds(ids) : ids;
      await playerPlay({ itemId: queue[0], mode: "replaceQueue", queue, defaultQueue: true });
      navigate("/now");
    },
    [navigate],
  );

  if (err) return <div className="muted">Failed to load home: {err}</div>;
  if (!data) return <div className="muted">Loading…</div>;

  return (
    <div>
      <h1>Music</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        {data.randomAlbum ? (
          <>
            <button className="btn primary" type="button" onClick={() => void playAlbum(data.randomAlbum!, false)}>
              Random album
            </button>
            <button className="btn" type="button" onClick={() => void playAlbum(data.randomAlbum!, true)}>
              Shuffle album
            </button>
          </>
        ) : null}
      </div>

      <div className="section">
        <h2>Recently added</h2>
        <div className="grid">{data.recentlyAddedAlbums.map((a) => <AlbumCard key={a.id} a={a} />)}</div>
      </div>

      <div className="section">
        <h2>Favorites</h2>
        <div className="grid">{data.favoriteAlbums.map((a) => <AlbumCard key={a.id} a={a} />)}</div>
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
                      void playerPlay({ itemId: t.id, mode: "replaceQueue", queue: [t.id], defaultQueue: true }).then(() => navigate("/now"));
                    }}
                  >
                    Play
                  </button>
                  <button className="btn ghost" type="button" onClick={() => void playerEnqueue({ itemId: t.id })}>
                    Queue
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
