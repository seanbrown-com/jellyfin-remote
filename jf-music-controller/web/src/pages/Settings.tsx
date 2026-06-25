import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { PlayerState } from "../api";
import { playerVolume } from "../api";

type Ctx = {
  player: PlayerState | null;
  theme: string;
  setTheme: (theme: string) => void;
};

export function Settings() {
  const { player, theme, setTheme } = useOutletContext<Ctx>();
  const [dragVol, setDragVol] = useState<number | null>(null);
  const volume = dragVol ?? player?.volume ?? 80;

  return (
    <div>
      <h1>Settings</h1>

      <div className="section">
        <h2>Appearance</h2>
        <div className="row">
          <button className={`btn ${theme === "dark" ? "primary" : ""}`} type="button" onClick={() => setTheme("dark")}>
            Dark
          </button>
          <button className={`btn ${theme === "light" ? "primary" : ""}`} type="button" onClick={() => setTheme("light")}>
            Light
          </button>
        </div>
      </div>

      <div className="section">
        <h2>Volume</h2>
        <div className="settings-card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span className="muted">Output volume</span>
            <strong>{Math.round(volume)}%</strong>
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
    </div>
  );
}
