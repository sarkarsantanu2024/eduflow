import { describe, it, expect } from "vitest";
import {
  autoDetectMapping, buildStudents, parseStudentsCsv, parseStudentsFromSheet, studentTemplateCsv,
} from "./student-csv";
import { parseCsv } from "@/lib/csv";

/**
 * Bulk import is how a centre onboards — one messy list handed over from a
 * register, an old Excel file, or another software's export. Everything here
 * is deliberately forgiving, so the tests are mostly about the ways a real
 * list is ugly: dd/mm/yyyy dates, "Father's Name", Excel date serials, a
 * single "Name" column, phone numbers under six different headers.
 */

describe("autoDetectMapping — recognising a real school list's headers", () => {
  it("maps the headers a handwritten register gets typed up with", () => {
    expect(
      autoDetectMapping(["Name", "Father's Name", "Mobile No", "Date of Joining", "Class"]),
    ).toEqual({
      Name: "name",
      "Father's Name": "fatherName",
      "Mobile No": "fatherContact",
      "Date of Joining": "admissionDate",
      Class: "schoolClass",
    });
  });

  it("ignores case, spaces and punctuation in a header", () => {
    expect(autoDetectMapping(["  STUDENT_NAME  "])["  STUDENT_NAME  "]).toBe("name");
    expect(autoDetectMapping(["Roll No."])["Roll No."]).toBe("code");
  });

  it("recognises the many things a centre calls a phone number", () => {
    for (const h of ["Phone", "Mobile", "WhatsApp", "Contact No", "Parent Mobile"]) {
      expect(autoDetectMapping([h])[h]).toBe("fatherContact");
    }
  });

  it("marks a column it does not understand as ignore, rather than guessing", () => {
    expect(autoDetectMapping(["Remarks"])).toEqual({ Remarks: "ignore" });
  });
});

describe("buildStudents — turning mapped rows into students", () => {
  it("splits a single full-name column into first and last", () => {
    const [s] = buildStudents([{ Name: "Aarav Kumar Sharma" }], { Name: "name" });
    expect(s).toMatchObject({ firstName: "Aarav", lastName: "Kumar Sharma" });
  });

  it("leaves a one-word name without inventing a surname", () => {
    const [s] = buildStudents([{ Name: "Aarav" }], { Name: "name" });
    expect(s).toMatchObject({ firstName: "Aarav", lastName: "" });
  });

  it("prefers explicit first/last columns over the split name", () => {
    const [s] = buildStudents(
      [{ Name: "Wrong Person", First: "Aarav", Last: "Sharma" }],
      { Name: "name", First: "firstName", Last: "lastName" },
    );
    expect(s).toMatchObject({ firstName: "Aarav", lastName: "Sharma" });
  });

  it("reads the dd/mm/yyyy dates an Indian list is written in", () => {
    const [s] = buildStudents([{ N: "Aarav", DOJ: "15/01/2026", DOB: "5-4-2016" }], {
      N: "name", DOJ: "admissionDate", DOB: "dob",
    });
    expect(s).toMatchObject({ admissionDate: "2026-01-15", dob: "2016-04-05" });
  });

  it("expands a two-digit year to this century", () => {
    const [s] = buildStudents([{ N: "Aarav", DOB: "12/04/16" }], { N: "name", DOB: "dob" });
    expect(s!.dob).toBe("2016-04-12");
  });

  it("reads a date Excel handed over as a serial number", () => {
    // 45672 is 2025-01-15 in Excel's 1900 system.
    const [s] = buildStudents([{ N: "Aarav", DOJ: 45672 }], { N: "name", DOJ: "admissionDate" });
    expect(s!.admissionDate).toBe("2025-01-15");
  });

  it("reads a real Date object from a parsed xlsx", () => {
    const [s] = buildStudents([{ N: "Aarav", DOB: new Date("2016-04-12T00:00:00Z") }], {
      N: "name", DOB: "dob",
    });
    expect(s!.dob).toBe("2016-04-12");
  });

  it("drops a row that is only a date — a date is not a student", () => {
    expect(buildStudents([{ DOB: "12/04/16" }], { DOB: "dob" })).toEqual([]);
  });

  it("leaves an unreadable date blank rather than filing a wrong one", () => {
    const [s] = buildStudents([{ Name: "Aarav", DOB: "sometime in April" }], {
      Name: "name", DOB: "dob",
    });
    expect(s!.dob).toBe("");
  });

  it("strips the ₹ and commas off a fee", () => {
    const [s] = buildStudents([{ N: "Aarav", Fee: "₹1,500" }], { N: "name", Fee: "monthlyFee" });
    expect(s!.monthlyFee).toBe(1500);
  });

  it("files an unreadable fee as zero, which falls back to the centre's flat fee", () => {
    const [s] = buildStudents([{ Name: "Aarav", Fee: "TBD" }], { Name: "name", Fee: "monthlyFee" });
    expect(s!.monthlyFee).toBe(0);
  });

  it("reads the shorthand a register uses for gender", () => {
    const rows = [{ N: "A", G: "M" }, { N: "B", G: "female" }, { N: "C", G: "?" }];
    const out = buildStudents(rows, { N: "name", G: "gender" });
    expect(out.map((s) => s.gender)).toEqual(["male", "female", ""]);
  });

  it("treats an unrecognised status as active rather than hiding the student", () => {
    const [s] = buildStudents([{ N: "A", S: "studying" }], { N: "name", S: "status" });
    expect(s!.status).toBe("active");
  });

  it("keeps a valid status", () => {
    const [s] = buildStudents([{ N: "A", S: "dropped" }], { N: "name", S: "status" });
    expect(s!.status).toBe("dropped");
  });

  it("copies the father's name and number into the parent fields reminders send to", () => {
    const [s] = buildStudents(
      [{ N: "Aarav", F: "Rohit Sharma", P: "9804243159" }],
      { N: "name", F: "fatherName", P: "fatherContact" },
    );
    expect(s).toMatchObject({ parentName: "Rohit Sharma", parentMobile: "9804243159" });
  });

  it("falls back to the mother when there is no father on the list", () => {
    const [s] = buildStudents(
      [{ N: "Aarav", M: "Sita Sharma", P: "9804243159" }],
      { N: "name", M: "motherName", P: "motherContact" },
    );
    expect(s).toMatchObject({ parentName: "Sita Sharma", parentMobile: "9804243159" });
  });

  it("carries the course text through for the importer to resolve to a level", () => {
    const [s] = buildStudents([{ N: "A", L: "Level 3" }], { N: "name", L: "course" });
    expect(s!._course).toBe("Level 3");
  });

  it("skips ignored and unmapped columns", () => {
    const [s] = buildStudents([{ N: "Aarav", R: "good boy", X: "?" }], { N: "name", R: "ignore" });
    expect(s).toMatchObject({ firstName: "Aarav" });
    expect(JSON.stringify(s)).not.toContain("good boy");
  });

  it("drops a row that identifies nobody — no name, no guardian, no number", () => {
    const rows = [{ N: "Aarav", P: "" }, { N: "", P: "" }, { N: "", P: "9804243159" }];
    const out = buildStudents(rows, { N: "name", P: "fatherContact" });
    expect(out).toHaveLength(2);
  });

  it("imports nothing from an empty sheet", () => {
    expect(buildStudents([], {})).toEqual([]);
  });
});

describe("parseStudentsFromSheet — import without the mapping step", () => {
  it("auto-detects the headers and builds usable students", () => {
    const out = parseStudentsFromSheet([
      { Name: "Aarav Sharma", "Father's Name": "Rohit Sharma", Mobile: "9804243159", "Date of Joining": "15/01/2026" },
    ]);
    expect(out[0]).toMatchObject({
      firstName: "Aarav", lastName: "Sharma",
      fatherName: "Rohit Sharma", parentMobile: "9804243159",
      admissionDate: "2026-01-15", status: "active",
    });
  });

  it("returns nothing for an empty sheet", () => {
    expect(parseStudentsFromSheet([])).toEqual([]);
  });
});

describe("parseStudentsCsv — re-importing our own export", () => {
  it("round-trips the downloadable template", () => {
    const out = parseStudentsCsv(studentTemplateCsv());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      code: "MMA-0001", firstName: "Aarav", lastName: "Sharma",
      monthlyFee: 500, gender: "male", status: "active",
      parentMobile: "9804243159", city: "Kolkata",
    });
  });

  it("keeps a quoted address containing a comma intact", () => {
    const csv = 'firstName,address\nAarav,"Barasat, Kolkata"';
    expect(parseStudentsCsv(csv)[0]!.address).toBe("Barasat, Kolkata");
  });

  it("ignores a column that is not one of ours", () => {
    const csv = "firstName,nonsense\nAarav,x";
    expect(parseStudentsCsv(csv)[0]).toMatchObject({ firstName: "Aarav" });
  });

  it("reads a header-only file as no students, not one blank one", () => {
    expect(parseStudentsCsv("firstName,lastName")).toEqual([]);
    expect(parseStudentsCsv("")).toEqual([]);
  });

  it("drops a row with neither a name nor a code", () => {
    const csv = "firstName,code,city\nAarav,,Kolkata\n,,Kolkata\n,MMA-2,Kolkata";
    expect(parseStudentsCsv(csv)).toHaveLength(2);
  });

  it("defaults a blank fee to zero rather than NaN", () => {
    expect(parseStudentsCsv("firstName,monthlyFee\nAarav,")[0]!.monthlyFee).toBe(0);
  });
});

describe("studentTemplateCsv", () => {
  it("ships a header row plus exactly one example", () => {
    expect(parseCsv(studentTemplateCsv())).toHaveLength(2);
  });

  it("fills every column it advertises", () => {
    const [header, example] = parseCsv(studentTemplateCsv());
    expect(example!.length).toBe(header!.length);
    expect(example!.every((c) => c.trim() !== "")).toBe(true);
  });
});
