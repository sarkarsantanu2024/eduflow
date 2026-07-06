import { IndianRupee, TrendingUp, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PlatformMetrics } from "@/features/admin/actions";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const lakh = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : rupees(n));

/** Your platform's own revenue at a glance (super-admin). */
export function PlatformMetricsView({ metrics }: { metrics: PlatformMetrics }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={IndianRupee} label="MRR (recurring / mo)" value={rupees(metrics.mrr)} highlight />
        <Stat icon={TrendingUp} label="ARR (annualised)" value={lakh(metrics.arr)} />
        <Stat icon={CheckCircle2} label="Active subscriptions" value={String(metrics.activeSubs)} />
        <Stat icon={Clock} label="On trial" value={String(metrics.trialingSubs)} />
      </div>
      {metrics.byPlan.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap gap-x-6 gap-y-2 p-4 text-sm">
            <span className="font-semibold text-muted-foreground">MRR by plan:</span>
            {metrics.byPlan.map((p) => (
              <span key={p.code}>
                <strong>{p.name}</strong> ×{p.count} = {rupees(p.mrr)}
              </span>
            ))}
            {metrics.pastDueSubs > 0 && (
              <span className="text-amber-600"><AlertCircle className="mr-1 inline size-3.5" />{metrics.pastDueSubs} past-due</span>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight = false }: { icon: typeof IndianRupee; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : undefined}>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
