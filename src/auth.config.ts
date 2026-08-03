import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config. Contains NO database or bcrypt imports so it can
 * run in middleware on the edge runtime. The real Credentials provider (which
 * needs the DB + bcrypt) is added in `src/auth.ts`, used by the Node API route.
 */

const PUBLIC_PATHS = [
  "/login", "/register", "/forgot-password", "/auth", "/pricing", "/verify",
  // Lead capture from the public marketing site — write-only, no session.
  // See src/app/api/leads/route.ts.
  "/api/leads",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // real providers are injected in src/auth.ts (Node runtime)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        if (user.role) token.role = user.role;
        token.instituteId = user.instituteId ?? null;
        token.organizationId = user.organizationId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role;
        session.user.instituteId = token.instituteId ?? null;
        session.user.organizationId = token.organizationId ?? null;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);

      // Public pages are always reachable.
      if (isPublicPath(pathname)) return true;

      // Everything else requires a session.
      if (!isLoggedIn) return false;

      // The super-admin console is restricted to platform owners.
      if (pathname.startsWith("/admin") && auth!.user.role !== "super_admin") {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      // The Head-Office console is restricted to franchise owners (org_admin)
      // and the platform owner (super_admin can view any HO).
      if (
        pathname.startsWith("/org") &&
        auth!.user.role !== "org_admin" &&
        auth!.user.role !== "super_admin"
      ) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
