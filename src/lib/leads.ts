/**
 * Lead pipeline vocabulary. Kept in a plain module (not the "use server"
 * actions file) so both server actions and client components can import it —
 * a "use server" file may only export async functions.
 */

export const LEAD_STATUSES = ["new", "contacted", "demo_booked", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  demo_booked: "Demo booked",
  won: "Won",
  lost: "Lost",
};

/** One enquiry from the public marketing-site form. */
export type LeadRow = {
  id: string;
  name: string;
  centerName: string;
  centerType: string;
  students: number | null;
  phone: string;
  email: string | null;
  city: string | null;
  message: string;
  source: string;
  status: string;
  notes: string;
  createdAt: Date;
};
