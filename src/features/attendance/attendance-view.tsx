"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Check, X, Save, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import { renderTemplate } from "@/lib/wa-link";
import { queueAbsentAlerts } from "@/features/automation/actions";
import {
  rosterFor, unassignedCount, savedAbsentIds, attendanceWrites, attendanceSummary,
} from "@/features/attendance/attendance-math";
import {
  useCollection, useHydrated, useProfile, addItem, updateItem, newId,
  type Attendance, type Student,
} from "@/lib/store/local-db";
import { todayIso } from "@/lib/date";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

const ABSENT_BODY =
  "Dear {{parent_name}}, {{student_name}} was marked absent in today's class ({{date}}). Please ensure regular attendance. — {{business}}";

export function AttendanceView() {
  const hydrated = useHydrated();
  const students = useCollection("students");
  const batches = useCollection("batches");
  const attendance = useCollection("attendance");
  const profile = useProfile();
  const biz = profile.businessName || "our institute";

  const today = todayIso();
  const [date, setDate] = useState(today);
  const [batchId, setBatchId] = useState<string>("");

  // Default to the first batch once data is present.
  const activeBatch = batchId || batches[0]?.id || "";
  const roster = useMemo(() => rosterFor(students, activeBatch), [students, activeBatch]);
  // Active students with no batch never appear in ANY roster — surface them
  // instead of letting them silently disappear from attendance.
  const unassigned = useMemo(() => unassignedCount(students), [students]);

  // Which students are currently marked absent (seeded from saved records).
  const savedAbsent = useMemo(
    () => savedAbsentIds(attendance, activeBatch, date),
    [attendance, activeBatch, date],
  );

  const [absent, setAbsent] = useState<Set<string>>(new Set());
  // Re-seed local toggles whenever batch/date changes.
  const seedKey = `${activeBatch}|${date}`;
  const [lastSeed, setLastSeed] = useState("");
  if (seedKey !== lastSeed) {
    setLastSeed(seedKey);
    setAbsent(new Set(savedAbsent));
  }

  function toggle(id: string) {
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    const { creates, updates } = attendanceWrites(roster, absent, attendance, activeBatch, date);
    updates.forEach((u) => updateItem<Attendance>("attendance", u.id, { present: u.present }));
    creates.forEach((c) => addItem<Attendance>("attendance", { id: newId("att"), ...c }));
    const tally = attendanceSummary(roster, absent);
    toast.success("Attendance saved", { description: `${tally.present} present · ${tally.absent} absent` });
    // If the center enabled the "Absent today" automation, queue alerts into
    // the Reminders → Outbox (no-op otherwise; server checks the switch).
    if (absent.size > 0) {
      void queueAbsentAlerts(date, [...absent])
        .then((n) => { if (n > 0) toast.info(`${n} absence alert${n === 1 ? "" : "s"} queued in WhatsApp Reminders`); })
        .catch(() => {});
    }
  }

  const absentStudents = roster.filter((s) => absent.has(s.id));

  function absentMessage(s: Student) {
    return renderTemplate(ABSENT_BODY, {
      parent_name: s.parentName || s.fatherName || "Parent",
      student_name: `${s.firstName} ${s.lastName}`.trim(),
      date: new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      business: biz,
    });
  }

  if (hydrated && students.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Attendance" description="Mark present/absent and alert parents on WhatsApp." />
        <EmptyState
          icon={ClipboardCheck} title="No students yet"
          description="Add students first, then mark attendance and send WhatsApp absent-alerts."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Mark present/absent and alert absent parents on WhatsApp — free." />

      {/* Controls */}
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Batch</Label>
            <select className={selectClass} value={activeBatch} onChange={(e) => setBatchId(e.target.value)}>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Students that can never show up here, whatever batch is picked */}
      {hydrated && unassigned > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <span>
            <strong>{unassigned} active student{unassigned > 1 ? "s have" : " has"} no batch assigned</strong>
            {" "}— they won&apos;t appear in any batch&apos;s attendance. Open each student and set their Batch.
          </span>
          <Button size="sm" variant="outline" asChild>
            <a href="/students">Fix in Students</a>
          </Button>
        </div>
      )}

      {/* Roster */}
      {!hydrated ? null : roster.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No active students in this batch" description="Pick another batch, or assign students to this batch first." />
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{roster.length} students</CardTitle>
            <Button onClick={save}><Save /> Save attendance</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {roster.map((s) => {
              const isAbsent = absent.has(s.id);
              const name = `${s.firstName} ${s.lastName}`.trim();
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                  <span className="font-medium">{name}</span>
                  <div className="inline-flex overflow-hidden rounded-lg border">
                    <button
                      type="button" onClick={() => isAbsent && toggle(s.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${!isAbsent ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      <Check className="size-4" /> Present
                    </button>
                    <button
                      type="button" onClick={() => !isAbsent && toggle(s.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${isAbsent ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      <X className="size-4" /> Absent
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Absent alerts */}
      {absentStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="size-5 text-primary" /> Alert absent parents ({absentStudents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {absentStudents.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{`${s.firstName} ${s.lastName}`.trim()}</span>
                  <Badge variant="destructive">absent</Badge>
                </div>
                <SendOnWhatsApp
                  size="sm" phone={s.parentMobile || s.fatherContact} message={absentMessage(s)}
                  label="Notify parent"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
