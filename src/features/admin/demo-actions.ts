"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations, institutes, courses, teachers, batches, students, fees, payments, expenses,
  attendance, promotions, testScores, certificates, examRegs, performances,
  materials, events, templates, users, subscriptions, subscriptionPlans, messageOutbox,
  adMaterials, stationery,
} from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { ACTING_COOKIE } from "@/lib/tenant";
import {
  DEMO_ORG_ID, DEMO_INSTITUTE_ID, DEMO_BRANCH_2_ID, DEMO_ABACUS_IDS,
  DEMO_CENTERS, getDemoCenter, type DemoCenter, DEMO_CENTER_PASSWORD, demoCenterUsername,
  DEMO_INSTITUTE_NAME as DEMO_NAME, DEMO_ORG_NAME, DEMO_HO_USERNAME, DEMO_HO_PASSWORD,
} from "@/lib/demo-tenant";
import { getSector } from "@/lib/sectors";
import { queueForInstitute } from "@/features/automation/engine";

/**
 * DEMO MODE — a real but isolated tenant the super-admin can drop into for
 * sales demos. It has a fixed id (see @/lib/demo-tenant), so seeding/resetting
 * only ever touches this one center and never a real customer. Every module is
 * populated so a demo walks through the whole product.
 */

/** ymd `offset` days from today — keeps demo fee dates fresh on any demo day. */
function demoDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function demoMonthLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleString("en-IN", { month: "long", year: "numeric" });
}
/** All automation rules on — every demo center shows the feature live. */
const DEMO_AUTOMATION = { feeDue: true, feeDueDays: 3, feeOverdue: true, absent: true, birthday: true };

/** True if the demo tenant is fully seeded (org + main branch present). */
async function demoExists(): Promise<boolean> {
  const [inst] = await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, DEMO_INSTITUTE_ID)).limit(1);
  const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, DEMO_ORG_ID)).limit(1);
  return Boolean(inst && org);
}

/** Build the demo franchise from scratch. Idempotent — clears any prior demo
 *  rows first, so it's safe to call to rebuild the demo at any time. */
async function seedDemo(): Promise<void> {
  // Clear any prior demo state (branches cascade their data; deleting the org
  // removes the org-admin login via ON DELETE CASCADE).
  await db.delete(institutes).where(inArray(institutes.id, DEMO_ABACUS_IDS));
  await db.delete(organizations).where(eq(organizations.id, DEMO_ORG_ID));

  // ── Head-Office organization (a franchise brand) ──
  await db.insert(organizations).values({
    id: DEMO_ORG_ID,
    name: DEMO_ORG_NAME,
    slug: "demo-bright-abacus-group",
    ownerName: "Priya Menon",
    partnerSharePercent: 20,
    isActive: true,
  });

  // ── Main branch (branding + fees filled so every screen looks real) ──
  await db.insert(institutes).values({
    id: DEMO_INSTITUTE_ID,
    organizationId: DEMO_ORG_ID,
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
    // Automation switched ON so a sales demo shows the feature live.
    automation: DEMO_AUTOMATION,
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

  // ── Fees (last month + this month, mixed statuses) ──
  // Dated relative to TODAY so the Automation scan always has material: last
  // month's unpaid fees are recently overdue, this month's fall due in 2 days
  // (inside the default 3-day "fee due soon" window).
  const prevMonth = new Date();
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevYm = prevMonth.toISOString().slice(0, 7);
  const curYm = new Date().toISOString().slice(0, 7);
  const overdueDate = demoDay(-6);
  const dueSoonDate = demoDay(2);

  const feeValues: (typeof fees.$inferInsert)[] = [];
  active.forEach((s, i) => {
    const paidPrev = i % 4 !== 0; // most paid, some not
    feeValues.push({
      instituteId: DEMO_INSTITUTE_ID, studentId: s.id, studentName: fullName(s), parentMobile: s.parentMobile,
      kind: "monthly", period: prevYm, title: `${demoMonthLabel(overdueDate)} Monthly Fee`, type: "monthly",
      amount: 800, amountPaid: paidPrev ? 800 : (i % 4 === 0 && i > 0 ? 400 : 0),
      status: paidPrev ? "paid" : (i % 4 === 0 && i > 0 ? "partial" : "overdue"), dueDate: overdueDate,
    });
    feeValues.push({
      instituteId: DEMO_INSTITUTE_ID, studentId: s.id, studentName: fullName(s), parentMobile: s.parentMobile,
      kind: "monthly", period: curYm, title: `${demoMonthLabel(dueSoonDate)} Monthly Fee`, type: "monthly",
      amount: 800, amountPaid: 0, status: "pending", dueDate: dueSoonDate,
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

  // ── Ad materials & stationery (so the Ad & Stationery module isn't empty) ──
  await db.insert(adMaterials).values([
    { instituteId: DEMO_INSTITUTE_ID, date: demoDay(-20), banner: 2, leaflet: 500, sunPack: 0, poster: 20, voice: 0, other: "", addedBy: "Priya Menon" },
    { instituteId: DEMO_INSTITUTE_ID, date: demoDay(-5), banner: 0, leaflet: 0, sunPack: 1, poster: 10, voice: 1, other: "Auto-rickshaw announcement", addedBy: "Priya Menon" },
  ]);
  await db.insert(stationery).values([
    { instituteId: DEMO_INSTITUTE_ID, date: demoDay(-20), stationery: 24, gift: 0, other: "Practice books batch A", addedBy: "Priya Menon" },
    { instituteId: DEMO_INSTITUTE_ID, date: demoDay(-3), stationery: 0, gift: 12, other: "Birthday return gifts", addedBy: "Priya Menon" },
  ]);

  // ── A teacher staff login (shows the Staff Logins module in action) ──
  await db.insert(users).values({
    instituteId: DEMO_INSTITUTE_ID, role: "teacher",
    username: "demo-abacus-teacher", email: "demo-abacus-teacher@noemail.eduflow.local",
    fullName: "Anjali Sharma", passwordHash: await hashPassword(DEMO_CENTER_PASSWORD),
  });

  // ── Events ──
  await db.insert(events).values([
    { instituteId: DEMO_INSTITUTE_ID, title: "Annual Day 2026", date: "2026-12-20", venue: "City Auditorium", note: "Prize distribution + performances" },
    { instituteId: DEMO_INSTITUTE_ID, title: "Free Demo Class", date: demoDay(14), venue: "Center", note: "Open house for new admissions" },
  ]);

  // ── WhatsApp templates ──
  await db.insert(templates).values([
    { instituteId: DEMO_INSTITUTE_ID, name: "Fee Due Reminder", type: "fee_due", channel: "whatsapp", body: "Dear {{parent_name}}, the fee of ₹{{amount}} for {{student_name}} is due on {{due_date}}. — Bright Abacus" },
    { instituteId: DEMO_INSTITUTE_ID, name: "Fee Overdue", type: "fee_overdue", channel: "whatsapp", body: "Dear {{parent_name}}, the fee of ₹{{amount}} for {{student_name}} is now overdue. Please ignore this message if already paid. — Bright Abacus" },
    { instituteId: DEMO_INSTITUTE_ID, name: "Absent Today", type: "absent", channel: "whatsapp", body: "Dear {{parent_name}}, {{student_name}} was absent from class today. Kindly ensure regular attendance. — Bright Abacus" },
    { instituteId: DEMO_INSTITUTE_ID, name: "Birthday Wish", type: "birthday", channel: "whatsapp", body: "Happy Birthday {{student_name}}! 🎉 — Bright Abacus" },
    { instituteId: DEMO_INSTITUTE_ID, name: "Level Promotion", type: "promotion", body: "Congratulations! {{student_name}} is promoted to {{level}}. 🎉 — Bright Abacus" },
  ]);

  // ── Automation Outbox (pre-queued so the demo shows the feature working) ──
  const byFirst = (n: string) => active.find((s) => s.firstName === n);
  const outboxSeed = [
    { s: byFirst("Ananya"), kind: "fee_due", body: "Dear Sourav Roy, the fee of ₹800 for Ananya is due on 05 Jul. — Bright Abacus" },
    { s: byFirst("Vivaan"), kind: "fee_overdue", body: "Dear Manoj Singh, the fee of ₹800 for Vivaan is now overdue. Please ignore this message if already paid. — Bright Abacus" },
    { s: byFirst("Reyansh"), kind: "absent", body: "Dear Subir Das, Reyansh was absent from class today. Kindly ensure regular attendance. — Bright Abacus" },
    { s: byFirst("Aarav"), kind: "birthday", body: "Happy Birthday Aarav! 🎉 — Bright Abacus" },
  ].filter((r) => r.s);
  await db.insert(messageOutbox).values(
    outboxSeed.map((r) => ({
      instituteId: DEMO_INSTITUTE_ID, studentId: r.s!.id, studentName: fullName(r.s!),
      phone: r.s!.parentMobile ?? "", kind: r.kind, body: r.body, dedupeKey: `demo:${r.kind}:${r.s!.id}`,
    })),
  );

  // ── Second branch (so the Head-Office roll-up shows a real franchise) ──
  await db.insert(institutes).values({
    id: DEMO_BRANCH_2_ID,
    organizationId: DEMO_ORG_ID,
    name: "▶ Demo — Bright Abacus (Behala)",
    slug: "demo-bright-abacus-behala",
    type: "abacus",
    ownerName: "Priya Menon",
    city: "Kolkata",
    monthlyFee: 800, admissionFee: 500, upiId: "brightabacus@upi",
    onboarded: true, isActive: true,
  });
  const proPlan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.code, "business") });
  if (proPlan) {
    const end2 = new Date();
    end2.setDate(end2.getDate() + 30);
    await db.insert(subscriptions).values({ instituteId: DEMO_BRANCH_2_ID, planId: proPlan.id, status: "active", currentPeriodEnd: end2 });
  }
  const B2 = [
    ["Rehan", "Sen", "Ashok Sen", "9812222201"],
    ["Tara", "Bose", "Debashish Bose", "9812222202"],
    ["Ivan", "Ghosh", "Partha Ghosh", "9812222203"],
    ["Nyra", "Dutta", "Sanjay Dutta", "9812222204"],
    ["Ojas", "Mitra", "Kaushik Mitra", "9812222205"],
    ["Zara", "Sarkar", "Biswajit Sarkar", "9812222206"],
  ] as const;
  const b2 = await db.insert(students).values(
    B2.map(([first, last, parent, mobile], i) => ({
      instituteId: DEMO_BRANCH_2_ID, code: `BAB-${String(i + 1).padStart(4, "0")}`,
      firstName: first, lastName: last, gender: (i % 2 === 0 ? "male" : "female") as "male" | "female",
      admissionDate: "2026-02-01", parentName: parent, parentMobile: mobile, fatherName: parent, fatherContact: mobile,
      city: "Kolkata", status: "active" as const,
    })),
  ).returning({ id: students.id, firstName: students.firstName, lastName: students.lastName, parentMobile: students.parentMobile });

  const b2name = (r: { firstName: string; lastName: string }) => `${r.firstName} ${r.lastName}`.trim();
  await db.insert(fees).values(
    b2.map((s, i) => ({
      instituteId: DEMO_BRANCH_2_ID, studentId: s.id, studentName: b2name(s), parentMobile: s.parentMobile,
      kind: "monthly", period: "2026-06", title: "June 2026 Monthly Fee", type: "monthly",
      amount: 800, amountPaid: i % 3 === 0 ? 0 : 800, status: (i % 3 === 0 ? "overdue" : "paid") as "overdue" | "paid", dueDate: "2026-06-05",
    })),
  );
  await db.insert(payments).values(
    b2.filter((_, i) => i % 3 !== 0).map((s) => ({
      instituteId: DEMO_BRANCH_2_ID, studentId: s.id, studentName: b2name(s),
      amount: 800, method: "upi" as const, status: "success" as const, source: "fee", date: "2026-06-03",
    })),
  );

  // ── Franchise-owner (org_admin) login for demoing the Head-Office console ──
  await db.insert(users).values({
    organizationId: DEMO_ORG_ID, instituteId: null, role: "org_admin",
    username: DEMO_HO_USERNAME, email: `${DEMO_HO_USERNAME}@noemail.eduflow.local`,
    fullName: "Priya Menon (Head Office)", passwordHash: await hashPassword(DEMO_HO_PASSWORD),
  });
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

/** Wipe and rebuild the demo data (fresh start for the next demo). seedDemo is
 *  self-cleaning, so it clears the prior demo org + both branches first. */
export async function resetDemoData(): Promise<{ ok?: boolean; error?: string }> {
  await requireSuperAdmin();
  await seedDemo();
  revalidatePath("/admin");
  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────────────────
 * SECTOR DEMO CENTERS
 * One standalone demo center per other business type (coaching, computer,
 * dance, drawing, spoken English, tuition, general). Each is built from that
 * sector's config in @/lib/sectors — its own courses, WhatsApp templates and
 * only the modules that sector switches on — so a prospect sees their own kind
 * of institute, not an abacus center with the words changed.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Sample families, reused across sectors (names only — no real people). */
const DEMO_PEOPLE = [
  { first: "Aarav", last: "Sharma", parent: "Rohit Sharma", dob: "2012-07-06" },
  { first: "Diya", last: "Gupta", parent: "Anil Gupta", dob: "2011-03-22" },
  { first: "Vivaan", last: "Singh", parent: "Manoj Singh", dob: "2010-11-02" },
  { first: "Ananya", last: "Roy", parent: "Sourav Roy", dob: "2012-07-09" },
  { first: "Kabir", last: "Khan", parent: "Imran Khan", dob: "2009-05-18" },
  { first: "Isha", last: "Patel", parent: "Nikhil Patel", dob: "2011-09-30" },
  { first: "Reyansh", last: "Das", parent: "Subir Das", dob: "2010-01-12" },
  { first: "Myra", last: "Nair", parent: "Vinod Nair", dob: "2008-08-25" },
  { first: "Arjun", last: "Iyer", parent: "Suresh Iyer", dob: "2011-12-05" },
  { first: "Sara", last: "Ali", parent: "Feroz Ali", dob: "2012-04-19" },
  { first: "Vihaan", last: "Bose", parent: "Amit Bose", dob: "2010-06-14" },
  { first: "Aditi", last: "Kapoor", parent: "Rajesh Kapoor", dob: "2009-10-08" },
  { first: "Ayaan", last: "Mondal", parent: "Prasenjit Mondal", dob: "2011-02-27" },
  { first: "Riya", last: "Chowdhury", parent: "Tapan Chowdhury", dob: "2012-11-16" },
  { first: "Dhruv", last: "Saxena", parent: "Alok Saxena", dob: "2010-08-03" },
  { first: "Kiara", last: "Menon", parent: "Hari Menon", dob: "2013-01-29" },
  { first: "Rudra", last: "Pal", parent: "Bikash Pal", dob: "2009-04-11" },
  { first: "Anvi", last: "Rathore", parent: "Devendra Rathore", dob: "2012-09-21" },
] as const;

/** Trainers per sector, named to fit the subject. */
const DEFAULT_STAFF: [string, string][] = [["Joseph Fernandes", "Senior Instructor"], ["Alisha Pereira", "Junior Instructor"]];
const DEMO_STAFF: Record<string, [string, string][]> = {
  coaching: [["Dr. Subhankar Bose", "Physics & Mathematics"], ["Nandita Sen", "Chemistry & Biology"]],
  computer: [["Vikas Kulkarni", "Programming & O-Level"], ["Sneha Joshi", "Tally, GST & DTP"]],
  dance: [["Meera Chatterjee", "Kathak (Senior Guru)"], ["Ritu Panda", "Bharatanatyam & Odissi"]],
  drawing: [["Kavita Desai", "Watercolour & Sketching"], ["Imran Shaikh", "Acrylic & Exam prep"]],
  spoken_english: [["Arun Nambiar", "Fluency & Accent"], ["Grace Thomas", "Kids & Personality Dev."]],
  tuition: [["Ramesh Yadav", "Mathematics & Science"], ["Pooja Mishra", "English & Accountancy"]],
  // A full activity center runs one specialist per activity.
  activity: [
    ["Neha Agarwal", "Abacus & Vedic Maths"],
    ["Sourav Banerjee", "Computer & Coding"],
    ["Yogesh Rawat", "Yoga & Fitness"],
    ["Meera Chatterjee", "Dance (Kathak & Bollywood)"],
    ["Kavita Desai", "Drawing & Painting"],
    ["Ritwik Sen", "Music (Vocal & Keyboard)"],
    ["Sensei Rahul Thapa", "Karate / Self-defence"],
    ["Grace Thomas", "Spoken English & Handwriting"],
  ],
  other: DEFAULT_STAFF,
};

/** True if this sector demo center is already seeded. */
async function centerExists(id: string): Promise<boolean> {
  const [row] = await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, id)).limit(1);
  return Boolean(row);
}

/** Build one sector demo center from scratch. Idempotent — clears itself first. */
async function seedCenter(center: DemoCenter): Promise<void> {
  const sector = getSector(center.sector);
  const has = (m: (typeof sector.modules)[number]) => sector.modules.includes(m);
  const iid = center.id;
  // Distinct (but obviously fake) phone series per demo center.
  const series = DEMO_CENTERS.findIndex((c) => c.id === center.id) + 1;

  await db.delete(institutes).where(eq(institutes.id, iid));

  // ── Institute ──
  await db.insert(institutes).values({
    id: iid,
    name: center.name,
    slug: center.slug,
    type: center.sector,
    ownerName: center.ownerName,
    email: `${center.slug}@eduflow.app`,
    phone: "9800000000",
    whatsapp: "9800000000",
    city: center.city,
    address: `Main Road, ${center.city}`,
    monthlyFee: center.monthlyFee,
    admissionFee: center.admissionFee,
    reactivationFee: 200,
    upiId: center.upiId,
    onboarded: true,
    isActive: true,
    recurringCharges: [{ id: "rc1", name: "Room rent", basis: "fixed", amount: 6000, category: "Rent" }],
    // Every sector demo shows WhatsApp Automation live too.
    automation: DEMO_AUTOMATION,
  });

  // ── Owner login, so a prospect can sign in and drive it themselves ──
  await db.insert(users).values({
    instituteId: iid,
    role: "institute_admin",
    username: demoCenterUsername(center.sector),
    email: `${demoCenterUsername(center.sector)}@noemail.eduflow.local`,
    fullName: `${center.ownerName} (Demo)`,
    passwordHash: await hashPassword(DEMO_CENTER_PASSWORD),
  });

  // ── Subscription ──
  const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.code, center.planCode) });
  if (plan) {
    const end = new Date();
    end.setDate(end.getDate() + 30);
    await db.insert(subscriptions).values({ instituteId: iid, planId: plan.id, status: "active", currentPeriodEnd: end });
  }

  // ── Courses — this sector's own curriculum (a multi-activity center gets
  // its full activity list, so the demo shows the whole roster) ──
  const seedCourses = sector.seedCourses.slice(0, 12);
  const courseRows = await db.insert(courses).values(
    seedCourses.map((c) => ({ instituteId: iid, name: c.name, description: c.description })),
  ).returning({ id: courses.id, name: courses.name });

  // ── Teachers ──
  const staff = DEMO_STAFF[center.sector] ?? DEFAULT_STAFF;
  const leadTeacher = staff[0]?.[0] ?? "Senior Instructor";
  const teacherRows = await db.insert(teachers).values(
    staff.map(([name, specialization], i) => ({
      instituteId: iid, name, phone: `9${series}${String(i + 1).padStart(2, "0")}000000`,
      specialization, salary: i === 0 ? 18000 : 12000, joinDate: i === 0 ? "2024-06-01" : "2025-01-15", rating: 5 - i,
    })),
  ).returning({ id: teachers.id });

  // ── Batches — one per activity/course (capped at 8), instructors round-robin.
  // A multi-activity center therefore gets a real timetable: abacus in the
  // evening, yoga in the morning, dance on the weekend… ──
  const SLOTS: [string, string][] = [
    ["5:00 PM – 6:30 PM", "Mon, Wed, Fri"],
    ["7:00 AM – 8:30 AM", "Tue, Thu, Sat"],
    ["6:30 PM – 8:00 PM", "Mon, Thu"],
    ["6:00 AM – 7:00 AM", "Mon–Sat"],
    ["4:00 PM – 5:30 PM", "Tue, Fri"],
    ["11:00 AM – 12:30 PM", "Sat, Sun"],
    ["3:30 PM – 5:00 PM", "Wed, Sat"],
    ["8:00 AM – 9:30 AM", "Sun"],
  ];
  const batchRows = await db.insert(batches).values(
    courseRows.slice(0, 8).map((c, i) => ({
      instituteId: iid,
      courseId: c.id,
      teacherId: teacherRows[i % Math.max(teacherRows.length, 1)]?.id ?? null,
      name: c.name,
      timing: SLOTS[i % SLOTS.length]?.[0] ?? "5:00 PM – 6:30 PM",
      days: SLOTS[i % SLOTS.length]?.[1] ?? "Mon, Wed, Fri",
      capacity: "20",
    })),
  ).returning({ id: batches.id });
  const batchA = batchRows[0]?.id ?? null;

  // ── Students (mixed statuses so every filter has something to show), spread
  // across every activity so each batch has real enrolment ──
  const count = Math.min(center.studentCount ?? 10, DEMO_PEOPLE.length);
  const people = DEMO_PEOPLE.slice(0, count);
  const statusOf = (i: number) => (i === 4 ? "inactive" : i === 7 ? "graduated" : "active") as "active" | "inactive" | "graduated";
  const studentRows = await db.insert(students).values(
    people.map((p, i) => {
      const slot = i % Math.max(batchRows.length, 1);
      return {
        instituteId: iid,
        code: `${center.prefix}-${String(i + 1).padStart(4, "0")}`,
        firstName: p.first, lastName: p.last,
        gender: (i % 2 === 0 ? "male" : "female") as "male" | "female",
        dob: p.dob, admissionDate: "2026-01-15",
        courseId: courseRows[slot]?.id ?? null,
        batchId: batchRows[slot]?.id ?? null,
        parentName: p.parent, parentMobile: `9${series}${String(i + 11).padStart(2, "0")}111111`,
        fatherName: p.parent, city: center.city, address: `${center.city}, India`,
        status: statusOf(i),
      };
    }),
  ).returning({ id: students.id, firstName: students.firstName, lastName: students.lastName, parentMobile: students.parentMobile, batchId: students.batchId });

  const name = (r: { firstName: string; lastName: string }) => `${r.firstName} ${r.lastName}`.trim();
  const active = studentRows.filter((_, i) => statusOf(i) === "active");
  const fee = center.monthlyFee;

  // ── Fees (last month paid/overdue mix + this month pending) & payments ──
  // Relative dates so the Automation Outbox always has material on demo day.
  const ctrOverdueDate = demoDay(-6);
  const ctrDueSoonDate = demoDay(2);
  const ctrPrevMonth = new Date();
  ctrPrevMonth.setMonth(ctrPrevMonth.getMonth() - 1);
  const ctrPrevYm = ctrPrevMonth.toISOString().slice(0, 7);
  const ctrCurYm = new Date().toISOString().slice(0, 7);
  const feeValues: (typeof fees.$inferInsert)[] = [];
  active.forEach((s, i) => {
    const paid = i % 4 !== 0;
    feeValues.push({
      instituteId: iid, studentId: s.id, studentName: name(s), parentMobile: s.parentMobile,
      kind: "monthly", period: ctrPrevYm, title: `${demoMonthLabel(ctrOverdueDate)} Monthly Fee`, type: "monthly",
      amount: fee, amountPaid: paid ? fee : 0, status: paid ? "paid" : "overdue", dueDate: ctrOverdueDate,
    });
    feeValues.push({
      instituteId: iid, studentId: s.id, studentName: name(s), parentMobile: s.parentMobile,
      kind: "monthly", period: ctrCurYm, title: `${demoMonthLabel(ctrDueSoonDate)} Monthly Fee`, type: "monthly",
      amount: fee, amountPaid: 0, status: "pending", dueDate: ctrDueSoonDate,
    });
  });

  // A multi-activity center's real money story: parents who add a second
  // activity, plus the extras such a center actually charges for.
  if (center.sector === "activity") {
    const second = ["Yoga & Fitness", "Drawing & Painting", "Music (Vocal & Keyboard)", "Karate / Self-defence"];
    active.slice(0, 4).forEach((s, i) => {
      feeValues.push({
        instituteId: iid, studentId: s.id, studentName: name(s), parentMobile: s.parentMobile,
        kind: "other", period: ctrCurYm, title: `Second activity — ${second[i % second.length]}`,
        type: "activity", amount: 600, amountPaid: i % 2 === 0 ? 600 : 0,
        status: i % 2 === 0 ? "paid" : "pending", dueDate: demoDay(5),
      });
    });
    active.slice(4, 7).forEach((s, i) => {
      feeValues.push({
        instituteId: iid, studentId: s.id, studentName: name(s), parentMobile: s.parentMobile,
        kind: "other", period: ctrCurYm,
        title: ["Annual function costume", "Exam board fee", "Activity kit"][i % 3] ?? "Extra charge",
        type: "other", amount: [500, 600, 350][i % 3] ?? 500,
        amountPaid: 0, status: "pending", dueDate: demoDay(12),
      });
    });
  }

  await db.insert(fees).values(feeValues);
  await db.insert(payments).values(
    active.filter((_, i) => i % 4 !== 0).map((s, i) => ({
      instituteId: iid, studentId: s.id, studentName: name(s),
      amount: fee, method: (["upi", "cash", "razorpay"] as const)[i % 3], status: "success" as const,
      source: "fee", date: "2026-06-03",
    })),
  );

  // ── Expenses ──
  await db.insert(expenses).values([
    { instituteId: iid, title: "Room rent — June", category: "Rent", amount: 6000, date: "2026-06-01" },
    { instituteId: iid, title: `Salary — ${leadTeacher}`, category: "Salary", amount: 18000, date: "2026-06-01" },
    { instituteId: iid, title: "Electricity", category: "Utilities", amount: 1200, date: "2026-06-05" },
    { instituteId: iid, title: "Leaflets & banner", category: "Marketing", amount: 900, date: "2026-06-10" },
    // A multi-activity center pays several specialists, not one teacher.
    ...(center.sector === "activity"
      ? staff.slice(1, 5).map(([n], i) => ({
          instituteId: iid, title: `Salary — ${n}`, category: "Salary",
          amount: [9000, 8000, 10000, 7500][i] ?? 8000, date: "2026-06-01",
        }))
      : []),
  ]);

  // ── WhatsApp templates — this sector's own wording ──
  await db.insert(templates).values(
    sector.seedTemplates.slice(0, 8).map((t) => ({
      instituteId: iid, name: t.name, type: t.type, channel: "whatsapp",
      body: t.body.replaceAll("{{business}}", center.name.replace("▶ Demo — ", "")),
    })),
  );

  // ── Module-specific sample data (only what this sector switches on) ──
  if (has("attendance")) {
    // Today's register for every batch, so a multi-activity center shows a full day.
    await db.insert(attendance).values(
      active.map((s, i) => ({
        instituteId: iid, date: "2026-07-06", batchId: s.batchId ?? batchA, studentId: s.id,
        studentName: name(s), parentMobile: s.parentMobile, present: i % 5 !== 0,
      })),
    );
  }
  if (has("promotions") && courseRows.length > 1) {
    // An activity center promotes within an activity (level / belt / grade),
    // not from one activity to another.
    const ladders: [string, string][] = center.sector === "activity"
      ? [["Abacus Level 2", "Abacus Level 3"], ["Karate Yellow Belt", "Karate Orange Belt"], ["Dance Grade 1", "Dance Grade 2"]]
      : [[courseRows[0]?.name ?? "Level 1", courseRows[1]?.name ?? "Level 2"]];
    await db.insert(promotions).values(
      active.slice(0, 3).map((s, i) => ({
        instituteId: iid, studentId: s.id, studentName: name(s), parentMobile: s.parentMobile,
        fromLevel: ladders[i % ladders.length]?.[0] ?? "Level 1",
        toLevel: ladders[i % ladders.length]?.[1] ?? "Level 2",
        score: "92", date: "2026-06-20", notified: true,
      })),
    );
  }
  if (has("tests")) {
    await db.insert(testScores).values(
      active.map((s, i) => ({
        instituteId: iid, testName: "June Monthly Assessment", date: "2026-06-25", batchId: s.batchId,
        studentId: s.id, studentName: name(s), parentMobile: s.parentMobile,
        score: 70 + ((i * 7) % 30), maxScore: 100,
      })),
    );
  }
  const isActivity = center.sector === "activity";

  if (has("certificates")) {
    // An activity center issues certificates across several activities at once.
    const certCourses = isActivity
      ? ["Abacus & Mental Maths", "Computer Basics (DCA/MS Office)", "Drawing & Painting", "Spoken English & Personality"]
      : [courseRows[0]?.name ?? "Course"];
    await db.insert(certificates).values(
      active.slice(0, isActivity ? 4 : 2).map((s, i) => {
        const course = certCourses[i % certCourses.length] ?? "Course";
        return {
          instituteId: iid, serial: `${center.prefix}-CERT-${1000 + i}`, studentId: s.id, studentName: name(s),
          title: `${course} Completion Certificate`, course, issueDate: "2026-06-28",
        };
      }),
    );
  }
  if (has("examBoards")) {
    const boards: Record<string, string> = { coaching: "WBCHSE", computer: "NIELIT", dance: "Prayag Sangit Samiti", drawing: "Govt. Elementary Exam" };
    // One center, many boards — the reality of a multi-activity center.
    const activityBoards: [string, string][] = [
      ["UCMAS (Abacus)", "Level 3"],
      ["NIELIT (Computer)", "CCC"],
      ["Prayag Sangit Samiti (Dance)", "Grade 2"],
      ["Govt. Elementary Exam (Drawing)", "Elementary"],
      ["Karate Association (Belt)", "Orange Belt"],
    ];
    await db.insert(examRegs).values(
      active.slice(0, isActivity ? 5 : 3).map((s, i) => ({
        instituteId: iid, studentId: s.id, studentName: name(s), parentMobile: s.parentMobile,
        board: isActivity ? (activityBoards[i]?.[0] ?? "State Board") : (boards[center.sector] ?? "State Board"),
        tier: isActivity ? (activityBoards[i]?.[1] ?? "Level 1") : (courseRows[0]?.name ?? "Level 1"),
        examDate: "2026-08-15", fee: 600, status: "registered",
      })),
    );
  }
  if (has("performance")) {
    const eventNames: Record<string, string> = { dance: "State Dance Festival", drawing: "All-India Art Contest" };
    const activityEvents = ["State Abacus Championship", "Inter-school Dance Festival", "All-India Art Contest", "District Karate Tournament"];
    await db.insert(performances).values(
      active.slice(0, isActivity ? 4 : 2).map((s, i) => ({
        instituteId: iid, studentId: s.id, studentName: name(s), parentMobile: s.parentMobile,
        event: isActivity ? (activityEvents[i % activityEvents.length] ?? "State Championship") : (eventNames[center.sector] ?? "State Championship"),
        level: i % 2 === 0 ? "State" : "District",
        result: i === 0 ? "1st Place" : i === 1 ? "2nd Place" : "Participation", date: "2026-05-30",
      })),
    );
  }
  if (has("materials")) {
    const kits: Record<string, string[]> = { dance: ["Costume set", "Ghungroo"], drawing: ["Colour box", "Sketch pad"], computer: ["Course book", "Practice CD"] };
    const activityKits: [string, number][] = [
      ["Abacus kit", 350], ["Computer course book", 250], ["Yoga mat", 450],
      ["Dance costume set", 900], ["Drawing colour box", 300], ["Karate uniform (Gi)", 800],
    ];
    const kit = kits[center.sector] ?? ["Course kit", "Workbook set"];
    await db.insert(materials).values(
      active.slice(0, isActivity ? 6 : 4).map((s, i) => ({
        instituteId: iid, studentId: s.id, studentName: name(s),
        item: isActivity ? (activityKits[i]?.[0] ?? "Activity kit") : (kit[i % 2] ?? "Course kit"),
        amount: isActivity ? (activityKits[i]?.[1] ?? 300) : (i % 2 === 0 ? 350 : 150),
        issued: i % 3 !== 0, date: "2026-01-20",
      })),
    );
  }
  if (has("events")) {
    const titles: Record<string, string> = { dance: "Annual Recital 2026", drawing: "Students' Art Exhibition 2026" };
    const rows = isActivity
      ? [
          { title: "Annual Function 2026 — all activities", date: "2026-12-20", venue: "City Auditorium", note: "Dance, music & karate performances + prize distribution" },
          { title: "Art & Craft Exhibition", date: "2026-09-14", venue: "Center hall", note: "Drawing and hobby-craft students' work on display" },
          { title: "International Yoga Day", date: "2026-06-21", venue: "Community Park", note: "Free open session — good admission funnel" },
          { title: "Free Trial Week — all activities", date: "2026-07-15", venue: "Center", note: "Open house for new admissions" },
        ]
      : [
          { title: titles[center.sector] ?? "Annual Function 2026", date: "2026-12-20", venue: "City Auditorium", note: "Prize distribution + performances" },
          { title: "Free Demo Class", date: "2026-07-15", venue: "Center", note: "Open house for new admissions" },
        ];
    await db.insert(events).values(rows.map((r) => ({ instituteId: iid, ...r })));
  }

  // ── Ad materials & stationery (so the Ad & Stationery module isn't empty) ──
  await db.insert(adMaterials).values([
    { instituteId: iid, date: demoDay(-20), banner: 2, leaflet: 500, sunPack: 0, poster: 20, voice: 0, other: "", addedBy: center.ownerName },
    { instituteId: iid, date: demoDay(-5), banner: 0, leaflet: 0, sunPack: 1, poster: 10, voice: 1, other: "Auto-rickshaw announcement", addedBy: center.ownerName },
  ]);
  await db.insert(stationery).values([
    { instituteId: iid, date: demoDay(-20), stationery: 24, gift: 0, other: "Practice books", addedBy: center.ownerName },
    { instituteId: iid, date: demoDay(-3), stationery: 0, gift: 12, other: "Birthday return gifts", addedBy: center.ownerName },
  ]);

  // ── A teacher staff login (shows the Staff Logins module in action) ──
  await db.insert(users).values({
    instituteId: iid, role: "teacher",
    username: `${demoCenterUsername(center.sector)}-teacher`,
    email: `${demoCenterUsername(center.sector)}-teacher@noemail.eduflow.local`,
    fullName: staff[0]?.[0] ?? "Demo Teacher", passwordHash: await hashPassword(DEMO_CENTER_PASSWORD),
  });

  // ── Fill the Automation Outbox exactly like the daily cron would, plus one
  // absent + one birthday example the scan alone can't produce on demo day ──
  const bizName = center.name.replace("▶ Demo — ", "");
  await queueForInstitute({ id: iid, name: bizName, automation: DEMO_AUTOMATION });
  const outboxExtras = [
    { s: active[5], kind: "absent", body: `Dear Parent, ${active[5]?.firstName} was absent from class today. Kindly ensure regular attendance. — ${bizName}` },
    { s: active[0], kind: "birthday", body: `Happy Birthday ${active[0]?.firstName}! 🎉 — ${bizName}` },
  ].filter((r) => r.s);
  await db.insert(messageOutbox).values(
    outboxExtras.map((r) => ({
      instituteId: iid, studentId: r.s!.id, studentName: name(r.s!),
      phone: r.s!.parentMobile ?? "", kind: r.kind, body: r.body, dedupeKey: `demo:${r.kind}:${r.s!.id}`,
    })),
  );
}

/** Which demo centers are seeded — drives the "Ready / Not seeded" badges. */
export async function listDemoCenters(): Promise<{ sector: string; seeded: boolean }[]> {
  await requireSuperAdmin();
  const ids = DEMO_CENTERS.map((c) => c.id);
  const rows = await db.select({ id: institutes.id }).from(institutes).where(inArray(institutes.id, ids));
  const live = new Set(rows.map((r) => r.id));
  return DEMO_CENTERS.map((c) => ({ sector: c.sector, seeded: live.has(c.id) }));
}

/** Enter a sector demo center: seed on first use, then "open" it. */
export async function enterSectorDemo(formData: FormData) {
  await requireSuperAdmin();
  const center = getDemoCenter(String(formData.get("sector") ?? ""));
  if (!center) return;
  if (!(await centerExists(center.id))) await seedCenter(center);
  const store = await cookies();
  store.set(ACTING_COOKIE, center.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

/** Wipe and rebuild one sector demo center. */
export async function resetSectorDemo(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const center = getDemoCenter(String(formData.get("sector") ?? ""));
  if (!center) return;
  await seedCenter(center);
  revalidatePath("/admin");
}

/** Build (or rebuild) every sector demo center in one go. */
export async function seedAllSectorDemos(): Promise<{ ok?: boolean; error?: string }> {
  await requireSuperAdmin();
  for (const center of DEMO_CENTERS) await seedCenter(center);
  revalidatePath("/admin");
  return { ok: true };
}
