"use client";

import { useState } from "react";
import { Coins, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  useCollection, useHydrated, addItem, removeItem, newId,
  EXPENSE_CATEGORIES, type Expense,
} from "@/lib/store/local-db";
import { formatCurrency, formatDate } from "@/lib/utils";

type Range = "day" | "month" | "year";

const RANGES: { key: Range; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
];

export function ExpensesView() {
  const hydrated = useHydrated();
  const expenses = useCollection("expenses");
  const [range, setRange] = useState<Range>("month");

  const today = new Date().toISOString().slice(0, 10);
  const inRange = (d: string) =>
    (range === "day" && d === today) ||
    (range === "month" && d.slice(0, 7) === today.slice(0, 7)) ||
    (range === "year" && d.slice(0, 4) === today.slice(0, 4));

  const rows = expenses.filter((e) => inRange(e.date)).sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((s, e) => s + e.amount, 0);

  // category breakdown for the active range
  const byCat = Object.entries(
    rows.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const addBtn = (
    <FormDialog
      title="Add expense" submitLabel="Add expense" successMessage="Expense added"
      trigger={<Button><Plus /> Add expense</Button>}
      fields={[
        { name: "title", label: "Title", required: true, placeholder: "Center rent" },
        { name: "category", label: "Category", type: "select", defaultValue: "Rent",
          options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })) },
        { name: "amount", label: "Amount (₹)", type: "number", required: true },
        { name: "date", label: "Date", type: "date", defaultValue: today },
        { name: "note", label: "Note", type: "textarea" },
      ]}
      onSubmit={(v) => addItem<Expense>("expenses", {
        id: newId("exp"), title: v("title"), category: v("category") || "Other",
        amount: Number(v("amount")) || 0, date: v("date") || today, note: v("note"),
      })}
    />
  );

  if (hydrated && expenses.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Expenses" description="Track your center's running costs — daily, monthly and yearly." actions={addBtn} />
        <EmptyState
          icon={Coins} title="No expenses yet"
          description="Record rent, salaries, utilities and more, or load sample data."
          action={
            <div className="flex gap-2">
              {addBtn}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Expenses" description="Track your center's running costs — daily, monthly and yearly." actions={addBtn} />

      {/* range toggle */}
      <div className="inline-grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {RANGES.map((r) => (
          <button
            key={r.key} type="button" onClick={() => setRange(r.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              range === r.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground">Total ({RANGES.find((r) => r.key === range)?.label})</p>
            <p className="text-2xl font-extrabold tracking-tight">{formatCurrency(total * 100)}</p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-medium text-muted-foreground">By category</p>
            {byCat.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses in this range.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {byCat.map(([cat, amt]) => (
                  <Badge key={cat} variant="secondary" className="font-medium">
                    {cat} · {formatCurrency(amt * 100)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Title</TableHead><TableHead>Category</TableHead>
              <TableHead>Note</TableHead><TableHead>Amount</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No expenses in this range.</TableCell></TableRow>
            )}
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{formatDate(e.date)}</TableCell>
                <TableCell className="font-medium">{e.title}</TableCell>
                <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                <TableCell className="max-w-[14rem] truncate text-muted-foreground">{e.note || "—"}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(e.amount * 100)}</TableCell>
                <TableCell className="text-right">
                  <ConfirmDialog
                    title={`Delete "${e.title}"?`} confirmLabel="Delete" destructive
                    onConfirm={() => { removeItem("expenses", e.id); toast.success("Expense deleted"); }}
                    trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
