"use client";

import { useEffect, useRef, useState } from "react";
import { loadImage, processFrownImage, processSmileImage } from "@/lib/avatarPipeline";
import type { CreatedAvatarEntry } from "@/lib/avatarLibrary";

const DEFAULT_IRIS_COLOR = 0x3f2a17;

export default function AvatarPreparingScreen({
  smileImageUrl,
  irisColor,
  onReady,
  onError,
}: {
  smileImageUrl: string;
  /** Detected from the user's own original photo (see lib/avatarPipeline.ts's
   *  detectIrisColor) -- falls back to the shared default when detection fails. */
  irisColor: number | null;
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

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 15, overflow: "hidden", pointerEvents: "none" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pool.png" alt="" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "auto", display: "block" }} />
      <div
        style={{
          width: 220,
          aspectRatio: "480 / 675",
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
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
      {/* Layered directly over the avatar (same centered spot, later in DOM so it sits on
          top) rather than below it. */}
      <p
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: "var(--font-baloo)",
          fontWeight: 800,
          fontSize: 34,
          lineHeight: 0.95,
          margin: 0,
          letterSpacing: 0.5,
          textAlign: "center",
          whiteSpace: "nowrap",
          // Same gradient/animation family as the avatar's own shimmer above, so the two
          // visually read as shimmering together -- background-clip:text sweeping the
          // gradient left-to-right on a loop instead of a static fill color.
          background: "linear-gradient(120deg, #7ee6c4, #ffe36e, #ff9f6e, #ff8fc7, #7ee6c4)",
          backgroundSize: "300% 100%",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "shimmerHue 2.2s linear infinite",
          // text-shadow doesn't render with a transparent fill, but drop-shadow works off
          // the glyphs' own alpha shape regardless of fill color -- needed for legibility
          // sitting directly on top of the avatar shimmer.
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))",
        }}
      >
        Vacation
        <br />
        Loading...
      </p>
    </div>
  );
}
