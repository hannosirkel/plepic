/**
 * The marker fixture: a `SiteCopy` in which every sentence is wrapped in two
 * marker characters, and the scan that finds whatever a render shows outside
 * them.
 *
 * A component made locale-aware has to be shown to read **all** of its words
 * from the edition it is given. Comparing a render with the English copy
 * cannot show that, because English is what a forgotten literal says too.
 * So a test hands the component a copy no page was ever written in, renders
 * it, removes everything between the markers and reads what is left. A
 * sentence that survives was not read from the edition.
 *
 * Each marked sentence also names the edition it was marked for, as
 * `⟦et:…⟧`. A component that reads copy but ignores the locale it was handed
 * shows marked text all the same, and only that name tells the two apart.
 *
 * This file imports no content at run time. A test replaces
 * `content/editions.js` with a mock built from {@link markSiteCopy}, and a
 * helper that imported the module being mocked would be handed the mock.
 */
import type { SiteCopy } from "../../../content/editions.js";

export const MARK_OPEN = "⟦";
export const MARK_CLOSE = "⟧";

/**
 * Keys whose strings are identifiers, link targets or tokens, not prose.
 *
 * It is the list `content/mirror.test.ts` holds equal between editions, plus
 * `supporting`, which that test matches by path. The two lists are not
 * shared, and need not agree to be safe: a prose key listed here leaves its
 * sentence unmarked, and an identifier missing from here breaks the link or
 * the lookup it feeds. Either way a test that uses the fixture fails.
 */
const IDENTIFIER_KEYS: ReadonlySet<string> = new Set([
  "anchor", "autoComplete", "control", "covers", "emphasis", "href", "id",
  "indexable", "kind", "name", "path", "reviewStatus", "route", "sections",
  "source", "src", "supporting", "to", "type", "url", "youTubeId",
]);

/** `text` as the fixture for `edition` holds it. */
export function markedFor(edition: string, text: string): string {
  return `${MARK_OPEN}${edition}:${text}${MARK_CLOSE}`;
}

function marked(value: unknown, key: string, edition: string): unknown {
  if (typeof value === "string") {
    // An empty string is how copy says "nothing here"; a marked one would not be empty.
    if (value === "" || IDENTIFIER_KEYS.has(key) || key.endsWith("Id")) return value;
    return markedFor(edition, value);
  }
  // A list's strings are what its key says they are: `sections` holds anchors.
  if (Array.isArray(value)) return value.map((item) => marked(item, key, edition));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        marked(child, childKey, edition),
      ]),
    );
  }
  return value;
}

/**
 * `copy` with every sentence wrapped in the markers and named for `edition`,
 * and its structure untouched.
 */
export function markSiteCopy(copy: SiteCopy, edition: string): SiteCopy {
  return marked(copy, "", edition) as SiteCopy;
}

const EDITION_NAME = new RegExp(`${MARK_OPEN}([^:${MARK_CLOSE}]*):`, "g");

/** The editions whose marked sentences `html` shows, each once, in order of appearance. */
export function editionsMarkedIn(html: string): readonly string[] {
  return [...new Set([...html.matchAll(EDITION_NAME)].map((match) => match[1] ?? ""))];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

const MARKED_SPAN = new RegExp(`${MARK_OPEN}[^${MARK_OPEN}${MARK_CLOSE}]*${MARK_CLOSE}`, "g");

/** `text` with every marked sentence removed, each leaving a line break behind. */
export function withoutMarkedText(text: string): string {
  return text.replace(MARKED_SPAN, "\n");
}

/**
 * Every run of reader-facing text in `html` that is neither inside the
 * markers nor one of `exempt`, and that holds at least one letter.
 *
 * Reader-facing is the text between tags and the four attributes a reader
 * meets as words: `alt`, `aria-label`, `title` and `placeholder`. Prices,
 * punctuation and digits are not letters and are never reported.
 *
 * `exempt` is for words that come from somewhere other than `SiteCopy` on
 * purpose. The caller names each one; nothing is exempt by default.
 */
export function unmarkedText(html: string, exempt: readonly string[]): readonly string[] {
  const attributes = [...html.matchAll(/\s(?:alt|aria-label|title|placeholder)="([^"]*)"/g)].map(
    (match) => match[1] ?? "",
  );
  /*
   * A tag becomes a line break, not nothing, so two neighbouring elements are
   * two runs. A marked sentence that an element splits (`*emphasis*`) still
   * closes, because a marked span may cross a line break.
   */
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "\n")
    .replace(/<[^>]*>/g, "\n");
  const longestFirst = exempt.toSorted((a, b) => b.length - a.length);

  return [...attributes, text].flatMap((part) => {
    let rest = withoutMarkedText(decodeEntities(part));
    for (const phrase of longestFirst) rest = rest.replaceAll(phrase, "\n");
    return rest
      .split("\n")
      .map((run) => run.trim())
      .filter((run) => /\p{L}/u.test(run));
  });
}
