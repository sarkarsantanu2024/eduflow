import type { Metadata } from "next";
import { MaterialsView } from "@/features/materials/materials-view";

export const metadata: Metadata = { title: "Materials" };

export default function MaterialsPage() {
  return <MaterialsView />;
}
