import { describe, it, expect } from "vitest";
import { waPhone, waLink, renderTemplate } from "./wa-link";

/**
 * WhatsApp is the entire delivery channel — fee reminders, absence alerts,
 * result cards, birthday wishes. A number normalised wrong opens a chat with
 * nobody, and the owner has no way to tell that the parent never got it.
 */

describe("waPhone — turning what an owner typed into a wa.me number", () => {
  it("adds the country code to a plain 10-digit mobile", () => {
    expect(waPhone("9804243159")).toBe("919804243159");
  });

  it("strips the spaces, dashes and brackets people paste in", () => {
    expect(waPhone("98042-43159")).toBe("919804243159");
    expect(waPhone("(980) 424 3159")).toBe("919804243159");
  });

  it("keeps a number that already carries +91", () => {
    expect(waPhone("+91 98042 43159")).toBe("919804243159");
  });

  it("drops the STD zero before adding the country code", () => {
    expect(waPhone("09804243159")).toBe("919804243159");
  });

  it("returns blank for no number, so the caller can skip the send", () => {
    expect(waPhone("")).toBe("");
    expect(waPhone("   ")).toBe("");
    expect(waPhone("not a phone")).toBe("");
  });

  it("leaves an unrecognised length alone rather than mangling it into a wrong number", () => {
    expect(waPhone("12345")).toBe("12345");
  });
});

describe("waLink", () => {
  it("addresses the parent and pre-fills the message", () => {
    expect(waLink("9804243159", "Fees due")).toBe("https://wa.me/919804243159?text=Fees%20due");
  });

  it("escapes the characters a fee reminder actually contains", () => {
    const link = waLink("9804243159", "₹500 due — pay & confirm?");
    expect(link).toContain("%E2%82%B9500");
    expect(link).toContain("%26"); // & must not start a new query param
    expect(link).not.toMatch(/[?&]confirm/);
  });

  it("still opens WhatsApp with the text when no number is on file", () => {
    // Better that the owner picks the contact by hand than nothing happening.
    expect(waLink("", "Fees due")).toBe("https://wa.me/?text=Fees%20due");
  });
});

describe("renderTemplate — filling a WhatsApp template", () => {
  it("substitutes every placeholder", () => {
    expect(
      renderTemplate("Dear {{parent_name}}, {{student_name}} owes ₹{{amount}}.", {
        parent_name: "Rohit",
        student_name: "Aarav",
        amount: 500,
      }),
    ).toBe("Dear Rohit, Aarav owes ₹500.");
  });

  it("tolerates the spacing owners type inside the braces", () => {
    expect(renderTemplate("Hi {{ parent_name }}", { parent_name: "Rohit" })).toBe("Hi Rohit");
  });

  it("leaves an unknown placeholder visible rather than sending the word undefined", () => {
    expect(renderTemplate("Hi {{nickname}}", { parent_name: "Rohit" })).toBe("Hi {{nickname}}");
  });

  it("substitutes a zero rather than treating it as missing", () => {
    expect(renderTemplate("Balance ₹{{amount}}", { amount: 0 })).toBe("Balance ₹0");
  });

  it("replaces every occurrence, not just the first", () => {
    expect(renderTemplate("{{n}} and {{n}}", { n: "x" })).toBe("x and x");
  });

  it("passes an empty template straight through", () => {
    expect(renderTemplate("", { a: 1 })).toBe("");
  });
});
