import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  // Staff logins don't get the business dashboard — send them to Students.
  if (profile.role === "teacher") redirect("/students");
  return <DashboardView />;
}
