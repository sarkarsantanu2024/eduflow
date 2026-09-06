"use client";

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DemoTrendPoint, DemoEnrolPoint } from "@/lib/demo";
import type { DashboardMetrics } from "@/features/dashboard/queries";

interface StatusDatum {
  name: string;
  value: number;
}

const PIE_COLORS = ["#F2630E", "#16A34A", "#F59E0B", "#6366F1"];

/**
 * Compact axis ticks: 10000 -> "10k". The axis was 48px wide with raw numbers,
 * so a five-digit tick had its leading digit clipped and "10000" rendered as
 * "0000" — a wrong number, not just an ugly one.
 */
function inrTick(v: number): string {
  if (Math.abs(v) >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

export function DashboardAnalytics({
  metrics,
  trend,
  statusData,
  enrolment,
}: {
  metrics: DashboardMetrics;
  trend: DemoTrendPoint[];
  statusData: StatusDatum[];
  enrolment: DemoEnrolPoint[];
}) {
  const joined = enrolment.reduce((s, e) => s + e.joined, 0);

  /**
   * Retention over the whole student base, not a six-month joining cohort.
   *
   * It used to be (joined - dropped) / joined across the last six months, so a
   * centre whose students all enrolled more than six months ago divided by
   * zero and displayed "0%" — the worst possible number — while having lost
   * nobody at all. That is most established centres.
   */
  const baseForRetention = metrics.activeStudents + metrics.droppedStudents;
  const retention = baseForRetention > 0
    ? `${Math.round((metrics.activeStudents / baseForRetention) * 100)}%`
    : "—";

  /**
   * Of everything billed, how much has been collected. Previously this took
   * THIS month's collection over this month's collection plus ALL-TIME
   * pending, which pinned any centre carrying a backlog near 0% however well
   * it was actually collecting.
   */
  const collectionRate = metrics.billedTotal > 0
    ? `${Math.round((metrics.collectedTotal / metrics.billedTotal) * 100)}%`
    : "—";

  const stats = [
    { label: "Collection rate", value: collectionRate },
    { label: "New admissions (6 mo)", value: String(joined) },
    // Was "Dropouts this month", counted from each dropped student's ADMISSION
    // date — so it answered "who joined this month and has since left", which
    // is not what anyone reads it as. There is no drop date on the record, so
    // this reports the honest total instead of a precise-looking wrong number.
    { label: "Dropped students", value: String(metrics.droppedStudents) },
    { label: "Retention rate", value: retention },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-extrabold tracking-tight">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Collections trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Collections vs Pending (last 6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trend} margin={{ left: -10, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F2630E" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#F2630E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d4" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={62} tickFormatter={inrTick} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Area type="monotone" dataKey="collected" stroke="#F2630E" strokeWidth={2.5} fill="url(#gCollected)" name="Collected" />
                <Area type="monotone" dataKey="pending" stroke="#F59E0B" strokeWidth={2} fill="url(#gPending)" name="Pending" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Students by status */}
        <Card>
          <CardHeader>
            <CardTitle>Students by status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* New admissions vs dropouts */}
      <Card>
        <CardHeader>
          <CardTitle>New admissions vs dropouts (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={enrolment} margin={{ left: -10, right: 8 }} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d4" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="joined" fill="#16A34A" radius={[6, 6, 0, 0]} name="New admissions" />
              <Bar dataKey="dropped" fill="#EF4444" radius={[6, 6, 0, 0]} name="Dropped" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
