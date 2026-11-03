import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lightsail release: GitHub Actions builds with STANDALONE=1 so the server only runs
  // `node server.js`. Netlify builds leave it unset and are unchanged.
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  // Keep server.js at the top of the standalone folder even if a parent folder has a lockfile.
  outputFileTracingRoot: process.env.STANDALONE === "1" ? process.cwd() : undefined,
  // Excel uploads (salary workbooks, punch files) go through server actions.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  images: {
    // Stock photos are downloaded into /public/images by scripts/fetch-images.mjs.
    // The remote pattern is kept only as a dev fallback before that script is run.
    remotePatterns: [{ protocol: "https", hostname: "images.pexels.com" }],
  },
};

export default nextConfig;
