"use client";

import { Receipt, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog, type FormField } from "@/components/form-dialog";
import { UpiCollectDialog } from "@/features/payments/upi-collect-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  useCollection, useHydrated, useProfile, addItem, loadSamples, newId, type Fee,
} from "@/lib/store/local-db";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusVariant: Record<Fee["status"], "success" | "warning" | "secondary" | "destructive"> = {
  paid: "success", partial: "warning", pending: "secondary", overdue: "destructive",
};

export function FeesView() {
  const hydrated = useHydrated();
  const fees = useCollection("fees");
  const students = useCollection("students");
  const { monthlyFee } = useProfile();

  const createBtn = (
    <FormDialog
      title="Create fee" submitLabel="Create fee" successMessage="Fee created"
      trigger={<Button><Plus /> Create fee</Button>}
      fields={[
        { name: "studentId", label: "Student", type: "select", required: true,
          options: students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() })) },
        { name: "title", label: "Title", required: true, placeholder: "June 2026 Monthly Fee" },
        { name: "amount", label: "Amount (₹)", type: "number", required: true,
          defaultValue: monthlyFee > 0 ? String(monthlyFee) : "" },
        { name: "dueDate", label: "Due date", type: "date" },
      ]}
      onSubmit={(v) => {
        const student = students.find((s) => s.id === v("studentId"));
        addItem<Fee>("fees", {
          id: newId("fee"), studentId: v("studentId"),
          studentName: student ? `${student.firstName} ${student.lastName}`.trim() : "",
          title: v("title"), type: "monthly", amount: Number(v("amount")) || 0, amountPaid: 0,
          status: "pending", dueDate: v("dueDate"),
        });
      }}
    />
  );

  if (hydrated && fees.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fees" description="Create and track what students owe." actions={createBtn} />
        <EmptyState
          icon={Receipt} title="No fees yet"
          description="Create a fee (what a student owes), or load sample data."
          action={
            <div className="flex gap-2">
              {createBtn}
              <Button variant="outline" onClick={() => { loadSamples(); toast.success("Sample data loaded"); }}>
                <Sparkles /> Load sample data
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const billed = fees.reduce((s, f) => s + f.amount, 0);
  const collected = fees.reduce((s, f) => s + f.amountPaid, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Fees" description="Create and track what students owe." actions={createBtn} />

      <div className="grid gap-4 sm:grid-cols-3">
        {[["Total Billed", billed], ["Collected", collected], ["Pending", billed - collected]].map(([label, val]) => (
          <Card key={label as string}>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">{label as string}</p>
              <p className="text-2xl font-extrabold tracking-tight">{formatCurrency((val as number) * 100)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead><TableHead>Fee</TableHead><TableHead>Amount</TableHead>
              <TableHead>Paid</TableHead><TableHead>Due date</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.studentName}</TableCell>
                <TableCell>{f.title}</TableCell>
                <TableCell>{formatCurrency(f.amount * 100)}</TableCell>
                <TableCell>{formatCurrency(f.amountPaid * 100)}</TableCell>
                <TableCell>{f.dueDate ? formatDate(f.dueDate) : "—"}</TableCell>
                <TableCell><Badge variant={statusVariant[f.status]}>{f.status}</Badge></TableCell>
                <TableCell className="text-right">
                  {f.status !== "paid" && (
                    <UpiCollectDialog
                      feeId={f.id} studentId={f.studentId} studentName={f.studentName}
                      amount={f.amount - f.amountPaid}
                      trigger={<Button size="sm" variant="outline">Collect</Button>}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
