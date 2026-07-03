import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { SuppliesView } from "@/features/supplies/supplies-view";

export const metadata: Metadata = { title: "Ad & Stationery" };

export default async function SuppliesPage() {
  const profile = await requireProfile();
  // Owner-only — staff can't reach it even by URL.
  if (profile.role === "teacher") redirect("/students");
  return <SuppliesView addedBy={profile.email || profile.username || ""} />;
}
