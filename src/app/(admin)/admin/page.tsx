import Link from "next/link";
import { Building2 } from "lucide-react";
import { listCustomers, getPlatformMetrics, listPlans } from "@/features/admin/actions";
import { AdminConsole } from "@/features/admin/admin-console";
import { PlatformMetricsView } from "@/features/admin/platform-metrics";
import { DemoModeCard } from "@/features/admin/demo-mode-card";
import { ChangePasswordCard } from "@/features/auth/change-password-card";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [customers, metrics, plans] = await Promise.all([listCustomers(), getPlatformMetrics(), listPlans()]);
  return (
    <div className="space-y-8">
      <div className="flex justify-end gap-2">
        {FEATURES.headOffice && (
          <Link href="/admin/organizations">
            <Button variant="outline" size="sm"><Building2 className="size-3.5" /> Organizations (Head Office)</Button>
          </Link>
        )}
      </div>
      <PlatformMetricsView metrics={metrics} />
      <DemoModeCard />
      <AdminConsole customers={customers} plans={plans} />
      <ChangePasswordCard />
    </div>
  );
}
