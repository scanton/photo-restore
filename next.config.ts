import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.vercel-storage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  serverExternalPackages: ["jimp"],
};

export default nextConfig;
