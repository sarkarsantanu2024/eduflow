import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/features";
import { OrgRegisterForm } from "@/features/auth/org-register-form";

/** Self-serve multi-center brand signup — only when the HO feature is on. */
export default function HeadOfficeRegisterPage() {
  if (!FEATURES.headOffice) notFound();
  return <OrgRegisterForm />;
}
