"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Logo from "./Logo";
import TitleCandyDecor, { type PctRect } from "./TitleCandyDecor";

const CARD_BORDER_WIDTH = 4;
// The gap from the box's own visible top edge (outer border, not just the padding) down to
// the Starburst logo, which is set to equal the Starburst logo's own marginBottom below --
// that's what actually centers the Starburst logo in the gap between the box's top edge and
// the Mini Vacay logo (see the card's JSX further down). Padding alone starts inside the
// border, so it's shorted by CARD_BORDER_WIDTH to make the two visible gaps match.
const CARD_TOP_GAP = 14;

const cardStyle: React.CSSProperties = {
  background: "#57beab",
  borderRadius: 28,
  padding: `${CARD_TOP_GAP - CARD_BORDER_WIDTH}px 24px 40px`,
  width: "min(340px, 88vw)",
  textAlign: "center",
  boxShadow: "0 10px 0 rgba(0,0,0,0.12)",
  border: `${CARD_BORDER_WIDTH}px solid #ffffff`,
};

const buttonBase: React.CSSProperties = {
  fontFamily: "var(--font-baloo)",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
};

export default function StartScreen({
  onPlay,
  highScore,
}: {
  onPlay: () => void;
  highScore: number;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const starburstLogoRef = useRef<HTMLImageElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const paragraphRef = useRef<HTMLParagraphElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const highScoreRef = useRef<HTMLParagraphElement | null>(null);
  const [avoidZones, setAvoidZones] = useState<PctRect[] | null>(null);
  const [wrapperPx, setWrapperPx] = useState<{ width: number; height: number } | null>(null);
  const [pointerPct, setPointerPct] = useState<{ x: number; y: number } | null>(null);
  const isPressedRef = useRef(false);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const logo = logoRef.current;
    const paragraph = paragraphRef.current;
    const button = buttonRef.current;
    if (!wrapper || !logo || !paragraph || !button) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    // A small pixel pad around each avoided element, so candies don't land edge-to-edge
    // with the actual glyphs/artwork -- converted to percent of the wrapper's own box (the
    // same box TitleCandyDecor positions its candies within), not the browser window, since
    // this screen renders inside a centered "phone frame" that isn't always the same size
    // as the window itself.
    const toPct = (r: DOMRect, pad: number): PctRect => ({
      left: ((r.left - wrapperRect.left - pad) / wrapperRect.width) * 100,
      right: ((r.right - wrapperRect.left + pad) / wrapperRect.width) * 100,
      top: ((r.top - wrapperRect.top - pad) / wrapperRect.height) * 100,
      bottom: ((r.bottom - wrapperRect.top + pad) / wrapperRect.height) * 100,
    });

    const zones = [toPct(logo.getBoundingClientRect(), 6), toPct(paragraph.getBoundingClientRect(), 6), toPct(button.getBoundingClientRect(), 6)];
    if (highScoreRef.current) zones.push(toPct(highScoreRef.current.getBoundingClientRect(), 6));
    if (starburstLogoRef.current) zones.push(toPct(starburstLogoRef.current.getBoundingClientRect(), 6));

    setAvoidZones(zones);
    setWrapperPx({ width: wrapperRect.width, height: wrapperRect.height });
  }, [highScore]);

  // Pressing down anywhere except the button pulls the candies in toward that point; letting
  // up (or the pointer leaving/canceling) releases them back to their resting spots.
  const updatePointerPct = (e: React.PointerEvent) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    setPointerPct({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (buttonRef.current?.contains(e.target as Node)) return;
    isPressedRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePointerPct(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPressedRef.current) return;
    updatePointerPct(e);
  };

  const releasePointer = () => {
    isPressedRef.current = false;
    setPointerPct(null);
  };

  return (
    <div
      ref={wrapperRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
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
      <div style={{ position: "relative" }}>
        {highScore > 0 && (
          <p
            ref={highScoreRef}
            style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginBottom: 10,
              whiteSpace: "nowrap",
              fontFamily: "var(--font-baloo)",
              fontWeight: 700,
              color: "#ffffff",
              fontSize: 16,
              letterSpacing: 0.5,
              textShadow: "0 1px 2px rgba(0,0,0,0.25)",
            }}
          >
            High Score: {highScore}
          </p>
        )}
        <div style={cardStyle}>
          <div style={{ marginTop: 25, marginBottom: CARD_TOP_GAP }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={starburstLogoRef}
              src="/StarburstLogo-white.svg"
              alt="Starburst"
              // `display: block` (instead of the img default `inline`) removes the few px of
              // baseline/descender space browsers otherwise reserve below inline images --
              // without it, the gap below ends up a few px taller than CARD_TOP_GAP above,
              // even though both are set to the exact same value.
              style={{ width: 119, height: "auto", display: "block", margin: "0 auto" }}
            />
          </div>
          <div ref={logoRef} style={{ display: "inline-block", marginTop: -5 }}>
            <Logo width={236} />
          </div>
        <p
          ref={paragraphRef}
          style={{
            fontFamily: "var(--font-baloo)",
            fontWeight: 600,
            color: "#ffffff",
            fontSize: 15,
            margin: "7px 0 32px",
            lineHeight: 1.3,
          }}
        >
          Pack your suitcase with all the essentials, and make sure to dodge
          the buzzkills.
          <br />
          This is YOUR Mini Vacay, after all!
        </p>

        <button
          ref={buttonRef}
          onClick={onPlay}
          style={{
            ...buttonBase,
            fontSize: 20,
            padding: "12px 34px",
            borderRadius: 999,
            background: "linear-gradient(160deg, #ffd23f, #ff9f45)",
            color: "#8a3a10",
            boxShadow: "0 5px 0 #c06a1e",
          }}
        >
          Let&apos;s go!
        </button>
        </div>
      </div>
      {avoidZones && wrapperPx && <TitleCandyDecor avoidZones={avoidZones} wrapperPx={wrapperPx} pointerPct={pointerPct} />}
    </div>
  );
}
