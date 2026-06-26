import {
  LayoutDashboard, Users, BookOpen, CalendarClock, Receipt,
  MessageSquare, LifeBuoy, Wallet, Coins, ClipboardCheck, TrendingUp,
  Trophy, Award, ScrollText, Package, PartyPopper, GraduationCap, type LucideIcon,
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
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["institute_admin", "teacher"] },
  { title: "Students", href: "/students", icon: Users, roles: ["institute_admin", "teacher"], labelKey: "members" },
  { title: "Courses", href: "/courses", icon: BookOpen, roles: ["institute_admin"], labelKey: "courses" },
  { title: "Batches", href: "/batches", icon: CalendarClock, roles: ["institute_admin", "teacher"], labelKey: "batches" },
  { title: "Teachers", href: "/teachers", icon: GraduationCap, roles: ["institute_admin"] },
  { title: "Attendance", href: "/attendance", icon: ClipboardCheck, roles: ["institute_admin", "teacher"], module: "attendance" },
  { title: "Promotions", href: "/promotions", icon: TrendingUp, roles: ["institute_admin", "teacher"], module: "promotions" },
  { title: "Tests & Ranks", href: "/tests", icon: Trophy, roles: ["institute_admin", "teacher"], module: "tests" },
  { title: "Certificates", href: "/certificates", icon: Award, roles: ["institute_admin"], module: "certificates" },
  { title: "Exam Boards", href: "/exam-boards", icon: ScrollText, roles: ["institute_admin"], module: "examBoards" },
  { title: "Performance", href: "/performance", icon: Trophy, roles: ["institute_admin", "teacher"], module: "performance" },
  { title: "Materials", href: "/materials", icon: Package, roles: ["institute_admin"], module: "materials" },
  { title: "Events", href: "/events", icon: PartyPopper, roles: ["institute_admin", "teacher"], module: "events" },
  { title: "Fees", href: "/fees", icon: Receipt, roles: ["institute_admin"] },
  { title: "Expenses", href: "/expenses", icon: Coins, roles: ["institute_admin"] },
  { title: "WhatsApp Reminders", href: "/reminders", icon: MessageSquare, roles: ["institute_admin"] },
  { title: "Billing & Plans", href: "/billing", icon: Wallet, roles: ["institute_admin"] },
  { title: "Support", href: "/support", icon: LifeBuoy, roles: ["institute_admin", "teacher"] },
];

export const SUBSCRIPTION_PLANS = [
  {
    code: "starter",
    name: "Starter",
    price: 499,
    students: "Up to 75 students",
    popular: false,
    features: ["Students, batches & attendance", "Monthly fees + dues tracking", "UPI QR + payment links", "WhatsApp click-to-send (free)", "PDF receipts & certificates", "1 staff login · Email support"],
  },
  {
    code: "growth",
    name: "Growth",
    price: 1499,
    students: "Up to 300 students",
    popular: true,
    features: ["Everything in Starter", "Automatic WhatsApp reminders", "All sector modules (promotions, tests, certificates, exam boards…)", "Reports & analytics", "2,000 WhatsApp msgs / month", "Up to 3 staff logins", "Parent portal · Priority support"],
  },
  {
    code: "professional",
    name: "Professional",
    price: 2999,
    students: "Up to 1,000 students",
    popular: false,
    features: ["Everything in Growth", "Two-way WhatsApp 'Fees Due' bot", "Multi-batch & multi-teacher", "5,000 WhatsApp msgs / month", "Up to 10 staff logins", "API access · Dedicated support"],
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
