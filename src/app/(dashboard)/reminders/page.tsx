import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { RemindersView } from "@/features/reminders/reminders-view";

export const metadata: Metadata = { title: "WhatsApp Reminders" };
export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const profile = await requireProfile();
  // Fee reminders are built from the fee ledger, which a staff login no longer
  // receives (features/data/scope.ts) — so the page has nothing to show them.
  if (profile.role === "teacher") redirect("/students");
  const canEditAutomation = profile.role !== "parent";
  return <RemindersView canEditAutomation={canEditAutomation} />;
}
