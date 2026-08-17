"use client";

import { useEffect, useRef, useState } from "react";
import { gameEvents } from "@/game/eventBus";

interface Bonus {
  id: number;
  count: number;
}

const DURATION_MS = 1500;

export default function MiniBonusPopup() {
  const [bonus, setBonus] = useState<Bonus | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const off = gameEvents.on("mini-bonus", ({ count }) => {
      const id = nextId.current++;
      setBonus({ id, count });
      window.setTimeout(() => {
        setBonus((current) => (current?.id === id ? null : current));
      }, DURATION_MS);
    });
    return off;
  }, []);

  if (!bonus) return null;

  const textStyle: React.CSSProperties = {
    fontFamily: "var(--font-baloo)",
    fontWeight: 800,
    whiteSpace: "nowrap",
    color: "#ffffff",
    WebkitTextStroke: "2px #c23a1f",
    paintOrder: "stroke fill",
    textShadow: "0 3px 0 rgba(0,0,0,0.25)",
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 7, pointerEvents: "none", overflow: "hidden" }}>
      <div
        key={bonus.id}
        style={{
          position: "absolute",
          left: "50%",
          top: "40%",
          textAlign: "center",
          animation: `miniBonusPopup ${DURATION_MS}ms ease-out forwards`,
        }}
      >
        <div style={{ ...textStyle, fontSize: 34, lineHeight: 1.15 }}>MINI BONUS!</div>
        <div style={{ ...textStyle, fontSize: 26 }}>{bonus.count}</div>
      </div>
    </div>
  );
}
