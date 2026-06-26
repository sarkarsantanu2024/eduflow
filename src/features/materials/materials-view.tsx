"use client";

import { Package, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  useCollection, useHydrated, addItem, updateItem, loadSamples, newId, type Material,
} from "@/lib/store/local-db";
import { formatDate, formatCurrency } from "@/lib/utils";

export function MaterialsView() {
  const hydrated = useHydrated();
  const materials = useCollection("materials");
  const students = useCollection("students");

  const addBtn = (
    <FormDialog
      title="Issue material / kit" submitLabel="Add" successMessage="Material recorded"
      description="Track kits, costumes and art materials issued to students."
      trigger={<Button><Package /> Issue material</Button>}
      fields={[
        { name: "studentId", label: "Student", type: "select", required: true,
          options: students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() })) },
        { name: "item", label: "Item", required: true, placeholder: "Abacus Kit / Costume / Colour box" },
        { name: "amount", label: "Charge (₹, 0 if free)", type: "number" },
      ]}
      onSubmit={(v) => {
        const s = students.find((x) => x.id === v("studentId"));
        if (!s) return;
        addItem<Material>("materials", {
          id: newId("mat"), studentId: s.id, studentName: `${s.firstName} ${s.lastName}`.trim(),
          item: v("item"), amount: Number(v("amount")) || 0, issued: false,
          date: new Date().toISOString().slice(0, 10),
        });
      }}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Materials & Kits" description="Track kit, costume and material issuance per student." actions={addBtn} />

      {!hydrated ? null : materials.length === 0 ? (
        <EmptyState
          icon={Package} title="No materials yet"
          description="Record kits, costumes or art supplies issued to students."
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
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead><TableHead>Item</TableHead><TableHead>Charge</TableHead>
                  <TableHead>Date</TableHead><TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.studentName}</TableCell>
                    <TableCell>{m.item}</TableCell>
                    <TableCell>{m.amount ? formatCurrency(m.amount * 100) : <span className="text-muted-foreground">Free</span>}</TableCell>
                    <TableCell>{formatDate(m.date)}</TableCell>
                    <TableCell className="text-right">
                      {m.issued ? (
                        <Badge variant="success" className="gap-1"><Check className="size-3" /> Issued</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { updateItem<Material>("materials", m.id, { issued: true }); toast.success("Marked as issued"); }}>
                          Mark issued
                        </Button>
                      )}
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
