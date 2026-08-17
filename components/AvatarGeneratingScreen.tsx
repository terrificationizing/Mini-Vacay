"use client";

import { useEffect, useRef, useState } from "react";
import { checkIrisPresence, detectIrisColor, loadImage } from "@/lib/avatarPipeline";

const cardStyle: React.CSSProperties = {
  background: "#57beab",
  borderRadius: 28,
  padding: "30px 24px",
  width: "min(320px, 88vw)",
  textAlign: "center",
  boxShadow: "0 10px 0 rgba(0,0,0,0.12)",
  border: "4px solid #ffffff",
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function shuffle<T>(items: T[]): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (pool.length > 0) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

/** Hard filter, not a ranking: candidates that still show a visible iris/pupil (the prompt
 *  demands blank white eyes, but Nano Banana doesn't honor that on every output in a batch)
 *  are NEVER shown to the user -- an iris slipping through here doesn't just look wrong, it
 *  also throws off the in-game scale/placement math downstream (eye-spacing detection reads
 *  the iris as breaking up the sclera blob, which can push the whole avatar's head off the
 *  top of the canvas). A candidate that couldn't be checked at all (unusual framing, load
 *  error) is treated as unconfirmed-bad, not confirmed-clean, and is dropped too -- only
 *  candidates that positively passed the check are eligible. Returns at most 3, at least 2
 *  or none (caller decides what "none" means for the UI). */
async function filterCleanCandidates(urls: string[]): Promise<string[]> {
  const checked = await Promise.all(
    urls.map(async (url) => {
      try {
        const img = await loadImage(url);
        return { url, check: await checkIrisPresence(img) };
      } catch {
        return { url, check: "unknown" as const };
      }
    })
  );
  const clean = shuffle(checked.filter((c) => c.check === "clean").map((c) => c.url));
  if (clean.length < 2) return [];
  return clean.slice(0, 3);
}

export default function AvatarGeneratingScreen({
  photoDataUrl,
  onCandidates,
  onBack,
}: {
  photoDataUrl: string;
  onCandidates: (urls: string[], irisColor: number | null) => void;
  onBack: () => void;
}) {
  const [error, setError] = useState<"generation" | "no-clean-candidates" | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const formData = new FormData();
        formData.append("selfie", dataUrlToBlob(photoDataUrl), "selfie.png");
        // Iris color comes from the ORIGINAL photo (a real face, so it has a genuine
        // visible iris) -- runs in parallel with generation since it's independent of it.
        const irisColorPromise = loadImage(photoDataUrl)
          .then((img) => detectIrisColor(img))
          .catch(() => null);
        const res = await fetch("/api/avatar/candidates", { method: "POST", body: formData });
        if (!res.ok) throw new Error("generation failed");
        const data = await res.json();
        if (!Array.isArray(data.images) || data.images.length === 0) throw new Error("no images returned");
        const [clean, irisColor] = await Promise.all([filterCleanCandidates(data.images), irisColorPromise]);
        if (clean.length === 0) {
          setError("no-clean-candidates");
          return;
        }
        onCandidates(clean, irisColor);
      } catch {
        setError("generation");
      }
    })();
  }, [photoDataUrl, onCandidates]);

  return (
    <div
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
      <div style={cardStyle}>
        {error ? (
          <>
            <p style={{ fontFamily: "var(--font-baloo)", fontWeight: 700, color: "#ffffff", fontSize: 16, margin: "0 0 18px" }}>
              {error === "no-clean-candidates"
                ? "We couldn't get a clean result from that photo. Try a clearer, well-lit photo facing the camera."
                : "Hmm, that didn't work. Let's try again."}
            </p>
            <button
              onClick={onBack}
              style={{
                fontFamily: "var(--font-baloo)",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                borderRadius: 999,
                padding: "10px 24px",
                fontSize: 14,
                background: "#ffe1ea",
                color: "#b6567a",
              }}
            >
              Back
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                width: 90,
                height: 90,
                margin: "0 auto 20px",
                animation: "candySpin 3.5s ease-in-out infinite, candyColorFade 2.5s linear infinite",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/starburst-yellow.svg" alt="" style={{ width: "100%", height: "100%" }} />
            </div>
            <p style={{ fontFamily: "var(--font-baloo)", fontWeight: 700, color: "#ffffff", fontSize: 16, margin: 0 }}>
              Making your Mini Me...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
