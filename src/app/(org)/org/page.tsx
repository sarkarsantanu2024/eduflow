import { getOrgOverview } from "@/features/org/actions";
import { OrgConsole } from "@/features/org/org-console";

export const dynamic = "force-dynamic";

export default async function OrgPage() {
  const overview = await getOrgOverview();
  return <OrgConsole overview={overview} />;
}
