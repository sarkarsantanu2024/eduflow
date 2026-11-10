import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { ExpensesView } from "@/features/expenses/expenses-view";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  // Owner-only: see fetchDb's role scoping in features/data/scope.ts.
  const profile = await requireProfile();
  if (profile.role === "teacher") redirect("/students");
  return <ExpensesView />;
}
