import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { ProfileView } from "@/features/profile/profile-view";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const profile = await requireProfile();
  // The profile page holds business, payment and franchise settings — owner-only.
  if (profile.role === "teacher") redirect("/students");
  return <ProfileView />;
}
