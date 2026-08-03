import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets a production build run into a separate folder while `next dev` is
  // still using .next — otherwise the two fight over the same directory and
  // the build fails with "Cannot find module for page: /_document".
  //   NEXT_DIST_DIR=.next-build npm run build
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    // Vercel Blob public URLs (for student photos, logos, certificate templates).
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
