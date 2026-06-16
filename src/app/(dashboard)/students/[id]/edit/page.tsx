"use client";

import { useParams } from "next/navigation";
import { StudentStoreForm } from "@/features/students/student-store-form";

export default function EditStudentPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-5xl">
      <StudentStoreForm studentId={params.id} />
    </div>
  );
}
