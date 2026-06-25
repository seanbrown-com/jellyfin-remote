import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { PlayerState, Track } from "../api";
import { fetchPlayerQueue, fetchTrack, formatTime, playerNext, playerPause, playerPrevious, playerResume, playerSeek } from "../api";

type Ctx = { player: PlayerState | null };

export function NowPlaying() {
  const { player: live } = useOutletContext<Ctx>();
  const [dragPos, setDragPos] = useState<number | null>(null);
  const [nextUp, setNextUp] = useState<Track | null>(null);

  const player = live;

  const duration = player?.duration ?? 0;
  const position = dragPos ?? player?.position ?? 0;

  const img = player?.itemId ? `/api/image/${player.itemId}?maxWidth=900` : undefined;

  const title = player?.title || "Nothing playing";
  const artists = (player?.artists && player.artists.join(", ")) || "";
  const album = player?.album || "";

  useEffect(() => {
    let cancelled = false;
    async function loadNextUp() {
      if (!player?.itemId) {
        setNextUp(null);
        return;
      }
      try {
        const queue = await fetchPlayerQueue();
        const index = queue.itemIds.indexOf(player.itemId);
        const nextId = queue.itemIds[index >= 0 ? index + 1 : queue.index + 1];
        if (!nextId) {
          setNextUp(null);
          return;
        }
        const track = await fetchTrack(nextId);
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

  const toggle = async () => {
    if (!player?.itemId) return;
    if (player.state === "playing") await playerPause();
    else await playerResume();
  };

  const maxDur = useMemo(() => Math.max(duration, 1), [duration]);

  return (
    <div className="np">
      {img ? <img className="art" src={img} alt="" /> : <div className="art" />}
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

      {nextUp ? (
        <div className="next-up">
          <h2>Next Up</h2>
          <div className="next-card">
            <img src={nextUp.imageUrl || `/api/image/${nextUp.id}?maxWidth=160`} alt="" />
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
