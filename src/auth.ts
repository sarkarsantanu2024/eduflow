import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { clear, clientIp, hit, isLimited, LIMITS } from "@/lib/rate-limit";

/** Too many failed sign-ins for this username or address; the form says so. */
export class TooManyAttempts extends CredentialsSignin {
  override code = "rate_limited";
}

/**
 * Full Auth.js setup (Node runtime). Username/password only.
 * The account must already exist in our `users` table (created via signup
 * or by a center owner for staff).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const username = String(credentials?.username ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!username || !password) return null;

        // Checked here, not only in the login form's action: Auth.js also
        // exposes /api/auth/callback/credentials, which would skip the form.
        const userKey = `login:user:${username}`;
        const ipKey = `login:ip:${clientIp(request.headers)}`;
        if (await isLimited(userKey, LIMITS.loginPerUser) || await isLimited(ipKey, LIMITS.loginPerIp)) {
          throw new TooManyAttempts();
        }

        const user = await db.query.users.findFirst({ where: eq(users.username, username) });
        const ok = !!user && user.isActive && !!user.passwordHash && await verifyPassword(password, user.passwordHash);
        if (!ok) {
          await Promise.all([hit(userKey, LIMITS.loginPerUser), hit(ipKey, LIMITS.loginPerIp)]);
          return null;
        }

        await clear(userKey);
        return { id: user.id, email: user.email, name: user.fullName };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /** Load role + tenant from the DB onto the token at sign-in. */
    async jwt({ token, user }) {
      if (user?.id) {
        const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.instituteId = dbUser.instituteId;
          token.organizationId = dbUser.organizationId;
          try {
            await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, dbUser.id));
          } catch {
            /* best-effort */
          }
        }
      }
      return token;
    },
  },
});
