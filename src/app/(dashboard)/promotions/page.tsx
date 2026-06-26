import type { Metadata } from "next";
import { PromotionsView } from "@/features/promotions/promotions-view";

export const metadata: Metadata = { title: "Promotions" };

export default function PromotionsPage() {
  return <PromotionsView />;
}
