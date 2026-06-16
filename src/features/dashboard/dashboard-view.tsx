"use client";

import { Users, UserCheck, IndianRupee, AlertTriangle, TrendingUp, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { DashboardAnalytics } from "@/features/dashboard/components/dashboard-analytics";
import { useDb, useHydrated, loadSamples } from "@/lib/store/local-db";
import { demoCollectionTrend, demoEnrolmentTrend } from "@/lib/demo";
import { formatCurrency } from "@/lib/utils";

export function DashboardView() {
  const hydrated = useHydrated();
  const db = useDb();

  if (!hydrated) return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;

  const { students, fees, payments } = db;
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const r = (n: number) => n * 100; // rupees → paise for formatCurrency

  const todayCollection = r(payments.filter((p) => p.status === "success" && p.date === today).reduce((s, p) => s + p.amount, 0));
  const monthCollection = r(payments.filter((p) => p.status === "success" && p.date.startsWith(ym)).reduce((s, p) => s + p.amount, 0));
  const pendingAmount = r(fees.reduce((s, f) => s + Math.max(0, f.amount - f.amountPaid), 0));
  const defaultersCount = fees.filter((f) => f.status !== "paid").length;

  const metrics = {
    totalStudents: students.length,
    activeStudents: students.filter((s) => s.status === "active").length,
    todayCollection, monthCollection, pendingAmount, defaultersCount,
  };

  const cards = [
    { label: "Today's Collection", value: formatCurrency(metrics.todayCollection), icon: IndianRupee },
    { label: "This Month", value: formatCurrency(metrics.monthCollection), icon: TrendingUp },
    { label: "Pending Fees", value: formatCurrency(metrics.pendingAmount), icon: Clock },
    { label: "Fee Defaulters", value: String(metrics.defaultersCount), icon: AlertTriangle },
    { label: "Total Students", value: String(metrics.totalStudents), icon: Users },
    { label: "Active Students", value: String(metrics.activeStudents), icon: UserCheck },
  ];

  const statusData = [
    { name: "Active", value: students.filter((s) => s.status === "active").length },
    { name: "Inactive", value: students.filter((s) => s.status === "inactive").length },
    { name: "Graduated", value: students.filter((s) => s.status === "graduated").length },
    { name: "Dropped", value: students.filter((s) => s.status === "dropped").length },
  ].filter((d) => d.value > 0);

  const isEmpty = students.length === 0 && fees.length === 0 && payments.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your business performance." />

      {isEmpty ? (
        <EmptyState
          icon={Sparkles}
          title="Your dashboard is empty"
          description="Add students and fees to see live metrics, or load sample data to explore."
          action={
            <Button variant="outline" onClick={() => { loadSamples(); toast.success("Sample data loaded"); }}>
              <Sparkles /> Load sample data
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.label}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                      <Icon className="size-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-muted-foreground">{c.label}</p>
                      <p className="text-2xl font-extrabold tracking-tight">{c.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DashboardAnalytics
            metrics={metrics}
            trend={demoCollectionTrend}
            statusData={statusData.length ? statusData : [{ name: "Active", value: metrics.activeStudents || 1 }]}
            enrolment={demoEnrolmentTrend}
          />
        </>
      )}
    </div>
  );
}
