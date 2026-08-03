import type { Metadata } from "next";
import { StudentStoreForm } from "@/features/students/student-store-form";
import { LimitReached } from "@/features/capacity/limit-reached";
import { getCapacityPanel } from "@/features/capacity/actions";

export const metadata: Metadata = { title: "Add Student" };
export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  // At the limit the form never opens — the owner sees what to do instead of
  // filling in a page of details only to be turned away at the save button.
  const panel = await getCapacityPanel();

  return (
    <div className="mx-auto max-w-5xl">
      {panel && panel.usage.atCap ? <LimitReached panel={panel} /> : <StudentStoreForm />}
    </div>
  );
}
