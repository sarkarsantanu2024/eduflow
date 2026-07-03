import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { SuppliesView } from "@/features/supplies/supplies-view";

export const metadata: Metadata = { title: "Ad & Stationery" };

export default async function SuppliesPage() {
  const profile = await requireProfile();
  return <SuppliesView addedBy={profile.email || profile.username || ""} />;
}
