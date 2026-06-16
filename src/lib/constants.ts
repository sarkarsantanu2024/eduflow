import {
  LayoutDashboard, Users, BookOpen, CalendarClock, Receipt,
  CreditCard, MessageSquare, LifeBuoy, Wallet, type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types/database.types";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  /** When set, the sidebar replaces `title` with the sector label for this key. */
  labelKey?: "members" | "courses" | "batches";
}

export const APP_NAME = "EduFlow";

/** Sidebar navigation. `roles` gates visibility per user role. */
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["institute_admin", "teacher"] },
  { title: "Students", href: "/students", icon: Users, roles: ["institute_admin", "teacher"], labelKey: "members" },
  { title: "Courses", href: "/courses", icon: BookOpen, roles: ["institute_admin"], labelKey: "courses" },
  { title: "Batches", href: "/batches", icon: CalendarClock, roles: ["institute_admin", "teacher"], labelKey: "batches" },
  { title: "Fees", href: "/fees", icon: Receipt, roles: ["institute_admin"] },
  { title: "Payments", href: "/payments", icon: CreditCard, roles: ["institute_admin"] },
  { title: "WhatsApp Reminders", href: "/reminders", icon: MessageSquare, roles: ["institute_admin"] },
  { title: "Billing & Plans", href: "/billing", icon: Wallet, roles: ["institute_admin"] },
  { title: "Support", href: "/support", icon: LifeBuoy, roles: ["institute_admin", "teacher"] },
];

/** Sectors EduFlow serves — drives the label map (Student → Member, etc.). */
export const BUSINESS_TYPES = [
  { value: "abacus", label: "Abacus Center", member: "Student", members: "Students", courses: "Levels", batches: "Batches" },
  { value: "tuition", label: "Tuition Center", member: "Student", members: "Students", courses: "Subjects", batches: "Batches" },
  { value: "dance", label: "Dance School", member: "Student", members: "Students", courses: "Dance Forms", batches: "Batches" },
  { value: "drawing", label: "Drawing School", member: "Student", members: "Students", courses: "Courses", batches: "Batches" },
  { value: "music", label: "Music Academy", member: "Student", members: "Students", courses: "Instruments", batches: "Batches" },
  { value: "playschool", label: "Playschool", member: "Child", members: "Children", courses: "Programs", batches: "Classes" },
  { value: "activity", label: "Activity Center (yoga, guitar, chess, computer…)", member: "Member", members: "Members", courses: "Activities", batches: "Batches" },
  { value: "salon", label: "Salon", member: "Client", members: "Clients", courses: "Services", batches: "Schedule" },
  { value: "gym", label: "Gym / Fitness", member: "Member", members: "Members", courses: "Plans", batches: "Classes" },
  { value: "other", label: "Other", member: "Member", members: "Members", courses: "Courses", batches: "Batches" },
] as const;

export interface SectorLabels {
  member: string;
  members: string;
  courses: string;
  batches: string;
}

/** Returns the terminology for a business type (defaults to generic). */
export function getLabels(businessType: string | undefined): SectorLabels {
  const t = BUSINESS_TYPES.find((b) => b.value === businessType);
  return t
    ? { member: t.member, members: t.members, courses: t.courses, batches: t.batches }
    : { member: "Member", members: "Members", courses: "Courses", batches: "Batches" };
}

export const SUBSCRIPTION_PLANS = [
  {
    code: "starter",
    name: "Starter",
    price: 499,
    students: "Up to 100 students",
    popular: false,
    features: ["Student & fee management", "Payment links (UPI/cards)", "500 WhatsApp msgs / month", "PDF receipts", "Email support"],
  },
  {
    code: "growth",
    name: "Growth",
    price: 999,
    students: "Up to 500 students",
    popular: true,
    features: ["Everything in Starter", "UPI AutoPay (recurring)", "Reports & analytics", "2,000 WhatsApp msgs / month", "Parent portal", "Priority support"],
  },
  {
    code: "professional",
    name: "Professional",
    price: 1999,
    students: "Unlimited students",
    popular: false,
    features: ["Everything in Growth", "Multi-location", "Staff roles & permissions", "5,000 WhatsApp msgs / month", "API access", "Dedicated support"],
  },
] as const;

/** Current plan code for the signed-in tenant (demo). */
export const CURRENT_PLAN_CODE = "growth";
