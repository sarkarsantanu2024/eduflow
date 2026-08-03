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
  async rewrites() {
    return {
      // `beforeFiles` runs ahead of the App Router, so "/" serves the static
      // marketing page in public/site.html instead of src/app/page.tsx. The
      // URL stays "/" — visitors never see "site.html". Login lives at /login
      // and the product itself at /dashboard, same origin, same cookie.
      beforeFiles: [{ source: "/", destination: "/site.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
  images: {
    // Vercel Blob public URLs (for student photos, logos, certificate templates).
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
