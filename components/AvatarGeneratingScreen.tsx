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

/** Picks 3 of the 4 candidates, prioritizing ones that pass a check for still showing a
 *  visible iris/pupil -- the prompt demands blank white eyes, but Nano Banana doesn't
 *  honor that on every output in a batch (confirmed: real generations have come back with
 *  1 of 4 candidates showing colored irises despite the same prompt). Clean candidates are
 *  shown first; a candidate that couldn't be checked (unusual framing, load error) ranks
 *  above a confirmed-iris one but below a confirmed-clean one, since it's not confirmed
 *  bad, just unconfirmed. Only falls back to iris-flagged candidates if fewer than 3 clean/
 *  unknown ones exist, so a genuinely bad batch still shows *something* rather than nothing. */
async function rankAndPickThree(urls: string[]): Promise<string[]> {
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
  const unknown = shuffle(checked.filter((c) => c.check === "unknown").map((c) => c.url));
  const iris = shuffle(checked.filter((c) => c.check === "iris").map((c) => c.url));
  return [...clean, ...unknown, ...iris].slice(0, 3);
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
  const [error, setError] = useState(false);
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
        const [ranked, irisColor] = await Promise.all([rankAndPickThree(data.images), irisColorPromise]);
        onCandidates(ranked, irisColor);
      } catch {
        setError(true);
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
              Hmm, that didn&apos;t work. Let&apos;s try again.
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
