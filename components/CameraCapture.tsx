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
  // Desktop webcams (especially external/USB ones) can take noticeably longer than a
  // phone's front camera to actually deliver their first frame after getUserMedia
  // resolves -- capturing before then reads a 0x0 video, producing an unrenderable still.
  // Gates the Capture button on the stream's `loadeddata` event instead of just on mode.
  const [videoReady, setVideoReady] = useState(false);
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

  // Runs whenever "live" mode is (re-)entered -- covers both the very first camera start
  // AND retake(), which unmounts the reviewing view's <img> and mounts a brand-new <video>
  // element that otherwise has no idea a stream already exists. Attaching here, once, in
  // one place keeps those two paths from drifting out of sync with each other.
  useEffect(() => {
    if (mode !== "live") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {});
    video.onloadeddata = () => setVideoReady(true);
    return () => {
      video.onloadeddata = null;
    };
  }, [mode]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setVideoReady(false);
      setMode("live");
    } catch {
      setMode("denied");
    }
  }, []);

  const takeStill = useCallback(() => {
    const video = videoRef.current;
    // videoWidth/videoHeight are only populated once the stream has actually delivered a
    // frame -- capturing before then would size the canvas 0x0 and produce an
    // unrenderable still, so this bails rather than trusting the button's disabled state
    // alone.
    if (!video || !video.videoWidth || !video.videoHeight) return;
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
    // The remounted <video> element needs its own `loadeddata` before it has real frame
    // data, even though the underlying stream was already flowing -- same gate as the
    // initial start, handled by the mode-keyed effect above.
    setVideoReady(false);
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
          <button
            onClick={keep}
            style={{
              ...buttonStyle,
              background: "linear-gradient(160deg, #ffd23f, #ff9f45)",
              color: "#8a3a10",
              boxShadow: "0 3px 0 #c06a1e",
            }}
          >
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
        <button
          onClick={takeStill}
          disabled={!videoReady}
          style={{
            ...buttonStyle,
            background: videoReady ? "#ff6f91" : "#d99cad",
            color: "#ffffff",
            fontSize: 16,
            padding: "12px 26px",
            cursor: videoReady ? "pointer" : "default",
          }}
        >
          {videoReady ? "📸 Capture" : "Starting camera…"}
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
