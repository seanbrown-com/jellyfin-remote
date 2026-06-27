import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { PlayerState, Track } from "../api";
import { fetchPlayerQueueDetails, formatTime, playerNext, playerPause, playerPrevious, playerRepeat, playerResume, playerSeek, playerShuffle } from "../api";

type Ctx = { player: PlayerState | null };

export function NowPlaying() {
  const { player: live } = useOutletContext<Ctx>();
  const [dragPos, setDragPos] = useState<number | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [nextUp, setNextUp] = useState<Track | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [artLoading, setArtLoading] = useState(false);
  const [artFailed, setArtFailed] = useState(false);

  const player = live;

  const duration = player?.duration ?? 0;
  const position = dragPos ?? player?.position ?? 0;

  const artItemId = currentTrack?.id || player?.itemId;
  const img = artItemId ? `/api/image/${artItemId}?maxWidth=900` : undefined;

  const title = currentTrack?.name || player?.title || "Nothing playing";
  const artists = currentTrack?.artists.join(", ") || (player?.artists && player.artists.join(", ")) || "";
  const album = currentTrack?.album || player?.album || "";

  useEffect(() => {
    let cancelled = false;
    async function loadNextUp() {
      if (!player?.itemId) {
        setCurrentTrack(null);
        setNextUp(null);
        return;
      }
      try {
        const queue = await fetchPlayerQueueDetails(player.itemId);
        const current = queue.current || null;
        const track = queue.next || null;
        if (!cancelled) setCurrentTrack(current);
        if (!track) {
          setNextUp(null);
          return;
        }
        if (!cancelled) setNextUp(track);
      } catch {
        if (!cancelled) setNextUp(null);
      }
    }
    void loadNextUp();
    const timer = window.setInterval(() => void loadNextUp(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [player?.itemId]);

  useEffect(() => {
    setCurrentTrack(null);
    setNextUp(null);
  }, [player?.itemId]);

  useEffect(() => {
    setArtFailed(false);
    setArtLoading(Boolean(img));
  }, [img]);

  const toggle = async () => {
    if (!player?.itemId) return;
    if (player.state === "playing") await playerPause();
    else await playerResume();
  };

  const toggleShuffle = async () => {
    setBusy("shuffle");
    try {
      await playerShuffle(!player?.shuffle);
    } finally {
      setBusy(null);
    }
  };

  const cycleRepeat = async () => {
    const next = player?.repeat === "one" ? "all" : player?.repeat === "all" ? "none" : "one";
    setBusy("repeat");
    try {
      await playerRepeat(next);
    } finally {
      setBusy(null);
    }
  };

  const maxDur = useMemo(() => Math.max(duration, 1), [duration]);

  return (
    <div className="np">
      <div className="art-shell">
        {img && !artFailed ? (
          <img
            key={img}
            className={`art ${artLoading ? "loading" : ""}`}
            src={img}
            alt=""
            onLoad={() => setArtLoading(false)}
            onError={() => {
              setArtLoading(false);
              setArtFailed(true);
            }}
          />
        ) : null}
        {!img || artLoading || artFailed ? <div className="art-placeholder">{artFailed ? null : <div className="page-loader"><span /><span /><span /></div>}</div> : null}
      </div>
      <div className="title">{title}</div>
      <div className="sub">{artists}</div>
      {album ? <div className="sub album-title">{album}</div> : null}

      <div style={{ marginTop: 14 }}>
        <input
          className="slider"
          type="range"
          min={0}
          max={maxDur}
          step={0.25}
          value={Math.min(position, maxDur)}
          onChange={(e) => setDragPos(Number(e.target.value))}
          onPointerUp={async () => {
            if (dragPos == null) return;
            await playerSeek(dragPos);
            setDragPos(null);
          }}
          onTouchEnd={async () => {
            if (dragPos == null) return;
            await playerSeek(dragPos);
            setDragPos(null);
          }}
        />
        <div className="row muted" style={{ justifyContent: "space-between", marginTop: 6 }}>
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="controls">
        <button className="bigbtn" type="button" onClick={() => void playerPrevious()} aria-label="Previous">
          <span className="control-icon previous" aria-hidden="true" />
        </button>
        <button className="bigbtn play" type="button" onClick={() => void toggle()} aria-label="Play pause">
          <span className={`control-icon ${player?.state === "playing" ? "pause" : "play"}`} aria-hidden="true" />
        </button>
        <button className="bigbtn" type="button" onClick={() => void playerNext()} aria-label="Next">
          <span className="control-icon next" aria-hidden="true" />
        </button>
      </div>

      <div className="mode-controls" aria-label="Playback modes">
        <button className={`mode-btn ${player?.shuffle ? "active" : ""}`} type="button" onClick={() => void toggleShuffle()} disabled={!player?.itemId || busy === "shuffle"} aria-label="Shuffle">
          ⇄
        </button>
        <button className={`mode-btn ${player?.repeat && player.repeat !== "none" ? "active" : ""}`} type="button" onClick={() => void cycleRepeat()} disabled={!player?.itemId || busy === "repeat"} aria-label="Repeat">
          {player?.repeat === "one" ? "1" : "↻"}
        </button>
        <button className="mode-btn" type="button" disabled aria-label="Lyrics">
          LRC
        </button>
      </div>

      {nextUp ? (
        <div className="next-up">
          <h2>Next Up</h2>
          <div className="next-card">
            <img src={nextUp.imageUrl || "/cover-placeholder.svg"} alt="" />
            <div style={{ minWidth: 0 }}>
              <div className="name">{nextUp.name}</div>
              <div className="sub">{nextUp.artists.join(", ")}</div>
              <div className="sub">{nextUp.album}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
