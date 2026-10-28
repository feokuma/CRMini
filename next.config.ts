import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev server's webpack output separate from `next build` artifacts.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  output: "standalone",
  // better-sqlite3 carrega o binário nativo dinamicamente; o tracing do Next não
  // o rastreia de forma confiável — força a inclusão do pacote no standalone.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/better-sqlite3/**/*"],
  },
};

export default nextConfig;
