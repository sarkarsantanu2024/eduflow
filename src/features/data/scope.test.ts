import { describe, expect, it } from "vitest";
import { EMPTY_DB, EMPTY_PROFILE, type CollectionName, type Db } from "@/lib/store/types";
import {
  OWNER_ONLY_PROFILE_FIELDS,
  TEACHER_VISIBLE_COLLECTIONS,
  roleMayRead,
  scopeDbForRole,
  scopeProfileForRole,
} from "./scope";

const ALL_COLLECTIONS = Object.keys(EMPTY_DB).filter((k) => k !== "profile") as CollectionName[];
const MONEY: CollectionName[] = ["fees", "payments", "expenses", "materials", "stationery", "adMaterials"];

/** A Db with one row in every collection and a fully populated profile. */
function populated(): Db {
  const db = { ...EMPTY_DB } as unknown as Record<string, unknown>;
  for (const name of ALL_COLLECTIONS) db[name] = [{ id: `${name}-1` }];
  db.profile = {
    ...EMPTY_PROFILE,
    businessName: "Bright Minds Abacus",
    businessType: "abacus",
    ownerName: "Rina Das",
    phone: "9830000000",
    gst: "19ABCDE1234F1Z5",
    upiId: "rina@upi",
    qrImage: "data:image/png;base64,xxx",
    monthlyFee: 800,
    admissionFee: 500,
    reactivationFee: 200,
    hoRoyaltyPerStudent: 50,
    hoRoyaltyPercent: 10,
    recurringCharges: [{ id: "rc1", name: "HO royalty", amount: 50 } as never],
  };
  return db as unknown as Db;
}

describe("roleMayRead", () => {
  it("owners read everything", () => {
    for (const role of ["institute_admin", "super_admin", "org_admin"]) {
      for (const name of ALL_COLLECTIONS) expect(roleMayRead(role, name), `${role}/${name}`).toBe(true);
    }
  });

  it.each(MONEY)("a teacher never reads %s", (name) => {
    expect(roleMayRead("teacher", name)).toBe(false);
  });

  it("a teacher never reads staff, templates, certificates or exam registrations", () => {
    for (const name of ["teachers", "templates", "certificates", "examRegs"] as CollectionName[]) {
      expect(roleMayRead("teacher", name), name).toBe(false);
    }
  });

  it.each(TEACHER_VISIBLE_COLLECTIONS)("a teacher reads %s (their screens need it)", (name) => {
    expect(roleMayRead("teacher", name)).toBe(true);
  });

  it("the teacher list is exactly the complement of the hidden set", () => {
    const hidden = ALL_COLLECTIONS.filter((n) => !roleMayRead("teacher", n)).sort();
    expect(hidden).toEqual(
      ["adMaterials", "certificates", "examRegs", "expenses", "fees", "materials", "payments", "stationery", "teachers", "templates"].sort(),
    );
  });

  it("a parent or an unknown role reads nothing", () => {
    for (const name of ALL_COLLECTIONS) {
      expect(roleMayRead("parent", name)).toBe(false);
      expect(roleMayRead("something-new", name)).toBe(false);
    }
  });
});

describe("scopeProfileForRole", () => {
  it("strips money and tax identity for a teacher, keeps the public identity", () => {
    const scoped = scopeProfileForRole("teacher", populated().profile, EMPTY_PROFILE);
    expect(scoped.businessName).toBe("Bright Minds Abacus");
    expect(scoped.businessType).toBe("abacus");
    expect(scoped.ownerName).toBe("Rina Das");
    expect(scoped.phone).toBe("9830000000");
    for (const field of OWNER_ONLY_PROFILE_FIELDS) {
      expect(scoped[field], String(field)).toEqual(EMPTY_PROFILE[field]);
    }
  });

  it("returns the owner's profile untouched, by reference", () => {
    const profile = populated().profile;
    expect(scopeProfileForRole("institute_admin", profile, EMPTY_PROFILE)).toBe(profile);
  });
});

describe("scopeDbForRole", () => {
  it("empties every hidden collection for a teacher and leaves the visible ones", () => {
    const scoped = scopeDbForRole("teacher", populated(), EMPTY_DB);
    for (const name of ALL_COLLECTIONS) {
      expect(scoped[name].length, name).toBe(TEACHER_VISIBLE_COLLECTIONS.includes(name) ? 1 : 0);
    }
    expect(scoped.profile.upiId).toBe("");
    expect(scoped.profile.gst).toBe("");
  });

  it("never grows the payload: nothing a teacher receives is absent for the owner", () => {
    const full = populated();
    const scoped = scopeDbForRole("teacher", full, EMPTY_DB);
    for (const name of ALL_COLLECTIONS) {
      expect(scoped[name].length).toBeLessThanOrEqual(full[name].length);
    }
  });

  it("returns the owner's Db untouched, by reference", () => {
    const full = populated();
    expect(scopeDbForRole("institute_admin", full, EMPTY_DB)).toBe(full);
    expect(scopeDbForRole("org_admin", full, EMPTY_DB)).toBe(full);
  });

  it("hands a parent an empty centre", () => {
    const scoped = scopeDbForRole("parent", populated(), EMPTY_DB);
    for (const name of ALL_COLLECTIONS) expect(scoped[name]).toEqual([]);
  });
});
