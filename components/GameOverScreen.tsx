"use client";

import CandyIcon from "./CandyIcon";

const SUITCASE_FLAT_SIZE = 250;
const WELL = { left: 0.1, right: 0.906, top: 0.222, bottom: 0.667 };
const SUITCASE_TOP_FRACTION = 51 / 360;
const SUITCASE_HANDLE_BOTTOM_FRACTION = 309 / 360;
const SUITCASE_VISIBLE_HEIGHT = SUITCASE_FLAT_SIZE * (SUITCASE_HANDLE_BOTTOM_FRACTION - SUITCASE_TOP_FRACTION);
const wellStyle: React.CSSProperties = {
  position: "absolute",
  left: `${WELL.left * 100}%`,
  right: `${(1 - WELL.right) * 100}%`,
  top: `${WELL.top * 100}%`,
  bottom: `${(1 - WELL.bottom) * 100}%`,
};

// Half of the earlier 3x size (which was too big), then reduced another 25%: (4*26 + 3*8) * 3 / 2 * 0.75.
const MINIPACK_WIDTH = 144;

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.94)",
  borderRadius: 28,
  padding: "20px 24px 32px",
  width: "min(320px, 88vw)",
  // Safety net for very tall content (e.g. large candy counts) -- scroll inside the card
  // itself, the same pattern PhotoSelectScreen's card already uses. Content is sized to
  // fit well within this on a typical viewport.
  maxHeight: "92vh",
  overflowY: "auto",
  textAlign: "center",
  boxShadow: "0 10px 0 rgba(0,0,0,0.12)",
  border: "4px solid #ffffff",
};

const pillButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-baloo)",
  fontWeight: 700,
  fontSize: 19,
  padding: "9px 28px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  width: "min(210px, 55vw)",
  whiteSpace: "nowrap",
};

const starburstLinkStyle: React.CSSProperties = {
  fontFamily: "var(--font-baloo)",
  fontWeight: 700,
  fontSize: 13,
  color: "#ffffff",
  textDecoration: "underline",
  textAlign: "center",
  lineHeight: 1.3,
};

// Every avatar is composited onto the same 720x1100 canvas (see lib/avatarPipeline.ts /
// data/avatarProfiles.ts), but each photo's head sits at a different height within that
// canvas -- a single fixed crop only ever looked right for whichever avatar it was tuned
// against (Abe). Every other avatar's crop is solved so its own eye-line lands at that same
// spot, the same calibration approach used for the Be Yourself grid (see
// PhotoSelectScreen.tsx). The zoom itself (AVATAR_CIRCLE_SCALE) stays fixed across avatars,
// since head SIZE is already normalized by the shared reference eye spacing.
const CANVAS_W = 720;
const CANVAS_H = 1100;
const ASPECT_RATIO = CANVAS_H / CANVAS_W;
const AVATAR_CIRCLE_SCALE = 1.45;
// Abe's own eye-line sits at 213.4 "local" units (see data/avatarProfiles.ts, local = canvas
// px / 2) -> 38.8% of the 1100px canvas height. Paired with a 30% objectPosition, that's the
// combination that was tuned by eye to look right for Abe specifically.
const REFERENCE_EYE_Y_PCT = ((213.4 * 2) / CANVAS_H) * 100;
const REFERENCE_OBJECT_POSITION_Y = 30;
const REFERENCE_TARGET = REFERENCE_EYE_Y_PCT * ASPECT_RATIO - (ASPECT_RATIO - 1) * REFERENCE_OBJECT_POSITION_Y;

function avatarCircleObjectPositionY(eyeYPct: number): number {
  const y = (eyeYPct * ASPECT_RATIO - REFERENCE_TARGET) / (ASPECT_RATIO - 1);
  return Math.max(0, Math.min(100, y));
}

export default function GameOverScreen({
  score,
  candyCount,
  bonusCount,
  avatarFrownSrc,
  avatarEyeYPct,
  onRestart,
  onStartOver,
}: {
  score: number;
  candyCount: number;
  bonusCount: number;
  avatarFrownSrc: string | null;
  /** The current avatar's eye-line, as a percentage of the shared 720x1100 canvas height --
   *  used to calibrate the avatar circle's crop per-avatar (see avatarCircleObjectPositionY
   *  above). Falls back to Abe's own reference position when unavailable. */
  avatarEyeYPct: number | null;
  onRestart: () => void;
  onStartOver: () => void;
}) {
  const objectPositionY = avatarCircleObjectPositionY(avatarEyeYPct ?? REFERENCE_EYE_Y_PCT);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        background: "rgba(238, 60, 108, 0.35)",
      }}
    >
      <div style={cardStyle}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            overflow: "hidden",
            border: "4px solid #ff6f91",
            margin: "0 auto 8px",
            background: "#ffe1ea",
          }}
        >
          {avatarFrownSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarFrownSrc}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `center ${objectPositionY}%`,
                transform: `scale(${AVATAR_CIRCLE_SCALE})`,
                transformOrigin: "50% 0%",
              }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
              🏖️
            </div>
          )}
        </div>
        <h2 style={{ fontFamily: "var(--font-baloo)", fontWeight: 800, color: "#ff6f91", fontSize: 26, margin: "6px 0 2px" }}>
          Trip Interrupted :/
        </h2>
        <p style={{ fontFamily: "var(--font-baloo)", fontWeight: 600, color: "#7a3a55", fontSize: 16, margin: "0 0 0" }}>
          You got <strong style={{ color: "#e8482f" }}>{score}</strong> vacay points
        </p>
        <p style={{ fontFamily: "var(--font-baloo)", fontWeight: 600, color: "#7a3a55", fontSize: 16, margin: "-6px 0 16px" }}>
          and <strong style={{ color: "#e8482f" }}>{bonusCount}</strong> candy bonus{bonusCount === 1 ? "" : "es"}
        </p>
        <p style={{ fontFamily: "var(--font-baloo)", fontWeight: 600, color: "#1f8f7a", fontSize: 13, margin: "0 0 4px" }}>
          You collected <strong style={{ color: "#e8482f" }}>{candyCount}</strong> Starburst® Minis total
        </p>

        <div style={{ position: "relative", left: "50%", transform: "translateX(-50%)", width: SUITCASE_FLAT_SIZE, height: SUITCASE_VISIBLE_HEIGHT, overflow: "hidden" }}>
          <div style={{ position: "relative", top: -SUITCASE_FLAT_SIZE * SUITCASE_TOP_FRACTION, width: SUITCASE_FLAT_SIZE, height: SUITCASE_FLAT_SIZE }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/suitcase-flat.svg" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            <div style={wellStyle}>
              {candyCount > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(20px, 1fr))", gap: 5, height: "100%", overflowY: "auto", alignContent: "start", padding: 4 }}>
                  {Array.from({ length: candyCount }).map((_, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "center" }}>
                      <CandyIcon colorIndex={i} size={20} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontFamily: "var(--font-baloo)", fontWeight: 600, color: "#e5fbf7", fontSize: 13, lineHeight: 1.1, margin: 0, padding: "0 8px" }}>
                    No Starburst®?
                    <br />
                    Better go repack.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 22 }}>
          <button
            onClick={onRestart}
            style={{
              ...pillButtonStyle,
              background: "linear-gradient(160deg, #ffd23f, #ff9f45)",
              color: "#8a3a10",
              boxShadow: "0 5px 0 #c06a1e",
              marginTop: 3,
            }}
          >
            Play Again
          </button>
          <button onClick={onStartOver} style={{ ...pillButtonStyle, background: "linear-gradient(160deg, #ff8fb3, #ff6f91)", color: "#7a1f3a", boxShadow: "0 5px 0 #c23a5c" }}>
            Start Over
          </button>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/minipack.png" alt="" style={{ width: MINIPACK_WIDTH, height: "auto", marginTop: 18, animation: "packWiggle 2.2s ease-in-out infinite" }} />
      <a
        href="https://www.starburst.com/"
        target="_blank"
        rel="noopener noreferrer"
        style={starburstLinkStyle}
      >
        Pack for your next Mini Vacay at Starburst.com
      </a>
    </div>
  );
}
