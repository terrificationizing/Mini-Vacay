"use client";

import { useEffect, useState } from "react";
import { sfxEngine } from "@/game/sfx";

const MESSAGES = ["It's about time for some YOU time.", "Hurry and pack!"];
const MESSAGE_DURATION_MS = 1800;

const textStyle: React.CSSProperties = {
  fontFamily: "var(--font-baloo)",
  fontWeight: 800,
  color: "#ffffff",
  WebkitTextStroke: "2px #c23a1f",
  paintOrder: "stroke fill",
  textShadow: "0 3px 0 rgba(0,0,0,0.25)",
  fontSize: 26,
  lineHeight: 1.25,
  textAlign: "center",
  whiteSpace: "normal",
  width: "min(320px, 82vw)",
};

export default function AvatarFlourish({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    sfxEngine.playFlourishFanfare();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (index < MESSAGES.length - 1) setIndex((i) => i + 1);
      else onDone();
    }, MESSAGE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [index, onDone]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 15, pointerEvents: "none", overflow: "hidden" }}>
      <div
        key={index}
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          animation: `flourishMessage ${MESSAGE_DURATION_MS}ms ease-out forwards`,
        }}
      >
        <div style={textStyle}>{MESSAGES[index]}</div>
      </div>
    </div>
  );
}
