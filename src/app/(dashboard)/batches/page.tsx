import type { Metadata } from "next";
import { BatchesView } from "@/features/batches/batches-view";

export const metadata: Metadata = { title: "Batches" };

export default function BatchesPage() {
  return <BatchesView />;
}
