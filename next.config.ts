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
  // Jimp loads bitmap fonts at runtime via fs.existsSync + fs.readFile using a
  // path string (not an import). Vercel's file tracer doesn't follow dynamic paths,
  // so the .fnt and .png font files are missing from the deployment bundle.
  // Force-include them for every server route that uses the watermark helper.
  outputFileTracingIncludes: {
    "/api/webhooks/kie": [
      "./node_modules/@jimp/plugin-print/dist/fonts/**/*",
    ],
  },
};

export default nextConfig;
