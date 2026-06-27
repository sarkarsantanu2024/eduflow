import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Route gating runs through Auth.js's `authorized` callback (see
 * src/auth.config.ts). It's edge-safe: no DB or bcrypt imports here.
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    /*
     * Match all paths except static assets, image optimisation files, and
     * the auth API (which Auth.js handles itself).
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
