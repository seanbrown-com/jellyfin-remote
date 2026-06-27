import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Album, Track } from "../api";
import { fetchAlbumTracks, fetchArtistAlbums, fetchArtistTracks, playerEnqueue, playerPlay } from "../api";

export function Artist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setErr(null);
    Promise.all([fetchArtistAlbums(id), fetchArtistTracks(id)])
      .then(([nextAlbums, nextTracks]) => {
        setAlbums(nextAlbums);
        setTracks(nextTracks);
      })
      .catch((e: Error) => setErr(e.message));
  }, [id]);

  if (!id) return <div className="muted">Missing artist id</div>;
  if (err) return <div className="muted">{err}</div>;
  if (!albums || !tracks) return <div className="muted">Loading…</div>;

  const artistName = albums[0]?.artist || "Artist";
  const artistIds = tracks.map((t) => t.id);

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

  const albumIds = async (albumId: string) => (await fetchAlbumTracks(albumId)).map((t) => t.id);

  return (
    <div>
      <h1>{artistName}</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn primary" type="button" disabled={!artistIds.length || busy === "play-artist"} onClick={() => void playQueue(artistIds, "play-artist")}>
          {busy === "play-artist" ? "Playing..." : "Play artist"}
        </button>
        <button className="btn ghost" type="button" disabled={!artistIds.length || busy === "queue-artist"} onClick={() => void enqueue(artistIds, "queue-artist")}>
          {busy === "queue-artist" ? "Queueing..." : "Queue artist"}
        </button>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
      {albums.length ? (
        <div className="grid">
          {albums.map((a) => (
            <div className="card" key={a.id}>
              <Link to={`/album/${a.id}`}>
                <img className="cover" src={a.imageUrl || "/cover-placeholder.svg"} alt="" loading="lazy" />
                <div className="meta">
                  <div className="title">{a.name}</div>
                  <div className="sub">
                    {a.year ? `${a.year} · ` : ""}
                    {a.trackCount ? `${a.trackCount} tracks` : "Album"}
                  </div>
                </div>
              </Link>
              <div className="card-actions">
                <button
                  className="btn"
                  type="button"
                  disabled={busy === `play-${a.id}`}
                  onClick={() => {
                    setBusy(`play-${a.id}`);
                    void albumIds(a.id)
                      .then((ids) => playQueue(ids, `play-${a.id}`))
                      .finally(() => setBusy(null));
                  }}
                >
                  {busy === `play-${a.id}` ? "Playing..." : "Play"}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={busy === `queue-${a.id}`}
                  onClick={() => {
                    setBusy(`queue-${a.id}`);
                    void albumIds(a.id)
                      .then((ids) => enqueue(ids, `queue-${a.id}`))
                      .finally(() => setBusy(null));
                  }}
                >
                  {busy === `queue-${a.id}` ? "Queueing..." : "Queue"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">No albums found for this artist.</div>
      )}
    </div>
  );
}
