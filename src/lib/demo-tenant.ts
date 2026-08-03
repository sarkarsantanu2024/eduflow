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

/** The abacus demo franchise (head office + its two branches). */
export const DEMO_ABACUS_IDS = [DEMO_INSTITUTE_ID, DEMO_BRANCH_2_ID];

/**
 * One ready-made demo center per *other* business type, so a sales call can
 * show a coaching owner a coaching center, a dance school a dance school, and
 * so on — each with its own terminology, modules and sample data. The `sector`
 * value must match an entry in src/lib/sectors.ts.
 */
export type DemoSectorKey =
  | "coaching" | "computer" | "dance" | "drawing" | "spoken_english" | "tuition" | "activity" | "other";

export interface DemoCenter {
  sector: DemoSectorKey;
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  city: string;
  /** Student-code prefix, e.g. SUN-0001. */
  prefix: string;
  monthlyFee: number;
  admissionFee: number;
  upiId: string;
  /** subscription_plans.code to attach, so Billing looks real. */
  planCode: string;
  /** How many sample students to seed (default 10). */
  studentCount?: number;
}

export const DEMO_CENTERS: DemoCenter[] = [
  { sector: "coaching", id: "d3300000-0000-4000-8000-000000000101", name: "▶ Demo — Sunrise Coaching Classes", slug: "demo-sunrise-coaching", ownerName: "Debashis Roy", city: "Kolkata", prefix: "SUN", monthlyFee: 1500, admissionFee: 1000, upiId: "sunrisecoaching@upi", planCode: "business" },
  { sector: "computer", id: "d3300000-0000-4000-8000-000000000102", name: "▶ Demo — TechEdge Computer Institute", slug: "demo-techedge-computer", ownerName: "Sanjay Mehta", city: "Pune", prefix: "TEC", monthlyFee: 1200, admissionFee: 1500, upiId: "techedge@upi", planCode: "business" },
  { sector: "dance", id: "d3300000-0000-4000-8000-000000000103", name: "▶ Demo — Nrityangan Dance Academy", slug: "demo-nrityangan-dance", ownerName: "Meera Chatterjee", city: "Kolkata", prefix: "NRT", monthlyFee: 1000, admissionFee: 700, upiId: "nrityangan@upi", planCode: "growth" },
  { sector: "drawing", id: "d3300000-0000-4000-8000-000000000104", name: "▶ Demo — Rangoli Art School", slug: "demo-rangoli-art", ownerName: "Kavita Desai", city: "Ahmedabad", prefix: "RNG", monthlyFee: 800, admissionFee: 500, upiId: "rangoliart@upi", planCode: "growth" },
  { sector: "spoken_english", id: "d3300000-0000-4000-8000-000000000105", name: "▶ Demo — FluentSpeak English Center", slug: "demo-fluentspeak-english", ownerName: "Arun Nambiar", city: "Bengaluru", prefix: "FLS", monthlyFee: 1100, admissionFee: 800, upiId: "fluentspeak@upi", planCode: "growth" },
  { sector: "tuition", id: "d3300000-0000-4000-8000-000000000106", name: "▶ Demo — Vidya Tuition Center", slug: "demo-vidya-tuition", ownerName: "Ramesh Yadav", city: "Lucknow", prefix: "VDY", monthlyFee: 700, admissionFee: 300, upiId: "vidyatuition@upi", planCode: "starter" },
  { sector: "activity", id: "d3300000-0000-4000-8000-000000000108", name: "▶ Demo — Sparkle Multi-Activity Center", slug: "demo-sparkle-activity", ownerName: "Neha Agarwal", city: "Kolkata", prefix: "SPK", monthlyFee: 1000, admissionFee: 800, upiId: "sparkleactivity@upi", planCode: "business", studentCount: 18 },
  { sector: "other", id: "d3300000-0000-4000-8000-000000000107", name: "▶ Demo — Harmony Music & Skills Academy", slug: "demo-harmony-academy", ownerName: "Joseph Fernandes", city: "Goa", prefix: "HRM", monthlyFee: 900, admissionFee: 600, upiId: "harmonyacademy@upi", planCode: "starter" },
];

/** Look up a demo center by its sector key. */
export function getDemoCenter(sector: string): DemoCenter | undefined {
  return DEMO_CENTERS.find((c) => c.sector === sector);
}

/** Every demo institute id — excluded from real-customer lists & metrics. */
export const DEMO_INSTITUTE_IDS = [...DEMO_ABACUS_IDS, ...DEMO_CENTERS.map((c) => c.id)];

export const DEMO_INSTITUTE_NAME = "▶ Demo — Bright Abacus Academy";
export const DEMO_ORG_NAME = "▶ Demo — Bright Abacus Group";

/** Ready-made franchise-owner login for demoing the Head-Office console. */
export const DEMO_HO_USERNAME = "demo-ho";
export const DEMO_HO_PASSWORD = "demo1234";

/**
 * Every sector demo center also gets its own owner login, so a client can sign
 * in and drive the product themselves instead of watching over your shoulder.
 * Same password for all of them — these are throwaway demo tenants.
 */
export const DEMO_CENTER_PASSWORD = "demo1234";

/** Username for a sector demo center's owner login, e.g. "demo-dance". */
export function demoCenterUsername(sector: string): string {
  return `demo-${sector.replace(/_/g, "-")}`;
}
