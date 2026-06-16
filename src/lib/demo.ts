/**
 * Zero-config DEMO MODE.
 *
 * Active when NEXT_PUBLIC_DEMO_MODE=true, OR when no real Supabase URL is
 * configured (so a fresh `npm run dev` "just works" for client demos).
 * When you add real Supabase keys to .env.local, the app switches to the
 * live backend automatically — no code changes.
 *
 * In demo mode: a hardcoded login sets a cookie, and all reads return the
 * seeded fixtures below. No database or network calls are made.
 */
import type {
  ProfileRow, StudentRow, CourseRow, BatchRow,
} from "@/types/database.types";
import type { DashboardMetrics } from "@/features/dashboard/queries";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
  url === "" ||
  url.includes("placeholder") ||
  url.includes("YOUR-PROJECT");

export const DEMO_COOKIE = "eduflow_demo";

/** Credentials shown on the login screen in demo mode. */
export const DEMO_CREDENTIALS = {
  email: "demo@eduflow.app",
  password: "demo1234",
};

const audit = {
  created_at: "2026-01-10T08:00:00.000Z",
  updated_at: "2026-01-10T08:00:00.000Z",
  created_by: null,
  updated_by: null,
};

export const DEMO_INSTITUTE = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "MMA-Barasat",
};

export const demoProfile: ProfileRow = {
  id: "00000000-0000-0000-0000-0000000000aa",
  institute_id: DEMO_INSTITUTE.id,
  role: "institute_admin",
  full_name: "Demo Admin",
  email: DEMO_CREDENTIALS.email,
  phone: "+919800000000",
  avatar_url: null,
  is_active: true,
  last_login_at: "2026-06-15T09:00:00.000Z",
  ...audit,
};

function level(id: string, name: string, description: string): CourseRow {
  return {
    id, institute_id: DEMO_INSTITUTE.id, name, description,
    duration_months: null, monthly_fee: 0, admission_fee: 0, is_active: true, ...audit,
  };
}

// Abacus curriculum levels (no price — fees are set per institute).
export const demoCourses: CourseRow[] = [
  level("c1", "Basic", "Single digit add/subtract chains"),
  level("c2", "Kids 1", "Small numbers, short chains"),
  level("c3", "Kids 2", "Bigger numbers, longer chains"),
  level("c4", "Kids 3", "Two-digit chains with carry"),
  level("c5", "Level 1", "Small Friend concept"),
  level("c6", "Level 2", "Big Friend concept"),
  level("c7", "Level 3", "Mix Friend"),
  level("c8", "Level 4", "Two-digit advanced"),
  level("c9", "Level 5", "Three-digit operations"),
  level("c10", "Level 6", "Multiplication basics"),
  level("c11", "Level 7", "Division basics"),
  level("c12", "Level 8", "Advanced all operations"),
];

export const demoBatches: BatchRow[] = [
  { id: "b1", institute_id: DEMO_INSTITUTE.id, course_id: "c1", teacher_id: null, name: "Evening Batch A", timing: "5:00 PM - 6:30 PM", days: ["Mon", "Wed", "Fri"], capacity: 20, is_active: true, ...audit },
  { id: "b2", institute_id: DEMO_INSTITUTE.id, course_id: "c2", teacher_id: null, name: "Morning Batch B", timing: "7:00 AM - 8:30 AM", days: ["Tue", "Thu", "Sat"], capacity: 15, is_active: true, ...audit },
];

function student(
  i: number,
  first: string,
  last: string,
  parent: string,
  mobile: string,
  status: StudentRow["status"] = "active",
): StudentRow {
  return {
    id: `s${i}`,
    institute_id: DEMO_INSTITUTE.id,
    student_code: `BM-${String(i).padStart(4, "0")}`,
    first_name: first,
    last_name: last,
    gender: i % 2 === 0 ? "female" : "male",
    date_of_birth: "2015-04-12",
    admission_date: "2026-01-15",
    course_id: i % 2 === 0 ? "c1" : "c2",
    primary_batch_id: i % 2 === 0 ? "b1" : "b2",
    parent_id: null,
    parent_name: parent,
    parent_mobile: mobile,
    parent_email: null,
    address: "Kolkata, West Bengal",
    photo_url: null,
    status,
    ...audit,
  };
}

export const demoStudents: StudentRow[] = [
  student(1, "Aarav", "Sharma", "Rohit Sharma", "+919811111111"),
  student(2, "Diya", "Gupta", "Anil Gupta", "+919822222222"),
  student(3, "Vivaan", "Singh", "Manoj Singh", "+919833333333"),
  student(4, "Ananya", "Roy", "Sourav Roy", "+919844444444"),
  student(5, "Kabir", "Khan", "Imran Khan", "+919855555555", "inactive"),
  student(6, "Isha", "Patel", "Nikhil Patel", "+919866666666"),
  student(7, "Reyansh", "Das", "Subir Das", "+919877777777"),
  student(8, "Myra", "Nair", "Vinod Nair", "+919888888888", "graduated"),
];

export interface DemoFee {
  id: string;
  studentName: string;
  title: string;
  amount: number;
  amountPaid: number;
  status: "paid" | "partial" | "pending" | "overdue";
  dueDate: string;
}

export const demoFees: DemoFee[] = [
  { id: "f1", studentName: "Aarav Sharma", title: "June 2026 Monthly Fee", amount: 80000, amountPaid: 80000, status: "paid", dueDate: "2026-06-05" },
  { id: "f2", studentName: "Diya Gupta", title: "June 2026 Monthly Fee", amount: 80000, amountPaid: 40000, status: "partial", dueDate: "2026-06-05" },
  { id: "f3", studentName: "Vivaan Singh", title: "June 2026 Monthly Fee", amount: 100000, amountPaid: 0, status: "overdue", dueDate: "2026-06-05" },
  { id: "f4", studentName: "Ananya Roy", title: "June 2026 Monthly Fee", amount: 80000, amountPaid: 0, status: "pending", dueDate: "2026-06-20" },
  { id: "f5", studentName: "Isha Patel", title: "Exam Fee", amount: 30000, amountPaid: 0, status: "pending", dueDate: "2026-06-25" },
];

export interface DemoPayment {
  id: string;
  studentName: string;
  amount: number;
  method: "razorpay" | "upi" | "cash";
  status: "success" | "pending" | "failed";
  date: string;
}

export const demoPayments: DemoPayment[] = [
  { id: "p1", studentName: "Aarav Sharma", amount: 80000, method: "razorpay", status: "success", date: "2026-06-03" },
  { id: "p2", studentName: "Diya Gupta", amount: 40000, method: "upi", status: "success", date: "2026-06-04" },
  { id: "p3", studentName: "Myra Nair", amount: 80000, method: "cash", status: "success", date: "2026-06-02" },
  { id: "p4", studentName: "Reyansh Das", amount: 100000, method: "razorpay", status: "pending", date: "2026-06-14" },
];

export interface DemoTemplate {
  id: string;
  name: string;
  type: string;
  channel: "whatsapp" | "email";
  body: string;
}

export const demoTemplates: DemoTemplate[] = [
  { id: "t1", name: "Fee Due Reminder", type: "fee_due", channel: "whatsapp", body: "Hi {{parent_name}}, the fee of ₹{{amount}} for {{student_name}} is due on {{due_date}}. — MMA-Barasat" },
  { id: "t2", name: "Fee Overdue", type: "fee_overdue", channel: "whatsapp", body: "Reminder: ₹{{amount}} for {{student_name}} is overdue. Please pay at the earliest. — MMA-Barasat" },
  { id: "t3", name: "Birthday Wish", type: "birthday", channel: "whatsapp", body: "Happy Birthday {{student_name}}! 🎉 — MMA-Barasat" },
  { id: "t4", name: "Holiday Notice", type: "holiday_notice", channel: "whatsapp", body: "Dear parents, the center will remain closed on {{date}} for {{occasion}}. — MMA-Barasat" },
];

export interface DemoMessageLog {
  id: string;
  recipient: string;
  type: string;
  status: "delivered" | "sent" | "failed";
  sentAt: string;
}

export const demoMessageLogs: DemoMessageLog[] = [
  { id: "m1", recipient: "Rohit Sharma", type: "Fee Due", status: "delivered", sentAt: "2026-06-01 09:00" },
  { id: "m2", recipient: "Anil Gupta", type: "Fee Due", status: "delivered", sentAt: "2026-06-01 09:00" },
  { id: "m3", recipient: "Manoj Singh", type: "Fee Overdue", status: "sent", sentAt: "2026-06-06 09:00" },
  { id: "m4", recipient: "Sourav Roy", type: "Fee Due", status: "failed", sentAt: "2026-06-01 09:00" },
];

export interface DemoMessage {
  id: string;
  name: string;
  initials: string;
  text: string;
  time: string;
  unread: boolean;
}

export const demoMessages: DemoMessage[] = [
  { id: "msg1", name: "Rohit Sharma", initials: "RS", text: "Thank you, fee paid for Aarav.", time: "5 min ago", unread: true },
  { id: "msg2", name: "Anil Gupta", initials: "AG", text: "Can Diya switch to the morning batch?", time: "22 min ago", unread: true },
  { id: "msg3", name: "Manoj Singh", initials: "MS", text: "Will pay the pending fee by Friday.", time: "1h ago", unread: true },
  { id: "msg4", name: "Sourav Roy", initials: "SR", text: "Is there a class on Saturday?", time: "3h ago", unread: false },
];

export interface DemoTrendPoint {
  month: string;
  collected: number; // rupees
  pending: number; // rupees
}

export const demoCollectionTrend: DemoTrendPoint[] = [
  { month: "Jan", collected: 92000, pending: 18000 },
  { month: "Feb", collected: 105000, pending: 22000 },
  { month: "Mar", collected: 98000, pending: 15000 },
  { month: "Apr", collected: 120000, pending: 28000 },
  { month: "May", collected: 134000, pending: 19000 },
  { month: "Jun", collected: 142500, pending: 32000 },
];

export interface DemoEnrolPoint {
  month: string;
  joined: number;
  dropped: number;
}

export const demoEnrolmentTrend: DemoEnrolPoint[] = [
  { month: "Jan", joined: 6, dropped: 1 },
  { month: "Feb", joined: 4, dropped: 2 },
  { month: "Mar", joined: 8, dropped: 1 },
  { month: "Apr", joined: 5, dropped: 3 },
  { month: "May", joined: 7, dropped: 1 },
  { month: "Jun", joined: 9, dropped: 2 },
];

export interface DemoNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

export const demoNotifications: DemoNotification[] = [
  { id: "n1", title: "Payment received", body: "Aarav Sharma paid ₹800 (June fee).", time: "2h ago", unread: true },
  { id: "n2", title: "Fee overdue", body: "Vivaan Singh's June fee is overdue.", time: "5h ago", unread: true },
  { id: "n3", title: "WhatsApp delivered", body: "4 fee reminders delivered successfully.", time: "1d ago", unread: true },
  { id: "n4", title: "New admission", body: "Myra Nair was added to Morning Batch B.", time: "2d ago", unread: false },
];

export const demoMetrics: DashboardMetrics = {
  totalStudents: demoStudents.length,
  activeStudents: demoStudents.filter((s) => s.status === "active").length,
  todayCollection: 1850000, // ₹18,500
  monthCollection: 14250000, // ₹1,42,500
  pendingAmount: 3200000, // ₹32,000
  defaultersCount: 5,
};
