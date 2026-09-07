import { describe, it, expect } from "vitest";
import {
  rosterFor, unassignedCount, savedAbsentIds, attendanceSummary, attendanceWrites,
} from "./attendance-math";
import type { Attendance, Student } from "@/lib/store/types";

/**
 * Attendance is re-opened and corrected constantly — a child walks in late, a
 * teacher marks the wrong row. Every one of those corrections has to land on
 * the record that already exists. A second row for the same child on the same
 * day makes them both present and absent, and nothing downstream can tell
 * which one is true.
 */

const student = (over: Partial<Student> & { id: string }): Student =>
  ({
    code: "", firstName: "Aarav", lastName: "Sharma", gender: "", dob: "", admissionDate: "",
    courseId: "", batchId: "b1", monthlyFee: 0, billingStartMonth: "", centreName: "", hobbies: "",
    siblingAge: "", schoolName: "", schoolClass: "", address: "", city: "", pincode: "",
    fatherName: "", fatherContact: "", motherName: "", motherContact: "", parentName: "",
    parentMobile: "", parentEmail: "", photo: "", status: "active",
    ...over,
  }) as Student;

const record = (over: Partial<Attendance> & { id: string; studentId: string }): Attendance => ({
  date: "2026-09-07", batchId: "b1", studentName: "", parentMobile: "", present: true, ...over,
});

describe("rosterFor — who is on today's register", () => {
  const students = [
    student({ id: "s1", batchId: "b1" }),
    student({ id: "s2", batchId: "b2" }),
    student({ id: "s3", batchId: "b1", status: "dropped" }),
    student({ id: "s4", batchId: "b1", status: "inactive" }),
  ];

  it("takes only the active students of that batch", () => {
    expect(rosterFor(students, "b1").map((s) => s.id)).toEqual(["s1"]);
  });

  it("keeps a dropped student off the register entirely", () => {
    expect(rosterFor(students, "b1").some((s) => s.id === "s3")).toBe(false);
  });

  it("returns nobody rather than everybody when no batch is picked", () => {
    expect(rosterFor(students, "")).toEqual([]);
  });
});

describe("unassignedCount — the students no register can reach", () => {
  it("counts active students with no batch", () => {
    expect(
      unassignedCount([
        student({ id: "s1", batchId: "" }),
        student({ id: "s2", batchId: "b1" }),
        student({ id: "s3", batchId: "" }),
      ]),
    ).toBe(2);
  });

  it("ignores inactive students — nobody expects to mark them", () => {
    expect(unassignedCount([student({ id: "s1", batchId: "", status: "dropped" })])).toBe(0);
  });
});

describe("savedAbsentIds — reopening a day that was already marked", () => {
  const attendance = [
    record({ id: "a1", studentId: "s1", present: false }),
    record({ id: "a2", studentId: "s2", present: true }),
    record({ id: "a3", studentId: "s3", present: false, date: "2026-09-06" }),
    record({ id: "a4", studentId: "s4", present: false, batchId: "b2" }),
  ];

  it("re-checks exactly the students saved as absent", () => {
    expect([...savedAbsentIds(attendance, "b1", "2026-09-07")]).toEqual(["s1"]);
  });

  it("does not carry yesterday's absences into today", () => {
    expect(savedAbsentIds(attendance, "b1", "2026-09-07").has("s3")).toBe(false);
  });

  it("does not carry another batch's absences across", () => {
    expect(savedAbsentIds(attendance, "b1", "2026-09-07").has("s4")).toBe(false);
  });

  it("is empty for a day nobody has marked", () => {
    expect(savedAbsentIds(attendance, "b1", "2026-09-08").size).toBe(0);
  });
});

describe("attendanceSummary — the present/absent tally shown on save", () => {
  const roster = [student({ id: "s1" }), student({ id: "s2" }), student({ id: "s3" })];

  it("splits the register", () => {
    expect(attendanceSummary(roster, new Set(["s2"]))).toEqual({ present: 2, absent: 1 });
  });

  it("counts a full house", () => {
    expect(attendanceSummary(roster, new Set())).toEqual({ present: 3, absent: 0 });
  });

  it("ignores a toggle left over from another batch instead of over-counting absentees", () => {
    // The page keeps one absent-set; switching batch must not report an absence
    // for somebody who is not on this register.
    expect(attendanceSummary(roster, new Set(["s2", "someone-else"]))).toEqual({ present: 2, absent: 1 });
  });
});

describe("attendanceWrites — saving is a diff, not an insert", () => {
  const roster = [
    student({ id: "s1", firstName: "Aarav", lastName: "Sharma", parentMobile: "9800000001" }),
    student({ id: "s2", firstName: "Bina", lastName: "Das", fatherContact: "9800000002" }),
  ];

  it("creates a record for every student on a day never marked before", () => {
    const { creates, updates } = attendanceWrites(roster, new Set(["s2"]), [], "b1", "2026-09-07");
    expect(updates).toEqual([]);
    expect(creates).toHaveLength(2);
    expect(creates[0]).toMatchObject({
      studentId: "s1", studentName: "Aarav Sharma", parentMobile: "9800000001",
      present: true, batchId: "b1", date: "2026-09-07",
    });
    expect(creates[1]).toMatchObject({ studentId: "s2", present: false });
  });

  it("falls back to the father's number when there is no parent mobile", () => {
    const { creates } = attendanceWrites(roster, new Set(), [], "b1", "2026-09-07");
    expect(creates[1]!.parentMobile).toBe("9800000002");
  });

  it("updates the existing record instead of adding a second one for the same day", () => {
    const existing = [record({ id: "a1", studentId: "s1", present: true })];
    const { creates, updates } = attendanceWrites(roster, new Set(["s1"]), existing, "b1", "2026-09-07");
    expect(updates).toEqual([{ id: "a1", present: false }]);
    expect(creates.map((c) => c.studentId)).toEqual(["s2"]);
  });

  it("writes nothing at all when a saved day is re-saved unchanged", () => {
    const existing = [
      record({ id: "a1", studentId: "s1", present: true }),
      record({ id: "a2", studentId: "s2", present: false }),
    ];
    expect(attendanceWrites(roster, new Set(["s2"]), existing, "b1", "2026-09-07")).toEqual({
      creates: [], updates: [],
    });
  });

  it("marks a student back present after a correction", () => {
    const existing = [record({ id: "a2", studentId: "s2", present: false })];
    const { updates } = attendanceWrites(roster, new Set(), existing, "b1", "2026-09-07");
    expect(updates).toEqual([{ id: "a2", present: true }]);
  });

  it("does not treat another day's or batch's record as this day's", () => {
    const existing = [
      record({ id: "a1", studentId: "s1", present: false, date: "2026-09-06" }),
      record({ id: "a2", studentId: "s2", present: false, batchId: "b2" }),
    ];
    const { creates, updates } = attendanceWrites(roster, new Set(), existing, "b1", "2026-09-07");
    expect(updates).toEqual([]);
    expect(creates.map((c) => c.studentId)).toEqual(["s1", "s2"]);
  });

  it("never writes for a student who is not on the register", () => {
    const { creates } = attendanceWrites([], new Set(["s1"]), [], "b1", "2026-09-07");
    expect(creates).toEqual([]);
  });
});
