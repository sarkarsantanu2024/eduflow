import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { FeesView } from "@/features/fees/fees-view";

export const metadata: Metadata = { title: "Fees" };

export default async function FeesPage() {
  // Money is the owner's. fetchDb already withholds fees from a staff login;
  // the redirect spares them an empty page they were never meant to reach.
  const profile = await requireProfile();
  if (profile.role === "teacher") redirect("/students");
  return <FeesView />;
}
