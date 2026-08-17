"use client";

import type { EyeOverlayInfo } from "@/lib/avatarPipeline";

// The generated candidates are prompted to have blank white eyes (so the in-game rig's own
// painted pupils don't double up on top of a real iris) -- but shown blank on the
// picker/grid previews, that reads as unsettling. This draws a live-look-alike iris/pupil
// over each detected eye position, colored to match what the in-game avatar will actually
// use (see lib/avatarPipeline.ts's detectIrisColor).
//
// Mirrors the real rig's own masking behavior (see clipPupilToSclera/applyAvatarProfile in
// game/MainScene.ts) rather than its exact constants -- the rig's numbers are calibrated
// for its own zoomed-in avatar canvas, where the face fills most of the frame; on these
// raw, un-cropped candidate photos the face is a much smaller fraction of the image, so
// porting the rig's absolute size multiplier verbatim renders an all-but-invisible dot.
// What DOES carry over directly: the iris is a circle boosted past the sclera's own size,
// anchored by its BOTTOM edge a small gap above the sclera's bottom, and clipped only
// vertically (top/bottom) to the sclera's own box -- never horizontally, never as an
// ellipse.
const IRIS_SIZE_BOOST = 1.91664;
const IRIS_BOTTOM_GAP_FRACTION = 0.3;

function hexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function Eye({
  pos,
  scleraWidthPct,
  scleraHeightPct,
  irisColor,
  animationDirection,
}: {
  pos: { xPct: number; yPct: number };
  scleraWidthPct: number;
  scleraHeightPct: number;
  irisColor: number;
  animationDirection: "normal" | "reverse";
}) {
  const irisWidthPctOfWindow = ((scleraHeightPct * IRIS_SIZE_BOOST) / scleraWidthPct) * 100;

  return (
    <div
      style={{
        position: "absolute",
        left: `${pos.xPct}%`,
        top: `${pos.yPct}%`,
        width: `${scleraWidthPct}%`,
        height: `${scleraHeightPct}%`,
        transform: "translate(-50%, -50%)",
        // Rectangular clip, NOT a circle/ellipse -- the real rig only ever clips the iris
        // vertically to the sclera band, never horizontally.
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: `${IRIS_BOTTOM_GAP_FRACTION * 100}%`,
          width: `${irisWidthPctOfWindow}%`,
          aspectRatio: "1 / 1",
          transform: "translateX(-50%)",
          borderRadius: "50%",
          background: hexColor(irisColor),
          boxShadow: "inset 0 0 0 999px rgba(0,0,0,0.08)",
          animation: `eyeLookAround 4.5s ease-in-out infinite ${animationDirection}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "38%",
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            background: "#000000",
            transform: "translate(-50%, -50%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "60%",
            top: "34%",
            width: "16%",
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
    </div>
  );
}

export default function EyeOverlay({
  info,
  irisColor,
  animationDirection = "normal",
}: {
  info: EyeOverlayInfo;
  irisColor: number;
  /** Lets neighboring avatars (e.g. every other grid slot) start their eye-wobble out of
   *  phase with each other, instead of every eye on screen moving in lockstep. */
  animationDirection?: "normal" | "reverse";
}) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Eye pos={info.left} scleraWidthPct={info.scleraWidthPct} scleraHeightPct={info.scleraHeightPct} irisColor={irisColor} animationDirection={animationDirection} />
      <Eye pos={info.right} scleraWidthPct={info.scleraWidthPct} scleraHeightPct={info.scleraHeightPct} irisColor={irisColor} animationDirection={animationDirection} />
    </div>
  );
}
