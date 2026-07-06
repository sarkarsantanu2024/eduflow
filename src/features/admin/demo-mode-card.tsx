"use client";

import { useActionState } from "react";
import { PlayCircle, RefreshCw, Sparkles, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { enterDemoMode, resetDemoData } from "@/features/admin/demo-actions";
import { FEATURES } from "@/lib/features";
import { DEMO_HO_USERNAME, DEMO_HO_PASSWORD } from "@/lib/demo-tenant";

/** Super-admin only: jump into a fully-populated demo center for sales calls. */
export function DemoModeCard() {
  const [state, resetAction, resetting] = useActionState(
    async (_p: { ok?: boolean; error?: string } | undefined) => resetDemoData(),
    undefined,
  );

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </span>
        <div className="flex-1">
          <h3 className="font-bold">Demo mode</h3>
          <p className="text-sm text-muted-foreground">
            Enter a fully-populated sample center (students, fees, tests, certificates, reports…) to
            walk a prospect through the whole product. It&apos;s an isolated demo tenant — nothing here
            affects real customers. Use <strong>Reset</strong> to start the next demo fresh.
          </p>
          {state?.ok && <p className="mt-1 text-sm text-emerald-600">Demo data reset.</p>}
          {state?.error && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
          {FEATURES.headOffice && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="size-3.5" />
              To demo the <strong>Head-Office / franchise</strong> view, sign in as the demo owner:
              <code className="rounded bg-background px-1.5 py-0.5 font-mono">{DEMO_HO_USERNAME}</code> /
              <code className="rounded bg-background px-1.5 py-0.5 font-mono">{DEMO_HO_PASSWORD}</code>
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <form action={resetAction}>
            <Button type="submit" variant="outline" disabled={resetting}>
              <RefreshCw className={`size-4 ${resetting ? "animate-spin" : ""}`} /> {resetting ? "Resetting…" : "Reset"}
            </Button>
          </form>
          <form action={enterDemoMode}>
            <Button type="submit">
              <PlayCircle className="size-4" /> Enter demo mode
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
