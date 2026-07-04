"use client";

import { useState } from "react";
import Link from "next/link";
import { Coins, Plus, Trash2, Repeat, Settings2, Info } from "lucide-react";
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
  stickyActionsHead, stickyActionsCell,
} from "@/components/ui/table";
import {
  useCollection, useHydrated, useProfile, setProfile, addItem, removeItem, newId,
  ONE_OFF_EXPENSE_CATEGORIES, type Expense, type RecurringCharge,
} from "@/lib/store/local-db";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Recurring costs (Head Office royalty, room rent, teacher salary, material
 * cost-of-goods) are posted automatically — royalty/rent from Profile › Monthly
 * charges, salary from Teachers, material cost from an issued kit. They're the
 * center's *fixed* spend and shouldn't be re-typed each month, so here we flag
 * them (badge + link to their source) and keep "Add expense" for true one-offs.
 */
type AutoSource = { label: string; href: string; hint: string };

function autoSource(e: Expense, charges: RecurringCharge[]): AutoSource | null {
  if (charges.some((c) => c.name && e.title.startsWith(`${c.name} — `)))
    return { label: "Auto · Monthly charge", href: "/profile", hint: "Posted from Profile › Monthly charges" };
  if (e.title.startsWith("Teacher salary — "))
    return { label: "Auto · Salary", href: "/teachers", hint: "Posted from teacher salaries on the Teachers page" };
  if (e.title.startsWith("Head Office — "))
    return { label: "Auto · Material cost", href: "/materials", hint: "Cost of a kit/book issued from Head Office" };
  return null;
}

type Range = "day" | "month" | "year";

const RANGES: { key: Range; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
];

export function ExpensesView() {
  const hydrated = useHydrated();
  const expenses = useCollection("expenses");
  const profile = useProfile();
  const charges = profile.recurringCharges ?? [];
  const [range, setRange] = useState<Range>("month");

  // Promote a one-off expense into a fixed monthly charge, so it stops being a
  // thing the owner re-types and starts posting itself from Profile each month.
  const makeRecurring = (e: Expense) => {
    const name = e.title.replace(/\s+—\s+.*$/, "").trim() || e.title;
    if (charges.some((c) => c.name === name)) {
      toast.info(`“${name}” is already a monthly charge`);
      return;
    }
    const charge: RecurringCharge = { id: newId(), name, basis: "fixed", amount: e.amount, category: e.category };
    setProfile({ recurringCharges: [...charges, charge] });
    toast.success(`“${name}” is now a monthly charge`, {
      description: "It will post automatically each month. Fine-tune it in Profile › Monthly charges.",
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const inRange = (d: string) =>
    (range === "day" && d === today) ||
    (range === "month" && d.slice(0, 7) === today.slice(0, 7)) ||
    (range === "year" && d.slice(0, 4) === today.slice(0, 4));

  const rows = expenses.filter((e) => inRange(e.date)).sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((s, e) => s + e.amount, 0);

  // Split fixed (auto-posted) from one-off (manually added) for this range.
  const fixedRows = rows.filter((e) => autoSource(e, charges));
  const manualRows = rows.filter((e) => !autoSource(e, charges));
  const fixedTotal = fixedRows.reduce((s, e) => s + e.amount, 0);
  const manualTotal = total - fixedTotal;

  // category breakdown for the active range
  const byCat = Object.entries(
    rows.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const addBtn = (
    <FormDialog
      title="Add one-off expense" submitLabel="Add expense" successMessage="Expense added"
      trigger={<Button><Plus /> Add expense</Button>}
      fields={[
        { name: "title", label: "Title", required: true, placeholder: "Electricity bill" },
        { name: "category", label: "Category", type: "select", defaultValue: ONE_OFF_EXPENSE_CATEGORIES[0],
          options: ONE_OFF_EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })) },
        { name: "amount", label: "Amount (₹)", type: "number", required: true },
        { name: "date", label: "Date", type: "date", defaultValue: today },
        { name: "note", label: "Note", type: "textarea" },
      ]}
      onSubmit={(v) => addItem<Expense>("expenses", {
        id: newId("exp"), title: v("title"), category: v("category") || "Miscellaneous",
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

      {/* Why costs appear here without being typed each month. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Fixed monthly costs post here automatically — royalty &amp; rent from{" "}
          <Link href="/profile" className="font-medium text-primary underline">Profile › Monthly charges</Link>,
          salaries from <Link href="/teachers" className="font-medium text-primary underline">Teachers</Link>, and
          material costs when you issue a kit. Use <span className="font-medium">Add expense</span> only for one-off
          costs — and if a one-off turns into a monthly bill, hit <span className="font-medium">Make monthly</span> to set it once.
        </p>
      </div>

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
            <p className="mt-1 text-xs text-muted-foreground">
              Fixed {formatCurrency(fixedTotal * 100)} · One-off {formatCurrency(manualTotal * 100)}
            </p>
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

      {/* One-off expenses — the costs you actually type in each time. */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="font-bold">One-off expenses</h3>
          <span className="text-sm text-muted-foreground">{formatCurrency(manualTotal * 100)}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Title</TableHead><TableHead>Category</TableHead>
              <TableHead>Note</TableHead><TableHead>Amount</TableHead><TableHead className={`text-right ${stickyActionsHead}`}>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {manualRows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No one-off expenses in this range.</TableCell></TableRow>
            )}
            {manualRows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{formatDate(e.date)}</TableCell>
                <TableCell className="font-medium">{e.title}</TableCell>
                <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                <TableCell className="max-w-[14rem] truncate text-muted-foreground" title={e.note || ""}>{e.note || "—"}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(e.amount * 100)}</TableCell>
                <TableCell className={`text-right ${stickyActionsCell}`}>
                  <div className="flex justify-end gap-1">
                    <ConfirmDialog
                      title={`Make "${e.title}" a monthly charge?`}
                      description="It will be added to Profile › Monthly charges and post automatically every month as a fixed amount. This month's entry stays as-is."
                      confirmLabel="Make monthly"
                      onConfirm={() => makeRecurring(e)}
                      trigger={<Button size="icon" variant="ghost" aria-label="Make monthly" title="Make this a monthly charge"><Repeat /></Button>}
                    />
                    <ConfirmDialog
                      title={`Delete "${e.title}"?`} confirmLabel="Delete" destructive
                      onConfirm={() => { removeItem("expenses", e.id); toast.success("Expense deleted"); }}
                      trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Fixed monthly costs — auto-posted, managed at their source. Collapsed by
          default so they don't clutter the one-off ledger the owner works with. */}
      {fixedRows.length > 0 && (
        <Card className="overflow-hidden">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 hover:bg-muted/40">
              <span className="flex items-center gap-2 font-bold">
                <Settings2 className="size-4 text-muted-foreground" />
                Fixed monthly costs
                <Badge variant="secondary" className="font-normal text-muted-foreground">auto-posted</Badge>
              </span>
              <span className="text-sm text-muted-foreground">{formatCurrency(fixedTotal * 100)} · {fixedRows.length} item{fixedRows.length > 1 ? "s" : ""}</span>
            </summary>
            <div className="border-t px-5 pb-2 pt-3 text-xs text-muted-foreground">
              These recur every month from Profile › Monthly charges, Teachers, or issued materials. Edit them at their source — not here.
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Title</TableHead><TableHead>Category</TableHead>
                  <TableHead>Note</TableHead><TableHead>Amount</TableHead><TableHead className={`text-right ${stickyActionsHead}`}>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixedRows.map((e) => {
                  const auto = autoSource(e, charges)!;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.date)}</TableCell>
                      <TableCell className="font-medium">{e.title}</TableCell>
                      <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                      <TableCell className="max-w-[14rem] truncate text-muted-foreground" title={e.note || ""}>{e.note || "—"}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(e.amount * 100)}</TableCell>
                      <TableCell className={`text-right ${stickyActionsCell}`}>
                        <Button size="icon" variant="ghost" aria-label="Manage source" title={auto.hint} asChild>
                          <Link href={auto.href}><Settings2 /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </details>
        </Card>
      )}
    </div>
  );
}
