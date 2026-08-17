import Image from "next/image";

export default function Logo({ width = 200 }: { width?: number }) {
  return (
    <Image
      src="/MiniVacayLogo.svg"
      alt="Mini Vacay"
      width={343}
      height={280}
      style={{ width, height: "auto", display: "block", margin: "0 auto" }}
      priority
      draggable={false}
    />
  );
}
