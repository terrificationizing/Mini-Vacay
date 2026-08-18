import Image from "next/image";

export default function Logo({ width = 200 }: { width?: number }) {
  return (
    <Image
      src="/MiniVacayLogo.svg"
      alt="Mini Vacay"
      width={343}
      height={280}
      style={{
        width,
        height: "auto",
        display: "block",
        margin: "0 auto",
        // A long-press near the logo during a catch-gesture on mobile was triggering the
        // browser's native "save/copy image" callout -- these suppress that (and the
        // matching text-selection long-press) without affecting the drag/tilt game controls,
        // which don't target this element at all.
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      priority
      draggable={false}
    />
  );
}
