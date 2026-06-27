"use client";

import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import { renderTemplate } from "@/lib/wa-link";
import {
  useCollection, useHydrated, useProfile, addItem, newId, type Performance,
} from "@/lib/store/local-db";
import { formatDate } from "@/lib/utils";

const BODY = "Proud moment! {{student_name}} achieved {{result}} at {{event}} ({{level}}). Congratulations! 🏆 — {{business}}";

export function PerformanceView() {
  const hydrated = useHydrated();
  const performances = useCollection("performances");
  const students = useCollection("students");
  const profile = useProfile();
  const biz = profile.businessName || "our institute";

  const addBtn = (
    <FormDialog
      title="Record performance" submitLabel="Record" successMessage="Performance recorded"
      description="Log a competition, recital or contest result, then share it with the parent."
      trigger={<Button><Trophy /> New entry</Button>}
      fields={[
        { name: "studentId", label: "Student", type: "select", required: true,
          options: students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() })) },
        { name: "event", label: "Event", required: true, placeholder: "State Championship / Annual Recital" },
        { name: "level", label: "Level", type: "select",
          options: ["School", "District", "State", "National", "International"].map((l) => ({ value: l, label: l })) },
        { name: "result", label: "Result", placeholder: "Rank 1 / Gold Medal / Participated" },
        { name: "date", label: "Date", type: "date" },
      ]}
      onSubmit={(v) => {
        const s = students.find((x) => x.id === v("studentId"));
        if (!s) return;
        addItem<Performance>("performances", {
          id: newId("perf"), studentId: s.id, studentName: `${s.firstName} ${s.lastName}`.trim(),
          parentMobile: s.parentMobile || s.fatherContact, event: v("event"), level: v("level"),
          result: v("result"), date: v("date") || new Date().toISOString().slice(0, 10),
        });
      }}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Performance & Competitions" description="Track contest, competition and recital results." actions={addBtn} />

      {!hydrated ? null : performances.length === 0 ? (
        <EmptyState
          icon={Trophy} title="No entries yet"
          description="Record a competition or recital result to celebrate with parents."
          action={
            <div className="flex gap-2">
              {addBtn}
            </div>
          }
        />
      ) : (
        <div className="space-y-2">
          {performances.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{p.studentName}</p>
                  <p className="text-sm text-muted-foreground">{p.event} · {formatDate(p.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{p.level}</Badge>
                  <Badge variant="success">{p.result}</Badge>
                  <SendOnWhatsApp
                    size="sm" variant="outline" phone={p.parentMobile} label="Share"
                    message={renderTemplate(BODY, { student_name: p.studentName, result: p.result, event: p.event, level: p.level, business: biz })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
