import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { NotificationsView } from "@/features/notifications/notifications-view";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const profile = await requireProfile();
  return <NotificationsView role={profile.role} />;
}
