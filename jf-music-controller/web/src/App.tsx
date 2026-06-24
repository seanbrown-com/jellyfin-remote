import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import type { PlayerState } from "./api";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { Library } from "./pages/Library";
import { Album } from "./pages/Album";
import { Artist } from "./pages/Artist";
import { NowPlaying } from "./pages/NowPlaying";

function usePlayerStream() {
  const [state, setState] = useState<PlayerState | null>(null);
  useEffect(() => {
    const es = new EventSource("/api/player/events");
    es.onmessage = (ev) => {
      try {
        setState(JSON.parse(ev.data) as PlayerState);
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      /* browser will retry */
    };
    return () => es.close();
  }, []);
  return state;
}

function MiniPlayer({ state }: { state: PlayerState | null }) {
  const loc = useLocation();
  if (!state?.itemId || loc.pathname === "/now") return null;
  const title = state.title || "Unknown track";
  const artist = (state.artists && state.artists[0]) || "";
  const img = state.itemId ? `/api/image/${state.itemId}?maxWidth=128` : undefined;
  return (
    <div className="mini">
      <div className="inner">
        {img ? <img className="cover" src={img} width={52} height={52} alt="" style={{ borderRadius: 12 }} /> : <div style={{ width: 52, height: 52 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 750, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          <div className="muted" style={{ fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {artist}
          </div>
        </div>
        <NavLink className="btn ghost" to="/now">
          Open
        </NavLink>
      </div>
    </div>
  );
}

function Layout() {
  const state = usePlayerStream();
  const loc = useLocation();
  const tab = useMemo(() => {
    if (loc.pathname.startsWith("/search")) return "search";
    if (loc.pathname.startsWith("/library") || loc.pathname.startsWith("/album")) return "library";
    if (loc.pathname.startsWith("/now")) return "now";
    return "home";
  }, [loc.pathname]);

  return (
    <div className="shell">
      <div className="page">
        <MiniPlayer state={state} />
        <Outlet context={{ player: state }} />
      </div>
      <nav className="nav">
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/" end>
          <span style={{ fontSize: "1.1rem" }}>⌂</span>
          Home
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/search">
          <span style={{ fontSize: "1.1rem" }}>⌕</span>
          Search
        </NavLink>
        <NavLink className={({ isActive }) => (isActive || tab === "library" ? "active" : "")} to="/library">
          <span style={{ fontSize: "1.1rem" }}>☰</span>
          Library
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/now">
          <span style={{ fontSize: "1.1rem" }}>♪</span>
          Now
        </NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="library" element={<Library />} />
        <Route path="album/:id" element={<Album />} />
        <Route path="artist/:id" element={<Artist />} />
        <Route path="now" element={<NowPlaying />} />
      </Route>
    </Routes>
  );
}
