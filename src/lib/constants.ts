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

// Full 6-tier lineup (matches the published pricing sheet). Priced by center
// size; each tier unlocks more. Codes must match subscription_plans.code in the
// DB (see src/lib/db/seed.ts) and the ranks in src/lib/plan-gating.ts.
export const SUBSCRIPTION_PLANS = [
  {
    code: "starter",
    name: "Starter",
    price: 499,
    students: "Up to 50 students",
    popular: false,
    features: ["Students, batches & attendance", "Monthly + admission fees, UPI-QR", "WhatsApp click-to-send (free)", "Branded certificates & PDF receipts", "Materials & franchise P&L", "Data export & Trash · 1 staff login"],
  },
  {
    code: "growth",
    name: "Growth",
    price: 999,
    students: "Up to 100 students",
    popular: true,
    features: ["Everything in Starter", "Welcome & Birthday poster maker", "Tests, rank lists & result cards", "Automatic WhatsApp reminders", "Reports & analytics", "2,000 WhatsApp msgs / mo · 3 staff logins"],
  },
  {
    code: "pro",
    name: "Pro",
    price: 1999,
    students: "Up to 300 students",
    popular: false,
    features: ["Everything in Growth", "Welcome & Birthday video maker", "Exam boards & performance/competitions", "Advanced reports (half-yearly/yearly) + PDF", "Multi-batch & multi-teacher", "5,000 WhatsApp msgs / mo · 6 staff logins"],
  },
  {
    code: "business",
    name: "Business",
    price: 3499,
    students: "Up to 600 students",
    popular: false,
    features: ["Everything in Pro", "Custom branding", "Priority support", "8,000 WhatsApp msgs / mo", "Up to 10 staff logins"],
  },
  {
    code: "premium",
    name: "Premium",
    price: 4999,
    students: "Up to 900 students",
    popular: false,
    features: ["Everything in Business", "Dedicated onboarding & account manager", "12,000 WhatsApp msgs / mo", "Up to 15 staff logins"],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: 6499,
    students: "Up to 1,200 students",
    popular: false,
    features: ["Everything in Premium", "WhatsApp auto-send — Meta Cloud API (rolling out)", "Multi-center / Head-Office console (rolling out)", "Unlimited staff logins", "Dedicated support"],
  },
] as const;

/** Separate tier for franchises / multi-center brands (per-branch pricing). */
export const FRANCHISE_PLAN = {
  code: "franchise",
  name: "Franchise / Multi-center",
  priceLabel: "Custom",
  blurb: "For brands running multiple branches across a city or state.",
  features: [
    "Head-office dashboard across all branches",
    "Push shared courses, templates & certificate designs to every branch",
    "Central certificate issue & verification",
    "Per-branch billing · franchise-owner & branch-admin roles",
  ],
} as const;

/** Current plan code for the signed-in tenant (demo). */
export const CURRENT_PLAN_CODE = "growth";
