import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev server's webpack output separate from `next build` artifacts.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
