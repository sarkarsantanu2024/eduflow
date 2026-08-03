import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listLeads } from "@/features/admin/lead-actions";
import { LeadsView } from "@/features/admin/leads-view";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await listLeads();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin">
          <Button variant="outline" size="sm"><ArrowLeft className="size-3.5" /> Back to admin</Button>
        </Link>
      </div>
      <LeadsView leads={leads} />
    </div>
  );
}
