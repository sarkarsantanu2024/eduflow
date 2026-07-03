"use client";

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

/**
 * Real, live notifications derived from the center's own data — nothing is
 * stored in the database. Naturally sector-aware: exam/event items only appear
 * if that sector's modules have data.
 *
 * Role-aware: staff (teacher) logins never see money/fee items, matching what
 * they can access in the app.
 */
export function useNotifications(role?: UserRole): AppNotification[] {
  const db = useDb();
  const seesMoney = role !== "teacher";
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const mmdd = todayStr.slice(5);
  const inDays = (d: string, days: number) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - today.getTime()) / 86_400_000;
    return diff >= 0 && diff <= days;
  };

  const notes: AppNotification[] = [];

  // Overdue fees (most useful, money first) — admins/owners only.
  if (seesMoney) {
    db.fees
      .filter((f) => f.status !== "paid" && f.dueDate && f.dueDate < todayStr)
      .slice(0, 6)
      .forEach((f) =>
        notes.push({
          id: `fee-${f.id}`,
          title: "Fee overdue",
          body: `${f.studentName || "A student"} — ${inr(f.amount - f.amountPaid)} pending (due ${f.dueDate})`,
          time: f.dueDate,
          unread: true,
          category: "money",
          href: "/fees",
        }),
      );
  }

  // Birthdays — today, plus a one-day-ahead heads-up for the owner.
  const tomorrowMmdd = new Date(today.getTime() + 86_400_000).toISOString().slice(5, 10);
  db.students
    .filter((s) => s.status === "active" && s.dob)
    .forEach((s) => {
      const md = s.dob.slice(5);
      const name = `${s.firstName} ${s.lastName}`.trim();
      if (md === mmdd) {
        notes.push({ id: `bday-${s.id}`, title: "Birthday today 🎂", body: name, time: "Today", unread: true, category: "students", href: "/students" });
      } else if (md === tomorrowMmdd) {
        notes.push({ id: `bday-tmrw-${s.id}`, title: "Birthday tomorrow 🎂", body: `${name} — wish them / send a message`, time: "Tomorrow", unread: true, category: "students", href: "/students" });
      }
    });

  // New admissions in the last 7 days.
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  db.students
    .filter((s) => s.admissionDate && s.admissionDate >= weekAgo && s.admissionDate <= todayStr)
    .slice(0, 4)
    .forEach((s) =>
      notes.push({ id: `adm-${s.id}`, title: "New admission", body: `${s.firstName} ${s.lastName}`.trim(), time: s.admissionDate, unread: true, category: "students", href: "/students" }),
    );

  // Upcoming exam-board exams (next 14 days) — only sectors using exam boards.
  db.examRegs
    .filter((e) => inDays(e.examDate, 14))
    .slice(0, 4)
    .forEach((e) =>
      notes.push({ id: `exam-${e.id}`, title: "Exam coming up", body: `${e.studentName} — ${e.board} on ${e.examDate}`, time: e.examDate, unread: true, category: "academics", href: "/exam-boards" }),
    );

  // Upcoming events (next 30 days) — sectors using events.
  db.events
    .filter((ev) => inDays(ev.date, 30))
    .slice(0, 3)
    .forEach((ev) =>
      notes.push({ id: `evt-${ev.id}`, title: "Upcoming event", body: `${ev.title}${ev.date ? ` — ${ev.date}` : ""}`, time: ev.date, unread: true, category: "events", href: "/events" }),
    );

  return notes.slice(0, 20);
}
