import {
  LayoutDashboard, Users, BookOpen, CalendarClock, Receipt,
  MessageSquare, LifeBuoy, Wallet, Coins, ClipboardCheck, TrendingUp,
  Trophy, Award, ScrollText, Package, PartyPopper, GraduationCap, KeyRound, Megaphone, Trash2, type LucideIcon,
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
// PRICING RULES WE HOLD TO (see sales/01-PRICING-REVIEW-AND-GAPS.md):
//  1. Every tier gets every *daily workflow* module — attendance, fees, tests,
//     certificates, exam boards, promotions, materials, events. We only charge
//     for SIZE (students, staff logins) and EXTRAS (posters, videos, branding,
//     onboarding, multi-center). Never gate what a center needs to run its day.
//  2. WhatsApp click-to-send is FREE AND UNLIMITED on every tier, because it
//     goes from the owner's own number and costs us nothing. There are no
//     per-tier message quotas. Fully-automated sending via the Meta Cloud API
//     is Enterprise-only and has NOT shipped yet — never imply otherwise.
//
// Five tiers only. Fewer plans = less hesitation at the point of sale.
export const SUBSCRIPTION_PLANS = [
  {
    code: "free",
    name: "Free",
    price: 0,
    priceLabel: "₹0",
    launchPrice: 0,
    students: "Up to 15 students · 1 staff login",
    maxStudents: 15,
    popular: false,
    features: ["Student management & admissions", "Attendance & batches", "Monthly fee generation", "UPI-QR payment", "Unlimited free WhatsApp reminders", "PDF receipts & Excel export"],
  },
  {
    code: "starter",
    name: "Starter",
    price: 499,
    priceLabel: "₹499",
    launchPrice: 299,
    students: "Up to 75 students · 1 staff login",
    maxStudents: 75,
    popular: false,
    features: ["Everything in Free", "Tests & rank lists", "Certificates with QR verify", "Exam management", "Expense tracking & profit reports", "Student promotion & materials"],
  },
  {
    code: "growth",
    name: "Growth",
    price: 999,
    priceLabel: "₹999",
    launchPrice: 699,
    students: "Up to 200 students · 3 staff logins",
    maxStudents: 200,
    popular: true,
    features: ["Everything in Starter", "Welcome & birthday poster maker", "Half-yearly & annual reports", "Multi-staff login & roles", "Teacher & staff management"],
  },
  {
    code: "business",
    name: "Business",
    price: 1999,
    priceLabel: "₹1,999",
    launchPrice: 1499,
    students: "Up to 500 students · 10 staff logins",
    maxStudents: 500,
    popular: false,
    features: ["Everything in Growth", "Animated video maker", "Advanced reports & analytics", "Custom branding", "Priority support", "Multiple activities in one center"],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: 0,
    priceLabel: "Contact Sales",
    launchPrice: 0,
    students: "Unlimited students & staff logins",
    maxStudents: null,
    popular: false,
    features: ["Everything in Business", "Dedicated account manager", "Priority onboarding", "Enterprise security & backups", "Multi-branch & head-office console (not yet released)", "API access & integrations (not yet released)"],
  },
] as const;

/** Shown under every price. Decide once, print everywhere. */
export const PRICE_NOTE = "Prices in INR, exclusive of 18% GST. Cross your student limit and nothing switches off — you stay on the same plan at ₹8 per extra student per month, and move up only when the next plan works out cheaper.";

/** Paid add-ons, priced per month. */
export const ADD_ONS = {
  extraStudent: 8,
  extraBranch: 399,
} as const;

/** Annual billing discount, shown as "Save 20%". */
export const ANNUAL_DISCOUNT_PERCENT = 20;

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
