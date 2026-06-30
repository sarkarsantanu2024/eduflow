import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";

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
      authorize: async (credentials) => {
        const username = String(credentials?.username ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!username || !password) return null;

        const user = await db.query.users.findFirst({ where: eq(users.username, username) });
        if (!user || !user.isActive || !user.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

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
