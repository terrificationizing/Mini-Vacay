"use client";

import { useEffect, useState } from "react";
import { AVATAR_PROFILES } from "@/data/avatarProfiles";
import type { CreatedAvatarEntry } from "@/lib/avatarLibrary";
import { detectEyeOverlayInfo, loadImage, type EyeOverlayInfo } from "@/lib/avatarPipeline";
import CameraCapture from "./CameraCapture";
import EyeOverlay from "./EyeOverlay";

const cardStyle: React.CSSProperties = {
  background: "#57beab",
  borderRadius: 28,
  padding: "20px 20px 26px",
  width: "min(380px, 92vw)",
  textAlign: "center",
  boxShadow: "0 10px 0 rgba(0,0,0,0.12)",
  border: "4px solid #ffffff",
  maxHeight: "88vh",
  overflowY: "auto",
};

const buttonStyle: React.CSSProperties = {
  fontFamily: "var(--font-baloo)",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  borderRadius: 999,
};

// Every avatar (preloaded or created) is composited onto the same 720x1100 canvas (see
// lib/avatarPipeline.ts), but each photo's head sits at a different height within that
// canvas -- so a single fixed objectPosition crops each thumbnail's face to a different
// spot. Abe's framing (at the old fixed 22%) was the one that looked right, so every other
// avatar's crop is solved to land its own eye-line at that exact same spot in the box.
const CANVAS_W = 720;
const CANVAS_H = 1100;
const ASPECT_RATIO = CANVAS_H / CANVAS_W;
const BASELINE_OBJECT_POSITION_Y = 22;

function containerYPct(imageYPct: number, objectPositionY: number): number {
  return imageYPct * ASPECT_RATIO - (ASPECT_RATIO - 1) * objectPositionY;
}

function objectPositionYForEyeLine(imageEyeYPct: number, targetContainerYPct: number): number {
  const y = (imageEyeYPct * ASPECT_RATIO - targetContainerYPct) / (ASPECT_RATIO - 1);
  return Math.max(0, Math.min(100, y));
}

function toContainerEyeInfo(raw: EyeOverlayInfo, objectPositionY: number): EyeOverlayInfo {
  return {
    left: { xPct: raw.left.xPct, yPct: containerYPct(raw.left.yPct, objectPositionY) },
    right: { xPct: raw.right.xPct, yPct: containerYPct(raw.right.yPct, objectPositionY) },
    scleraWidthPct: raw.scleraWidthPct,
    scleraHeightPct: raw.scleraHeightPct * ASPECT_RATIO,
  };
}

type SlotVisual = { objectPositionY: number; eyeInfo: EyeOverlayInfo | null };

function GridSlot({
  label,
  thumbSrc,
  objectPositionY,
  eyeInfo,
  irisColor,
  eyeAnimationDirection,
  onClick,
}: {
  label: string;
  thumbSrc: string;
  objectPositionY: number;
  eyeInfo: EyeOverlayInfo | null | undefined;
  irisColor: number;
  eyeAnimationDirection: "normal" | "reverse";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 4,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 82,
          height: 82,
          borderRadius: 16,
          overflow: "hidden",
          border: "2px solid #5bd6bf",
          background: "#6fefd7",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbSrc}
          alt={label}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `center ${objectPositionY}%` }}
        />
        {eyeInfo && <EyeOverlay info={eyeInfo} irisColor={irisColor} animationDirection={eyeAnimationDirection} />}
      </div>
      <span style={{ fontFamily: "var(--font-baloo)", fontWeight: 600, fontSize: 11, color: "#ffffff" }}>{label}</span>
    </button>
  );
}

// Newest created avatar first, at the FRONT of the grid (top-left onward); preloaded
// characters fill whatever slots are left, in their own original order, so it's always
// the TAIL of the preloaded list (MJ, then Nichole, then Matt...) that gets displaced as
// more are created -- never the front ones.
type GridEntry = { kind: "created"; entry: CreatedAvatarEntry } | { kind: "preloaded"; profile: (typeof AVATAR_PROFILES)[number] };

function buildGridSlots(avatarLibrary: CreatedAvatarEntry[]): GridEntry[] {
  const newestFirst = [...avatarLibrary].reverse();
  const slots: GridEntry[] = newestFirst.map((entry) => ({ kind: "created", entry }));
  for (const profile of AVATAR_PROFILES) {
    if (slots.length >= AVATAR_PROFILES.length) break;
    slots.push({ kind: "preloaded", profile });
  }
  return slots;
}

export default function PhotoSelectScreen({
  capturedPhotoDataUrl,
  onPhotoReady,
  onDiscardPhoto,
  onMakeMiniMe,
  onUsePreloaded,
  onUseCreated,
  onDeleteCreated,
  onRenameCreated,
  avatarLibrary,
}: {
  capturedPhotoDataUrl: string | null;
  onPhotoReady: (dataUrl: string) => void;
  /** Clears the captured selfie/upload -- without this, once a photo is captured there was
   *  no way back to the camera/upload buttons or the picker grid short of generating a
   *  Mini Me, which is a dead end if e.g. the upload itself was the wrong photo. */
  onDiscardPhoto: () => void;
  onMakeMiniMe: () => void;
  onUsePreloaded: (id: string) => void;
  onUseCreated: (entry: CreatedAvatarEntry) => void;
  onDeleteCreated: (id: string) => void;
  onRenameCreated: (id: string, name: string) => void;
  avatarLibrary: CreatedAvatarEntry[];
}) {
  const [previewing, setPreviewing] = useState<CreatedAvatarEntry | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [slotVisuals, setSlotVisuals] = useState<Record<string, SlotVisual>>({});
  const canRename = previewing !== null && nameDraft.trim() !== "" && nameDraft !== (previewing.name ?? "");

  const openPreview = (entry: CreatedAvatarEntry) => {
    setPreviewing(entry);
    setNameDraft(entry.name ?? "");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const abeProfile = AVATAR_PROFILES.find((p) => p.id === "abe");
      if (!abeProfile) return;
      let targetContainerYPct: number;
      try {
        const abeImg = await loadImage(abeProfile.smileSrc);
        const abeRaw = await detectEyeOverlayInfo(abeImg);
        if (!abeRaw) return;
        const abeEyeYPct = (abeRaw.left.yPct + abeRaw.right.yPct) / 2;
        targetContainerYPct = containerYPct(abeEyeYPct, BASELINE_OBJECT_POSITION_Y);
      } catch {
        return;
      }
      if (cancelled) return;

      buildGridSlots(avatarLibrary).forEach((slot) => {
        const key = slot.kind === "created" ? slot.entry.id : slot.profile.id;
        const thumbSrc = slot.kind === "created" ? slot.entry.smileDataUrl : slot.profile.smileSrc;
        (async () => {
          try {
            const img = await loadImage(thumbSrc);
            const raw = await detectEyeOverlayInfo(img);
            if (!raw || cancelled) return;
            const eyeYPct = (raw.left.yPct + raw.right.yPct) / 2;
            const objectPositionY = objectPositionYForEyeLine(eyeYPct, targetContainerYPct);
            const eyeInfo = toContainerEyeInfo(raw, objectPositionY);
            if (!cancelled) setSlotVisuals((prev) => ({ ...prev, [key]: { objectPositionY, eyeInfo } }));
          } catch {
            // leave this slot at the default framing/no iris overlay
          }
        })();
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarLibrary]);

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
        <h2 style={{ fontFamily: "var(--font-baloo)", fontWeight: 800, color: "#ffffff", fontSize: 44, margin: "4px 0 0" }}>
          Be Yourself!
        </h2>
        <p style={{ fontFamily: "var(--font-baloo)", fontWeight: 600, color: "rgba(255,255,255,0.9)", fontSize: 13, margin: "-18px 0 22px" }}>
          Play as your own Mini character in the game.
        </p>

        {!capturedPhotoDataUrl ? (
          <CameraCapture onPhotoReady={onPhotoReady} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedPhotoDataUrl}
              alt="Your photo"
              style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 20, border: "4px solid #ffffff" }}
            />
            <button
              onClick={onMakeMiniMe}
              style={{ ...buttonStyle, fontSize: 18, padding: "12px 30px", background: "linear-gradient(160deg, #ffd23f, #ff9f45)", color: "#8a3a10", boxShadow: "0 5px 0 #c06a1e" }}
            >
              Make a Mini Me!
            </button>
            <button
              onClick={onDiscardPhoto}
              style={{ ...buttonStyle, fontSize: 13, padding: "8px 20px", background: "#ffe1ea", color: "#b6567a" }}
            >
              ← Back
            </button>
          </div>
        )}

        {!capturedPhotoDataUrl && (
          <>
            <p style={{ fontFamily: "var(--font-baloo)", fontWeight: 600, color: "#ffffff", fontSize: 13, margin: "34px 0 10px" }}>
              ...or play as a character already created.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, justifyItems: "center" }}>
              {buildGridSlots(avatarLibrary).map((slot, i) => {
                const key = slot.kind === "created" ? slot.entry.id : slot.profile.id;
                const visual = slotVisuals[key];
                const eyeAnimationDirection = i % 2 === 0 ? "normal" : "reverse";
                return slot.kind === "created" ? (
                  <GridSlot
                    key={key}
                    label={slot.entry.name?.trim() || "Your Mini Me"}
                    thumbSrc={slot.entry.smileDataUrl}
                    objectPositionY={visual?.objectPositionY ?? BASELINE_OBJECT_POSITION_Y}
                    eyeInfo={visual?.eyeInfo}
                    irisColor={slot.entry.geometry.irisColor}
                    eyeAnimationDirection={eyeAnimationDirection}
                    onClick={() => openPreview(slot.entry)}
                  />
                ) : (
                  <GridSlot
                    key={key}
                    label={slot.profile.displayName}
                    thumbSrc={slot.profile.smileSrc}
                    objectPositionY={visual?.objectPositionY ?? BASELINE_OBJECT_POSITION_Y}
                    eyeInfo={visual?.eyeInfo}
                    irisColor={slot.profile.irisColor}
                    eyeAnimationDirection={eyeAnimationDirection}
                    onClick={() => onUsePreloaded(slot.profile.id)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {previewing && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ ...cardStyle, width: "min(280px, 80vw)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewing.smileDataUrl}
              alt="Your Mini Me"
              style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 20, border: "4px solid #ffffff", margin: "0 auto 16px" }}
            />
            <div style={{ position: "relative", marginBottom: 14 }}>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Name your character!"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "var(--font-baloo)",
                  fontWeight: 600,
                  fontSize: 14,
                  color: "#2f302f",
                  background: "#ffffff",
                  border: "none",
                  borderRadius: 999,
                  padding: canRename ? "8px 78px 8px 16px" : "8px 16px",
                  textAlign: "left",
                  outline: "none",
                }}
              />
              {canRename && (
                <button
                  onClick={() => {
                    const name = nameDraft.trim();
                    onRenameCreated(previewing.id, name);
                    setPreviewing((prev) => (prev ? { ...prev, name } : prev));
                  }}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontFamily: "var(--font-baloo)",
                    fontWeight: 700,
                    fontSize: 11,
                    color: "#ffffff",
                    background: "#ff6f91",
                    border: "none",
                    borderRadius: 999,
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  RENAME
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => {
                  onDeleteCreated(previewing.id);
                  setPreviewing(null);
                }}
                style={{ ...buttonStyle, fontSize: 14, padding: "10px 20px", background: "#1f8f7a", color: "#ffffff" }}
              >
                DELETE
              </button>
              <button
                onClick={() => onUseCreated(previewing)}
                style={{
                  ...buttonStyle,
                  fontSize: 14,
                  padding: "10px 20px",
                  background: "linear-gradient(160deg, #ffd23f, #ff9f45)",
                  color: "#8a3a10",
                  boxShadow: "0 5px 0 #c06a1e",
                }}
              >
                USE
              </button>
            </div>
            <button
              onClick={() => setPreviewing(null)}
              style={{ ...buttonStyle, fontSize: 12, padding: "8px", background: "none", color: "#ffffff", marginTop: 10 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
