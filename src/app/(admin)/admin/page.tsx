import Link from "next/link";
import { Building2, Inbox, ArrowRight, Users } from "lucide-react";
import { listCustomers, getPlatformMetrics, listPlans } from "@/features/admin/actions";
import { AdminConsole } from "@/features/admin/admin-console";
import { PlatformMetricsView } from "@/features/admin/platform-metrics";
import { DemoModeCard } from "@/features/admin/demo-mode-card";
import { DemoCentersCard } from "@/features/admin/demo-centers-card";
import { listDemoCenters } from "@/features/admin/demo-actions";
import { getLeadStats } from "@/features/admin/lead-actions";
import { countOpenCapacityRequests } from "@/features/capacity/actions";
import { ChangePasswordCard } from "@/features/auth/change-password-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [customers, metrics, plans, demoCenters, leadStats, openCapacity] = await Promise.all([
    listCustomers(), getPlatformMetrics(), listPlans(), listDemoCenters(), getLeadStats(),
    countOpenCapacityRequests(),
  ]);
  const seeded = Object.fromEntries(demoCenters.map((c) => [c.sector, c.seeded]));
  const newLeads = leadStats.new ?? 0;

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

      {/* Leads, seat requests and demo mode share one row — three short cards
          side by side instead of three full-width bands, so the customer list
          below starts near the top of the page. They stack on a phone. */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Enquiries from the public website's demo form */}
        <Card className={`h-full ${newLeads > 0 ? "border-primary/40 bg-primary/5" : ""}`}>
          <CardContent className="flex h-full flex-col gap-3 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Inbox className="size-5" />
            </span>
            <h3 className="font-bold">
              Leads {newLeads > 0 && <span className="text-primary">· {newLeads} new</span>}
            </h3>
            <p className="flex-1 text-sm text-muted-foreground">
              {leadStats.total
                ? `${leadStats.total} enquir${leadStats.total === 1 ? "y" : "ies"} from your website's “Book your free demo” form. Call new ones the same day — speed wins these deals.`
                : "Enquiries from your website's “Book your free demo” form land here."}
            </p>
            <Link href="/admin/leads">
              <Button className="w-full">Open leads <ArrowRight className="size-4" /></Button>
            </Link>
          </CardContent>
        </Card>

        {/* Centers that hit their student limit and want more seats */}
        <Card className={`h-full ${openCapacity > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}>
          <CardContent className="flex h-full flex-col gap-3 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Users className="size-5" />
            </span>
            <h3 className="font-bold">
              Upgrade requests {openCapacity > 0 && <span className="text-destructive">· {openCapacity} waiting</span>}
            </h3>
            <p className="flex-1 text-sm text-muted-foreground">
              {openCapacity > 0
                ? "A center is at its student limit and has asked for more seats. Confirm payment, then approve."
                : "When a center taps a seat pack, the request lands here so it isn't lost in a WhatsApp thread."}
            </p>
            <Link href="/admin/capacity">
              <Button variant={openCapacity > 0 ? "default" : "outline"} className="w-full">
                Open requests <ArrowRight className="size-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <DemoModeCard />
      </div>

      <AdminConsole customers={customers} plans={plans} />
      <ChangePasswordCard />
      <DemoCentersCard seeded={seeded} />
    </div>
  );
}
