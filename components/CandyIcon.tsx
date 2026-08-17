const CANDY_ART = ["/starburst-red.svg", "/starburst-orange.svg", "/starburst-green.svg", "/starburst-yellow.svg"];

export default function CandyIcon({ colorIndex = 0, size = 28 }: { colorIndex?: number; size?: number }) {
  const src = CANDY_ART[colorIndex % CANDY_ART.length];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} style={{ flexShrink: 0, display: "block" }} />
  );
}
