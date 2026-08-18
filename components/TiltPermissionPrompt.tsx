"use client";

const buttonStyle: React.CSSProperties = {
  fontFamily: "var(--font-baloo)",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  borderRadius: 999,
  fontSize: 14,
  padding: "10px 22px",
};

export default function TiltPermissionPrompt({ onChoice }: { onChoice: (useTilt: boolean) => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 25, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(238, 60, 108, 0.25)" }}>
      <div
        style={{
          background: "rgba(238, 60, 108, 0.9)",
          borderRadius: 24,
          padding: "22px 26px",
          width: "min(280px, 82vw)",
          textAlign: "center",
          boxShadow: "0 8px 0 rgba(0,0,0,0.15)",
        }}
      >
        <p style={{ fontFamily: "var(--font-baloo)", fontWeight: 700, color: "#ffffff", fontSize: 15, margin: "0 0 16px", lineHeight: 1.25 }}>
          Tilt your phone to catch items in your suitcase!
        </p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => onChoice(true)}
            style={{ ...buttonStyle, background: "linear-gradient(160deg, #ffd23f, #ff9f45)", color: "#8a3a10", boxShadow: "0 4px 0 #c06a1e", width: "min(200px, 60vw)" }}
          >
            Allow Tilt
          </button>
          <button
            onClick={() => onChoice(false)}
            style={{ ...buttonStyle, background: "#ffe1ea", color: "#b6567a", width: "min(200px, 60vw)" }}
          >
            Use Drag Instead
          </button>
        </div>
      </div>
    </div>
  );
}
