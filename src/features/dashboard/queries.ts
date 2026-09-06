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
  /** Everything ever billed, and how much of it has been paid — rupees. */
  billedTotal: number;
  collectedTotal: number;
  /** Head-count by status, for retention. */
  droppedStudents: number;
}
