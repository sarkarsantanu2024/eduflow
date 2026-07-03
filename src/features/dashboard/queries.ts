/**
 * Shape of the aggregated dashboard metrics consumed by the analytics
 * components. The values are computed client-side from the live data store
 * (see the dashboard view); there is no separate server aggregation query.
 */
export interface DashboardMetrics {
  totalStudents: number;
  activeStudents: number;
  todayCollection: number;
  monthCollection: number;
  pendingAmount: number;
  defaultersCount: number;
}
