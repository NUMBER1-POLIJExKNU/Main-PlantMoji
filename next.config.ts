import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
