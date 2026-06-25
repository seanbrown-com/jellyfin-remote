import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchAlbum, fetchAlbumTracks, formatTime, playerEnqueue, playerPlay, ticksToSeconds, type Album, type Track } from "../api";

export function Album() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    const queue = shuffle ? shuffleIds(ids) : ids;
    await playerPlay({ itemId: queue[0], mode: "replaceQueue", queue, defaultQueue: true });
    navigate("/now");
  };

  const img = album.imageUrl || `/api/image/${album.id}?maxWidth=900`;

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn primary" type="button" onClick={() => void playAll(false)}>
          Play
        </button>
        <button className="btn" type="button" onClick={() => void playAll(true)}>
          Shuffle
        </button>
      </div>

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
                  void playerPlay({ itemId: t.id, mode: "replaceQueue", queue: ids, defaultQueue: true }).then(() => navigate("/now"));
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
