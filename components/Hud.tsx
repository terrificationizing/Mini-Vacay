"use client";

import { useEffect, useState } from "react";
import { gameEvents } from "@/game/eventBus";

const PULSE_DURATION_MS = 600;
// Exported so other chrome (e.g. GameRoot's mute button) can match this same corner
// radius rather than picking an independent value that could drift out of sync.
export const HUD_BAR_RADIUS = 7;

const pillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  background: "#ffd5b3",
  borderRadius: 999,
  padding: "8px 14px",
  fontFamily: "var(--font-baloo)",
  fontWeight: 700,
  fontSize: 18,
  color: "#c23a1f",
  boxShadow: "0 3px 0 rgba(0,0,0,0.12)",
};

export default function Hud({ score, lives }: { score: number; lives: number }) {
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    const off = gameEvents.on("mini-bonus", () => {
      setPulsing(true);
      const timer = window.setTimeout(() => setPulsing(false), PULSE_DURATION_MS);
      return () => window.clearTimeout(timer);
    });
    return off;
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(env(safe-area-inset-top, 0px) + 10px)",
        left: 0,
        right: 0,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 16,
          top: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            ...pillStyle,
            flexDirection: "column",
            justifyContent: "center",
            borderRadius: HUD_BAR_RADIUS,
            padding: "6px 4px",
            gap: 2,
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src="/suitcase-icon.svg"
              alt=""
              style={{ opacity: i < lives ? 1 : 0.25, width: 30, height: 30 }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          fontFamily: "var(--font-baloo)",
          fontWeight: 800,
          fontSize: 28,
          color: "#ffffff",
          WebkitTextStroke: "1.5px #c23a1f",
          paintOrder: "stroke fill",
          textShadow: "0 3px 0 rgba(0,0,0,0.18)",
          animation: pulsing ? `scorePulse ${PULSE_DURATION_MS}ms ease-out` : undefined,
        }}
      >
        {score}
      </div>
    </div>
  );
}
