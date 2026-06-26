import type { Metadata } from "next";
import { TestsView } from "@/features/tests/tests-view";

export const metadata: Metadata = { title: "Tests & Ranks" };

export default function TestsPage() {
  return <TestsView />;
}
