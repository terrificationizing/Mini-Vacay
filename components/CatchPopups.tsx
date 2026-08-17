"use client";

import { useEffect, useRef, useState } from "react";
import { gameEvents } from "@/game/eventBus";

interface Popup {
  id: number;
  lines: string[];
  points: number;
  kind: "good" | "bad";
}

const DURATION_MS = 900;
const STARBURST_PREFIX = "Starburst® ";

function toLines(label: string): string[] {
  if (label.startsWith(STARBURST_PREFIX)) {
    return ["Starburst®", `${label.slice(STARBURST_PREFIX.length)}!`];
  }
  return [`${label}!`];
}

export default function CatchPopups() {
  const [popup, setPopup] = useState<Popup | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const show = (label: string, points: number, kind: Popup["kind"]) => {
      const id = nextId.current++;
      setPopup({ id, lines: toLines(label), points, kind });
      window.setTimeout(() => {
        setPopup((current) => (current?.id === id ? null : current));
      }, DURATION_MS);
    };
    const offGood = gameEvents.on("catch-good", ({ label, points }) => show(label, points, "good"));
    const offBad = gameEvents.on("catch-bad", ({ label, points }) => show(label, points, "bad"));
    return () => {
      offGood();
      offBad();
    };
  }, []);

  if (!popup) return null;

  const color = popup.kind === "good" ? "#ffffff" : "#e94b5c";
  const stroke = popup.kind === "good" ? "1.5px #c23a1f" : "1.5px #6b1420";
  const textStyle: React.CSSProperties = {
    fontFamily: "var(--font-baloo)",
    fontWeight: 800,
    whiteSpace: "nowrap",
    color,
    WebkitTextStroke: stroke,
    paintOrder: "stroke fill",
    textShadow: "0 2px 0 rgba(0,0,0,0.2)",
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none", overflow: "hidden" }}>
      <div
        key={popup.id}
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          textAlign: "center",
          animation: `${popup.kind === "good" ? "catchPopupGood" : "catchPopupBad"} ${DURATION_MS}ms ease-out forwards`,
        }}
      >
        {popup.lines.map((line, i) => (
          <div key={i} style={{ ...textStyle, fontSize: popup.kind === "good" ? 26 : 25, lineHeight: 1.15 }}>
            {line}
          </div>
        ))}
        <div style={{ ...textStyle, fontSize: 20 }}>{popup.points > 0 ? `+${popup.points}` : popup.points}</div>
      </div>
    </div>
  );
}
