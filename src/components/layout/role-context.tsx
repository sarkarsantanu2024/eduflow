"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/types/database.types";

/**
 * The signed-in user's effective role, made available to client feature
 * screens. The server already enforces who may write what (see
 * features/data/actions.ts); this exists so the UI can avoid *attempting*
 * writes it knows will be refused.
 *
 * That mattered as soon as write permissions became real: two legacy one-time
 * data migrations run from a page's effect, and a teacher merely opening
 * Fees or WhatsApp Reminders triggered a write the server correctly rejected —
 * so they got a "Forbidden" error toast for doing nothing wrong.
 *
 * Defaults to institute_admin so a screen rendered outside the shell (tests,
 * storybook) behaves as it always did.
 */
const RoleContext = createContext<UserRole>("institute_admin");

export function RoleProvider({ role, children }: { role: UserRole; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/** The current user's effective role inside the centre. */
export function useRole(): UserRole {
  return useContext(RoleContext);
}

/**
 * May this user change the centre itself — money, settings, staff?
 * Teaching staff keep attendance, marks and promotions; everything else is the
 * owner's. Mirrors roleMayWrite() in features/data/actions.ts, which is where
 * it is actually enforced.
 */
export function useCanManage(): boolean {
  const role = useRole();
  return role === "institute_admin" || role === "super_admin" || role === "org_admin";
}
