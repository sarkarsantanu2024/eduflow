import {
  LayoutDashboard, Users, BookOpen, CalendarClock, Receipt,
  MessageSquare, LifeBuoy, Wallet, Coins, ClipboardCheck, TrendingUp,
  Trophy, Award, ScrollText, Package, PartyPopper, GraduationCap, KeyRound, Megaphone, Trash2, IdCard, type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types/database.types";
import type { ModuleKey } from "@/lib/sectors";

// Re-exported so existing imports from "@/lib/constants" keep working.
export { BUSINESS_TYPES, getLabels, getSector, isModuleEnabled } from "@/lib/sectors";
export type { SectorLabels, ModuleKey, SectorConfig } from "@/lib/sectors";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  /** When set, the sidebar replaces `title` with the sector label for this key. */
  labelKey?: "members" | "courses" | "batches";
  /** When set, the item only shows if the active sector enables this module. */
  module?: ModuleKey;
  /** When set, the item only shows if this feature flag is enabled. */
  feature?: "billing";
}

export const APP_NAME = "EduFlow";

/** Single source for support / owner contact — used by the Support page, footer, etc. */
export const SUPPORT = {
  productName: "EduFlow",
  ownerName: "Santanu Sarkar",
  phone: "9804243159",
  whatsapp: "9804243159",
  email: "sarkarsantanu69@gmail.com",
  hours: "Mon–Sat, 10 AM – 8 PM IST",
} as const;

/** Sidebar navigation. `roles` gates visibility per role; `module` per sector. */
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["institute_admin"] },
  { title: "Students", href: "/students", icon: Users, roles: ["institute_admin", "teacher"], labelKey: "members" },
  { title: "Courses", href: "/courses", icon: BookOpen, roles: ["institute_admin"], labelKey: "courses" },
  { title: "Batches", href: "/batches", icon: CalendarClock, roles: ["institute_admin", "teacher"], labelKey: "batches" },
  { title: "Teachers", href: "/teachers", icon: GraduationCap, roles: ["institute_admin"] },
  { title: "Staff Logins", href: "/staff", icon: KeyRound, roles: ["institute_admin"] },
  { title: "Attendance", href: "/attendance", icon: ClipboardCheck, roles: ["institute_admin", "teacher"], module: "attendance" },
  { title: "Promotions", href: "/promotions", icon: TrendingUp, roles: ["institute_admin", "teacher"], module: "promotions" },
  { title: "Tests & Ranks", href: "/tests", icon: Trophy, roles: ["institute_admin", "teacher"], module: "tests" },
  { title: "Certificates", href: "/certificates", icon: Award, roles: ["institute_admin"], module: "certificates" },
  { title: "ID Cards", href: "/id-cards", icon: IdCard, roles: ["institute_admin"], module: "idCards" },
  { title: "Exam Boards", href: "/exam-boards", icon: ScrollText, roles: ["institute_admin"], module: "examBoards" },
  { title: "Performance", href: "/performance", icon: Trophy, roles: ["institute_admin", "teacher"], module: "performance" },
  { title: "Materials", href: "/materials", icon: Package, roles: ["institute_admin"], module: "materials" },
  { title: "Ad & Stationery", href: "/supplies", icon: Megaphone, roles: ["institute_admin"] },
  { title: "Events", href: "/events", icon: PartyPopper, roles: ["institute_admin", "teacher"], module: "events" },
  { title: "Fees", href: "/fees", icon: Receipt, roles: ["institute_admin"] },
  { title: "Expenses", href: "/expenses", icon: Coins, roles: ["institute_admin"] },
  { title: "WhatsApp Reminders", href: "/reminders", icon: MessageSquare, roles: ["institute_admin"] },
  { title: "Trash", href: "/trash", icon: Trash2, roles: ["institute_admin"] },
  // Billing & Plans — shown only when the billing feature flag is on.
  { title: "Billing & Plans", href: "/billing", icon: Wallet, roles: ["institute_admin"], feature: "billing" },
  { title: "Support", href: "/support", icon: LifeBuoy, roles: ["institute_admin", "teacher"] },
];

// Full lineup (matches the published pricing sheet). Priced by center size.
// Codes must match subscription_plans.code in the DB (see src/lib/db/seed.ts)
// and the ranks in src/lib/plan-gating.ts.
//
// PRICING RULES WE HOLD TO:
//  1. The headline axis is SIZE — students and staff logins. A center picks its
//     plan by how big it is, which is the one number an owner already knows.
//  2. WhatsApp is ONE-CLICK, never automatic. The message opens ready-written
//     in the owner's own WhatsApp and they press send. It is free and unlimited
//     on every tier, including Free, with no per-tier quotas. Never call it
//     "automatic", "auto-send" or "automation" anywhere in the product or the
//     marketing — a customer would expect messages to go out with their phone
//     off, and they do not. Meta Cloud API auto-send has NOT shipped.
//  3. Annual billing is 10 months for 12 (~17% off). This is permanent, not a
//     launch offer, so there is no awkward moment when the offer expires.
//  4. Anything not built yet carries a "Coming soon" note in its own label.
//     Never list an unshipped capability as if it were included today.
//  5. Student capacity is PREPAID and enforced (src/lib/plan-limits.ts). A
//     center cannot add a student past plan cap + paid extra slots. Never
//     write copy promising that crossing the limit "changes nothing" — it
//     blocks the next admission until the extra capacity is paid for.
//
// Five tiers only. Fewer plans = less hesitation at the point of sale.
export const SUBSCRIPTION_PLANS = [
  {
    code: "free",
    name: "Free",
    price: 0,
    priceLabel: "₹0",
    annualPrice: 0,
    annualLabel: "₹0",
    tagline: "Perfect for home tutors",
    students: "Up to 20 students · 1 staff login",
    maxStudents: 20,
    maxStaff: 1,
    popular: false,
    // Export, Trash and bulk import are listed here because nothing gates
    // them: export-data.tsx has no plan check and plan-gating.ts has no key
    // for them. Marketing must not sell them as paid upgrades — see the
    // matching rows in public/site.html.
    features: ["Student management & admissions", "Attendance & batches", "Monthly fee generation", "UPI-QR payment", "Unlimited one-click WhatsApp reminders", "PDF receipts", "Excel / CSV export & Trash", "One-click Excel / CSV import", "Basic reports", "Works on any phone"],
  },
  {
    code: "starter",
    name: "Starter",
    price: 399,
    priceLabel: "₹399",
    annualPrice: 3999,
    annualLabel: "₹3,999",
    tagline: "Small coaching, abacus, dance, drawing & music",
    students: "Up to 100 students · 3 staff logins",
    maxStudents: 100,
    maxStaff: 3,
    popular: false,
    features: ["Everything in Free", "Student ID cards", "Certificates with QR verify", "No EduFlow mark on posters", "Email & WhatsApp support"],
  },
  {
    code: "growth",
    name: "Growth",
    price: 799,
    priceLabel: "₹799",
    annualPrice: 7999,
    annualLabel: "₹7,999",
    tagline: "Growing centers that run exams and track profit",
    students: "Up to 300 students · 8 staff logins",
    maxStudents: 300,
    maxStaff: 8,
    popular: true,
    features: ["Everything in Starter", "Exams, tests & rank lists", "Expenses, income & profit reports", "Teacher salary management", "Staff roles & permissions", "Student promotion & inventory", "Custom fee rules", "Advanced reports", "Priority support"],
  },
  {
    code: "business",
    name: "Business",
    price: 1499,
    priceLabel: "₹1,499",
    annualPrice: 14999,
    annualLabel: "₹14,999",
    tagline: "Large academies and multi-activity centers",
    students: "Up to 1,000 students · unlimited staff logins",
    maxStudents: 1000,
    maxStaff: null,
    popular: false,
    features: ["Everything in Growth", "Custom branding", "Multiple activities in one center", "Animated video maker", "Advanced analytics", "Data backup & full export", "Own domain (coming soon)", "Parent app (coming soon)", "Teacher app (coming soon)", "API access (coming soon)", "White label (coming soon)"],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: 0,
    priceLabel: "Contact Sales",
    annualPrice: 0,
    annualLabel: "Contact Sales",
    tagline: "Franchises and brands running many branches",
    students: "Unlimited students & staff logins",
    maxStudents: null,
    maxStaff: null,
    popular: false,
    features: ["Everything in Business", "Dedicated account manager", "Custom development", "Onboarding & staff training", "Data migration done for you", "Dedicated server", "Multiple branches (coming soon)", "Single sign-on (coming soon)"],
  },
] as const;

/** Shown under every price. Decide once, print everywhere. */
export const PRICE_NOTE = "Prices in INR, exclusive of 18% GST. Student capacity is prepaid: to go past your plan's limit, add a seat pack (+25, +50 or +100 students) or move up a plan — whichever suits you. Your existing students and data are completely safe either way; only new admissions wait for capacity.";

/** Paid add-ons, priced per month. */
export const ADD_ONS = {
  /** Internal unit rate. NEVER shown to a customer — see SEAT_PACKS. */
  extraStudent: 8,
  /**
   * Intended rate for a second branch. NOT SELLABLE YET — multiple branches
   * are marked "Coming soon" on the pricing page and in the plan comparison,
   * and no branch feature ships. Keep this out of every customer-facing
   * surface until branches actually exist.
   */
  extraBranch: 399,
} as const;

/**
 * Extra student capacity is sold as PACKS, never as a per-student rate.
 * "+50 students" is a decision an owner can make in one second; "₹8 per student
 * per month" makes them do arithmetic and feel metered.
 *
 * `price` is what WE quote on WhatsApp once they ask — it is deliberately NOT
 * rendered anywhere in the product or on the marketing site. Packs are priced
 * a little under the unit rate (50 × ₹8 = ₹400 → ₹349) so a bigger pack always
 * feels like the better buy.
 */
export const SEAT_PACKS = [
  { seats: 25, price: 199 },
  { seats: 50, price: 349 },
  { seats: 100, price: 649 },
] as const;

export type SeatPack = (typeof SEAT_PACKS)[number];

/**
 * Annual billing = pay for 10 months, get 12. That is 2/12 = 16.67%, which we
 * round to "Save 17%". Permanent, so it never has to be withdrawn.
 */
export const ANNUAL_DISCOUNT_PERCENT = 17;
export const ANNUAL_MONTHS_BILLED = 10;

/** Franchise / multi-branch add-on, sold on top of any paid plan. */
export const FRANCHISE_PLAN = {
  code: "franchise",
  name: "Franchise / Multi-branch",
  priceLabel: "₹399 per extra branch / month",
  blurb: "For brands running several branches across a city or state — added on top of your plan, no need to jump to Enterprise.",
  features: [
    "Each branch keeps its own students, fees and staff",
    "Push shared courses, templates & certificate designs to every branch",
    "Central certificate issue & verification",
    "Head-office dashboard across all branches (not yet released)",
  ],
} as const;

/** Current plan code for the signed-in tenant (demo). */
export const CURRENT_PLAN_CODE = "growth";
