import type { Metadata } from "next";
import { TestsView } from "@/features/tests/tests-view";
import { requireModule } from "@/lib/plan-guard";

export const metadata: Metadata = { title: "Tests & Ranks" };

export default async function TestsPage() {
  await requireModule("tests"); // Growth+ when billing gating is on
  return <TestsView />;
}
