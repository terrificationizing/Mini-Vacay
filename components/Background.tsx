"use client";

import { useEffect, useState } from "react";
import { gameEvents } from "@/game/eventBus";

const DANCE_DURATION_MS = 1400;

// Scattered positions within the pool water's own visible band (measured off pool.png
// directly -- the band narrows toward the left/right edges since it's an ellipse in
// perspective), each twinkling on its own randomized cycle so they don't sync up.
const POOL_SPARKLES = [
  { left: "12%", top: "45%", size: 10, duration: 3.4, delay: -0.6 },
  { left: "22%", top: "40%", size: 8, duration: 4.1, delay: -2.3 },
  { left: "33%", top: "49%", size: 11, duration: 3.8, delay: -1.1 },
  { left: "42%", top: "38%", size: 9, duration: 4.6, delay: -3.4 },
  { left: "50%", top: "46%", size: 12, duration: 3.2, delay: -0.2 },
  { left: "58%", top: "40%", size: 8, duration: 4.3, delay: -2.8 },
  { left: "68%", top: "48%", size: 10, duration: 3.9, delay: -1.7 },
  { left: "78%", top: "42%", size: 9, duration: 4.5, delay: -3.9 },
  { left: "87%", top: "46%", size: 8, duration: 3.6, delay: -0.9 },
];

function PoolSparkle({ left, top, size, duration, delay }: (typeof POOL_SPARKLES)[number]) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{
        position: "absolute",
        left,
        top,
        animation: `poolSparkleTwinkle ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        filter: "drop-shadow(0 0 2px rgba(255,255,255,0.8))",
      }}
    >
      <path
        d="M12 0 C12.8 8.2 13.8 9.2 22 10 C13.8 10.8 12.8 11.8 12 20 C11.2 11.8 10.2 10.8 2 10 C10.2 9.2 11.2 8.2 12 0 Z"
        fill="#ffffff"
      />
    </svg>
  );
}

// Both SVGs read as optically centered illustrations, so anchoring them flush
// to the screen edge leaves them looking off. Instead each is nudged further
// toward its outer edge so a bit more than a third of it bleeds off-screen.
// The gentle sway (see plantSwayLeft/Right in globals.css) runs continuously,
// independent of game state, since this is a plain always-mounted background.
// On a "mini-bonus" event the sway briefly swaps for a livelier dance.
export default function Background() {
  const [dancing, setDancing] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const off = gameEvents.on("mini-bonus", () => {
      setDancing(true);
      const timer = window.setTimeout(() => setDancing(false), DANCE_DURATION_MS);
      return () => window.clearTimeout(timer);
    });
    return off;
  }, []);

  useEffect(() => {
    return gameEvents.on("state-change", ({ state }) => setPlaying(state === "playing"));
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        background: dancing
          ? "radial-gradient(120% 90% at 50% 0%, #ffb347 0%, #ff7a59 100%)"
          : "radial-gradient(120% 90% at 50% 0%, #edae81 0%, #eab0b3 100%)",
        transition: "background 0.3s ease",
      }}
    >
      {/* Behind everything else in this layer (and so behind the plants, the avatar, and
          its arms, which all sit above Background in the DOM/z-index) -- full frame width,
          anchored to the bottom of the screen. Only during actual gameplay -- hidden on the
          start screen and the "Trip Interrupted" game-over screen. */}
      {playing && (
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pool.png" alt="" style={{ display: "block", width: "100%", height: "auto" }} />
          {POOL_SPARKLES.map((s, i) => (
            <PoolSparkle key={i} {...s} />
          ))}
        </div>
      )}
      {/* Sized as a percentage of the CONTAINER's own width (via explicit width + objectFit,
          instead of the image's natural aspect ratio driving width off of height:100%) --
          on a narrow-but-tall real phone screen, height-driven width alone would render
          these nearly as wide as the screen itself, which then shoved the old
          translateX(42%) self-width-relative offset (see plantSwayLeft/Right in
          globals.css) deep into the middle of the screen instead of staying near the
          edge. A stable width percentage keeps the bleed-off-screen amount consistent
          across device sizes -- only a small sliver bleeds off now (down from -15%),
          since a bigger bleed read as barely visible at all in the frame. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/plants.svg"
        alt=""
        style={{
          position: "absolute",
          left: "-5%",
          top: 0,
          width: "50%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "right center",
          transformOrigin: "bottom center",
          animation: dancing
            ? `plantDanceLeft ${DANCE_DURATION_MS}ms ease-in-out`
            : "plantSwayLeft 7s ease-in-out infinite",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/plants2.svg"
        alt=""
        style={{
          position: "absolute",
          right: "-5%",
          top: 0,
          width: "50%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "left center",
          transformOrigin: "bottom center",
          animation: dancing
            ? `plantDanceRight ${DANCE_DURATION_MS}ms ease-in-out`
            : "plantSwayRight 8s ease-in-out infinite",
        }}
      />
    </div>
  );
}
