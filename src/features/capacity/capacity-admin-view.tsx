"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Clock, IndianRupee, History, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveRequest, setRequestStatus, adjustCapacity, listCapacityHistory,
  type CapacityRequestRow, type CapacityEventRow, type CenterCapacityRow,
} from "@/features/capacity/actions";
import { formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for payment",
  payment_received: "Payment received",
  approved: "Approved",
  declined: "Declined",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge variant="success">Approved</Badge>;
  if (status === "declined") return <Badge variant="outline">Declined</Badge>;
  if (status === "payment_received") return <Badge>Payment received</Badge>;
  return <Badge variant="destructive">Waiting for payment</Badge>;
}

export function CapacityAdminView({ requests, centers }: { requests: CapacityRequestRow[]; centers: CenterCapacityRow[] }) {
  const open = requests.filter((r) => r.status === "pending" || r.status === "payment_received");
  const done = requests.filter((r) => r.status === "approved" || r.status === "declined");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Upgrade requests</h1>
        <p className="text-sm text-muted-foreground">
          Centers that tapped a seat pack. Confirm the payment, then approve — approving applies the
          seats and writes the history entry in one step.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-bold">
          Pending {open.length > 0 && <span className="text-destructive">· {open.length}</span>}
        </h2>
        {open.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            Nothing waiting. New seat requests appear here the moment a center taps a pack.
          </CardContent></Card>
        ) : (
          open.map((r) => <RequestCard key={r.id} req={r} />)
        )}
      </section>

      <ManualAdjust centers={centers} />

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">Handled</h2>
          {done.map((r) => <RequestCard key={r.id} req={r} />)}
        </section>
      )}
    </div>
  );
}

function RequestCard({ req }: { req: CapacityRequestRow }) {
  const [pending, start] = useTransition();
  const settled = req.status === "approved" || req.status === "declined";

  function run(fn: (fd: FormData) => Promise<{ error?: string; ok?: boolean }>, extra?: Record<string, string>) {
    const fd = new FormData();
    fd.set("id", req.id);
    for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
    start(async () => {
      const res = await fn(fd);
      if (res.error) toast.error(res.error);
      else toast.success("Updated");
    });
  }

  return (
    <Card className={req.status === "payment_received" ? "border-primary/40" : undefined}>
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{req.centerName}</h3>
            <Badge variant="outline">{req.centerId}</Badge>
            <StatusBadge status={req.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Requested <strong className="text-foreground">+{req.seats} students</strong> ·{" "}
            {req.planName} plan · {req.activeStudents} of {req.capAtRequest} used
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {formatDate(req.createdAt)} · {new Date(req.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            {req.handledBy && <> · handled by {req.handledBy}</>}
          </p>
          {req.suggestedPlanCode && (
            <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              This center has outgrown seat packs — suggest the{" "}
              <strong className="capitalize">{req.suggestedPlanCode}</strong> plan instead.
            </p>
          )}
        </div>

        {!settled && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {req.status === "pending" && (
              <Button variant="outline" size="sm" disabled={pending}
                onClick={() => run(setRequestStatus, { status: "payment_received" })}>
                <IndianRupee className="size-3.5" /> Mark paid
              </Button>
            )}
            <Button size="sm" disabled={pending} onClick={() => run(approveRequest)}>
              <Check className="size-3.5" /> Approve · +{req.seats}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending}
              onClick={() => run(setRequestStatus, { status: "declined" })}>
              <X className="size-3.5" /> Decline
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Manual capacity editor — the "current limit / additional seats / new limit"
 * panel, for when a center pays outside the request queue (a phone call, a
 * renewal, a goodwill top-up).
 */
function ManualAdjust({ centers }: { centers: CenterCapacityRow[] }) {
  const [instituteId, setInstituteId] = useState("");
  const [seats, setSeats] = useState(50);
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<CapacityEventRow[] | null>(null);
  const [pending, start] = useTransition();

  const center = centers.find((c) => c.instituteId === instituteId);

  function save() {
    if (!instituteId) { toast.error("Pick a center"); return; }
    const fd = new FormData();
    fd.set("instituteId", instituteId);
    fd.set("seats", String(seats));
    fd.set("notes", notes);
    start(async () => {
      const res = await adjustCapacity(fd);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`${seats > 0 ? "Added" : "Removed"} ${Math.abs(seats)} seats`);
      setNotes("");
      setHistory(await listCapacityHistory(instituteId));
    });
  }

  async function loadHistory(id: string) {
    setInstituteId(id);
    setHistory(id ? await listCapacityHistory(id) : null);
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="font-bold">Adjust capacity manually</h2>
          <p className="text-sm text-muted-foreground">
            For payments taken outside the queue. Every change is recorded in the history below.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="cap-center">Center</Label>
            <select
              id="cap-center"
              value={instituteId}
              onChange={(e) => loadHistory(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-2 text-sm"
            >
              <option value="">Select a center…</option>
              {centers.map((c) => (
                <option key={c.instituteId} value={c.instituteId}>
                  {c.name} ({c.centerId}) — {c.used}/{c.cap ?? "∞"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cap-current">Current limit</Label>
            <Input id="cap-current" readOnly className="mt-1 bg-muted"
              value={center ? (center.cap === null ? "Unlimited" : `${center.cap}`) : "—"} />
          </div>
          <div>
            <Label htmlFor="cap-seats">Additional seats</Label>
            <Input id="cap-seats" type="number" step={25} value={seats}
              onChange={(e) => setSeats(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="cap-new">New limit</Label>
            <Input id="cap-new" readOnly className="mt-1 bg-muted font-bold"
              value={center ? (center.cap === null ? "Unlimited" : `${center.cap + seats}`) : "—"} />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="cap-notes">Note (shown in history)</Label>
            <Input id="cap-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment received · UPI ref 1234" className="mt-1" />
          </div>
          <Button onClick={save} disabled={pending || !instituteId}>Save</Button>
        </div>

        {history && (
          <div className="pt-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold"><History className="size-4" /> Capacity history</h3>
            {history.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No changes recorded yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3 font-bold">Date</th>
                      <th className="py-2 pr-3 font-bold">Action</th>
                      <th className="py-2 pr-3 font-bold">By</th>
                      <th className="py-2 font-bold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDate(e.createdAt)}</td>
                        <td className="py-2 pr-3 font-medium">{describeEvent(e)}</td>
                        <td className="py-2 pr-3 capitalize">{e.actorName || e.actor}</td>
                        <td className="py-2 text-muted-foreground">{e.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** "+50 Students" / "Starter plan" — the Action column of the history table. */
export function describeEvent(e: CapacityEventRow): string {
  if (e.action === "seats_added") return `+${e.delta} Students`;
  if (e.action === "seats_removed") return `${e.delta} Students`;
  if (e.action === "plan_changed" || e.action === "plan_set") {
    return e.resultingCap === null ? "Plan set · unlimited" : `Plan set · ${e.resultingCap} Students`;
  }
  return e.action;
}

export { STATUS_LABEL };
