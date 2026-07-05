"use client";

import { useSyncExternalStore } from "react";
import { useDb } from "@/lib/store/local-db";
import type { UserRole } from "@/types/database.types";

export type NotificationCategory = "money" | "students" | "academics" | "events";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  category: NotificationCategory;
  href?: string;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/* ── read-state (per browser) ─────────────────────────────────────────
 * Notifications are derived live from the center's data, so there's no
 * notifications table. "Read" is tracked in localStorage by id, so the bell
 * badge clears once the owner has seen them and only genuinely-new items show
 * as unread. */
const READ_KEY = "eduflow:readNotifs";
let readIds: Set<string> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function loadRead(): Set<string> {
  if (readIds) return readIds;
  try { readIds = new Set<string>(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); }
  catch { readIds = new Set<string>(); }
  return readIds;
}
function persist() { try { localStorage.setItem(READ_KEY, JSON.stringify([...loadRead()])); } catch { /* ignore */ } }
function emit() { version++; listeners.forEach((l) => l()); }

/** Mark the given notification ids as read (clears them from the unread badge). */
export function markNotificationsRead(ids: string[]) {
  const r = loadRead();
  let changed = false;
  ids.forEach((id) => { if (!r.has(id)) { r.add(id); changed = true; } });
  if (changed) { persist(); emit(); }
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function useReadVersion() { return useSyncExternalStore(subscribe, () => version, () => 0); }

/**
 * All the live notifications a center could care about, derived from its own
 * data. Money items are hidden from teacher/staff logins. Sector-aware by
 * nature — exam/event/attendance items only appear when that data exists.
 */
export function useNotifications(role?: UserRole): AppNotification[] {
  const db = useDb();
  useReadVersion(); // re-render when read-state changes
  const read = loadRead();
  const seesMoney = role !== "teacher";

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const ym = todayStr.slice(0, 7);
  const mmdd = todayStr.slice(5);
  const tomorrowMmdd = new Date(today.getTime() + 86_400_000).toISOString().slice(5, 10);
  const inDays = (d: string, days: number) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - today.getTime()) / 86_400_000;
    return diff >= 0 && diff <= days;
  };

  const notes: Omit<AppNotification, "unread">[] = [];

  // ── Money (owners/admins only) ──────────────────────────────────
  if (seesMoney) {
    // Individual overdue fees (past due date).
    db.fees.filter((f) => f.status !== "paid" && f.dueDate && f.dueDate < todayStr).slice(0, 6)
      .forEach((f) => notes.push({ id: `fee-${f.id}`, title: "Fee overdue", body: `${f.studentName || "A student"} — ${inr(f.amount - f.amountPaid)} pending (due ${f.dueDate})`, time: f.dueDate, category: "money", href: "/fees" }));

    // This month's pending fees (aggregate).
    const monthFees = db.fees.filter((f) => (f.period || (f.dueDate || "").slice(0, 7)) === ym);
    const pending = monthFees.filter((f) => f.status !== "paid");
    const dueStudents = new Set(pending.map((f) => f.studentId)).size;
    const outstanding = pending.reduce((s, f) => s + (f.amount - f.amountPaid), 0);
    if (dueStudents > 0) notes.push({ id: `pending-${ym}`, title: "Pending fees this month", body: `${dueStudents} student${dueStudents > 1 ? "s have" : " has"} fees pending — ${inr(outstanding)} uncollected`, time: "This month", category: "money", href: "/fees" });

    // Low collection rate this month.
    const billed = monthFees.reduce((s, f) => s + f.amount, 0);
    const collected = db.payments.filter((p) => p.status === "success" && p.date && p.date.startsWith(ym)).reduce((s, p) => s + p.amount, 0);
    const rate = billed ? Math.round((collected / billed) * 100) : 100;
    if (billed > 0 && rate < 80) notes.push({ id: `collrate-${ym}`, title: "Collection running low", body: `Only ${rate}% of this month's fees collected — a reminder run helps`, time: "This month", category: "money", href: "/fees" });

    // Material charges awaiting collection.
    const matPending = db.materials.filter((m) => !m.issued && (m.amount || 0) > 0);
    if (matPending.length > 0) notes.push({ id: `matdue-${matPending.length}-${ym}`, title: "Material charges pending", body: `${matPending.length} kit charge${matPending.length > 1 ? "s" : ""} to collect — ${inr(matPending.reduce((s, m) => s + m.amount, 0))}`, time: "Pending", category: "money", href: "/materials" });
  }

  // ── Students ────────────────────────────────────────────────────
  db.students.filter((s) => s.status === "active" && s.dob).forEach((s) => {
    const md = s.dob.slice(5);
    const name = `${s.firstName} ${s.lastName}`.trim();
    if (md === mmdd) notes.push({ id: `bday-${s.id}`, title: "Birthday today 🎂", body: `${name} — send a wish`, time: "Today", category: "students", href: "/students" });
    else if (md === tomorrowMmdd) notes.push({ id: `bday-tmrw-${s.id}`, title: "Birthday tomorrow 🎂", body: `${name} — get a poster ready`, time: "Tomorrow", category: "students", href: "/students" });
  });

  // Absent today (attendance).
  const absent = db.attendance.filter((a) => a.date === todayStr && !a.present).length;
  if (absent > 0) notes.push({ id: `absent-${todayStr}`, title: "Students absent today", body: `${absent} student${absent > 1 ? "s were" : " was"} absent — alert their parents`, time: "Today", category: "students", href: "/attendance" });

  // New admissions (last 7 days).
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  db.students.filter((s) => s.admissionDate && s.admissionDate >= weekAgo && s.admissionDate <= todayStr).slice(0, 4)
    .forEach((s) => notes.push({ id: `adm-${s.id}`, title: "New admission", body: `${s.firstName} ${s.lastName}`.trim(), time: s.admissionDate, category: "students", href: "/students" }));

  // Inactive / dropped students to win back.
  const inactive = db.students.filter((s) => s.status === "inactive" || s.status === "dropped").length;
  if (inactive > 0) notes.push({ id: `inactive-${inactive}`, title: "Inactive students", body: `${inactive} student${inactive > 1 ? "s are" : " is"} inactive — a follow-up can win them back`, time: "", category: "students", href: "/students" });

  // Free seats across batches (growth nudge).
  const enrolled: Record<string, number> = {};
  db.students.forEach((s) => { if (s.status === "active" && s.batchId) enrolled[s.batchId] = (enrolled[s.batchId] ?? 0) + 1; });
  const seats = db.batches.reduce((sum, b) => sum + Math.max(0, (Number(b.capacity) || 0) - (enrolled[b.id] ?? 0)), 0);
  if (seats > 0) notes.push({ id: `seats-${seats}`, title: "Free seats to fill", body: `${seats} open seat${seats > 1 ? "s" : ""} across your batches — run an admission post`, time: "", category: "students", href: "/batches" });

  // ── Academics ───────────────────────────────────────────────────
  db.examRegs.filter((e) => inDays(e.examDate, 14)).slice(0, 4)
    .forEach((e) => notes.push({ id: `exam-${e.id}`, title: "Exam coming up", body: `${e.studentName} — ${e.board} on ${e.examDate}`, time: e.examDate, category: "academics", href: "/exam-boards" }));

  // ── Events ──────────────────────────────────────────────────────
  db.events.filter((ev) => inDays(ev.date, 30)).slice(0, 3)
    .forEach((ev) => notes.push({ id: `evt-${ev.id}`, title: "Upcoming event", body: `${ev.title}${ev.date ? ` — ${ev.date}` : ""}`, time: ev.date, category: "events", href: "/events" }));

  return notes.slice(0, 30).map((n) => ({ ...n, unread: !read.has(n.id) }));
}
