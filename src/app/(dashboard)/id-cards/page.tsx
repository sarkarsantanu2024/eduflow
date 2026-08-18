import type { Metadata } from "next";
import { IdCardsView } from "@/features/id-cards/id-cards-view";

export const metadata: Metadata = { title: "ID Cards" };

export default function IdCardsPage() {
  return <IdCardsView />;
}
