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
     * Match all paths except static assets, image optimisation files, the
     * static marketing pages in public/ (*.html), and the auth API (which
     * Auth.js handles itself).
     *
     * Two deliberate exclusions beyond the obvious:
     *   - `.+` rather than `.*` so the marketing page at "/" is skipped
     *     entirely. Auth.js would otherwise issue session/CSRF cookies to
     *     every anonymous visitor reading the public site.
     *   - `txt|xml|webmanifest` so /robots.txt and /sitemap.xml are served
     *     from public/ instead of being redirected to /login — a crawler
     *     asking for robots.txt must never get an auth redirect.
     *   - `css|js|map` and the font types, so static assets served straight
     *     from public/ are never gated. This bit us: /site.css (the marketing
     *     page's own stylesheet, added when the Tailwind CDN was removed) was
     *     answered with a 307 to /login, so the homepage rendered with no CSS
     *     at all. Anything under public/ that a browser fetches must be listed
     *     here — _next/static covers the app's own bundles, not public/.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|html|txt|xml|webmanifest|css|js|mjs|map|woff|woff2|ttf|otf)$).+)",
  ],
};
