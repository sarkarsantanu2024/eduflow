import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";

/**
 * Full Auth.js setup (Node runtime). Email/password only.
 * The account must already exist in our `users` table (created via signup
 * or by a center owner for staff).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await db.query.users.findFirst({ where: eq(users.email, email) });
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
      if (user?.email) {
        const dbUser = await db.query.users.findFirst({ where: eq(users.email, user.email.toLowerCase()) });
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
