import { describe, it, expect } from "vitest";
import {
  SECTORS, ALL_MODULES, MODULE_LABELS, BUSINESS_TYPES,
  getSector, getLabels, isModuleEnabled, getFaqs,
} from "./sectors";

/**
 * The sector registry decides what a centre is *called* and which modules it
 * even sees. A missing fallback here does not throw — it renders a yoga centre
 * as an abacus one, or blanks the sidebar, which is worse because nobody
 * reports it as an error.
 */

describe("getSector", () => {
  it("finds a configured sector", () => {
    expect(getSector("abacus").value).toBe("abacus");
  });

  it("falls back to the generic sector for an unknown or missing type", () => {
    // A centre created before a sector existed, or a typo in the profile,
    // must still render — never crash and never blank the app.
    expect(getSector("underwater-basket-weaving").value).toBe("other");
    expect(getSector(undefined).value).toBe("other");
    expect(getSector("").value).toBe("other");
  });
});

describe("getLabels — the terminology a centre reads everywhere", () => {
  it("gives every sector a full set of non-empty labels", () => {
    for (const s of SECTORS) {
      const labels = getLabels(s.value);
      for (const [key, value] of Object.entries(labels)) {
        expect(value, `${s.value}.${key}`).toBeTruthy();
      }
    }
  });

  it("relabels the member noun per sector rather than saying Student everywhere", () => {
    const nouns = new Set(SECTORS.map((s) => getLabels(s.value).member));
    expect(nouns.size).toBeGreaterThan(1);
  });

  it("falls back to generic terminology for an unknown type", () => {
    expect(getLabels("nope")).toEqual(getLabels("other"));
  });
});

describe("isModuleEnabled", () => {
  it("switches a module on for a sector that declares it", () => {
    const sector = SECTORS.find((s) => s.modules.length > 0)!;
    expect(isModuleEnabled(sector.value, sector.modules[0]!)).toBe(true);
  });

  it("switches off a module the sector does not declare", () => {
    const sector = SECTORS.find((s) => s.modules.length < ALL_MODULES.length)!;
    const missing = ALL_MODULES.find((m) => !sector.modules.includes(m))!;
    expect(isModuleEnabled(sector.value, missing)).toBe(false);
  });

  it("does not throw for an unknown sector", () => {
    expect(() => isModuleEnabled("nope", "attendance")).not.toThrow();
  });
});

describe("registry integrity", () => {
  it("has no duplicate sector values — a duplicate silently shadows one", () => {
    const values = SECTORS.map((s) => s.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("ships the generic fallback sector the lookups depend on", () => {
    expect(SECTORS.some((s) => s.value === "other")).toBe(true);
  });

  it("declares only modules the app actually has", () => {
    for (const s of SECTORS) {
      for (const m of s.modules) expect(ALL_MODULES, s.value).toContain(m);
    }
  });

  it("labels every module, so none renders as blank in the profile preview", () => {
    for (const m of ALL_MODULES) expect(MODULE_LABELS[m]).toBeTruthy();
  });

  it("offers every sector in the business-type dropdown", () => {
    expect(BUSINESS_TYPES.map((b) => b.value)).toEqual(SECTORS.map((s) => s.value));
    for (const b of BUSINESS_TYPES) expect(b.label).toBeTruthy();
  });

  it("gives every sector sample courses and templates for 'Load sample data'", () => {
    for (const s of SECTORS) {
      expect(s.seedCourses.length, `${s.value} courses`).toBeGreaterThan(0);
      expect(s.seedTemplates.length, `${s.value} templates`).toBeGreaterThan(0);
      for (const c of s.seedCourses) expect(c.name, s.value).toBeTruthy();
      for (const t of s.seedTemplates) {
        expect(t.name, s.value).toBeTruthy();
        expect(t.type, s.value).toBeTruthy();
        expect(t.body, s.value).toBeTruthy();
      }
    }
  });

  it("leaves no unfilled placeholder token in a seeded template body", () => {
    // A template that ships with a broken {{token}} — a single brace, or an
    // empty one — sends the parent literal punctuation. Remove every
    // well-formed token; anything brace-shaped left behind is a typo.
    for (const s of SECTORS) {
      for (const t of s.seedTemplates) {
        const leftovers = t.body.replace(/\{\{\s*\w+\s*\}\}/g, "");
        expect(leftovers, `${s.value}/${t.name}`).not.toMatch(/[{}]/);
      }
    }
  });
});

describe("getFaqs", () => {
  it("returns the shared FAQs plus that sector's own", () => {
    const other = getFaqs("other");
    const abacus = getFaqs("abacus");
    expect(other.length).toBeGreaterThan(0);
    expect(abacus.length).toBeGreaterThanOrEqual(other.length);
  });

  it("answers every question it asks", () => {
    for (const s of SECTORS) {
      for (const f of getFaqs(s.value)) {
        expect(f.q, s.value).toBeTruthy();
        expect(f.a, s.value).toBeTruthy();
      }
    }
  });

  it("still returns the common FAQs for an unknown sector", () => {
    expect(getFaqs("nope")).toEqual(getFaqs("other"));
  });
});
