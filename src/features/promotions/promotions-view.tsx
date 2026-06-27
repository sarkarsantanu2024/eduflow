"use client";

import { TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import { renderTemplate } from "@/lib/wa-link";
import { getLabels } from "@/lib/constants";
import {
  useCollection, useHydrated, useProfile, addItem, updateItem, newId, type Promotion,
} from "@/lib/store/local-db";
import { formatDate } from "@/lib/utils";

const BODY = "Congratulations! {{student_name}} has cleared {{from}} and is promoted to {{to}} ({{score}}). 🎉 — {{business}}";

export function PromotionsView() {
  const hydrated = useHydrated();
  const promotions = useCollection("promotions");
  const students = useCollection("students");
  const courses = useCollection("courses");
  const profile = useProfile();
  const biz = profile.businessName || "our institute";
  const { courses: levelLabel } = getLabels(profile.businessType);

  const levelOptions = courses.map((c) => ({ value: c.name, label: c.name }));

  const addBtn = (
    <FormDialog
      title={`Promote a ${getLabels(profile.businessType).member.toLowerCase()}`}
      submitLabel="Record promotion" successMessage="Promotion recorded"
      description="Record a level/grade promotion, then send the parent a WhatsApp congrats."
      trigger={<Button><TrendingUp /> New promotion</Button>}
      fields={[
        { name: "studentId", label: "Student", type: "select", required: true,
          options: students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() })) },
        { name: "fromLevel", label: `From ${levelLabel.toLowerCase()}`, type: "select", options: levelOptions },
        { name: "toLevel", label: `To ${levelLabel.toLowerCase()}`, type: "select", options: levelOptions },
        { name: "score", label: "Assessment score / remark", placeholder: "92% / Excellent" },
      ]}
      onSubmit={(v) => {
        const s = students.find((x) => x.id === v("studentId"));
        if (!s) return;
        addItem<Promotion>("promotions", {
          id: newId("promo"), studentId: s.id, studentName: `${s.firstName} ${s.lastName}`.trim(),
          parentMobile: s.parentMobile || s.fatherContact, fromLevel: v("fromLevel"), toLevel: v("toLevel"),
          score: v("score"), date: new Date().toISOString().slice(0, 10), notified: false,
        });
      }}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader title={`${levelLabel} Promotions`} description="Promote students and share the good news with parents." actions={addBtn} />

      {!hydrated ? null : promotions.length === 0 ? (
        <EmptyState
          icon={TrendingUp} title="No promotions yet"
          description="Record a promotion to congratulate parents on WhatsApp."
          action={
            <div className="flex gap-2">
              {addBtn}
            </div>
          }
        />
      ) : (
        <div className="space-y-2">
          {promotions.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{p.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.fromLevel || "—"} → <span className="font-medium text-foreground">{p.toLevel || "—"}</span>
                    {p.score && ` · ${p.score}`} · {formatDate(p.date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.notified && <Badge variant="success">notified</Badge>}
                  <SendOnWhatsApp
                    size="sm" phone={p.parentMobile}
                    message={renderTemplate(BODY, { student_name: p.studentName, from: p.fromLevel, to: p.toLevel, score: p.score, business: biz })}
                    label="Congratulate"
                    onSent={() => updateItem<Promotion>("promotions", p.id, { notified: true })}
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
