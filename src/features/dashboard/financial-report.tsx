"use client";

import { useState } from "react";
import { Printer, TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCollection, useProfile, effectiveFee } from "@/lib/store/local-db";
import { formatCurrency } from "@/lib/utils";

type Scope = "month" | "half" | "year";

const SCOPES: { key: Scope; label: string }[] = [
  { key: "month", label: "Monthly" },
  { key: "half", label: "Half-yearly" },
  { key: "year", label: "Yearly" },
];

/** Profit/loss + growth report, merged into the Dashboard. Save as PDF prints only this. */
export function FinancialReport() {
  const payments = useCollection("payments");
  const expenses = useCollection("expenses");
  const fees = useCollection("fees");
  const students = useCollection("students");
  const profile = useProfile();
  const [scope, setScope] = useState<Scope>("month");

  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const year = today.slice(0, 4);
  const startMonth = new Date(`${ym}-01T00:00:00`);
  startMonth.setMonth(startMonth.getMonth() - 5);
  const startYm = startMonth.toISOString().slice(0, 7);

  const inRange = (d: string) =>
    scope === "month" ? d.slice(0, 7) === ym
      : scope === "year" ? d.slice(0, 4) === year
      : d.slice(0, 7) >= startYm && d.slice(0, 7) <= ym;

  const scopeLabel =
    scope === "month" ? new Date(`${ym}-01T00:00:00`).toLocaleString("en-IN", { month: "long", year: "numeric" })
      : scope === "year" ? year
      : `${new Date(`${startYm}-01T00:00:00`).toLocaleString("en-IN", { month: "short", year: "numeric" })} – ${new Date(`${ym}-01T00:00:00`).toLocaleString("en-IN", { month: "short", year: "numeric" })}`;

  const income = payments.filter((p) => p.status === "success" && inRange(p.date)).reduce((s, p) => s + p.amount, 0);
  const spend = expenses.filter((e) => inRange(e.date)).reduce((s, e) => s + e.amount, 0);
  const profit = income - spend;

  const byCat = Object.entries(
    expenses.filter((e) => inRange(e.date)).reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const topCat = byCat[0];

  const unpaid = fees.filter((f) => f.status !== "paid");
  const outstanding = unpaid.reduce((s, f) => s + (f.amount - f.amountPaid), 0);
  const defaulters = new Set(unpaid.map((f) => f.studentId)).size;
  const activeList = students.filter((s) => s.status === "active");
  const activeStudents = activeList.length;
  const avgFee = activeStudents
    ? Math.round(activeList.reduce((s2, st) => s2 + effectiveFee(st, profile.monthlyFee), 0) / activeStudents)
    : profile.monthlyFee;
  const expenseRatio = income ? Math.round((spend / income) * 100) : 0;

  // Deeper written analysis for the report/PDF. The headline profit/loss and the
  // "collect pending fees" action live in the dashboard's Smart Suggestions, so
  // they are intentionally not repeated here.
  const tips: string[] = [];
  if (expenseRatio > 60 && income > 0) tips.push(`Expenses are ${expenseRatio}% of income — aim to keep this under 60%. Review ${topCat ? topCat[0].toLowerCase() : "recurring"} costs.`);
  if (topCat) tips.push(`Largest expense is ${topCat[0]} at ${formatCurrency(topCat[1] * 100)}. Negotiate or optimise this line first for the biggest impact.`);
  if (avgFee > 0 && spend > 0) {
    const need = Math.ceil(spend / avgFee);
    tips.push(`At an average fee of ${formatCurrency(avgFee * 100)}, about ${need} active student${need > 1 ? "s" : ""} cover your expenses. Each new admission adds roughly ${formatCurrency(avgFee * 100)}/month in recurring income.`);
  }
  const mkt = byCat.find(([c]) => c === "Marketing");
  if (mkt) tips.push(`Marketing spend is ${formatCurrency(mkt[1] * 100)} — track how many admissions it produced to measure ROI, and double down on the channel that converts best.`);
  if (profit >= 0 && tips.length === 0) tips.push(`Healthy finances this period — consider reinvesting part of your ${formatCurrency(profit * 100)} surplus into marketing to grow admissions.`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="no-print inline-grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {SCOPES.map((s) => (
            <button
              key={s.key} type="button" onClick={() => setScope(s.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                scope === s.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => window.print()} className="no-print"><Printer /> Save report as PDF</Button>
      </div>

      <div className="print-area space-y-6">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">{profile.businessName || "Your institute"}</h2>
            <p className="text-sm text-muted-foreground">{profile.address || profile.city}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{SCOPES.find((s) => s.key === scope)?.label} report</p>
            <p className="text-muted-foreground">{scopeLabel}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Collected" value={income} tone="green" />
          <Stat label="Expenses" value={spend} tone="red" />
          <Stat label={profit >= 0 ? "Net profit" : "Net loss"} value={Math.abs(profit)} tone={profit >= 0 ? "green" : "red"} big />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 font-bold">Expense breakdown</h3>
              {byCat.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses in this period.</p>
              ) : (
                <div className="space-y-2.5">
                  {byCat.map(([cat, amt]) => {
                    const pct = spend ? Math.round((amt / spend) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium">{cat}</span>
                          <span className="text-muted-foreground">{formatCurrency(amt * 100)} · {pct}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <h3 className="font-bold">Business health</h3>
              <Row label="Active students" value={String(activeStudents)} />
              <Row label="Average monthly fee" value={formatCurrency(avgFee * 100)} />
              <Row label="Expense-to-income ratio" value={income ? `${expenseRatio}%` : "—"} />
              <Row label="Outstanding fees" value={formatCurrency(outstanding * 100)} />
              <Row label="Students with dues" value={String(defaulters)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <Lightbulb className="size-4 text-primary" /> Where to improve & grow
            </h3>
            <ul className="space-y-2.5">
              {tips.map((t, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Generated by EduFlow on {new Date(`${today}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, big }: { label: string; value: number; tone: "green" | "red"; big?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {tone === "green" ? <TrendingUp className="size-4 text-emerald-600" /> : <TrendingDown className="size-4 text-destructive" />}
          {label}
        </p>
        <p className={`mt-1 ${big ? "text-3xl" : "text-2xl"} font-extrabold tracking-tight ${tone === "green" ? "text-emerald-600" : "text-destructive"}`}>
          {formatCurrency(value * 100)}
        </p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
