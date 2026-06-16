import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE, demoMetrics } from "@/lib/demo";

export interface DashboardMetrics {
  totalStudents: number;
  activeStudents: number;
  todayCollection: number;
  monthCollection: number;
  pendingAmount: number;
  defaultersCount: number;
}

/**
 * Aggregate dashboard metrics for the caller's institute.
 * All reads are RLS-scoped; counts use head requests to avoid pulling rows.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (DEMO_MODE) return demoMetrics;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [total, active, pendingFees, paidToday, paidMonth] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("fees").select("amount, amount_paid, discount").in("status", ["pending", "partial", "overdue"]),
    supabase.from("payments").select("amount").eq("status", "success").gte("paid_at", `${today}T00:00:00`),
    supabase.from("payments").select("amount").eq("status", "success").gte("paid_at", `${monthStart}T00:00:00`),
  ]);

  const pendingRows = (pendingFees.data ?? []) as { amount: number; amount_paid: number; discount: number }[];
  const pendingAmount = pendingRows.reduce(
    (sum, f) => sum + Math.max(0, f.amount - f.discount - f.amount_paid),
    0
  );

  const sum = (rows: { amount: number }[] | null) =>
    (rows ?? []).reduce((s, r) => s + r.amount, 0);

  return {
    totalStudents: total.count ?? 0,
    activeStudents: active.count ?? 0,
    todayCollection: sum(paidToday.data as { amount: number }[] | null),
    monthCollection: sum(paidMonth.data as { amount: number }[] | null),
    pendingAmount,
    defaultersCount: pendingRows.length,
  };
}
