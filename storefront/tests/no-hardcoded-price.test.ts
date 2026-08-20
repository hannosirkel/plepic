/**
 * "Render every price and availability string from data, never hardcoded.
 * The €25 in the homepage CTA is content bound to the catalogue, not a
 * literal." — this scans `src/` for a literal price string outside the one
 * place a price is allowed to be a literal: `src/lib/catalogue.ts`, which
 * reads it out of `storefront/mock/catalogue.json` and nowhere else.
 *
 * A component that needs a price must call `resolveCatalogue()` /
 * `resolveCataloguePlaceholders()` and render the result — never write
 * "€25", "25.00" or "2500" itself. This is what makes the mock catalogue
 * mechanically authoritative rather than a convention someone could quietly
 * break in a future edit.
 *
 * ## A tax **rate** is the second literal this file refuses, 2026-08-18
 *
 * `PRICE_PATTERNS` did not catch one, and after the price became net that
 * mattered a great deal more than it had. VAT is added rather than contained,
 * so the difference between the two figures this shop quotes is a rate — and
 * the shortest way to produce the wrong one of them is to write `* 1.24`
 * somewhere. **No rate exists in this workspace and none may be introduced:**
 * `backend/src/commerce/tax-model.ts` declares it, Medusa applies it, and
 * `storefront/src/` displays whichever of the two amounts Medusa returned that
 * the destination calls for.
 *
 * {@link TAX_RATE_PATTERNS} is the guard for that, and it differs from the
 * price patterns in two ways that are both deliberate.
 *
 * - **It applies to `src/lib/catalogue.ts` too.** That file is exempted from
 *   the price patterns because it is the one place a figure may be read from
 *   the catalogue; it is exempted from nothing here, because a rate is not a
 *   figure it is allowed to know either. It formats
 *   `product.price.vatRatePercent`, which is data.
 * - **It is context-sensitive rather than a bare number scan.** A two-digit
 *   number in the plausible VAT band is unremarkable on its own — a duration,
 *   a breakpoint, a count — and so is a decimal in that band, which is an
 *   opacity or a line height as often as it is a multiplier. So **both** forms
 *   are an offence only within sixty characters of a word about tax, on the
 *   same line.
 *
 * The cost of that narrowness is stated rather than hidden, because an earlier
 * revision of this comment overstated the guard: it claimed a decimal
 * multiplier was "refused outright", which was never true of either pattern.
 * A multiplier with no tax word within reach — `const grossed = net * 1.24` —
 * walks past this, as does a rate computed from two variables or assembled
 * from a string. In practice the name of the thing being assigned usually
 * gives it away (`withTax` contains `tax`), which is why the guard catches
 * more than the patterns strictly promise; that is luck, not design, and the
 * test below pins both the luck and the gap. It is a floor, like
 * every other scan in this suite. What it catches is the shape the mistake
 * actually takes — a rate written next to the word it is a rate *of*.
 */
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { listSourceFiles } from "./helpers/source-files.js";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(storefrontDir, "src");

/** The only file allowed to know the catalogue's literal price figures. */
const ALLOWED_SOURCE = join(srcDir, "lib", "catalogue.ts");

/**
 * Price-shaped literals: a euro sign followed by digits, "25.00" (the
 * frozen figure, decimal form), or the raw minor-units integer "2500" next
 * to something that reads as a price context. The minor-units check is
 * narrower (word-boundaried, not just "contains 2500") so it does not flag
 * an unrelated four-digit number (a year, a byte count) that happens to
 * share those digits.
 */
const PRICE_PATTERNS: readonly RegExp[] = [/€\s*\d/, /\b25\.00\b/, /\b2500\b(?=.*(?:price|amount|cent))/i];

/** A word that puts a number in a tax context. */
const TAX_CONTEXT = String.raw`(?:vat|tax|k\u00e4ibemaks)`;

/**
 * A VAT rate as it would plausibly be written: a percentage in the band EU
 * rates occupy, or the multiplier form of one.
 */
const TAX_RATE = String.raw`(?:[01]\.[12]\d\b|\b(?:1\d|2\d)\s*(?:%|percent))`;

/**
 * A rate literal **in a tax context** — see this file's doc comment for what
 * this deliberately does and does not catch.
 */
const TAX_RATE_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`${TAX_CONTEXT}[^\n]{0,60}?${TAX_RATE}`, "i"),
  new RegExp(String.raw`${TAX_RATE}[^\n]{0,60}?${TAX_CONTEXT}`, "i"),
];

describe("no hardcoded price literal outside src/lib/catalogue.ts", () => {
  const files = listSourceFiles(srcDir).filter((file) => file !== ALLOWED_SOURCE);

  it("scanned a plausible number of files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    it(`${relative(storefrontDir, file)} contains no price literal`, () => {
      const source = readFileSync(file, "utf8");
      const offenders = PRICE_PATTERNS.filter((pattern) => pattern.test(source));
      expect(
        offenders,
        "a price must be read from src/lib/catalogue.ts (resolveCatalogue / resolveCataloguePlaceholders), " +
          "never written as a literal — the €25 in a call to action is content bound to the catalogue",
      ).toEqual([]);
    });
  }

  it("has teeth: flags a literal price if one is introduced", () => {
    expect(PRICE_PATTERNS.some((pattern) => pattern.test("Buy for €25.00 today"))).toBe(true);
    expect(PRICE_PATTERNS.some((pattern) => pattern.test("Buy for {price}"))).toBe(false);
  });

  it("src/lib/catalogue.ts is exempted because it is the one place the figure is allowed to live", () => {
    const source = readFileSync(ALLOWED_SOURCE, "utf8");
    expect(source).toContain("25");
  });
});

describe("no VAT rate literal anywhere in src/, catalogue.ts included", () => {
  // Every file, with no exemption: see this file's doc comment. The rate is
  // declared in backend/src/commerce/tax-model.ts and applied by Medusa; this
  // workspace states it from data and never multiplies by it.
  const files = listSourceFiles(srcDir);

  it("scanned a plausible number of files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    it(`${relative(storefrontDir, file)} contains no tax rate literal`, () => {
      const source = readFileSync(file, "utf8");
      const offenders = TAX_RATE_PATTERNS.filter((pattern) => pattern.test(source));
      expect(
        offenders,
        "a VAT rate must never be written in the storefront. Medusa returns both the amount with " +
          "tax and the amount without it; src/lib/catalogue.ts picks one on the destination. The " +
          "rate itself is declared once, in backend/src/commerce/tax-model.ts, and the figure the " +
          "copy quotes comes from the catalogue as data",
      ).toEqual([]);
    });
  }

  it("has teeth: flags the shapes a rate is actually written in", () => {
    const caught = (text: string) => TAX_RATE_PATTERNS.some((pattern) => pattern.test(text));

    expect(caught("const VAT_RATE = 0.24;")).toBe(true);
    expect(caught("const withTax = Math.round(net * 1.24); // Estonian VAT")).toBe(true);
    expect(caught("VAT at 24%")).toBe(true);
    // A multiplier is caught whenever anything within reach names the tax,
    // which in practice includes the variable it is assigned to.
    expect(caught("const withTax = net * 1.24;")).toBe(true);

    // The two documented gaps, asserted as gaps so the comment above cannot
    // drift into claiming more than the patterns do.
    expect(caught("const rate = 24; // tax")).toBe(false);
    expect(caught("const grossed = net * 1.24;")).toBe(false);
    expect(caught("Includes VAT at 24 percent")).toBe(true);

    // And what it must not flag.
    expect(caught("Includes VAT at {vatRate}")).toBe(false);
    expect(caught("catalogue.priceTaxQualifier")).toBe(false);
    expect(caught("grid-template-columns: 24px;")).toBe(false);
    expect(caught("delivery inside the European Union usually takes 3 to 7 days")).toBe(false);
  });
});
