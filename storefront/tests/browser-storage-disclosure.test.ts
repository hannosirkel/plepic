/**
 * Every browser store this site writes itself is disclosed on `/legal/privacy`.
 *
 * The page had a table captioned "Cookies this site can set" and one sentence
 * of prose about the consent decision in `localStorage` — and it read as a
 * complete account of what this site puts in a browser. It was not one:
 * `src/lib/cart-store.tsx` keeps only an opaque cart identifier in
 * `sessionStorage`, and no word of the privacy
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
 *    curiosity. `/legal/privacy` says the basket store records only
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
 * ## Why cookies are a pinned list and not a mapping
 *
 * The cookie table used to name three cookies, every one of them set by a
 * third-party script rather than by this application, and this guard simply
 * required `src/` to write **none**. That is no longer true, and the change is
 * the one the earlier revision predicted:
 * `src/components/shop/DestinationSelector.tsx` sets `plepic_destination`,
 * because the advertised price became destination-dependent and a
 * server-rendered figure needs a destination the server can read.
 *
 * The guard did not become a mapping from writes to rows, because it cannot be
 * one — a text scan does not resolve `DESTINATION_COOKIE_NAME` to
 * `"plepic_destination"`. It does two things instead, which together cost a
 * decision:
 *
 * 1. the set of files that write a cookie is **pinned**, exactly as the Web
 *    Storage writers are, so a second module setting one goes red; and
 * 2. every published edition's cookie table is required to carry a row for
 *    each {@link DISCLOSED_FIRST_PARTY_COOKIES} entry, with all four columns
 *    filled — so the row cannot be removed, and cannot be added with the
 *    provider or the duration left blank.
 *
 * The residue is the same shape as the Web Storage one and is recorded rather
 * than papered over: a **second** cookie written from the file already listed
 * below still passes. Adding one means adding its name here and its row there,
 * and this comment is the notice.
 */
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { legalPagesByLocale } from "../../content/legal/index.js";
import { LOCALES, type Locale } from "../../content/routes.js";
import { contentFor } from "../../content/schema.js";
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

/** The Web Storage areas the source scan looks for. */
const STORAGE_AREAS = ["localStorage", "sessionStorage"] as const;

type StorageArea = (typeof STORAGE_AREAS)[number];

/**
 * The Web Storage areas, as each edition's privacy page has to describe them
 * to a reader — in that reader's own language. The store is one fact; the
 * sentence disclosing it exists once per published edition, so the check
 * runs once per published edition. Total over `Locale`, so an edition that
 * publishes a privacy page cannot ship without its two disclosure sentences
 * being written down here and asserted.
 */
const STORAGE_DISCLOSURES: Readonly<Record<Locale, Readonly<Record<StorageArea, string>>>> = {
  en: {
    localStorage: "in your browser's local storage rather than as a cookie",
    sessionStorage: "in your browser's session storage rather than as a cookie",
  },
  et: {
    localStorage: "kohalikku salvestusse (local storage), mitte küpsisena",
    sessionStorage: "seansisalvestusse (session storage), mitte küpsisena",
  },
};

/**
 * The basket sentence, verbatim per edition: where it is stored, how long it
 * survives, and what it contains, in that order. Checked whole because the
 * three claims were verified against a running build, and a translation that
 * drops one of them is a disclosure that stopped being the observation.
 */
const BASKET_SENTENCES: Readonly<Record<Locale, string>> = {
  en:
    "An opaque identifier for your basket is stored by this site in your browser's session storage " +
    "rather than as a cookie. It is kept only until you close the tab, and it records no product " +
    "details, quantities, email address or delivery address.",
  et:
    "Sinu ostukorvi läbipaistmatu tunnus salvestatakse selle saidi poolt sinu brauseri " +
    "seansisalvestusse (session storage), mitte küpsisena. Seda hoitakse ainult vahelehe " +
    "sulgemiseni ning see ei salvesta toodete üksikasju, koguseid, e-posti aadressi ega tarneaadressi.",
};

/** The cookie table's caption, per edition — the anchor the exclusion check holds on to. */
const COOKIE_TABLE_CAPTIONS: Readonly<Record<Locale, string>> = {
  en: "Cookies this site can set",
  et: "Küpsised, mida see sait võib salvestada",
};

/**
 * The exact column headings, per edition. `content/content.test.ts` pins the
 * same names in its `COOKIE_TABLE_LANGUAGE` — deliberately duplicated rather
 * than shared, because a first revision replaced this file's exact-name pin
 * with a bare length check when the names moved there, leaving one file's
 * future edit able to remove the last check instead of the second one. Two
 * suites, two pins, and a rename must answer to both.
 */
const COOKIE_TABLE_COLUMNS: Readonly<Record<Locale, readonly string[]>> = {
  en: ["Cookie", "Provider", "Purpose", "Duration"],
  et: ["Küpsis", "Teenusepakkuja", "Otstarve", "Kestus"],
};

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
/**
 * The first-party cookies this site sets, by the name a reader sees in the
 * table.
 *
 * Written out rather than derived: the write is
 * `document.cookie = \`${DESTINATION_COOKIE_NAME}=…\``, an identifier, and a
 * text scan does not resolve it. What that costs is one line here whenever a
 * cookie is added — which is the point, because the same edit has to add a row
 * to a twice-reviewed legal page in two languages, and a list somebody has to
 * touch is a list somebody has to think about.
 */
const DISCLOSED_FIRST_PARTY_COOKIES: readonly string[] = ["plepic_destination"];

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

  for (const area of STORAGE_AREAS) {
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
function consentSectionIn(locale: Locale) {
  const privacyPage = contentFor(legalPagesByLocale, locale).find(
    (page) => page.route === "legalPrivacy",
  );
  return privacyPage?.body.find((section) => section.anchor === "consent");
}

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

  /*
   * The stores are one fact about the code; the sentences disclosing them
   * exist once per published edition, and an edition whose privacy page
   * missed one would describe two of the three ways this site stores
   * something in a browser while reading as though it had described all of
   * them — the exact defect the English page was found with on 2026-08-10.
   */
  for (const locale of LOCALES) {
    const consentSection = consentSectionIn(locale);
    const consentProse = (consentSection?.body ?? []).join("\n");

    it(`${locale}: discloses each one in prose, in the consent section, above the table`, () => {
      expect(consentSection, "the consent section is gone").toBeDefined();

      for (const [area, files] of writers) {
        expect(
          consentProse,
          `${files.join(", ")} writes ${area} and the ${locale} privacy page never says so`,
        ).toContain(STORAGE_DISCLOSURES[locale][area]);
      }
    });

    it(`${locale}: says what the basket store holds and how long it lasts, not merely that it exists`, () => {
      /*
       * Checked against a running build rather than against a comment: after
       * adding the game to the basket, `sessionStorage` held only an opaque
       * Medusa cart identifier — no product id, price, quantity, address, or
       * email
       * — with `localStorage` holding only the consent decision and
       * `document.cookie` empty. The claims below are that observation, in the
       * edition's own words.
       */
      expect(consentProse).toContain(BASKET_SENTENCES[locale]);
    });

    it(`${locale}: keeps the two non-cookie stores out of the cookie table`, () => {
      /*
       * The operator's decision of 2026-08-10, and the structure the page
       * depends on: the table is cookies, everything else this site stores is
       * prose above it. A store moved into the table would have three of its
       * four columns empty and would claim a provider it does not have.
       *
       * The exclusion pattern carries both languages at once: the Estonian
       * sentences name each store with its English term in parentheses, so
       * the English words alone would catch a move, but the Estonian words
       * are matched too rather than relied on to tag along.
       */
      const table = consentSectionIn(locale)?.table;
      expect(table?.caption, "the caption a second reader relied on moved").toBe(
        COOKIE_TABLE_CAPTIONS[locale],
      );
      expect(table?.columns).toEqual(COOKIE_TABLE_COLUMNS[locale]);

      const tableText = [...(table?.rows ?? []).flat(), ...(table?.notes ?? [])].join("\n");
      expect(tableText).not.toMatch(
        /session storage|local storage|seansisalvestus|kohalik\w* salvestus/i,
      );
    });
  }

  it("pins which file writes a cookie, so a new one has to be a decision", () => {
    /*
     * This assertion used to be `toEqual([])` — no cookie at all. The
     * destination selector is the first legitimate first-party cookie this
     * site sets, and the guard was not weakened to let it through: the
     * refusal became a **pin**, so the set of files that may write one is
     * enumerated here and the disclosure each of them owes is asserted below.
     * A second module writing a cookie is exactly as red as it was.
     *
     * Note this check knows the forms listed in COOKIE_WRITE_FORMS above and
     * is not exhaustive: it is a floor, so passing it is not evidence that no
     * other cookie is set.
     */
    expect(
      cookieWriters.map(({ file }) => file).toSorted(),
      "a module other than the one below now writes a first-party cookie. The table captioned " +
        '"Cookies this site can set" would need another row with a provider and a duration — an ' +
        "operator decision on a twice-reviewed legal page, not a row this guard can infer",
    ).toEqual(["src/components/shop/DestinationSelector.tsx"]);
  });

  /**
   * Every first-party cookie this site sets has a **row**, in every edition,
   * with all four columns filled.
   *
   * A row rather than a sentence, and that asymmetry with the two Web Storage
   * disclosures above is deliberate rather than an inconsistency: those two
   * are not cookies, have no provider and no expiry, and would sit in the
   * table with three empty columns. A cookie has both, so it takes the shape
   * the table exists for — which is the operator's own structure of
   * 2026-08-10 and `content/legal/privacy.ts`'s recorded reasoning.
   *
   * The duration column is checked for content specifically. It is the column
   * a reader came for and the one that quietly becomes an empty string when a
   * row is added in a hurry.
   */
  for (const locale of LOCALES) {
    it(`${locale}: gives every first-party cookie a row with all four columns`, () => {
      const table = consentSectionIn(locale)?.table;
      expect(table, "the cookie table is gone").toBeDefined();

      for (const cookie of DISCLOSED_FIRST_PARTY_COOKIES) {
        const row = (table?.rows ?? []).find((cells) => cells[0] === cookie);
        expect(
          row,
          `src/ sets the ${cookie} cookie and the ${locale} cookie table has no row for it`,
        ).toBeDefined();
        expect(row).toHaveLength(4);
        for (const [index, cell] of (row ?? []).entries()) {
          expect(
            (cell ?? "").trim().length,
            `the ${locale} row for ${cookie} leaves "${String(table?.columns[index])}" empty`,
          ).toBeGreaterThan(0);
        }
      }
    });
  }

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
