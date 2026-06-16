import type { Metadata } from "next";
import { RemindersView } from "@/features/reminders/reminders-view";

export const metadata: Metadata = { title: "WhatsApp Reminders" };

export default function RemindersPage() {
  return <RemindersView />;
}
