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
