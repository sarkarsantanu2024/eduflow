/**
 * Feature flags — let unfinished/rolling-out capabilities ship in the codebase
 * without affecting live customers until the owner explicitly turns them on.
 *
 * The Head-Office (multi-center) console is OFF by default. To enable it, set
 *   NEXT_PUBLIC_FEATURE_HO=true
 * in the environment (.env.local / Vercel project settings) and redeploy. While
 * off, the /org routes and the super-admin "Organizations" management screens
 * are hidden, and the extra data columns simply sit unused.
 */
export const FEATURES = {
  /** Multi-center / Head-Office console + org_admin role + partner revenue-share. */
  headOffice: process.env.NEXT_PUBLIC_FEATURE_HO === "true",
  /**
   * Billing + plan-tier gating. OFF by default → every capability stays
   * unlocked for all centers (today's behaviour) and /billing is hidden.
   * Set NEXT_PUBLIC_FEATURE_BILLING=true to show the Billing page and enforce
   * which optional modules each plan tier unlocks (see src/lib/plan-gating.ts).
   */
  billing: process.env.NEXT_PUBLIC_FEATURE_BILLING === "true",
} as const;
