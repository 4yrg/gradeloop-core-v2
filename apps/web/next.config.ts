import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["57.155.2.141"],
  // produce a standalone build so the Dockerfile can copy the server bundle
  output: "standalone",
  // Run development server on port 80
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
