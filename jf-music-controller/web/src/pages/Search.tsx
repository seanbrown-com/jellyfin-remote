import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Album, Artist, Track } from "../api";
import { playerEnqueue, playerPlay, searchMusic } from "../api";

export function Search() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof searchMusic>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  return (
    <div>
      <h1>Search</h1>
      <input className="searchbar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artists, albums, tracks…" />
      {err ? <div className="muted" style={{ marginTop: 10 }}>{err}</div> : null}
      {!res ? (
        <div className="muted" style={{ marginTop: 12 }}>
          Type to search your library.
        </div>
      ) : (
        <>
          <div className="section">
            <h2>Artists</h2>
            <div className="tracklist">
              {res.artists.map((a: Artist) => (
                <Link key={a.id} to={`/artist/${a.id}`} style={{ display: "block" }}>
                  <div className="track" style={{ gridTemplateColumns: "1fr auto" }}>
                    <div className="name">{a.name}</div>
                    <span className="muted">→</span>
                  </div>
                </Link>
              ))}
              {!res.artists.length ? <div className="muted" style={{ padding: 12 }}>No artists</div> : null}
            </div>
          </div>
          <div className="section">
            <h2>Albums</h2>
            <div className="grid">{res.albums.map((a: Album) => <AlbumCard key={a.id} a={a} />)}</div>
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
              {!res.tracks.length ? <div className="muted" style={{ padding: 12 }}>No tracks</div> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AlbumCard({ a }: { a: Album }) {
  const img = a.imageUrl || "/cover-placeholder.svg";
  return (
    <Link className="card" to={`/album/${a.id}`}>
      <img className="cover" src={img} alt="" loading="lazy" />
      <div className="meta">
        <div className="title">{a.name}</div>
        <div className="sub">{a.artist}</div>
      </div>
    </Link>
  );
}
