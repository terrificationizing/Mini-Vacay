"use client";

import { useEffect, useRef, useState } from "react";
import { loadImage, processFrownImage, processSmileImage } from "@/lib/avatarPipeline";
import type { CreatedAvatarEntry } from "@/lib/avatarLibrary";

const DEFAULT_IRIS_COLOR = 0x3f2a17;

export default function AvatarPreparingScreen({
  smileImageUrl,
  irisColor,
  avatarRect,
  onReady,
  onError,
}: {
  smileImageUrl: string;
  /** Detected from the user's own original photo (see lib/avatarPipeline.ts's
   *  detectIrisColor) -- falls back to the shared default when detection fails. */
  irisColor: number | null;
  /** The real avatar's current on-screen rect (see MainScene's emitAvatarRect), as
   *  viewport percentages -- lets the shimmer placeholder occupy exactly where the real
   *  avatar will appear instead of an approximated centered position. */
  avatarRect: { xPct: number; yPct: number; widthPct: number; heightPct: number } | null;
  onReady: (entry: CreatedAvatarEntry) => void;
  onError: () => void;
}) {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const smileImg = await loadImage(smileImageUrl);

        const [smileResult, frownRes] = await Promise.all([
          processSmileImage(smileImg, irisColor ?? DEFAULT_IRIS_COLOR),
          fetch("/api/avatar/frown", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ smileImageUrl }),
          }).then(async (res) => {
            if (!res.ok) throw new Error("frown generation failed");
            const data = await res.json();
            if (typeof data.image !== "string") throw new Error("no frown image returned");
            return data.image as string;
          }),
        ]);

        let frownDataUrl: string;
        try {
          const frownImg = await loadImage(frownRes);
          const frownResult = await processFrownImage(frownImg, smileResult.placement);
          frownDataUrl = frownResult.pngDataUrl;
        } catch {
          // Frown generation/processing failed -- reuse the smile texture rather than
          // blocking gameplay on a mood-swap image; the frown moment just looks identical
          // to the smile moment instead of showing an error mid-flourish.
          frownDataUrl = smileResult.pngDataUrl;
        }

        onReady({
          id: `generated-${Date.now()}`,
          createdAt: Date.now(),
          geometry: smileResult.geometry,
          smileDataUrl: smileResult.pngDataUrl,
          frownDataUrl,
        });
      } catch {
        setFailed(true);
        onError();
      }
    })();
  }, [smileImageUrl, irisColor, onReady, onError]);

  if (failed) return null;

  // Percentages, not vw/vh -- this component is rendered as a sibling of <PhaserGame/>
  // inside the exact same wrapper element the canvas itself is sized to fill (see
  // GameRoot.tsx), so a plain % here resolves against that same box Phaser's own
  // this.scale.width/height already matches, with no separate DOM measurement involved.
  const boxStyle: React.CSSProperties = avatarRect
    ? {
        position: "absolute",
        left: `${avatarRect.xPct}%`,
        top: `${avatarRect.yPct}%`,
        width: `${avatarRect.widthPct}%`,
        height: `${avatarRect.heightPct}%`,
      }
    : {
        // Only used for the brief window before the first avatar-rect event arrives.
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 220,
        aspectRatio: "480 / 675",
        transform: "translate(-50%, -50%)",
      };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 15, pointerEvents: "none" }}>
      <div
        style={{
          ...boxStyle,
          WebkitMaskImage: "url(/avatars/template-silhouette.png)",
          maskImage: "url(/avatars/template-silhouette.png)",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center bottom",
          maskPosition: "center bottom",
          background: "linear-gradient(120deg, #7ee6c4, #ffe36e, #ff9f6e, #ff8fc7, #7ee6c4)",
          backgroundSize: "300% 100%",
          animation: "shimmerHue 2.2s linear infinite",
          opacity: 0.85,
        }}
      />
    </div>
  );
}
