"use client";

import { useEffect, useState } from "react";
import { detectEyeOverlayInfo, loadImage, type EyeOverlayInfo } from "@/lib/avatarPipeline";
import EyeOverlay from "./EyeOverlay";

const DEFAULT_IRIS_COLOR = 0x3f2a17;

const cardStyle: React.CSSProperties = {
  background: "#57beab",
  borderRadius: 28,
  padding: "14px 16px 18px",
  width: "min(320px, 88vw)",
  textAlign: "center",
  boxShadow: "0 10px 0 rgba(0,0,0,0.12)",
  border: "4px solid #ffffff",
};

// Each candidate is sized off the viewport HEIGHT (not a fixed px guess), so all 3 stacked
// vertically plus the heading/buttons always fit on screen without scrolling regardless of
// device height -- width follows from the 3:4 aspect ratio, not set independently.
const CANDIDATE_HEIGHT = "min(150px, 19vh)";

const buttonStyle: React.CSSProperties = {
  fontFamily: "var(--font-baloo)",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  borderRadius: 999,
  fontSize: 14,
  padding: "10px 22px",
};

export default function AvatarSelectionScreen({
  candidates,
  irisColor,
  onTryAgain,
  onUse,
}: {
  candidates: string[];
  /** Detected from the user's own original photo -- falls back to the shared default
   *  when detection fails, same fallback the final in-game avatar itself uses. */
  irisColor: number | null;
  onTryAgain: () => void;
  onUse: (url: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [eyeInfo, setEyeInfo] = useState<Record<string, EyeOverlayInfo | null>>({});

  useEffect(() => {
    let cancelled = false;
    candidates.forEach((url) => {
      (async () => {
        try {
          const img = await loadImage(url);
          const info = await detectEyeOverlayInfo(img);
          if (!cancelled) setEyeInfo((prev) => ({ ...prev, [url]: info }));
        } catch {
          if (!cancelled) setEyeInfo((prev) => ({ ...prev, [url]: null }));
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [candidates]);

  const resolvedIrisColor = irisColor ?? DEFAULT_IRIS_COLOR;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(238, 60, 108, 0.25)",
      }}
    >
      <div style={{ position: "relative", width: "min(320px, 88vw)" }}>
        <div style={cardStyle}>
        <button
          onClick={onTryAgain}
          style={{
            position: "absolute",
            top: 14,
            left: 16,
            fontFamily: "var(--font-baloo)",
            fontWeight: 700,
            fontSize: 14,
            color: "#ffffff",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← Back
        </button>
        <h2 style={{ fontFamily: "var(--font-baloo)", fontWeight: 800, color: "#ffffff", fontSize: 18, margin: "2px 0 10px" }}>
          Choose your Mini!
        </h2>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 12 }}>
          {candidates.map((url) => {
            const isSelected = selected === url;
            const info = eyeInfo[url];
            return (
              <button
                key={url}
                onClick={() => setSelected(url)}
                style={{
                  position: "relative",
                  height: CANDIDATE_HEIGHT,
                  aspectRatio: "3 / 4",
                  background: "#6fefd7",
                  border: isSelected ? "2px solid #ffd23f" : "2px solid #5bd6bf",
                  borderRadius: 14,
                  padding: 3,
                  boxSizing: "border-box",
                  cursor: "pointer",
                  overflow: "hidden",
                  boxShadow: isSelected ? "0 0 0 3px rgba(255,210,63,0.6)" : "none",
                }}
              >
                <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 11, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Mini Me option" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  {info && <EyeOverlay info={info} irisColor={resolvedIrisColor} />}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onTryAgain} style={{ ...buttonStyle, background: "#ffe1ea", color: "#b6567a" }}>
            TRY AGAIN
          </button>
          <button
            onClick={() => selected && onUse(selected)}
            disabled={!selected}
            style={{
              ...buttonStyle,
              background: selected ? "linear-gradient(160deg, #ffd23f, #ff9f45)" : "#cfcfcf",
              color: selected ? "#8a3a10" : "#8a8a8a",
              boxShadow: selected ? "0 5px 0 #c06a1e" : "none",
              cursor: selected ? "pointer" : "not-allowed",
            }}
          >
            USE
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
