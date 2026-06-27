import type { UserRole } from "@/types/database.types";
import "next-auth";
import "next-auth/jwt";

/** Carry tenant + role on the session and JWT. */
declare module "next-auth" {
  interface User {
    // Populated from the DB in the jwt callback, so optional on the provider User.
    role?: UserRole;
    instituteId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: UserRole;
      instituteId: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    instituteId: string | null;
  }
}
