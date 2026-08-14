import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { RemindersView } from "@/features/reminders/reminders-view";

export const metadata: Metadata = { title: "WhatsApp Reminders" };
export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const profile = await requireProfile();
  const canEditAutomation = profile.role !== "teacher" && profile.role !== "parent";
  return <RemindersView canEditAutomation={canEditAutomation} />;
}
