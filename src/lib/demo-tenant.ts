/**
 * Identity of the isolated demo tenants. Kept in a plain module (not the
 * "use server" actions file) so it can be imported by both server actions and
 * data queries — a "use server" file may only export async functions.
 *
 * The demo is a small franchise: a demo organization (Head Office) with two
 * branches, plus a ready-made owner login so a demo can walk the multi-center
 * story. All fixed ids, so seeding/resetting only ever touches these rows.
 */
export const DEMO_ORG_ID = "d3300000-0000-4000-8000-000000000010";
export const DEMO_INSTITUTE_ID = "d3300000-0000-4000-8000-000000000001";
export const DEMO_BRANCH_2_ID = "d3300000-0000-4000-8000-000000000002";

/** Every demo institute id — excluded from real-customer lists & metrics. */
export const DEMO_INSTITUTE_IDS = [DEMO_INSTITUTE_ID, DEMO_BRANCH_2_ID];

export const DEMO_INSTITUTE_NAME = "▶ Demo — Bright Abacus Academy";
export const DEMO_ORG_NAME = "▶ Demo — Bright Abacus Group";

/** Ready-made franchise-owner login for demoing the Head-Office console. */
export const DEMO_HO_USERNAME = "demo-ho";
export const DEMO_HO_PASSWORD = "demo1234";
