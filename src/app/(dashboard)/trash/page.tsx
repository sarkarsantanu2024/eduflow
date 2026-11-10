import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { TrashView } from "@/features/trash/trash-view";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  // Trash lists deleted rows from every collection, money included, and
  // restore/purge are owner actions (fetchTrash enforces this server-side).
  const profile = await requireProfile();
  if (profile.role === "teacher") redirect("/students");
  return <TrashView />;
}
