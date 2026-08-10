/**
 * Every browser store this site writes itself is disclosed on `/legal/privacy`.
 *
 * The page had a table captioned "Cookies this site can set" and one sentence
 * of prose about the consent decision in `localStorage` — and it read as a
 * complete account of what this site puts in a browser. It was not one:
 * `src/lib/cart-store.tsx` has kept the basket in `sessionStorage` under
 * `plepic.basket` since the shop pages landed, and no word of the privacy
 * notice mentioned it. Nothing failed, because nothing asked.
 *
 * That is the same defect class as the five legal routes that served a
 * placeholder through three merged pull requests: the page answered, the page
 * looked complete, and no test compared it to what the application actually
 * does. So this guard does not check that a sentence exists — it derives the
 * set of stores from `src/` and requires a sentence per store.
 *
 * ## Why it walks the tree rather than naming the two files
 *
 * A hand-written list cannot fail on a file nobody added to it, and this
 * repository has already shipped one guard that was inert for exactly that
 * reason (see `tests/helpers/source-files.ts`). A third store added in a third
 * file is precisely the event this test exists to catch, so the list of files
 * is a `readdir` and the list of store kinds is whatever that walk finds.
 *
 * ## Why `document.cookie` is an assertion and not a mapping
 *
 * The cookie table names three cookies and every one of them is set by a
 * third-party script, not by this application. If `src/` ever writes a cookie
 * itself, the honest disclosure is a fourth **row** with a provider and a
 * duration, not a fourth sentence — a different edit, on a page carrying two
 * qualified-reader reviews. This guard therefore fails rather than guessing.
 */
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { privacy } from "../../content/legal/privacy.js";
import { listSourceFiles } from "./helpers/source-files.js";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(storefrontDir, "src");

/**
 * Comments are prose about the code, not the code. `cart-store.tsx` discusses
 * `sessionStorage` in four paragraphs of doc comment, and a scan that counted
 * those would pass on a file that had stopped writing anything at all.
 */
function withoutComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, " ").replaceAll(/\/\/[^\n]*/g, " ");
}

/** The Web Storage areas, as the privacy page has to describe them to a reader. */
const STORAGE_DISCLOSURES = {
  localStorage: "in your browser's local storage rather than as a cookie",
  sessionStorage: "in your browser's session storage rather than as a cookie",
} as const;

type StorageArea = keyof typeof STORAGE_DISCLOSURES;

const writers = new Map<StorageArea, string[]>();
const cookieWriters: string[] = [];

for (const file of listSourceFiles(srcDir)) {
  const code = withoutComments(readFileSync(file, "utf8"));
  const name = relative(storefrontDir, file);

  for (const area of Object.keys(STORAGE_DISCLOSURES) as readonly StorageArea[]) {
    // `window.sessionStorage.setItem(`, `sessionStorage.setItem(`, and the
    // `.removeItem(`/`.clear()` forms that imply the same store is in use.
    if (new RegExp(String.raw`\b${area}\s*\.\s*(setItem|removeItem|clear)\s*\(`).test(code)) {
      writers.set(area, [...(writers.get(area) ?? []), name]);
    }
  }

  if (/\bdocument\s*\.\s*cookie\s*=/.test(code)) cookieWriters.push(name);
}

/** The prose above the table — where a non-cookie store is disclosed. */
const consentSection = privacy.body.find((section) => section.anchor === "consent");
const consentProse = (consentSection?.body ?? []).join("\n");

describe("the privacy notice accounts for every browser store this site writes", () => {
  it("scanned the source tree and found stores to check", () => {
    // Lesson: a guard that silently found nothing is not a guard. If the walk
    // stops matching — a refactor behind a helper, a renamed API — this fails
    // instead of passing vacuously.
    expect(
      [...writers.keys()].toSorted(),
      "the scan found no Web Storage writes at all, so every assertion below is vacuous",
    ).toEqual(["localStorage", "sessionStorage"]);
  });

  it("discloses each one in prose, in the consent section, above the table", () => {
    expect(consentSection, "the consent section is gone").toBeDefined();

    for (const [area, files] of writers) {
      expect(
        consentProse,
        `${files.join(", ")} writes ${area} and /legal/privacy never says so`,
      ).toContain(STORAGE_DISCLOSURES[area]);
    }
  });

  it("says what the basket store holds and how long it lasts, not merely that it exists", () => {
    /*
     * Checked against a running build rather than against a comment: after
     * adding the game to the basket, `sessionStorage` held
     * `{"plepic.basket":"[{\"id\":\"lunar-base\",\"quantity\":1}]"}` — a
     * product id and an integer, no price, no address, nothing about a person
     * — with `localStorage` holding only the consent decision and
     * `document.cookie` empty. The three claims below are that observation.
     */
    expect(consentProse).toContain(
      "The contents of your basket are stored by this site in your browser's session storage " +
        "rather than as a cookie. It is kept only until you close the tab, and it records nothing " +
        "but which game you chose and how many.",
    );
  });

  it("keeps the two non-cookie stores out of the cookie table", () => {
    /*
     * The operator's decision of 2026-08-10, and the structure the page
     * depends on: the table is cookies, everything else this site stores is
     * prose above it. A store moved into the table would have three of its
     * four columns empty and would claim a provider it does not have.
     */
    const table = consentSection?.table;
    expect(table?.caption, "the caption a second reader relied on moved").toBe(
      "Cookies this site can set",
    );
    expect(table?.columns).toEqual(["Cookie", "Provider", "Purpose", "Duration"]);

    const tableText = [...(table?.rows ?? []).flat(), ...(table?.notes ?? [])].join("\n");
    expect(tableText).not.toMatch(/session storage|local storage/i);
  });

  it("fails rather than guessing if this site ever sets a cookie of its own", () => {
    expect(
      cookieWriters,
      "src/ writes document.cookie: the cookie table needs a row with a provider and a " +
        "duration, which is an operator decision on a twice-reviewed legal page, not a " +
        "sentence this guard can infer",
    ).toEqual([]);
  });
});
