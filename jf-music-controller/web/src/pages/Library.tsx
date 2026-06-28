import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Album, Artist, Track } from "../api";
import { fetchAlbumTracks, fetchAlbums, fetchArtistTracks, fetchArtists, fetchPlaylistTracks, fetchPlaylists, fetchSongs, playerEnqueue, playerPlay } from "../api";

type Tab = "artists" | "albums" | "songs" | "playlists";
type PagedTab = Exclude<Tab, "playlists">;
type Indexed = { id: string; name: string };
type PagedItem = Artist | Album | Track;

const PAGE_SIZE = 100;
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

function imageFallback(src: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.src.endsWith(src)) return;
    img.src = src;
  };
}

function isPagedTab(value: Tab): value is PagedTab {
  return value === "artists" || value === "albums" || value === "songs";
}

function mergeUnique<T extends { id: string }>(current: T[], next: T[]) {
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current];
  for (const item of next) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function countNew<T extends { id: string }>(current: T[], next: T[]) {
  const seen = new Set(current.map((item) => item.id));
  return next.filter((item) => !seen.has(item.id)).length;
}

function findJumpTarget(items: Indexed[], key: string) {
  const wanted = INDEX_KEYS.indexOf(key);
  return (
    items.find((item) => {
      const current = INDEX_KEYS.indexOf(indexKey(item.name));
      return key === "0" ? current === wanted : current >= wanted;
    }) || null
  );
}

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label="Loading more results">
      <span />
      <span />
      <span />
    </div>
  );
}

function AlphabetIndex({ items, prefix, onJump, jumpingKey }: { items: Indexed[]; prefix: string; onJump?: (key: string) => void; jumpingKey?: string | null }) {
  const jump = async (key: string) => {
    if (onJump) {
      onJump(key);
      return;
    }
    const target = findJumpTarget(items, key);
    if (!target) return;
    document.getElementById(itemId(prefix, target.id))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="az-index" aria-label="Jump by first character">
      {INDEX_KEYS.map((key) => (
        <button key={key} type="button" className={jumpingKey === key ? "loading" : ""} onClick={() => void jump(key)}>
          {jumpingKey === key ? "..." : key}
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
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef<Record<PagedTab, boolean>>({ artists: false, albums: false, songs: false });
  const nextStartRef = useRef<Record<PagedTab, number>>({ artists: 0, albums: 0, songs: 0 });

  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [songs, setSongs] = useState<Track[] | null>(null);
  const [playlists, setPlaylists] = useState<{ id: string; name: string; imageUrl?: string | null }[] | null>(null);
  const [plTracks, setPlTracks] = useState<Track[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState<Record<PagedTab, boolean>>({ artists: false, albums: false, songs: false });
  const [hasMore, setHasMore] = useState<Record<PagedTab, boolean>>({ artists: true, albums: true, songs: true });
  const [totalCount, setTotalCount] = useState<Record<PagedTab, number | null>>({ artists: null, albums: null, songs: null });
  const [jumpingKey, setJumpingKey] = useState<string | null>(null);
  const [letterItems, setLetterItems] = useState<Record<PagedTab, PagedItem[] | null>>({ artists: null, albums: null, songs: null });
  const [loadedLetter, setLoadedLetter] = useState<Record<PagedTab, string | null>>({ artists: null, albums: null, songs: null });
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const rawLetterKey = sp.get("letter");
  const letterKey = isPagedTab(tab) && rawLetterKey && INDEX_KEYS.includes(rawLetterKey) ? rawLetterKey : null;

  const loadPage = useCallback(
    async (target: PagedTab, reset = false) => {
      if (loadingRef.current[target]) return;
      if (!reset && !hasMore[target]) return;

      if (reset) nextStartRef.current[target] = 0;
      const start = nextStartRef.current[target];

      setErr(null);
      loadingRef.current[target] = true;
      setLoadingPage((prev) => ({ ...prev, [target]: true }));
      try {
        if (target === "artists") {
          const page = await fetchArtists(start, PAGE_SIZE);
          const added = countNew(artists || [], page.items);
          nextStartRef.current.artists = start + page.items.length;
          setArtists((prev) => (reset || !prev ? page.items : mergeUnique(prev, page.items)));
          setTotalCount((prev) => ({ ...prev, artists: page.total ?? null }));
          setHasMore((prev) => ({ ...prev, artists: page.items.length === PAGE_SIZE && (reset || added > 0) }));
        } else if (target === "albums") {
          const page = await fetchAlbums(start, PAGE_SIZE);
          const added = countNew(albums || [], page.items);
          nextStartRef.current.albums = start + page.items.length;
          setAlbums((prev) => (reset || !prev ? page.items : mergeUnique(prev, page.items)));
          setTotalCount((prev) => ({ ...prev, albums: page.total ?? null }));
          setHasMore((prev) => ({ ...prev, albums: page.items.length === PAGE_SIZE && (reset || added > 0) }));
        } else {
          const page = await fetchSongs(start, PAGE_SIZE);
          const added = countNew(songs || [], page.items);
          nextStartRef.current.songs = start + page.items.length;
          setSongs((prev) => (reset || !prev ? page.items : mergeUnique(prev, page.items)));
          setTotalCount((prev) => ({ ...prev, songs: page.total ?? null }));
          setHasMore((prev) => ({ ...prev, songs: page.items.length === PAGE_SIZE && (reset || added > 0) }));
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        loadingRef.current[target] = false;
        setLoadingPage((prev) => ({ ...prev, [target]: false }));
      }
    },
    [albums, artists, hasMore, songs],
  );

  useEffect(() => {
    setErr(null);
    if (isPagedTab(tab)) {
      const current = tab === "artists" ? artists : tab === "albums" ? albums : songs;
      if (current === null) void loadPage(tab, true);
    } else if (playlists === null) {
      fetchPlaylists()
        .then(setPlaylists)
        .catch((e: Error) => setErr(e.message));
    }
  }, [albums, artists, loadPage, playlists, songs, tab]);

  useEffect(() => {
    if (!isPagedTab(tab)) return;
    if (letterKey) return;
    const node = loadMoreRef.current;
    if (!node || !hasMore[tab]) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadPage(tab);
      },
      { rootMargin: "360px 0px 360px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, letterKey, loadPage, tab]);

  useEffect(() => {
    if (tab !== "playlists" || !playlistId) {
      setPlTracks(null);
      return;
    }
    fetchPlaylistTracks(playlistId)
      .then(setPlTracks)
      .catch((e: Error) => setErr(e.message));
  }, [tab, playlistId]);

  const showLetter = (target: PagedTab, key: string) => {
    setLetterItems((prev) => ({ ...prev, [target]: null }));
    setLoadedLetter((prev) => ({ ...prev, [target]: null }));
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", target);
      next.set("letter", key);
      next.delete("playlist");
      return next;
    });
  };

  const clearLetter = () => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("letter");
      return next;
    });
  };

  const loadLetterPage = useCallback(
    async (target: PagedTab, key: string) => {
      if (loadingRef.current[target]) return;

      const fetchPage = async (start: number) => {
        if (target === "artists") return fetchArtists(start, PAGE_SIZE, key);
        if (target === "albums") return fetchAlbums(start, PAGE_SIZE, key);
        return fetchSongs(start, PAGE_SIZE, key);
      };

      setErr(null);
      setJumpingKey(key);
      loadingRef.current[target] = true;
      setLoadingPage((prev) => ({ ...prev, [target]: true }));
      setLetterItems((prev) => ({ ...prev, [target]: null }));
      setLoadedLetter((prev) => ({ ...prev, [target]: null }));

      try {
        let start = 0;
        let total: number | null = null;
        let matches: PagedItem[] = [];
        let keepGoing = true;

        while (keepGoing) {
          const page = await fetchPage(start);
          const items = page.items as PagedItem[];
          total = page.total ?? total;
          matches = mergeUnique(matches, items);
          setLetterItems((prev) => ({ ...prev, [target]: matches }));
          start += items.length;
          keepGoing = items.length === PAGE_SIZE && (total == null || start < total);
        }

        if (total != null) setTotalCount((prev) => ({ ...prev, [target]: total }));
        setLetterItems((prev) => ({ ...prev, [target]: matches }));
        setLoadedLetter((prev) => ({ ...prev, [target]: key }));
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        loadingRef.current[target] = false;
        setLoadingPage((prev) => ({ ...prev, [target]: false }));
        setJumpingKey(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isPagedTab(tab) || !letterKey) return;
    if (!INDEX_KEYS.includes(letterKey)) return;
    if (loadedLetter[tab] === letterKey && letterItems[tab] !== null) return;
    void loadLetterPage(tab, letterKey);
  }, [letterItems, letterKey, loadLetterPage, loadedLetter, tab]);

  const setTab = (t: Tab) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", t);
      next.delete("playlist");
      next.delete("letter");
      return next;
    });
  };

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

  const chips = (["albums", "artists", "songs", "playlists"] as const).map((t) => (
    <button key={t} className={`btn ${tab === t ? "primary" : ""}`} type="button" onClick={() => setTab(t)}>
      {t[0]!.toUpperCase() + t.slice(1)}
    </button>
  ));

  const loadingText =
    tab === "artists"
      ? "Loading artists..."
      : tab === "albums"
        ? "Loading albums..."
        : tab === "songs"
          ? "Loading songs..."
          : playlistId
            ? "Loading playlist..."
            : "Loading playlists...";

  const visibleAlbums = letterKey ? (letterItems.albums as Album[] | null) : albums;
  const visibleArtists = letterKey ? (letterItems.artists as Artist[] | null) : artists;
  const visibleSongs = letterKey ? (letterItems.songs as Track[] | null) : songs;

  return (
    <div>
      <h1>Library</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        {chips}
      </div>
      {err ? <div className="muted">{err}</div> : null}
      {toast ? <div className="toast">{toast}</div> : null}
      {!err && tab === "albums" && visibleAlbums === null ? <PageLoader /> : null}
      {!err && tab === "artists" && visibleArtists === null ? <PageLoader /> : null}
      {!err && tab === "songs" && visibleSongs === null ? <PageLoader /> : null}
      {!err && tab === "playlists" && !playlistId && playlists === null ? <div className="muted">{loadingText}</div> : null}
      {!err && tab === "playlists" && playlistId && plTracks === null ? <div className="muted">{loadingText}</div> : null}

      {tab === "albums" && visibleAlbums ? (
        <>
          <AlphabetIndex prefix="library-album" items={visibleAlbums.map((a) => ({ id: a.id, name: a.name }))} jumpingKey={jumpingKey} onJump={(key) => showLetter("albums", key)} />
          {letterKey ? (
            <div className="letter-view-bar">
              <span>{letterKey} albums</span>
              <button className="btn ghost" type="button" onClick={clearLetter}>
                All albums
              </button>
            </div>
          ) : null}
          {visibleAlbums.length ? (
            <>
              <div className="grid">
                {visibleAlbums.map((a) => (
                  <div id={itemId("library-album", a.id)} className="card scroll-target" key={a.id}>
                    <Link to={`/album/${a.id}`}>
                      <img className="cover" src={a.imageUrl || "/cover-placeholder.svg"} alt="" loading="lazy" onError={imageFallback("/cover-placeholder.svg")} />
                      <div className="meta">
                        <div className="title">{a.name}</div>
                        <div className="sub">{a.artist}</div>
                      </div>
                    </Link>
                    <div className="card-actions">
                      <button
                        className="btn"
                        type="button"
                        disabled={busy === `play-album-${a.id}`}
                        onClick={() => {
                          setBusy(`play-album-${a.id}`);
                          void fetchAlbumTracks(a.id)
                            .then((tracks) => playQueue(tracks.map((t) => t.id), `play-album-${a.id}`))
                            .finally(() => setBusy(null));
                        }}
                      >
                        {busy === `play-album-${a.id}` ? "Playing..." : "Play"}
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={busy === `queue-album-${a.id}`}
                        onClick={() => {
                          setBusy(`queue-album-${a.id}`);
                          void fetchAlbumTracks(a.id)
                            .then((tracks) => enqueue(tracks.map((t) => t.id), `queue-album-${a.id}`))
                            .finally(() => setBusy(null));
                        }}
                      >
                        {busy === `queue-album-${a.id}` ? "Queueing..." : "Queue"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {!letterKey && hasMore.albums ? (
                <div ref={loadMoreRef} className="load-more-sentinel">
                  {loadingPage.albums ? <PageLoader /> : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="muted">{letterKey ? `No albums found for ${letterKey}.` : "No albums found."}</div>
          )}
        </>
      ) : null}

      {tab === "artists" && visibleArtists ? (
        <>
          <AlphabetIndex prefix="library-artist" items={visibleArtists.map((a) => ({ id: a.id, name: a.name }))} jumpingKey={jumpingKey} onJump={(key) => showLetter("artists", key)} />
          {letterKey ? (
            <div className="letter-view-bar">
              <span>{letterKey} artists</span>
              <button className="btn ghost" type="button" onClick={clearLetter}>
                All artists
              </button>
            </div>
          ) : null}
          {visibleArtists.length ? (
            <>
              <div className="grid">
                {visibleArtists.map((a) => (
                  <div id={itemId("library-artist", a.id)} className="card scroll-target" key={a.id}>
                    <Link to={`/artist/${a.id}`}>
                      <img className="cover" src={a.imageUrl || "/artist-placeholder.svg"} alt="" loading="lazy" onError={imageFallback("/artist-placeholder.svg")} />
                      <div className="meta">
                        <div className="title">{a.name}</div>
                        <div className="sub">Artist</div>
                      </div>
                    </Link>
                    <div className="card-actions">
                      <button
                        className="btn"
                        type="button"
                        disabled={busy === `play-artist-${a.id}`}
                        onClick={() => {
                          setBusy(`play-artist-${a.id}`);
                          void fetchArtistTracks(a.id)
                            .then((tracks) => playQueue(tracks.map((t) => t.id), `play-artist-${a.id}`))
                            .finally(() => setBusy(null));
                        }}
                      >
                        {busy === `play-artist-${a.id}` ? "Playing..." : "Play"}
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={busy === `queue-artist-${a.id}`}
                        onClick={() => {
                          setBusy(`queue-artist-${a.id}`);
                          void fetchArtistTracks(a.id)
                            .then((tracks) => enqueue(tracks.map((t) => t.id), `queue-artist-${a.id}`))
                            .finally(() => setBusy(null));
                        }}
                      >
                        {busy === `queue-artist-${a.id}` ? "Queueing..." : "Queue"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {!letterKey && hasMore.artists ? (
                <div ref={loadMoreRef} className="load-more-sentinel">
                  {loadingPage.artists ? <PageLoader /> : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="muted">{letterKey ? `No artists found for ${letterKey}.` : "No artists found."}</div>
          )}
        </>
      ) : null}

      {tab === "songs" && visibleSongs ? (
        <>
          <AlphabetIndex prefix="library-song" items={visibleSongs.map((t) => ({ id: t.id, name: t.name }))} jumpingKey={jumpingKey} onJump={(key) => showLetter("songs", key)} />
          {letterKey ? (
            <div className="letter-view-bar">
              <span>{letterKey} songs</span>
              <button className="btn ghost" type="button" onClick={clearLetter}>
                All songs
              </button>
            </div>
          ) : null}
          {visibleSongs.length ? (
            <>
              <div className="tracklist">
                {visibleSongs.map((t) => (
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
              </div>
              {!letterKey && hasMore.songs ? (
                <div ref={loadMoreRef} className="load-more-sentinel">
                  {loadingPage.songs ? <PageLoader /> : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="muted">{letterKey ? `No songs found for ${letterKey}.` : "No songs found."}</div>
          )}
        </>
      ) : null}

      {tab === "playlists" && playlists && !playlistId ? (
        <>
          <AlphabetIndex prefix="library-playlist" items={playlists.map((p) => ({ id: p.id, name: p.name }))} />
          {playlists.length ? (
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
          ) : (
            <div className="muted">No playlists found.</div>
          )}
        </>
      ) : null}

      {tab === "playlists" && playlistId && plTracks ? (
        <div>
          <div className="row" style={{ marginBottom: 10 }}>
            <button
              className="btn"
              type="button"
              disabled={!plTracks.length || busy === "play-playlist"}
              onClick={() => {
                if (!plTracks.length) return;
                void playQueue(
                  plTracks.map((t) => t.id),
                  "play-playlist",
                );
              }}
            >
              {busy === "play-playlist" ? "Playing..." : "Play playlist"}
            </button>
            <button className="btn ghost" type="button" disabled={!plTracks.length || busy === "queue-playlist"} onClick={() => void enqueue(plTracks.map((t) => t.id), "queue-playlist")}>
              {busy === "queue-playlist" ? "Queueing..." : "Queue playlist"}
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
                  disabled={busy === `play-playlist-track-${t.id}`}
                  onClick={() => {
                    void playQueue([t.id], `play-playlist-track-${t.id}`);
                  }}
                >
                  {busy === `play-playlist-track-${t.id}` ? "Playing..." : "Play"}
                </button>
                <button className="btn ghost" type="button" disabled={busy === `queue-playlist-track-${t.id}`} onClick={() => void enqueue([t.id], `queue-playlist-track-${t.id}`)}>
                  {busy === `queue-playlist-track-${t.id}` ? "Queueing..." : "Queue"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
