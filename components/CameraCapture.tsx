"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type Mode = "idle" | "live" | "reviewing" | "denied";

const buttonStyle: React.CSSProperties = {
  fontFamily: "var(--font-baloo)",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  borderRadius: 999,
  padding: "10px 20px",
  fontSize: 14,
};

// The drop box grows taller while a file is dragged over it, reaching down toward the
// content below -- but its OUTER wrapper always reserves the grown height, so that
// content never shifts regardless of hover state; only the box's own visible height (and
// its dashed border) animates within that fixed reserved space.
const DRAG_BOX_IDLE_HEIGHT = 40;
const DRAG_BOX_HOVER_HEIGHT = 72;

export default function CameraCapture({ onPhotoReady }: { onPhotoReady: (dataUrl: string) => void }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [stillDataUrl, setStillDataUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const buttonsRowRef = useRef<HTMLDivElement | null>(null);
  const [dropBoxWidth, setDropBoxWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      if (buttonsRowRef.current) setDropBoxWidth(buttonsRowRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [mode]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setMode("live");
      // The <video> element only mounts once mode flips to "live" -- attach the stream
      // right after that render happens.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setMode("denied");
    }
  }, []);

  const takeStill = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setStillDataUrl(canvas.toDataURL("image/png"));
    setMode("reviewing");
    // Stream stays alive here -- RETAKE reuses it without a fresh permission prompt.
  }, []);

  const retake = useCallback(() => {
    setStillDataUrl(null);
    setMode("live");
  }, []);

  const keep = useCallback(() => {
    if (!stillDataUrl) return;
    stopStream();
    onPhotoReady(stillDataUrl);
  }, [stillDataUrl, stopStream, onPhotoReady]);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") onPhotoReady(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [onPhotoReady]
  );

  if (mode === "reviewing" && stillDataUrl) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={stillDataUrl}
          alt="Your selfie"
          style={{ width: 220, height: 220, objectFit: "cover", borderRadius: 20, border: "4px solid #ffffff" }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={retake} style={{ ...buttonStyle, background: "#ffe1ea", color: "#b6567a" }}>
            RETAKE
          </button>
          <button onClick={keep} style={{ ...buttonStyle, background: "#57beab", color: "#ffffff" }}>
            KEEP
          </button>
        </div>
      </div>
    );
  }

  if (mode === "live") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ width: 220, height: 220, borderRadius: 20, overflow: "hidden", border: "4px solid #ffffff" }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
        </div>
        <button onClick={takeStill} style={{ ...buttonStyle, background: "#ff6f91", color: "#ffffff", fontSize: 16, padding: "12px 26px" }}>
          📸 Capture
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
      <div ref={buttonsRowRef} style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={startCamera} style={{ ...buttonStyle, background: "#ff6f91", color: "#ffffff" }}>
          📸 Take a Selfie
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ ...buttonStyle, background: "#ffe1ea", color: "#b6567a" }}
        >
          🖼️ Upload Photo
        </button>
      </div>
      {mode === "denied" && (
        <p style={{ fontFamily: "var(--font-baloo)", fontSize: 12, color: "#ffffff", margin: 0, textAlign: "center" }}>
          Couldn&apos;t access your camera -- upload a photo instead.
        </p>
      )}
      {/* Matches the combined width of the two buttons above it (measured via ref, since
          that width is text-driven and not a fixed value). */}
      <div style={{ width: dropBoxWidth ? `${dropBoxWidth}px` : "100%", maxWidth: "100%", height: DRAG_BOX_HOVER_HEIGHT, position: "relative" }}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: dragOver ? DRAG_BOX_HOVER_HEIGHT : DRAG_BOX_IDLE_HEIGHT,
            transition: "height 0.15s ease",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 10px",
            borderRadius: 14,
            border: dragOver ? "2px dashed #ffffff" : "2px dashed rgba(255,255,255,0.55)",
            background: dragOver ? "rgba(255,255,255,0.12)" : "transparent",
            textAlign: "center",
          }}
        >
          <p style={{ fontFamily: "var(--font-baloo)", fontSize: 12, color: "rgba(255,255,255,0.9)", margin: 0 }}>
            drag a photo here
          </p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFile(e.target.files?.[0])}
        style={{ display: "none" }}
      />
    </div>
  );
}
