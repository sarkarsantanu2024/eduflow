import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/features";
import { listOrganizations, listCentersForAssign } from "@/features/admin/org-actions";
import { OrganizationsConsole } from "@/features/admin/organizations-console";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  if (!FEATURES.headOffice) notFound();
  const [orgs, centers] = await Promise.all([listOrganizations(), listCentersForAssign()]);
  return <OrganizationsConsole orgs={orgs} centers={centers} />;
}
