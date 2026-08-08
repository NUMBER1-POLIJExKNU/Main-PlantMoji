import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Documented experimental flag (already the v16.1+ default, set explicitly for clarity): persist Turbopack's dev compilation to .next/dev/cache/turbopack so restarting `next dev` reuses prior work instead of recompiling cold.
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  // The team designer's pixel-farm page (used verbatim from public/farm/)
  // is the main screen; the React routes stay for quests/collection/etc.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/farm/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
