import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listCapacityRequests, listCenterCapacity } from "@/features/capacity/actions";
import { CapacityAdminView } from "@/features/capacity/capacity-admin-view";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Upgrade requests" };
export const dynamic = "force-dynamic";

export default async function CapacityPage() {
  const [requests, centers] = await Promise.all([listCapacityRequests(), listCenterCapacity()]);
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin">
          <Button variant="outline" size="sm"><ArrowLeft className="size-3.5" /> Back to admin</Button>
        </Link>
      </div>
      <CapacityAdminView requests={requests} centers={centers} />
    </div>
  );
}
