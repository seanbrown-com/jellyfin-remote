import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { PlayerState } from "../api";
import { formatTime, playerNext, playerPause, playerPrevious, playerResume, playerSeek, playerVolume } from "../api";

type Ctx = { player: PlayerState | null };

export function NowPlaying() {
  const { player: live } = useOutletContext<Ctx>();
  const [dragPos, setDragPos] = useState<number | null>(null);
  const [dragVol, setDragVol] = useState<number | null>(null);

  const player = live;

  const duration = player?.duration ?? 0;
  const position = dragPos ?? player?.position ?? 0;
  const volume = dragVol ?? player?.volume ?? 80;

  const img = player?.itemId ? `/api/image/${player.itemId}?maxWidth=900` : undefined;

  const title = player?.title || "Nothing playing";
  const subtitle = (player?.artists && player.artists.join(", ")) || player?.album || "";

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
      <div className="sub">{subtitle}</div>

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
          ⏮
        </button>
        <button className="bigbtn play" type="button" onClick={() => void toggle()} aria-label="Play pause">
          {player?.state === "playing" ? "⏸" : "▶"}
        </button>
        <button className="bigbtn" type="button" onClick={() => void playerNext()} aria-label="Next">
          ⏭
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="muted" style={{ marginBottom: 6 }}>
          Volume
        </div>
        <input
          className="slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(e) => setDragVol(Number(e.target.value))}
          onPointerUp={async () => {
            if (dragVol == null) return;
            await playerVolume(dragVol);
            setDragVol(null);
          }}
          onTouchEnd={async () => {
            if (dragVol == null) return;
            await playerVolume(dragVol);
            setDragVol(null);
          }}
        />
      </div>
    </div>
  );
}
