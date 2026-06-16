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
  const dropped = enrolment.reduce((s, e) => s + e.dropped, 0);
  const droppedThisMonth = enrolment[enrolment.length - 1]?.dropped ?? 0;
  const retention = joined > 0 ? Math.round(((joined - dropped) / joined) * 100) : 0;
  const collectionRate =
    metrics.monthCollection + metrics.pendingAmount > 0
      ? Math.round((metrics.monthCollection / (metrics.monthCollection + metrics.pendingAmount)) * 100)
      : 0;

  const stats = [
    { label: "Collection rate", value: `${collectionRate}%` },
    { label: "New admissions (6 mo)", value: String(joined) },
    { label: "Dropouts this month", value: String(droppedThisMonth) },
    { label: "Retention rate", value: `${retention}%` },
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
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
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
