"use client";

import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SeatBar, SeatActions } from "@/features/capacity/seat-meter";
import type { CapacityPanel } from "@/features/capacity/actions";

/**
 * Shown instead of the Add Student form once a center is at its limit.
 *
 * Tone matters here: this is a growing customer being told to wait, which is
 * the worst possible moment to sound like a payment wall. So we lead with the
 * plain fact, promise their data is untouched, and give them three ways
 * forward — never the word "blocked".
 */
export function LimitReached({ panel }: { panel: CapacityPanel }) {
  const { usage } = panel;

  return (
    <Card className="border-amber-300/70">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-extrabold">Student limit reached</h2>
            <p className="mt-1 text-muted-foreground">
              Your current plan supports {usage.cap} active students.
            </p>

            <div className="mt-4 rounded-xl border bg-muted/40 p-4">
              <SeatBar panel={panel} />
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              Your existing students and data are completely safe. Nothing has been removed or switched
              off — only new admissions are waiting for capacity.
            </p>

            <p className="mt-4 text-sm font-semibold">Choose one:</p>
            <SeatActions panel={panel} compact />

            <p className="mt-4 text-sm">
              <Link href="/students" className="font-semibold text-primary hover:underline">
                ← Back to students
              </Link>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
