import type { Metadata } from "next";
import { FeesView } from "@/features/fees/fees-view";

export const metadata: Metadata = { title: "Fees" };

export default function FeesPage() {
  return <FeesView />;
}
