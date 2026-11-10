import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { MaterialsView } from "@/features/materials/materials-view";

export const metadata: Metadata = { title: "Materials" };

export default async function MaterialsPage() {
  // Kit charges and Head-Office costs are money: owner-only.
  const profile = await requireProfile();
  if (profile.role === "teacher") redirect("/students");
  return <MaterialsView />;
}
