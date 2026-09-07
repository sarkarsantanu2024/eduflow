import { describe, it, expect } from "vitest";
import { parseCsv, toCsv } from "./csv";

/**
 * Every bulk import and every export goes through here. A quoting mistake in
 * `toCsv` silently corrupts a downloaded fee register; a parsing mistake in
 * `parseCsv` shifts a whole spreadsheet one column left and files phone
 * numbers under addresses.
 */

describe("parseCsv", () => {
  it("reads a plain sheet", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("reads Windows line endings, which is what Excel writes", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a comma that lives inside a quoted address", () => {
    expect(parseCsv('name,address\nAarav,"Barasat, Kolkata"')).toEqual([
      ["name", "address"],
      ["Aarav", "Barasat, Kolkata"],
    ]);
  });

  it("unescapes a doubled quote", () => {
    expect(parseCsv('note\n"He said ""hi"""')).toEqual([["note"], ['He said "hi"']]);
  });

  it("keeps a newline inside a quoted field instead of splitting the row", () => {
    expect(parseCsv('name,note\nAarav,"line one\nline two"')).toEqual([
      ["name", "note"],
      ["Aarav", "line one\nline two"],
    ]);
  });

  it("keeps empty cells so later columns do not shift left", () => {
    expect(parseCsv("a,b,c\n1,,3")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ]);
  });

  it("drops the blank trailing line a spreadsheet leaves behind", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops a row of nothing but separators", () => {
    expect(parseCsv("a,b\n,,\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns nothing for an empty file rather than one phantom row", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("\n\n")).toEqual([]);
  });

  it("reads the last row when the file has no trailing newline", () => {
    expect(parseCsv("a\n1")).toEqual([["a"], ["1"]]);
  });
});

describe("toCsv", () => {
  it("writes CRLF, which every Indian centre's Excel expects", () => {
    expect(toCsv([["a", "b"], [1, 2]])).toBe("a,b\r\n1,2");
  });

  it("quotes a value containing a comma", () => {
    expect(toCsv([["Barasat, Kolkata"]])).toBe('"Barasat, Kolkata"');
  });

  it("doubles an embedded quote", () => {
    expect(toCsv([['He said "hi"']])).toBe('"He said ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(toCsv([["line one\nline two"]])).toBe('"line one\nline two"');
  });

  it("leaves an ordinary value unquoted", () => {
    expect(toCsv([["Aarav", 500]])).toBe("Aarav,500");
  });

  it("writes a blank for a missing cell rather than the word null", () => {
    expect(toCsv([[null as unknown as string, undefined as unknown as string]])).toBe(",");
  });
});

describe("round trip", () => {
  it("survives the values that actually break CSV", () => {
    const rows = [
      ["name", "address", "note"],
      ["Aarav Sharma", "Barasat, Kolkata", 'said "ok"'],
      ["Bina Das", "line one\nline two", ""],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
