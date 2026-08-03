"use client";

import { useActionState } from "react";
import { PlayCircle, RefreshCw, Layers, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { enterSectorDemo, resetSectorDemo, seedAllSectorDemos } from "@/features/admin/demo-actions";
import { DEMO_CENTERS } from "@/lib/demo-tenant";
import { getSector } from "@/lib/sectors";

/**
 * Super-admin only: one ready-made demo center per business type, so a sales
 * visit can show a coaching owner a coaching center, a dance school a dance
 * school, and so on. Each center carries its own courses, WhatsApp templates
 * and modules; entering one seeds it on first use.
 */
export function DemoCentersCard({ seeded }: { seeded: Record<string, boolean> }) {
  const [state, seedAllAction, seeding] = useActionState(
    async (_p: { ok?: boolean; error?: string } | undefined) => seedAllSectorDemos(),
    undefined,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-4 text-primary" /> Demo centers by business type
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {DEMO_CENTERS.length} more sample institutes besides the abacus demo — each with its own
            students, fees, batches, courses and WhatsApp messages. Show a prospect their own kind of
            center. Nothing here touches real customers.
          </p>
          {state?.ok && <p className="mt-1 text-sm text-emerald-600">All demo centers rebuilt.</p>}
          {state?.error && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
        </div>
        <form action={seedAllAction}>
          <Button type="submit" variant="outline" size="sm" disabled={seeding}>
            <RefreshCw className={`size-4 ${seeding ? "animate-spin" : ""}`} />
            {seeding ? "Building…" : "Build / reset all"}
          </Button>
        </form>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DEMO_CENTERS.map((center) => {
          const sector = getSector(center.sector);
          return (
            <div key={center.id} className="flex flex-col gap-2 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold leading-tight">{sector.label}</p>
                  <p className="text-xs text-muted-foreground">{center.name.replace("▶ Demo — ", "")}</p>
                </div>
                {seeded[center.sector] && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="size-3.5" /> Ready
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{sector.tagline}</p>
              <p className="text-xs text-muted-foreground">
                {center.city} · ₹{center.monthlyFee}/mo fee · {sector.courses}: {sector.seedCourses.length}
              </p>
              <div className="mt-auto flex gap-2 pt-1">
                <form action={enterSectorDemo} className="flex-1">
                  <input type="hidden" name="sector" value={center.sector} />
                  <Button type="submit" size="sm" className="w-full">
                    <PlayCircle className="size-4" /> Enter demo
                  </Button>
                </form>
                <form action={resetSectorDemo}>
                  <input type="hidden" name="sector" value={center.sector} />
                  <Button type="submit" size="sm" variant="outline" title="Rebuild this center's sample data">
                    <RefreshCw className="size-4" />
                  </Button>
                </form>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
