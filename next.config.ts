import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev badge in the corner — only relevant
  // for the hero-GIF recorder hitting localhost. Doesn't affect prod
  // (the badge is dev-only anyway).
  devIndicators: false,
};

export default nextConfig;
