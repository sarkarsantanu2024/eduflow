"use client";

import { useMemo, useState } from "react";
import { Trophy, Sparkles, Medal } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { renderTemplate } from "@/lib/wa-link";
import {
  useCollection, useHydrated, useProfile, addItem, loadSamples, newId, type TestScore,
} from "@/lib/store/local-db";

const BODY = "{{student_name}} scored {{score}}/{{max}} in the {{test}} test — Rank {{rank}} in the batch. — {{business}}";

export function TestsView() {
  const hydrated = useHydrated();
  const scores = useCollection("testScores");
  const students = useCollection("students");
  const profile = useProfile();
  const biz = profile.businessName || "our institute";

  // Group scores by test name; default-select the first test.
  const testNames = useMemo(() => Array.from(new Set(scores.map((s) => s.testName))), [scores]);
  const [selected, setSelected] = useState<string>("");
  const activeTest = selected || testNames[0] || "";

  // Ranked rows for the active test (highest score first).
  const ranked = useMemo(() => {
    return scores
      .filter((s) => s.testName === activeTest)
      .sort((a, b) => b.score - a.score)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [scores, activeTest]);

  const addBtn = (
    <FormDialog
      title="Add test score" submitLabel="Add score" successMessage="Score added"
      description="Record a student's score. Ranks update automatically per test."
      trigger={<Button><Trophy /> Add score</Button>}
      fields={[
        { name: "testName", label: "Test name", required: true, placeholder: "June Unit Test", defaultValue: activeTest },
        { name: "studentId", label: "Student", type: "select", required: true,
          options: students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() })) },
        { name: "score", label: "Score", type: "number", required: true },
        { name: "maxScore", label: "Out of", type: "number", placeholder: "100" },
      ]}
      onSubmit={(v) => {
        const s = students.find((x) => x.id === v("studentId"));
        if (!s) return;
        addItem<TestScore>("testScores", {
          id: newId("ts"), testName: v("testName"), date: new Date().toISOString().slice(0, 10),
          batchId: s.batchId, studentId: s.id, studentName: `${s.firstName} ${s.lastName}`.trim(),
          parentMobile: s.parentMobile || s.fatherContact,
          score: Number(v("score")) || 0, maxScore: Number(v("maxScore")) || 100,
        });
        setSelected(v("testName"));
      }}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Tests & Rank Lists" description="Record scores, auto-rank the batch, and send each parent a result card." actions={addBtn} />

      {!hydrated ? null : scores.length === 0 ? (
        <EmptyState
          icon={Trophy} title="No test scores yet"
          description="Add scores to build an automatic rank list and WhatsApp result cards."
          action={
            <div className="flex gap-2">
              {addBtn}
              <Button variant="outline" onClick={() => { loadSamples(); toast.success("Sample data loaded"); }}>
                <Sparkles /> Load sample data
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {testNames.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {testNames.map((t) => (
                <button key={t} onClick={() => setSelected(t)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${t === activeTest ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {t}
                </button>
              ))}
            </div>
          )}

          <Card className="overflow-hidden">
            <CardHeader><CardTitle className="text-base">{activeTest} — rank list</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead><TableHead>Student</TableHead>
                    <TableHead>Score</TableHead><TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant={r.rank <= 3 ? "success" : "secondary"} className="gap-1">
                          {r.rank <= 3 && <Medal className="size-3" />}#{r.rank}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{r.studentName}</TableCell>
                      <TableCell className="font-semibold">{r.score}/{r.maxScore}</TableCell>
                      <TableCell className="text-right">
                        <SendOnWhatsApp
                          size="sm" variant="outline" phone={r.parentMobile} label="Send result"
                          message={renderTemplate(BODY, { student_name: r.studentName, score: String(r.score), max: String(r.maxScore), test: r.testName, rank: String(r.rank), business: biz })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
