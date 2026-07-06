import type { Metadata } from "next";
import { PerformanceView } from "@/features/performance/performance-view";
import { requireModule } from "@/lib/plan-guard";

export const metadata: Metadata = { title: "Performance" };

export default async function PerformancePage() {
  await requireModule("performance"); // Professional when billing gating is on
  return <PerformanceView />;
}
