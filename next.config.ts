import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phaser owns an imperative canvas/WebGL lifecycle that doesn't tolerate
  // Strict Mode's dev-only double-mount (create -> destroy -> create).
  reactStrictMode: false,
};

export default nextConfig;
