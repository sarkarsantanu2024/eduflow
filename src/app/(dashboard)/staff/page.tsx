import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { listStaff } from "@/features/staff/actions";
import { StaffView } from "@/features/staff/staff-view";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const profile = await requireProfile();
  if (profile.role === "teacher") redirect("/dashboard"); // staff can't manage staff

  const data = await listStaff();
  return <StaffView data={data} />;
}
