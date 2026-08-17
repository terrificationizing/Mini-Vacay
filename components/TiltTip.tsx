"use client";

export default function TiltTip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 25, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "38%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "auto",
          background: "rgba(238, 60, 108, 0.85)",
          borderRadius: 20,
          padding: "16px 40px 16px 22px",
          width: "min(260px, 78vw)",
          boxShadow: "0 6px 0 rgba(0,0,0,0.15)",
        }}
      >
        <button
          onClick={onDismiss}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            background: "none",
            border: "none",
            color: "#ffffff",
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1,
            padding: 4,
            cursor: "pointer",
          }}
        >
          ×
        </button>
        <p style={{ fontFamily: "var(--font-baloo)", fontWeight: 700, color: "#ffffff", fontSize: 15, margin: 0, textAlign: "center" }}>
          Tilt your head to move the suitcase!
        </p>
      </div>
    </div>
  );
}
