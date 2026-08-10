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
 * reason (see `tests/helpers/source-files.ts`). The `readdir` is what makes
 * every check below independent of *where* a write lives, so a cookie set from
 * a file added next week is treated exactly as one added here would be — for
 * the forms this scan recognises, which is the caveat the rest of this comment
 * is about.
 *
 * ## This is a floor, not a proof, and the difference has already cost two passes
 *
 * **Read the list below as what is *known* to escape, never as what *can*.**
 * Two revisions of this record have now claimed a completeness they could not
 * have: the first said a third store "cannot be added without the notice
 * growing with it"; the second admitted "two things it does not see" and
 * presented that pair as the whole set. Review then demonstrated a third
 * escape, and a fourth, in the half each revision was most confident about.
 * **A passing run here is evidence that the known forms are absent. It is not
 * evidence that nothing is stored and nothing is set.**
 *
 * Known escapes, each demonstrated rather than reasoned about:
 *
 * 1. **A store outside Web Storage and cookies.** IndexedDB, Cache Storage and
 *    the rest are invisible to the scan below.
 * 2. **A new key in an area already disclosed** — a live hazard rather than a
 *    curiosity. `/legal/privacy` says the basket store "records nothing but
 *    which game you chose and how many", which is operator-approved copy. A
 *    second `sessionStorage` key holding a shipping address, an email address
 *    or an order draft — the obvious shape of Task 5's checkout — makes that
 *    sentence false. The write-site assertion below narrows this: a *new
 *    module* writing storage is now caught. A second key inside
 *    `cart-store.tsx` itself is not, because the write is
 *    `setItem(STORAGE_KEY, …)` — an identifier — and naming permitted keys
 *    statically needs constant resolution this scan does not do. Deferred
 *    deliberately; see `README.md` and `src/lib/cart-store.tsx`.
 * 3. **A cookie written through a form not in `COOKIE_WRITE_FORMS`.** The
 *    aliased receiver — `const jar = document; jar.cookie = …` — is green today
 *    and is the honest example: no text scan follows an assignment. Server-set
 *    cookies via `next/headers` and `NextResponse` *are* caught now, after
 *    review pass 2 showed both passing green.
 *
 * ## Why cookies are an assertion and not a mapping
 *
 * The cookie table names three cookies and every one of them is set by a
 * third-party script, not by this application. If `src/` writes a cookie
 * itself, the honest disclosure is a fourth **row** with a provider and a
 * duration, not a fourth sentence — a different edit, on a page carrying two
 * qualified-reader reviews. This guard therefore fails rather than guessing,
 * on every form it knows.
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

/**
 * The cookie-writing forms this scan knows, each with the name it reports.
 *
 * The first revision knew only the client-side assignment, and review pass 2
 * demonstrated the gap: `const jar = await cookies(); jar.set(…)` from
 * `next/headers` and `response.cookies.set(…)` on a `NextResponse` both passed
 * green. Neither is hypothetical here — `src/app/layout.tsx`, `src/app/robots.ts`,
 * `src/lib/request-host.ts` and `src/lib/nonce.ts` already import `next/headers`,
 * `src/proxy.ts` already holds a `NextResponse`, and Task 5's Medusa checkout is
 * precisely the unit that would persist a cart id as a server-set cookie.
 *
 * A server-set first-party cookie is the worst case this file has, because the
 * disclosure it falsifies is a **table** captioned "Cookies this site can set"
 * rather than a sentence.
 */
const COOKIE_WRITE_FORMS: readonly (readonly [string, RegExp])[] = [
  ["a `document.cookie` assignment", /\bdocument\s*\.\s*cookie\s*=/],
  [
    "`.cookies.set(`/`.delete(` on a NextRequest or NextResponse cookie jar",
    /\.\s*cookies\s*\.\s*(?:set|delete)\s*\(/,
  ],
  ["a direct `cookies().set(`", /\bcookies\s*\(\s*\)\s*\.\s*(?:set|delete)\s*\(/],
];

/**
 * The `next/headers` accessor bound to a name first — the form review pass 2
 * used, and the one no single expression catches, because `jar` could be
 * anything.
 *
 * So it is a two-part signal: the file imports `cookies` from `next/headers`,
 * **and** it calls `.set(`/`.delete(` on something. That is deliberately
 * conservative. It can in principle fire on a file that imports `cookies` for
 * reading and happens to call `Map.prototype.set` — no file in `src/` does
 * today, and the four that import `next/headers` contain no `.set(` at all —
 * and if one ever does, the cost is a loud failure a human resolves in a
 * minute. The cost of the opposite error is a first-party cookie with no row in
 * a twice-reviewed legal table, silently, which is the defect this file exists
 * to prevent. The asymmetry is the whole argument.
 */
const IMPORTS_COOKIES_FROM_NEXT_HEADERS =
  /import[\s\S]{0,200}?\bcookies\b[\s\S]{0,200}?from\s*["']next\/headers["']/;
const CALLS_SET_OR_DELETE = /\.\s*(?:set|delete)\s*\(/;

const writers = new Map<StorageArea, string[]>();
const cookieWriters: { file: string; form: string }[] = [];

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

  for (const [form, pattern] of COOKIE_WRITE_FORMS) {
    if (pattern.test(code)) cookieWriters.push({ file: name, form });
  }

  if (IMPORTS_COOKIES_FROM_NEXT_HEADERS.test(code) && CALLS_SET_OR_DELETE.test(code)) {
    cookieWriters.push({
      file: name,
      form: "`cookies()` imported from `next/headers` in a file that calls `.set(`/`.delete(`",
    });
  }
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

  it("fails rather than guessing on every cookie-write form it knows", () => {
    expect(
      cookieWriters,
      "src/ writes a first-party cookie. The table captioned \"Cookies this site can set\" " +
        "would need a fourth row with a provider and a duration — an operator decision on a " +
        "twice-reviewed legal page, not a sentence this guard can infer. Note this check " +
        "knows the forms listed in COOKIE_WRITE_FORMS above and is not exhaustive: it is a " +
        "floor, so passing it is not evidence that no cookie is set.",
    ).toEqual([]);
  });

  it("pins which file writes each store, so a new write site has to be a decision", () => {
    /*
     * MIN-C of review pass 2. The full hazard is a new *key* in an area already
     * disclosed, and a key-level assertion is genuinely out of reach here: the
     * write is `sessionStorage.setItem(STORAGE_KEY, …)`, an identifier, so
     * naming permitted keys statically needs constant resolution this scan does
     * not do.
     *
     * The cheap partial does not need it. Pinning the *files* costs one
     * assertion and catches the shape the escape actually took when it was
     * demonstrated — a second module deciding to persist something of its own.
     * It is a partial and is recorded as one: a second key added inside one of
     * the files below still passes, and that residue is deferred deliberately
     * rather than overlooked. See this file's doc comment.
     */
    expect(
      Object.fromEntries([...writers].map(([area, files]) => [area, files.toSorted()])),
      "a module other than the two below now writes browser storage. That is a disclosure " +
        "question before it is a code question: /legal/privacy describes what each store holds, " +
        "and a new writer is how that description silently stops being true",
    ).toEqual({
      localStorage: ["src/components/analytics/ConsentManager.tsx"],
      sessionStorage: ["src/lib/cart-store.tsx"],
    });
  });
});
