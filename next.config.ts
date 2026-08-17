import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phaser owns an imperative canvas/WebGL lifecycle that doesn't tolerate
  // Strict Mode's dev-only double-mount (create -> destroy -> create).
  reactStrictMode: false,
  // Vercel's serverless file tracing only picks up files reached via static imports --
  // app/api/avatar/candidates/route.ts reads assets/avatar-template.jpg with a dynamic
  // fs.readFile instead, which the tracer can't see on its own. Without this, the file
  // works locally but 404s once deployed.
  outputFileTracingIncludes: {
    "/api/avatar/candidates": ["./assets/avatar-template.jpg"],
  },
};

export default nextConfig;
