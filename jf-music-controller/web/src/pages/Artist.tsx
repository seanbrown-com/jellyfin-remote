import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Album } from "../api";
import { fetchArtistAlbums } from "../api";

export function Artist() {
  const { id } = useParams();
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setErr(null);
    fetchArtistAlbums(id)
      .then(setAlbums)
      .catch((e: Error) => setErr(e.message));
  }, [id]);

  if (!id) return <div className="muted">Missing artist id</div>;
  if (err) return <div className="muted">{err}</div>;
  if (!albums) return <div className="muted">Loading…</div>;

  const artistName = albums[0]?.artist || "Artist";

  return (
    <div>
      <h1>{artistName}</h1>
      {albums.length ? (
        <div className="grid">
          {albums.map((a) => (
            <Link className="card" key={a.id} to={`/album/${a.id}`}>
              <img className="cover" src={a.imageUrl || "/cover-placeholder.svg"} alt="" loading="lazy" />
              <div className="meta">
                <div className="title">{a.name}</div>
                <div className="sub">
                  {a.year ? `${a.year} · ` : ""}
                  {a.trackCount ? `${a.trackCount} tracks` : "Album"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="muted">No albums found for this artist.</div>
      )}
    </div>
  );
}
