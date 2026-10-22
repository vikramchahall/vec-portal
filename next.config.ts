import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Stock photos are downloaded into /public/images by scripts/fetch-images.mjs.
    // The remote pattern is kept only as a dev fallback before that script is run.
    remotePatterns: [{ protocol: "https", hostname: "images.pexels.com" }],
  },
};

export default nextConfig;
