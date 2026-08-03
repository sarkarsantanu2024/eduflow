"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Plus, Users } from "lucide-react";
import { getCapacityPanel, requestSeats, type CapacityPanel } from "@/features/capacity/actions";

/**
 * Student capacity meter.
 *
 * Silent while a center has room, warns from 90%, and at the limit explains
 * what to do. Deliberately shows SEATS, never a rupee-per-student rate: "+50
 * students" is a decision an owner makes in a second, "₹8 per student per
 * month" makes them do arithmetic and feel metered.
 */
export function SeatMeter({ className = "", always = false }: { className?: string; always?: boolean }) {
  const [panel, setPanel] = useState<CapacityPanel | null>(null);

  useEffect(() => {
    let alive = true;
    getCapacityPanel().then((p) => { if (alive) setPanel(p); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!panel) return null;
  const { usage } = panel;
  if (usage.cap === null) return null;              // Enterprise — nothing to meter
  if (!always && !usage.nearCap) return null;       // plenty of room, stay quiet

  return (
    <div
      role="status"
      className={`rounded-xl border p-4 ${
        usage.atCap ? "border-destructive/40 bg-destructive/5"
        : usage.nearCap ? "border-amber-300/70 bg-amber-50 dark:bg-amber-950/20"
        : "bg-card"
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${usage.atCap ? "text-destructive" : usage.nearCap ? "text-amber-600" : "text-muted-foreground"}`}>
          {usage.atCap ? <AlertTriangle className="size-5" /> : <Users className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <SeatBar panel={panel} />
          <SeatActions panel={panel} />
        </div>
      </div>
    </div>
  );
}

/** The "95 / 100 — only 5 seats remaining" block with its progress bar. */
export function SeatBar({ panel }: { panel: CapacityPanel }) {
  const { usage } = panel;
  if (usage.cap === null) {
    return <p className="font-semibold">Unlimited students on the {usage.planName} plan</p>;
  }
  const pct = Math.min(100, Math.round((usage.used / usage.cap) * 100));
  const left = usage.remaining;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-semibold">Student capacity</p>
        <p className="font-display text-sm font-bold tabular-nums">
          {usage.used} <span className="text-muted-foreground">/ {usage.cap}</span>
        </p>
      </div>

      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            usage.atCap ? "bg-destructive" : usage.nearCap ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-1.5 text-sm text-muted-foreground">
        {usage.atCap
          ? `You've used all ${usage.cap} seats on your ${usage.planName} plan. Your existing students and data are completely safe.`
          : `Only ${left} seat${left === 1 ? "" : "s"} remaining.`}
      </p>
    </>
  );
}

/** Seat packs + the upgrade route. One tap opens WhatsApp, pre-filled. */
export function SeatActions({ panel, compact = false }: { panel: CapacityPanel; compact?: boolean }) {
  const { offer, waLinks } = panel;
  const [busy, setBusy] = useState<number | null>(null);

  // When every pack is worse value than moving up, we stop selling seats and
  // say so — it's the honest answer and it protects revenue.
  if (offer.recommendedPlan) {
    return (
      <div className="mt-3">
        <p className="text-sm">{offer.reason}</p>
        <Link
          href="/billing"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Upgrade to {offer.recommendedPlan.name} <ArrowUpRight className="size-4" />
        </Link>
      </div>
    );
  }

  async function pick(seats: number, href: string) {
    setBusy(seats);
    // Open first: a popup blocker must never stand between an owner who wants
    // to pay us and the message that gets it done.
    window.open(href, "_blank", "noopener");
    try { await requestSeats(seats); } catch { /* queue entry is best-effort */ }
    setBusy(null);
  }

  return (
    <div className="mt-3">
      {!compact && <p className="text-sm font-semibold">Need more capacity?</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {offer.packs.filter((p) => !p.upgradeIsBetter).map((p) => (
          <button
            key={p.seats}
            type="button"
            disabled={busy !== null}
            onClick={() => pick(p.seats, waLinks[p.seats] ?? "")}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-primary px-3.5 py-2 text-sm font-bold text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
          >
            <Plus className="size-4" /> {p.seats} Students
          </button>
        ))}
        <Link
          href="/billing"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold"
        >
          Upgrade your plan
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Choosing a seat pack opens WhatsApp with your centre details filled in. We reply with payment
        details and switch the seats on as soon as payment is received.
      </p>
    </div>
  );
}
