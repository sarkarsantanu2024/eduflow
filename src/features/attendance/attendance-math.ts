import type { Attendance, Student } from "@/lib/store/local-db";

/**
 * The selection and save arithmetic behind the Attendance register.
 *
 * Extracted from the view because saving a register is a *diff*, not an
 * insert: a day can be re-opened and corrected any number of times, and every
 * correction has to land on the row that already exists rather than adding a
 * second, contradictory record for the same student on the same day. That is
 * the part worth testing — a duplicated row means the same child is counted
 * both present and absent.
 */

/** Active students in a batch — the register for a given day. */
export function rosterFor(students: Student[], batchId: string): Student[] {
  if (!batchId) return [];
  return students.filter((s) => s.batchId === batchId && s.status === "active");
}

/**
 * Active students with no batch at all. They appear in NO register, so the page
 * warns about them — silently vanishing from attendance is how a centre ends up
 * with a child nobody marked for a month.
 */
export function unassignedCount(students: Student[]): number {
  return students.filter((s) => s.status === "active" && !s.batchId).length;
}

/** Student ids already saved as absent for this batch and date. */
export function savedAbsentIds(attendance: Attendance[], batchId: string, date: string): Set<string> {
  const set = new Set<string>();
  for (const a of attendance) {
    if (a.batchId === batchId && a.date === date && !a.present) set.add(a.studentId);
  }
  return set;
}

/** How the day reads once saved. */
export function attendanceSummary(roster: Student[], absent: Set<string>): { present: number; absent: number } {
  const marked = roster.filter((s) => absent.has(s.id)).length;
  return { present: roster.length - marked, absent: marked };
}

export interface AttendanceWrites {
  /** New records to add — students with nothing saved for this batch/date yet. */
  creates: Omit<Attendance, "id">[];
  /** Existing records whose present/absent flag actually changed. */
  updates: { id: string; present: boolean }[];
}

/**
 * What saving the register should write.
 *
 * Only rows whose value genuinely changed are updated, so re-saving an
 * unchanged day is a no-op rather than a burst of writes. A student already on
 * record for this batch and date is never inserted a second time.
 */
export function attendanceWrites(
  roster: Student[],
  absent: Set<string>,
  attendance: Attendance[],
  batchId: string,
  date: string,
): AttendanceWrites {
  const existing = new Map<string, Attendance>();
  for (const a of attendance) {
    if (a.batchId === batchId && a.date === date) existing.set(a.studentId, a);
  }

  const creates: Omit<Attendance, "id">[] = [];
  const updates: { id: string; present: boolean }[] = [];

  for (const s of roster) {
    const present = !absent.has(s.id);
    const prior = existing.get(s.id);
    if (prior) {
      if (prior.present !== present) updates.push({ id: prior.id, present });
    } else {
      creates.push({
        date,
        batchId,
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`.trim(),
        parentMobile: s.parentMobile || s.fatherContact,
        present,
      });
    }
  }

  return { creates, updates };
}
