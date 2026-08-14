import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit must remain an external Node package so AFM font files resolve at runtime.
  // Bundling it under Turbopack rewrites font paths to an invalid root (e.g. C:\ROOT\...).
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
