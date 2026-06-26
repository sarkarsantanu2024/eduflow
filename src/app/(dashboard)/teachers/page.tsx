import type { Metadata } from "next";
import { TeachersView } from "@/features/teachers/teachers-view";

export const metadata: Metadata = { title: "Teachers" };

export default function TeachersPage() {
  return <TeachersView />;
}
