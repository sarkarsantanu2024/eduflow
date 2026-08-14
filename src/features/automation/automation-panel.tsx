"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Cake, AlarmClock, UserX, Inbox, Trash2, Zap, BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import { formatDate } from "@/lib/utils";
import type { AutomationSettings } from "@/lib/store/types";
import {
  getAutomationData, saveAutomationSettings, markOutboxSent, dismissOutboxItem, clearOutbox,
  markFeePaidFromOutbox, type OutboxRow,
} from "./actions";

const KIND_LABEL: Record<string, string> = {
  fee_due: "Fee due", fee_overdue: "Fee overdue", absent: "Absent", birthday: "Birthday", announce: "Announcement",
};

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} onClick={onClick} disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted-foreground/25"} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function RuleRow({ icon: Icon, title, hint, on, onToggle, disabled, children }: {
  icon: typeof Zap; title: string; hint: string; on: boolean; onToggle: () => void; disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 gap-2.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
          {children}
        </div>
      </div>
      <Toggle on={on} onClick={onToggle} disabled={disabled} />
    </div>
  );
}

/**
 * Automation switches + the Outbox of auto-queued reminders. Everything queued
 * here still goes out through the owner's own WhatsApp — one tap per message,
 * ₹0. The daily scan runs server-side every morning.
 */
export function AutomationPanel({ canEdit }: { canEdit: boolean }) {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [queue, setQueue] = useState<OutboxRow[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAutomationData()
      .then((d) => { setSettings(d.settings); setQueue(d.queued); setSentCount(d.sentRecently); })
      .catch(() => toast.error("Couldn't load automation settings"))
      .finally(() => setLoaded(true));
  }, []);

  function update(patch: Partial<AutomationSettings>) {
    if (!settings) return;
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    saveAutomationSettings(patch)
      .then(async (saved) => {
        setSettings(saved);
        // A newly enabled rule queues instantly server-side — show the results.
        const d = await getAutomationData();
        setQueue(d.queued);
      })
      .catch(() => { setSettings(settings); toast.error("Couldn't save — try again"); });
  }

  function sent(row: OutboxRow) {
    setQueue((q) => q.filter((r) => r.id !== row.id));
    setSentCount((n) => n + 1);
    void markOutboxSent(row.id).catch(() => toast.error("Couldn't update status"));
  }

  function dismiss(row: OutboxRow) {
    setQueue((q) => q.filter((r) => r.id !== row.id));
    void dismissOutboxItem(row.id).catch(() => toast.error("Couldn't remove"));
  }

  function markPaid(row: OutboxRow) {
    setQueue((q) => q.filter((r) => r.id !== row.id));
    markFeePaidFromOutbox(row.id)
      .then((res) => {
        if (res.ok) toast.success(`${row.studentName}'s fee marked paid`, { description: "Recorded in Fees & History — no reminder will be sent." });
        else toast.error(res.error ?? "Couldn't mark paid");
      })
      .catch(() => toast.error("Couldn't mark paid — try again"));
  }

  function dismissAll() {
    setQueue([]);
    void clearOutbox().catch(() => toast.error("Couldn't clear the queue"));
  }

  if (!loaded || !settings) return null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Zap className="size-4" /></span>
            <div>
              <h2 className="font-bold">Automation</h2>
              <p className="text-xs text-muted-foreground">
                EduFlow prepares these reminders for you every morning — you just tap send. Free, from your own WhatsApp.
              </p>
            </div>
          </div>
          {sentCount > 0 && <Badge variant="outline">{sentCount} sent</Badge>}
        </div>

        {!canEdit && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Only the center owner&apos;s login can switch automation rules on or off. You can still send anything waiting in the Outbox below.
          </p>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <RuleRow icon={CalendarClock} title="Fee due soon" on={settings.feeDue} disabled={!canEdit}
            hint="Queues the Fee Due Reminder before the due date." onToggle={() => update({ feeDue: !settings.feeDue })}>
            {settings.feeDue && (
              <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                Remind
                <input
                  type="number" min={0} max={14} value={settings.feeDueDays} disabled={!canEdit}
                  onChange={(e) => update({ feeDueDays: Number(e.target.value) })}
                  className="h-7 w-14 rounded-md border border-input bg-card px-2 text-sm"
                />
                days before due date
              </label>
            )}
          </RuleRow>
          <RuleRow icon={AlarmClock} title="Fee overdue" on={settings.feeOverdue} disabled={!canEdit}
            hint="Queues the Fee Overdue message once the due date passes unpaid. Stops when marked paid."
            onToggle={() => update({ feeOverdue: !settings.feeOverdue })} />
          <RuleRow icon={UserX} title="Absent today" on={settings.absent} disabled={!canEdit}
            hint="Queues an alert for each absent student the moment attendance is saved."
            onToggle={() => update({ absent: !settings.absent })} />
          <RuleRow icon={Cake} title="Birthday wish" on={settings.birthday} disabled={!canEdit}
            hint="Queues a birthday message on each student's big day."
            onToggle={() => update({ birthday: !settings.birthday })} />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Inbox className="size-4" /> Outbox
              {queue.length > 0 && <Badge>{queue.length}</Badge>}
            </h3>
            {queue.length > 1 && (
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={dismissAll}>
                <Trash2 className="size-3.5" /> Dismiss all
              </Button>
            )}
          </div>

          {queue.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nothing waiting. Turn on a rule above and reminders will appear here, ready to send.
            </p>
          ) : (
            <ul className="space-y-2">
              {queue.map((r) => (
                <li key={r.id} className="rounded-lg border p-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                    <span className="text-sm font-medium">{r.studentName || "—"}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="mb-2 line-clamp-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">{r.body}</p>
                  <div className="flex flex-wrap gap-2">
                    <SendOnWhatsApp phone={r.phone} message={r.body} label="Send" size="sm" onSent={() => sent(r)} />
                    {(r.kind === "fee_due" || r.kind === "fee_overdue") && (
                      <Button size="sm" variant="outline" onClick={() => markPaid(r)} title="They already paid — record it and skip this reminder">
                        <BadgeCheck className="size-3.5 text-emerald-600" /> Already paid
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label="Dismiss" onClick={() => dismiss(r)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
