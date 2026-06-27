"use client";

import { ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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
import { getSector } from "@/lib/constants";
import {
  useCollection, useHydrated, useProfile, addItem, updateItem, newId, type ExamReg,
} from "@/lib/store/local-db";
import { formatDate, formatCurrency } from "@/lib/utils";

// Sector-typical exam boards, shown as quick suggestions in the board field.
const BOARDS: Record<string, string[]> = {
  abacus: ["UCMAS IGE", "Aloha Grading", "National Abacus"],
  computer: ["NIELIT (CCC/O-Level)", "WEBEL", "ISO Franchise Cert"],
  dance: ["Bangiya Sangeet Parishad", "Prayag Sangit Samiti", "Rabindra Bharati"],
  drawing: ["Elementary Drawing Exam", "Intermediate Drawing Exam", "Bangiya Sangeet Parishad"],
};

const STATUS_LABEL: Record<ExamReg["status"], string> = {
  registered: "Registered", admit_card: "Admit card", result_out: "Result out",
};
const STATUS_VARIANT: Record<ExamReg["status"], "secondary" | "warning" | "success"> = {
  registered: "secondary", admit_card: "warning", result_out: "success",
};

const BODY = "Dear parent, {{student_name}} is registered for the {{board}} exam ({{tier}}) on {{date}}. Fee ₹{{fee}}. — {{business}}";

export function ExamBoardsView() {
  const hydrated = useHydrated();
  const regs = useCollection("examRegs");
  const students = useCollection("students");
  const profile = useProfile();
  const biz = profile.businessName || "our institute";
  const boards = BOARDS[getSector(profile.businessType).value] ?? ["Exam Board"];

  const addBtn = (
    <FormDialog
      title="Register for exam board" submitLabel="Register" successMessage="Exam registration added"
      description="Track external exam-board registration, fees and result status."
      trigger={<Button><ScrollText /> New registration</Button>}
      fields={[
        { name: "studentId", label: "Student", type: "select", required: true,
          options: students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() })) },
        { name: "board", label: "Exam board", type: "select", options: boards.map((b) => ({ value: b, label: b })) },
        { name: "tier", label: "Grade / level", placeholder: "Level 3 / Grade 2" },
        { name: "examDate", label: "Exam date", type: "date" },
        { name: "fee", label: "Fee (₹)", type: "number" },
      ]}
      onSubmit={(v) => {
        const s = students.find((x) => x.id === v("studentId"));
        if (!s) return;
        addItem<ExamReg>("examRegs", {
          id: newId("exr"), studentId: s.id, studentName: `${s.firstName} ${s.lastName}`.trim(),
          parentMobile: s.parentMobile || s.fatherContact, board: v("board"), tier: v("tier"),
          examDate: v("examDate"), fee: Number(v("fee")) || 0, status: "registered",
        });
      }}
    />
  );

  function cycle(r: ExamReg) {
    const next: ExamReg["status"] = r.status === "registered" ? "admit_card" : r.status === "admit_card" ? "result_out" : "registered";
    updateItem<ExamReg>("examRegs", r.id, { status: next });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Exam Boards" description="External exam-board registrations, fees and result tracking." actions={addBtn} />

      {!hydrated ? null : regs.length === 0 ? (
        <EmptyState
          icon={ScrollText} title="No exam registrations yet"
          description="Register students for board exams and track admit cards & results."
          action={
            <div className="flex gap-2">
              {addBtn}
            </div>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead><TableHead>Board / tier</TableHead><TableHead>Exam date</TableHead>
                  <TableHead>Fee</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell>{r.board}{r.tier && ` · ${r.tier}`}</TableCell>
                    <TableCell>{r.examDate ? formatDate(r.examDate) : "—"}</TableCell>
                    <TableCell>{r.fee ? formatCurrency(r.fee * 100) : "—"}</TableCell>
                    <TableCell>
                      <button onClick={() => cycle(r)} title="Click to advance status">
                        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <SendOnWhatsApp
                        size="sm" variant="outline" phone={r.parentMobile} label="Notify"
                        message={renderTemplate(BODY, { student_name: r.studentName, board: r.board, tier: r.tier, date: r.examDate ? formatDate(r.examDate) : "soon", fee: String(r.fee), business: biz })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
