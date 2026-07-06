"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  institutes, courses, teachers, batches, students, fees, payments, expenses,
  attendance, promotions, testScores, certificates, examRegs, performances,
  materials, events, templates, subscriptions, subscriptionPlans,
} from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/auth";
import { ACTING_COOKIE } from "@/lib/tenant";
import { DEMO_INSTITUTE_ID, DEMO_INSTITUTE_NAME as DEMO_NAME } from "@/lib/demo-tenant";

/**
 * DEMO MODE — a real but isolated tenant the super-admin can drop into for
 * sales demos. It has a fixed id (see @/lib/demo-tenant), so seeding/resetting
 * only ever touches this one center and never a real customer. Every module is
 * populated so a demo walks through the whole product.
 */

/** True if the demo tenant currently exists. */
async function demoExists(): Promise<boolean> {
  const [row] = await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, DEMO_INSTITUTE_ID)).limit(1);
  return Boolean(row);
}

/** Build the demo tenant from scratch (assumes it does not already exist). */
async function seedDemo(): Promise<void> {
  // ── Institute (branding + fees filled so every screen looks real) ──
  await db.insert(institutes).values({
    id: DEMO_INSTITUTE_ID,
    name: DEMO_NAME,
    slug: "demo-bright-abacus",
    type: "abacus",
    ownerName: "Priya Menon",
    email: "demo@eduflow.app",
    phone: "9800000000",
    whatsapp: "9800000000",
    city: "Kolkata",
    address: "12, MG Road, Kolkata 700001",
    monthlyFee: 800,
    admissionFee: 500,
    reactivationFee: 200,
    upiId: "brightabacus@upi",
    website: "https://brightabacus.example.com",
    onboarded: true,
    isActive: true,
    recurringCharges: [
      { id: "rc1", name: "Head Office royalty", basis: "percent", amount: 10, category: "Head Office" },
      { id: "rc2", name: "Room rent", basis: "fixed", amount: 6000, category: "Rent" },
    ],
  });

  // ── Subscription (Growth, active) ──
  const growth = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.code, "growth") });
  if (growth) {
    const end = new Date();
    end.setDate(end.getDate() + 30);
    await db.insert(subscriptions).values({
      instituteId: DEMO_INSTITUTE_ID, planId: growth.id, status: "active", currentPeriodEnd: end,
    });
  }

  // ── Courses (abacus levels) ──
  const courseRows = await db.insert(courses).values(
    ["Basic", "Kids 1", "Level 1", "Level 2", "Level 3", "Level 4"].map((name, i) => ({
      instituteId: DEMO_INSTITUTE_ID, name, description: `Abacus ${name} curriculum`,
    })),
  ).returning({ id: courses.id, name: courses.name });
  const courseId = (n: string) => courseRows.find((c) => c.name === n)?.id ?? null;

  // ── Teachers ──
  const teacherRows = await db.insert(teachers).values([
    { instituteId: DEMO_INSTITUTE_ID, name: "Anjali Sharma", phone: "9811111111", email: "anjali@demo.app", specialization: "Senior Abacus Trainer", salary: 18000, joinDate: "2024-06-01", rating: 5 },
    { instituteId: DEMO_INSTITUTE_ID, name: "Rahul Verma", phone: "9822222222", email: "rahul@demo.app", specialization: "Junior Trainer", salary: 12000, joinDate: "2025-01-15", rating: 4 },
  ]).returning({ id: teachers.id, name: teachers.name });

  // ── Batches ──
  const batchRows = await db.insert(batches).values([
    { instituteId: DEMO_INSTITUTE_ID, courseId: courseId("Basic"), teacherId: teacherRows[0]?.id ?? null, name: "Evening Batch A", timing: "5:00 PM – 6:30 PM", days: "Mon, Wed, Fri", capacity: "20" },
    { instituteId: DEMO_INSTITUTE_ID, courseId: courseId("Level 1"), teacherId: teacherRows[1]?.id ?? null, name: "Morning Batch B", timing: "7:00 AM – 8:30 AM", days: "Tue, Thu, Sat", capacity: "15" },
  ]).returning({ id: batches.id, name: batches.name });
  const batchA = batchRows[0]?.id ?? null;
  const batchB = batchRows[1]?.id ?? null;

  // ── Students (varied statuses; a couple of birthdays this week) ──
  const S = [
    { first: "Aarav", last: "Sharma", parent: "Rohit Sharma", mobile: "9811111101", dob: "2015-07-06", status: "active" as const, batch: batchA, course: "Basic" },
    { first: "Diya", last: "Gupta", parent: "Anil Gupta", mobile: "9811111102", dob: "2014-03-22", status: "active" as const, batch: batchA, course: "Basic" },
    { first: "Vivaan", last: "Singh", parent: "Manoj Singh", mobile: "9811111103", dob: "2013-11-02", status: "active" as const, batch: batchA, course: "Kids 1" },
    { first: "Ananya", last: "Roy", parent: "Sourav Roy", mobile: "9811111104", dob: "2015-07-09", status: "active" as const, batch: batchB, course: "Level 1" },
    { first: "Kabir", last: "Khan", parent: "Imran Khan", mobile: "9811111105", dob: "2012-05-18", status: "inactive" as const, batch: batchB, course: "Level 1" },
    { first: "Isha", last: "Patel", parent: "Nikhil Patel", mobile: "9811111106", dob: "2014-09-30", status: "active" as const, batch: batchB, course: "Level 2" },
    { first: "Reyansh", last: "Das", parent: "Subir Das", mobile: "9811111107", dob: "2013-01-12", status: "active" as const, batch: batchA, course: "Basic" },
    { first: "Myra", last: "Nair", parent: "Vinod Nair", mobile: "9811111108", dob: "2011-08-25", status: "graduated" as const, batch: batchB, course: "Level 4" },
    { first: "Arjun", last: "Iyer", parent: "Suresh Iyer", mobile: "9811111109", dob: "2014-12-05", status: "active" as const, batch: batchA, course: "Kids 1" },
    { first: "Sara", last: "Ali", parent: "Feroz Ali", mobile: "9811111110", dob: "2015-04-19", status: "active" as const, batch: batchB, course: "Level 2" },
    { first: "Vihaan", last: "Bose", parent: "Amit Bose", mobile: "9811111111", dob: "2013-06-14", status: "active" as const, batch: batchA, course: "Kids 1" },
    { first: "Aditi", last: "Kapoor", parent: "Rajesh Kapoor", mobile: "9811111112", dob: "2012-10-08", status: "dropped" as const, batch: batchB, course: "Level 3" },
  ];
  const studentRows = await db.insert(students).values(
    S.map((s, i) => ({
      instituteId: DEMO_INSTITUTE_ID,
      code: `BAA-${String(i + 1).padStart(4, "0")}`,
      firstName: s.first, lastName: s.last,
      gender: i % 2 === 0 ? ("male" as const) : ("female" as const),
      dob: s.dob, admissionDate: "2026-01-15",
      courseId: courseId(s.course), batchId: s.batch,
      parentName: s.parent, parentMobile: s.mobile, fatherName: s.parent, fatherContact: s.mobile,
      city: "Kolkata", address: "Kolkata, West Bengal",
      status: s.status,
    })),
  ).returning({ id: students.id, firstName: students.firstName, lastName: students.lastName, parentMobile: students.parentMobile, batchId: students.batchId });

  const fullName = (r: { firstName: string; lastName: string }) => `${r.firstName} ${r.lastName}`.trim();
  const active = studentRows.filter((_, i) => S[i]?.status === "active");

  // ── Fees (June + July, mixed statuses) ──
  const feeValues: (typeof fees.$inferInsert)[] = [];
  active.forEach((s, i) => {
    const paidJune = i % 4 !== 0; // most paid, some not
    feeValues.push({
      instituteId: DEMO_INSTITUTE_ID, studentId: s.id, studentName: fullName(s), parentMobile: s.parentMobile,
      kind: "monthly", period: "2026-06", title: "June 2026 Monthly Fee", type: "monthly",
      amount: 800, amountPaid: paidJune ? 800 : (i % 4 === 0 && i > 0 ? 400 : 0),
      status: paidJune ? "paid" : (i % 4 === 0 && i > 0 ? "partial" : "overdue"), dueDate: "2026-06-05",
    });
    feeValues.push({
      instituteId: DEMO_INSTITUTE_ID, studentId: s.id, studentName: fullName(s), parentMobile: s.parentMobile,
      kind: "monthly", period: "2026-07", title: "July 2026 Monthly Fee", type: "monthly",
      amount: 800, amountPaid: 0, status: "pending", dueDate: "2026-07-05",
    });
  });
  await db.insert(fees).values(feeValues);

  // ── Payments (successful collections) ──
  await db.insert(payments).values(
    active.slice(0, 6).map((s, i) => ({
      instituteId: DEMO_INSTITUTE_ID, studentId: s.id, studentName: fullName(s),
      amount: 800, method: (["upi", "cash", "razorpay"] as const)[i % 3], status: "success" as const,
      source: "fee", date: "2026-06-03",
    })),
  );

  // ── Expenses ──
  await db.insert(expenses).values([
    { instituteId: DEMO_INSTITUTE_ID, title: "Room rent — June", category: "Rent", amount: 6000, date: "2026-06-01" },
    { instituteId: DEMO_INSTITUTE_ID, title: "Teacher salary — Anjali", category: "Salary", amount: 18000, date: "2026-06-01" },
    { instituteId: DEMO_INSTITUTE_ID, title: "Electricity", category: "Utilities", amount: 1200, date: "2026-06-05" },
    { instituteId: DEMO_INSTITUTE_ID, title: "Marketing leaflets", category: "Marketing", amount: 900, date: "2026-06-10" },
  ]);

  // ── Attendance (today for batch A actives) ──
  await db.insert(attendance).values(
    active.filter((s) => s.batchId === batchA).map((s, i) => ({
      instituteId: DEMO_INSTITUTE_ID, date: "2026-07-06", batchId: batchA, studentId: s.id,
      studentName: fullName(s), parentMobile: s.parentMobile, present: i % 5 !== 0,
    })),
  );

  // ── Promotions ──
  await db.insert(promotions).values(
    active.slice(0, 3).map((s) => ({
      instituteId: DEMO_INSTITUTE_ID, studentId: s.id, studentName: fullName(s), parentMobile: s.parentMobile,
      fromLevel: "Basic", toLevel: "Kids 1", score: "92", date: "2026-06-20", notified: true,
    })),
  );

  // ── Test scores (a speed test with a rank list) ──
  await db.insert(testScores).values(
    active.map((s, i) => ({
      instituteId: DEMO_INSTITUTE_ID, testName: "June Speed Test", date: "2026-06-25", batchId: s.batchId,
      studentId: s.id, studentName: fullName(s), parentMobile: s.parentMobile,
      score: 70 + ((i * 7) % 30), maxScore: 100,
    })),
  );

  // ── Certificates ──
  await db.insert(certificates).values(
    active.slice(0, 2).map((s, i) => ({
      instituteId: DEMO_INSTITUTE_ID, serial: `BAA-CERT-${1000 + i}`, studentId: s.id, studentName: fullName(s),
      title: "Level Completion Certificate", course: "Basic", issueDate: "2026-06-28",
    })),
  );

  // ── Exam-board registrations ──
  await db.insert(examRegs).values(
    active.slice(0, 3).map((s) => ({
      instituteId: DEMO_INSTITUTE_ID, studentId: s.id, studentName: fullName(s), parentMobile: s.parentMobile,
      board: "UCMAS", tier: "Level 1", examDate: "2026-08-15", fee: 600, status: "registered",
    })),
  );

  // ── Performances (competitions) ──
  await db.insert(performances).values(
    active.slice(0, 2).map((s, i) => ({
      instituteId: DEMO_INSTITUTE_ID, studentId: s.id, studentName: fullName(s), parentMobile: s.parentMobile,
      event: "State Abacus Championship", level: "State", result: i === 0 ? "1st Place" : "Participation", date: "2026-05-30",
    })),
  );

  // ── Materials / kits issued ──
  await db.insert(materials).values(
    active.slice(0, 4).map((s, i) => ({
      instituteId: DEMO_INSTITUTE_ID, studentId: s.id, studentName: fullName(s),
      item: i % 2 === 0 ? "Abacus Kit" : "Workbook Set", amount: i % 2 === 0 ? 350 : 150, issued: i % 2 === 0, date: "2026-01-20",
    })),
  );

  // ── Events ──
  await db.insert(events).values([
    { instituteId: DEMO_INSTITUTE_ID, title: "Annual Day 2026", date: "2026-12-20", venue: "City Auditorium", note: "Prize distribution + performances" },
    { instituteId: DEMO_INSTITUTE_ID, title: "Free Demo Class", date: "2026-07-15", venue: "Center", note: "Open house for new admissions" },
  ]);

  // ── WhatsApp templates ──
  await db.insert(templates).values([
    { instituteId: DEMO_INSTITUTE_ID, name: "Fee Due Reminder", type: "fee_due", channel: "whatsapp", body: "Dear {{parent_name}}, the fee of ₹{{amount}} for {{student_name}} is due on {{due_date}}. — Bright Abacus" },
    { instituteId: DEMO_INSTITUTE_ID, name: "Birthday Wish", type: "birthday", channel: "whatsapp", body: "Happy Birthday {{student_name}}! 🎉 — Bright Abacus" },
    { instituteId: DEMO_INSTITUTE_ID, name: "Level Promotion", type: "promotion", body: "Congratulations! {{student_name}} is promoted to {{level}}. 🎉 — Bright Abacus" },
  ]);
}

/** Ensure the demo tenant exists (idempotent). Returns its id. */
export async function ensureDemo(): Promise<string> {
  await requireSuperAdmin();
  if (!(await demoExists())) await seedDemo();
  return DEMO_INSTITUTE_ID;
}

/** Enter demo mode: seed if needed, then "open" the demo center. */
export async function enterDemoMode() {
  await requireSuperAdmin();
  if (!(await demoExists())) await seedDemo();
  const store = await cookies();
  store.set(ACTING_COOKIE, DEMO_INSTITUTE_ID, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

/** Wipe and rebuild the demo data (fresh start for the next demo). */
export async function resetDemoData(): Promise<{ ok?: boolean; error?: string }> {
  await requireSuperAdmin();
  // Deleting the institute cascades to every child table (fees, students, …).
  await db.delete(institutes).where(eq(institutes.id, DEMO_INSTITUTE_ID));
  await seedDemo();
  revalidatePath("/admin");
  return { ok: true };
}
