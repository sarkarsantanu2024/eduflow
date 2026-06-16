import type { Metadata } from "next";
import { StudentStoreForm } from "@/features/students/student-store-form";

export const metadata: Metadata = { title: "Add Student" };

export default function NewStudentPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <StudentStoreForm />
    </div>
  );
}
