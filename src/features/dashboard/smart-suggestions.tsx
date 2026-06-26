"use client";

import Link from "next/link";
import {
  Lightbulb, MessageCircle, ClipboardCheck, UserMinus, Cake, ScrollText, TrendingUp, IndianRupee,
  TrendingDown, PiggyBank,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDb } from "@/lib/store/local-db";
import { getSector } from "@/lib/sectors";
import { formatCurrency } from "@/lib/utils";

type Tone = "urgent" | "info" | "good";

interface Suggestion {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  detail: string;
  cta: string;
  href: string;
}

const toneRing: Record<Tone, string> = {
  urgent: "bg-red-50 text-red-600",
  info: "bg-amber-50 text-amber-600",
  good: "bg-emerald-50 text-emerald-600",
};

/** Action-center: turns the institute's data into a few clear next steps. */
export function SmartSuggestions() {
  const db = useDb();
  const { students, fees, payments, expenses, attendance, examRegs, batches, profile } = db;
  const modules = getSector(profile.businessType).modules;

  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const todayMd = today.slice(5);

  // ── Profit & loss headline for this month. The deeper financial analysis
  //    (expense ratio, biggest cost, break-even, ROI) lives in the report below. ──
  const income = payments.filter((p) => p.status === "success" && p.date.startsWith(ym)).reduce((s, p) => s + p.amount, 0);
  const spend = expenses.filter((e) => e.date.startsWith(ym)).reduce((s, e) => s + e.amount, 0);
  const profit = income - spend;

  const pnl: Suggestion[] = [];
  if (spend > 0 || income > 0) {
    if (profit < 0) {
      pnl.push({
        key: "loss", icon: TrendingDown, tone: "urgent",
        title: `Running at a loss of ${formatCurrency(Math.abs(profit) * 100)} this month`,
        detail: `Income ${formatCurrency(income * 100)} vs expenses ${formatCurrency(spend * 100)}. Start by collecting the pending fees below.`,
        cta: "Collect fees", href: "/fees",
      });
    } else {
      pnl.push({
        key: "profit", icon: PiggyBank, tone: "good",
        title: `Profit of ${formatCurrency(profit * 100)} this month`,
        detail: "Healthy surplus — see the full breakdown and growth tips in the report below.",
        cta: "Add a student", href: "/students/new",
      });
    }
  }

  const suggestions: Suggestion[] = [];

  // 1) Pending fees — the #1 monthly pain.
  const unpaid = fees.filter((f) => f.status !== "paid");
  const dueStudents = new Set(unpaid.map((f) => f.studentId)).size;
  const outstanding = unpaid.reduce((s, f) => s + (f.amount - f.amountPaid), 0);
  if (dueStudents > 0) {
    suggestions.push({
      key: "fees", icon: MessageCircle, tone: "urgent",
      title: `${dueStudents} student${dueStudents > 1 ? "s have" : " has"} pending fees`,
      detail: `${formatCurrency(outstanding * 100)} is uncollected. Send WhatsApp reminders to recover it fast.`,
      cta: "Send reminders", href: "/fees",
    });
  }

  // 2) Absent today — keep parents informed.
  const absentToday = attendance.filter((a) => a.date === today && !a.present).length;
  if (absentToday > 0 && modules.includes("attendance")) {
    suggestions.push({
      key: "absent", icon: ClipboardCheck, tone: "info",
      title: `${absentToday} student${absentToday > 1 ? "s were" : " was"} absent today`,
      detail: "Alert their parents on WhatsApp — it builds trust and looks professional.",
      cta: "Open attendance", href: "/attendance",
    });
  }

  // 3) Win back inactive/dropped students.
  const lost = students.filter((s) => s.status === "inactive" || s.status === "dropped").length;
  if (lost > 0) {
    suggestions.push({
      key: "winback", icon: UserMinus, tone: "info",
      title: `${lost} student${lost > 1 ? "s are" : " is"} inactive`,
      detail: "Follow up with a call or WhatsApp — winning one back pays for months of EduFlow.",
      cta: "View students", href: "/students",
    });
  }

  // 4) Birthdays today — easy goodwill.
  const birthdays = students.filter((s) => s.dob && s.dob.slice(5) === todayMd).length;
  if (birthdays > 0) {
    suggestions.push({
      key: "birthday", icon: Cake, tone: "good",
      title: `${birthdays} birthday${birthdays > 1 ? "s" : ""} today 🎂`,
      detail: "Send a WhatsApp wish — parents love the personal touch.",
      cta: "Send wishes", href: "/reminders",
    });
  }

  // 5) Upcoming exam-board deadlines (sectors that use them).
  if (modules.includes("examBoards")) {
    const in14 = new Date(`${today}T00:00:00`); in14.setDate(in14.getDate() + 14);
    const soon = examRegs.filter((e) => e.examDate && e.examDate >= today && e.examDate <= in14.toISOString().slice(0, 10)).length;
    if (soon > 0) {
      suggestions.push({
        key: "exam", icon: ScrollText, tone: "info",
        title: `${soon} exam${soon > 1 ? "s" : ""} coming up in 2 weeks`,
        detail: "Remind parents about admit cards, fees and exam dates.",
        cta: "Open exam boards", href: "/exam-boards",
      });
    }
  }

  // 6) Free seats → push admissions (growth).
  const enrolledByBatch = students.reduce<Record<string, number>>((acc, s) => {
    if (s.status === "active" && s.batchId) acc[s.batchId] = (acc[s.batchId] ?? 0) + 1;
    return acc;
  }, {});
  const freeSeats = batches.reduce((sum, b) => {
    const cap = Number(b.capacity) || 0;
    return sum + Math.max(0, cap - (enrolledByBatch[b.id] ?? 0));
  }, 0);
  if (freeSeats > 0) {
    suggestions.push({
      key: "seats", icon: TrendingUp, tone: "good",
      title: `${freeSeats} free seat${freeSeats > 1 ? "s" : ""} across your batches`,
      detail: "Run a quick WhatsApp/Facebook admission post — every new student is recurring income.",
      cta: "Manage batches", href: "/batches",
    });
  }

  // 7) Collection rate this month (only if there's something billed).
  const billedThisMonth = fees.filter((f) => (f.period || f.dueDate.slice(0, 7)) === ym).reduce((s, f) => s + f.amount, 0);
  const collectedThisMonth = payments.filter((p) => p.status === "success" && p.date.startsWith(ym)).reduce((s, p) => s + p.amount, 0);
  const rate = billedThisMonth ? Math.round((collectedThisMonth / billedThisMonth) * 100) : 100;
  if (billedThisMonth > 0 && rate < 80) {
    suggestions.push({
      key: "rate", icon: IndianRupee, tone: "urgent",
      title: `Only ${rate}% of this month's fees collected`,
      detail: "Aim for 90%+. A daily reminder run during the 1st–10th makes a big difference.",
      cta: "Go to fees", href: "/fees",
    });
  }

  // Urgent first, then info, then growth — for the operational items.
  const order: Record<Tone, number> = { urgent: 0, info: 1, good: 2 };
  suggestions.sort((a, b) => order[a.tone] - order[b.tone]);

  // Profit/loss leads, then the operational next-steps.
  const all = [...pnl, ...suggestions];

  if (all.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Lightbulb className="size-5 text-primary" />
          All clear — no pending fees, no absentees, nothing urgent. Great work! 🎉
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-5 text-primary" /> Smart suggestions — what to do next
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {all.slice(0, 7).map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
              <div className="flex items-start gap-3">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${toneRing[s.tone]}`}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.detail}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" asChild className="shrink-0">
                <Link href={s.href}>{s.cta}</Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
