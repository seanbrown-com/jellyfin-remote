import { useState, type CSSProperties } from "react";
import { useOutletContext } from "react-router-dom";
import type { PlayerState } from "../api";
import { playerVolume } from "../api";

type Ctx = {
  player: PlayerState | null;
  theme: string;
  setTheme: (theme: string) => void;
  accent: string;
  setAccent: (accent: string) => void;
};

const ACCENTS = [
  { id: "red", label: "Red" },
  { id: "orange", label: "Orange" },
  { id: "yellow", label: "Yellow" },
  { id: "green", label: "Green" },
  { id: "cyan", label: "Cyan" },
  { id: "blue", label: "Blue" },
  { id: "purple", label: "Purple" },
  { id: "pink", label: "Pink" },
  { id: "brown", label: "Brown" },
];

export function Settings() {
  const { player, theme, setTheme, accent, setAccent } = useOutletContext<Ctx>();
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
        <div className="settings-card" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <span className="muted">Accent color</span>
            <strong>{ACCENTS.find((item) => item.id === accent)?.label || "Purple"}</strong>
          </div>
          <div className="swatch-grid" aria-label="Accent color">
            {ACCENTS.map((item) => (
              <button
                key={item.id}
                className={`swatch ${accent === item.id ? "active" : ""}`}
                style={{ "--swatch": `var(--accent-${item.id})` } as CSSProperties}
                type="button"
                onClick={() => setAccent(item.id)}
                aria-label={item.label}
                title={item.label}
              />
            ))}
          </div>
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
