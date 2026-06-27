import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchAlbum, fetchAlbumTracks, formatTime, playerEnqueue, playerPlay, ticksToSeconds, type Album, type Track } from "../api";

export function Album() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setErr(null);
    Promise.all([fetchAlbum(id), fetchAlbumTracks(id)])
      .then(([a, t]) => {
        setAlbum(a);
        setTracks(t);
      })
      .catch((e: Error) => setErr(e.message));
  }, [id]);

  if (!id) return <div className="muted">Missing album id</div>;
  if (err) return <div className="muted">{err}</div>;
  if (!album || !tracks) return <div className="muted">Loading…</div>;

  const ids = tracks.map((t) => t.id);

  const playAll = async (shuffle: boolean) => {
    if (!ids.length) return;
    setBusy(shuffle ? "shuffle-album" : "play-album");
    const queue = shuffle ? shuffleIds(ids) : ids;
    try {
      await playerPlay({ itemId: queue[0]!, mode: "replaceQueue", queue });
      navigate("/now");
    } finally {
      setBusy(null);
    }
  };

  const enqueue = async (queue: string[], label: string) => {
    if (!queue.length) return;
    setBusy(label);
    try {
      await playerEnqueue({ queue });
      setToast(queue.length === 1 ? "Track queued" : `${queue.length} tracks queued`);
      window.setTimeout(() => setToast(null), 1800);
    } finally {
      setBusy(null);
    }
  };

  const img = album.imageUrl || "/cover-placeholder.svg";

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn primary" type="button" disabled={busy === "play-album"} onClick={() => void playAll(false)}>
          {busy === "play-album" ? "Playing..." : "Play"}
        </button>
        <button className="btn" type="button" disabled={busy === "shuffle-album"} onClick={() => void playAll(true)}>
          {busy === "shuffle-album" ? "Shuffling..." : "Shuffle"}
        </button>
        <button className="btn ghost" type="button" disabled={busy === "queue-album"} onClick={() => void enqueue(ids, "queue-album")}>
          {busy === "queue-album" ? "Queueing..." : "Queue album"}
        </button>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}

      <div className="row" style={{ alignItems: "flex-start", gap: 14 }}>
        <img src={img} alt="" style={{ width: 160, height: 160, borderRadius: 16, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0 }}>{album.name}</h1>
          <div className="muted" style={{ marginTop: 6 }}>
            {album.artist}
            {album.year ? ` · ${album.year}` : ""}
          </div>
        </div>
      </div>

      <div className="section">
        <h2>Tracks</h2>
        <div className="tracklist">
          {tracks.map((t) => (
            <div key={t.id} className="track" style={{ gridTemplateColumns: "44px 1fr auto auto" }}>
              <div className="idx">{t.indexNumber ?? ""}</div>
              <div>
                <div className="name">{t.name}</div>
                <div className="sub">{formatTime(ticksToSeconds(t.durationTicks))}</div>
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setBusy(`play-${t.id}`);
                  void playerPlay({ itemId: t.id, mode: "replaceQueue", queue: [t.id] })
                    .then(() => navigate("/now"))
                    .finally(() => setBusy(null));
                }}
                disabled={busy === `play-${t.id}`}
              >
                {busy === `play-${t.id}` ? "Playing..." : "Play"}
              </button>
              <button className="btn ghost" type="button" disabled={busy === `queue-${t.id}`} onClick={() => void enqueue([t.id], `queue-${t.id}`)}>
                {busy === `queue-${t.id}` ? "Queueing..." : "Queue"}
              </button>
            </div>
          ))}
        </div>
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
