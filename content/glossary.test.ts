/**
 * The glossary check. For every registered glossary, each translated string
 * of the locale's site copy and legal set is read beside the English string at
 * the same key. A string fails when it uses a forbidden variant, when the
 * English string has a term and the translation has none of its forms, or when
 * an as-printed term is not there letter for letter.
 *
 * An identifier or a link target is skipped: `mirror.test.ts` pins it to the
 * English string. Any other string is read, even one left as the English has
 * it, because a label a reader sees is the glossary's business either way.
 *
 * No glossary is registered until a language's first task, so the check is
 * proven here on fixtures, and the walk on the Estonian legal set.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { siteCopyByLocale, siteCopyFor } from "./editions.js";
import {
  GLOSSARY_RULES,
  IDENTIFIER_KEYS,
  RULEBOOK_ONLY_TERMS,
  TERM_CLASSES,
  TERM_IDS,
  TERMS,
  glossaries,
  glossaryExceptions,
  type Glossary,
  type GlossaryException,
  type GlossaryRule,
  type Term,
  type TermId,
} from "./glossary/index.js";
import { legalPagesByLocale } from "./legal/index.js";
import { DEFAULT_LOCALE, type Locale } from "./routes.js";

const contentDir = dirname(fileURLToPath(import.meta.url));
const terms: Readonly<Record<TermId, Term>> = TERMS;

interface Pair {
  readonly key: string;
  readonly english: string;
  readonly translated: string;
}

/** Every string of `english` that `translated` also has at the same key. */
function pairsOf(english: unknown, translated: unknown, key: string, out: Pair[] = []): Pair[] {
  if (typeof english === "string") {
    if (typeof translated === "string") out.push({ key, english, translated });
  } else if (Array.isArray(english)) {
    if (Array.isArray(translated)) {
      english.forEach((item, index) => pairsOf(item, translated[index], `${key}[${index}]`, out));
    }
  } else if (english !== null && typeof english === "object" && translated !== null && typeof translated === "object") {
    for (const [name, value] of Object.entries(english)) {
      pairsOf(value, (translated as Record<string, unknown>)[name], `${key}.${name}`, out);
    }
  }
  return out;
}

function sitePairs(locale: Locale): readonly Pair[] {
  const copy = siteCopyByLocale[locale];
  return copy === null ? [] : pairsOf(siteCopyFor(DEFAULT_LOCALE), copy, "site");
}

function legalPairs(locale: Locale): readonly Pair[] {
  const translated = legalPagesByLocale[locale];
  return legalPagesByLocale[DEFAULT_LOCALE].flatMap((page) =>
    pairsOf(page, translated.find((candidate) => candidate.route === page.route), `legal.${page.route}`));
}

/**
 * The hook for rulebook text. When `rulebook/text/<locale>/` exists, this
 * returns one pair per frame id: the English text of the frame map beside the
 * locale's string for the same frame. Until then a locale has none.
 */
function rulebookPairs(_locale: Locale): readonly Pair[] {
  return [];
}

const sources = [sitePairs, legalPairs, rulebookPairs] as const;

const WORD_CHARACTER = "[\\p{L}\\p{N}]";

/** The form syntax of `glossary/schema.ts`, as a pattern over whole words. */
function patternOf(form: string): RegExp {
  const compoundEnd = form.startsWith("*");
  const stem = form.endsWith("*");
  const words = form.slice(compoundEnd ? 1 : 0, stem ? -1 : undefined)
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(
    (compoundEnd ? `${WORD_CHARACTER}*` : `(?<!${WORD_CHARACTER})`) + words + (stem ? `${WORD_CHARACTER}*` : `(?!${WORD_CHARACTER})`),
    "gu",
  );
}

interface Wanted {
  readonly term: TermId;
  readonly pattern: RegExp;
  readonly forbidden: boolean;
}

function wanted(term: TermId, forms: readonly string[], forbidden = false): Wanted[] {
  return forms.map((form) => ({ term, pattern: patternOf(form), forbidden }));
}

interface Hit extends Wanted {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** Every match in `text`, less those a longer overlapping match covers. */
function hitsIn(text: string, entries: readonly Wanted[]): Hit[] {
  const hits = entries.flatMap((entry) =>
    [...text.matchAll(entry.pattern)].map((match) => ({
      ...entry, text: match[0], start: match.index, end: match.index + match[0].length,
    })));
  return hits.filter((hit) => !hits.some((other) =>
    other.start < hit.end && hit.start < other.end && other.end - other.start > hit.end - hit.start));
}

const englishForms: readonly Wanted[] = TERM_IDS.flatMap((term) => wanted(term, terms[term].forms));

/** An as-printed term is held to the English spellings, whatever the locale lists. */
function wantedIn(glossary: Glossary): readonly Wanted[] {
  return TERM_IDS.flatMap((term) => [
    ...wanted(term, terms[term].class === "as-printed" ? terms[term].forms : glossary[term].forms),
    ...wanted(term, glossary[term].forbidden, true),
  ]);
}

interface Failure {
  readonly key: string;
  readonly term: TermId;
  readonly rule: GlossaryRule;
  readonly message: string;
}

function checkGlossary(glossary: Glossary, pairs: readonly Pair[]): Failure[] {
  const entries = wantedIn(glossary);
  const failures: Failure[] = [];
  for (const { key, english, translated } of pairs) {
    // The name of the property, or of the list the string is an item of.
    const name = /([A-Za-z]\w*)(?:\[\d+\])*$/.exec(key)?.[1] ?? "";
    if (english === translated && (IDENTIFIER_KEYS.includes(name) || name.endsWith("Id"))) continue;
    const found = hitsIn(translated, entries);
    const variants = new Map(found.filter((hit) => hit.forbidden).map((hit) => [`${hit.term} ${hit.text}`, hit]));
    for (const hit of variants.values()) {
      failures.push({
        key, term: hit.term, rule: "forbidden-variant",
        message: `${key}: forbidden variant "${hit.text}" of the term ${hit.term} ("${terms[hit.term].english}")`,
      });
    }
    const used = new Set(found.filter((hit) => !hit.forbidden).map((hit) => hit.term));
    for (const term of new Set(hitsIn(english, englishForms).map((hit) => hit.term))) {
      if (used.has(term)) continue;
      const name = `${term} ("${terms[term].english}")`;
      failures.push(terms[term].class === "as-printed"
        ? { key, term, rule: "altered-as-printed", message: `${key}: the as-printed term ${name} is altered or missing` }
        : { key, term, rule: "missing-term", message: `${key}: the English string has the term ${name} and the translation has none of its forms` });
    }
  }
  return failures;
}

function covers(exception: GlossaryException, locale: Locale, failure: Failure): boolean {
  return exception.locale === locale && exception.key === failure.key
    && exception.term === failure.term && exception.rule === failure.rule;
}

/** What is wrong with a locale's strings and with the exceptions written for it. */
function reportFor(
  locale: Locale, glossary: Glossary, pairs: readonly Pair[], exceptions: readonly GlossaryException[],
): string[] {
  const failures = checkGlossary(glossary, pairs);
  return [
    ...failures.filter((failure) => !exceptions.some((exception) => covers(exception, locale, failure)))
      .map((failure) => failure.message),
    ...exceptions.filter((exception) => exception.locale === locale && exception.reason.trim() === "")
      .map((exception) => `${exception.key}: the exception for ${exception.term} gives no reason`),
    ...exceptions.filter((exception) => exception.locale === locale && !failures.some((failure) => covers(exception, locale, failure)))
      .map((exception) => `${exception.key}: the exception for ${exception.term} (${exception.rule}) suppresses nothing`),
  ];
}

/** What is wrong with a glossary before any string is read. */
function problemsIn(glossary: Glossary): string[] {
  return TERM_IDS.flatMap((term) => {
    const { term: translation, forms, forbidden } = glossary[term];
    const printed = terms[term].class === "as-printed";
    return [
      ...(translation.trim() === "" ? [`${term}: no translation`] : []),
      ...(forms.length === 0 ? [`${term}: no form`] : []),
      ...([...forms, ...forbidden].some((form) => form.replaceAll("*", "").trim() === "") ? [`${term}: an empty form`] : []),
      ...(printed && (translation !== terms[term].english || forms.join() !== terms[term].forms.join())
        ? [`${term}: an as-printed term repeats the English term and forms`] : []),
    ];
  });
}

/** A fixture glossary: every term maps to its English forms, less what a test overrides. */
function fixtureGlossary(overrides: Partial<Glossary> = {}): Glossary {
  const base = Object.fromEntries(TERM_IDS.map((term) =>
    [term, { term: terms[term].english, forms: terms[term].forms, forbidden: [] }])) as unknown as Glossary;
  return { ...base, ...overrides };
}

const german = fixtureGlossary({
  agent: { term: "Agent", forms: ["Agent", "Agenten", "Agentenkarte*"], forbidden: ["Spion*"] },
  base: { term: "Basis", forms: ["Basis", "Basen", "*basis"], forbidden: [] },
  deck: { term: "Nachziehstapel", forms: ["Nachziehstapel*"], forbidden: ["Kartenstapel", "Deck"] },
  discardPile: { term: "Ablagestapel", forms: ["Ablagestapel*"], forbidden: [] },
  module: { term: "Modul", forms: ["Modul*"], forbidden: [] },
});
const renamed = fixtureGlossary({ ...german, lunarBase: { term: "Mondbasis", forms: ["Mondbasis"], forbidden: [] } });

function messagesFor(english: string, translated: string, glossary = german): string[] {
  return checkGlossary(glossary, [{ key: "fixture.line", english, translated }]).map((failure) => failure.message);
}

describe("the term list", () => {
  it("uses every class, and gives every term forms that match its own English term", () => {
    expect(TERM_IDS.length).toBeGreaterThan(30);
    expect(new Set(TERM_IDS.map((term) => terms[term].class))).toEqual(new Set(TERM_CLASSES));
    for (const term of TERM_IDS) {
      expect(hitsIn(terms[term].english, englishForms).map((hit) => hit.term), term).toEqual([term]);
    }
  });

  it("gives no English form to two terms, and an as-printed term its English spelling alone", () => {
    const forms = TERM_IDS.flatMap((term) => terms[term].forms);
    expect(forms.filter((form, index) => forms.indexOf(form) !== index)).toEqual([]);
    for (const term of TERM_IDS.filter((id) => terms[id].class === "as-printed")) {
      expect(terms[term].forms, term).toEqual([terms[term].english]);
    }
  });

  it("seeds only terms the English site copy uses, or the named rulebook-only terms", () => {
    const english = [...sitePairs(DEFAULT_LOCALE), ...legalPairs(DEFAULT_LOCALE)];
    expect(english.length).toBeGreaterThan(300);
    const used = new Set(english.flatMap((pair) => hitsIn(pair.english, englishForms)).map((hit) => hit.term));
    expect(TERM_IDS.filter((term) => !used.has(term))).toEqual(Object.keys(RULEBOOK_ONLY_TERMS));
  });
});

describe("the walk", () => {
  it("pairs every Estonian legal string with the English string at the same key", () => {
    const pairs = legalPairs("et");
    expect(pairs.length).toBe(legalPairs(DEFAULT_LOCALE).length);
    expect(pairs.length).toBeGreaterThan(100);
    const title = pairs.find((pair) => pair.key === "legal.legalTerms.title");
    expect(title?.english).toBe(legalPagesByLocale.en.find((page) => page.route === "legalTerms")?.title);
    expect(title?.translated).toBe(legalPagesByLocale.et.find((page) => page.route === "legalTerms")?.title);
    expect(title?.translated).not.toBe(title?.english);
    // The Estonian edition publishes no site copy, so it has no site pairs.
    expect(sitePairs("et")).toEqual([]);
  });

  it("pairs nested lists and objects by key, and skips what the translation lacks", () => {
    expect(pairsOf(
      { title: "One", items: [{ text: "Two" }, { text: "Three" }], gone: "Four" },
      { title: "Üks", items: [{ text: "Kaks" }] },
      "fixture",
    )).toEqual([
      { key: "fixture.title", english: "One", translated: "Üks" },
      { key: "fixture.items[0].text", english: "Two", translated: "Kaks" },
    ]);
  });
});

describe("the check, on fixture data", () => {
  it("fails on a forbidden variant and names the key and the term", () => {
    expect(messagesFor("Shuffle well.", "Mische den Kartenstapel gut.")).toEqual([
      'fixture.line: forbidden variant "Kartenstapel" of the term deck ("deck")',
    ]);
  });

  it("fails on a missing term and names the key and the term", () => {
    expect(messagesFor("Play an Agent card.", "Spiele eine Karte.")).toEqual([
      'fixture.line: the English string has the term agent ("Agent") and the translation has none of its forms',
    ]);
  });

  it("fails on an altered as-printed term and names the key and the term", () => {
    expect(messagesFor("Lunar Base is a card game.", "Mondbasis ist ein Kartenspiel.")).toEqual([
      'fixture.line: the as-printed term lunarBase ("Lunar Base") is altered or missing',
    ]);
    expect(messagesFor("Lunar Base is a card game.", "Lunar base ist ein Kartenspiel.")).toHaveLength(1);
    expect(messagesFor("Lunar Base is a card game.", "Lunar Base ist ein Kartenspiel.")).toEqual([]);
  });

  it("holds an as-printed term to the English spelling even where a glossary lists another", () => {
    expect(messagesFor("Lunar Base is a card game.", "Mondbasis ist ein Kartenspiel.", renamed)).toEqual([
      'fixture.line: the as-printed term lunarBase ("Lunar Base") is altered or missing',
    ]);
  });

  it("reports each of the three rules a string breaks", () => {
    const failures = checkGlossary(german, [
      { key: "fixture.line", english: "Send an Agent to Lunar Base.", translated: "Sende einen Spion zur Mondbasis." },
    ]);
    expect(failures.map((failure) => `${failure.term} ${failure.rule}`).sort()).toEqual([
      "agent forbidden-variant", "agent missing-term", "lunarBase altered-as-printed",
    ]);
    expect(failures.map((failure) => failure.rule).sort()).toEqual([...GLOSSARY_RULES].sort());
  });

  it("accepts inflected forms, stems and the end of a compound", () => {
    expect(messagesFor("Play two Agents.", "Spiele zwei Agenten.")).toEqual([]);
    expect(messagesFor("Build a Module.", "Baue eine Modulkarte.", fixtureGlossary({
      ...german, build: { term: "Bauen", forms: ["Bau*"], forbidden: [] },
    }))).toEqual([]);
    expect(messagesFor("Grow your base.", "Vergrößere deine Mondbasis.")).toEqual([]);
  });

  it("matches whole words, case exactly, and a term of several words across a line break", () => {
    expect(messagesFor("Play an Agent card.", "Spiele eine agentenkarte.")).toHaveLength(1);
    expect(messagesFor("Play an Agent card.", "Spiele einen Geheimagenten.")).toHaveLength(1);
    expect(messagesFor("Shuffle well.", "Mische auf dem Sonnendeck.")).toEqual([]);
    expect(messagesFor("Reach Lunar\nBase first.", "Erreiche Lunar\nBase zuerst.")).toEqual([]);
  });

  it("lets the longer of two overlapping matches stand", () => {
    expect(messagesFor("Lunar Base ships today.", "Lunar Base wird heute versandt.")).toEqual([]);
    expect(messagesFor("Shuffle the discard pile.", "Mische den Ablagestapel.")).toEqual([]);
    expect(messagesFor("Shuffle the deck.", "Mische den Ablagestapel.")).toHaveLength(1);
  });

  it("skips an identifier the mirror test pins, and reads any other string left as the English has it", () => {
    const kasse = fixtureGlossary({ checkout: { term: "Kasse", forms: ["Kasse"], forbidden: ["Checkout"] } });
    const rulesAt = (key: string, english: string, translated = english) =>
      checkGlossary(kasse, [{ key, english, translated }]).map((failure) => failure.rule);
    expect(rulesAt("fixture.title", "Checkout")).toEqual(["forbidden-variant", "missing-term"]);
    expect(rulesAt("fixture.title", "checkout")).toEqual(["missing-term"]);
    for (const key of ["fixture.route", "fixture.sections[0]", "fixture.checkoutId"]) expect(rulesAt(key, "checkout"), key).toEqual([]);
    // An identifier that was changed is no longer the pinned string, so it is read.
    expect(rulesAt("fixture.route", "checkout", "Checkout")).toEqual(["forbidden-variant", "missing-term"]);
    // The English site copy beside itself: the page title nobody translated fails, its route does not.
    const route = sitePairs(DEFAULT_LOCALE).find((pair) => pair.english === "checkout" && pair.key.endsWith(".route"))?.key ?? "";
    const failed = checkGlossary(kasse, sitePairs(DEFAULT_LOCALE)).map((failure) => `${failure.key} ${failure.rule}`);
    expect(failed).toContain(`${route.replace(/route$/, "title")} forbidden-variant`);
    expect(failed.filter((line) => line.startsWith(`${route} `))).toEqual([]);
  });

  it("lets a named exception pass, and fails one that gives no reason or suppresses nothing", () => {
    const pairs = [{ key: "fixture.line", english: "On the other hand, wait.", translated: "Warte lieber." }];
    const exception: GlossaryException = {
      locale: "et", key: "fixture.line", term: "hand", rule: "missing-term",
      reason: "An idiom: no player's hand of cards is meant.",
    };
    expect(reportFor("et", german, pairs, [])).toHaveLength(1);
    expect(reportFor("et", german, pairs, [exception])).toEqual([]);
    expect(reportFor("et", german, pairs, [{ ...exception, reason: " " }])).toEqual([
      "fixture.line: the exception for hand gives no reason",
    ]);
    expect(reportFor("et", german, pairs, [exception, { ...exception, term: "deck" }])).toEqual([
      "fixture.line: the exception for deck (missing-term) suppresses nothing",
    ]);
  });
});

describe("the registered glossaries", () => {
  const registered = Object.entries(glossaries) as [keyof typeof glossaries, Glossary][];

  it("has an allowed form for every term and explains any shared translation", () => {
    for (const [locale, glossary] of registered) {
      expect(Object.keys(glossary).sort(), locale).toEqual([...TERM_IDS].sort());
      const byTranslation = new Map<string, TermId[]>();
      for (const term of TERM_IDS) {
        expect(glossary[term].forms.length, `${locale}.${term}`).toBeGreaterThan(0);
        const translation = glossary[term].term.toLocaleLowerCase(locale === "de" ? "de" : "en");
        byTranslation.set(translation, [...(byTranslation.get(translation) ?? []), term]);
      }
      for (const ids of byTranslation.values()) {
        if (ids.length > 1) {
          for (const term of ids) expect(glossary[term].note?.trim(), `${locale}.${term}`).toBeTruthy();
        }
      }
    }
  });

  it("names a term with no form, an empty form, or an as-printed term that was translated", () => {
    expect(problemsIn(german)).toEqual([]);
    expect(problemsIn(fixtureGlossary({ ...renamed, hand: { term: " ", forms: [], forbidden: ["*"] } }))).toEqual([
      "hand: no translation", "hand: no form", "hand: an empty form",
      "lunarBase: an as-printed term repeats the English term and forms",
    ]);
  });

  it("are well formed and pass the check over every translated string, less the named exceptions", () => {
    for (const [locale, glossary] of registered) {
      expect(problemsIn(glossary), locale).toEqual([]);
      // A glossary can be prepared before its locale is registered in T019.
      if (Object.hasOwn(siteCopyByLocale, locale)) {
        const activeLocale = locale as Locale;
        const pairs = sources.flatMap((pairsFor) => pairsFor(activeLocale));
        expect(pairs.length, `${locale} has a glossary and no translated string`).toBeGreaterThan(0);
        expect(reportFor(activeLocale, glossary, pairs, glossaryExceptions), locale).toEqual([]);
      }
    }
  });

  it("own every exception", () => {
    const locales = registered.map(([locale]) => locale);
    for (const exception of glossaryExceptions) {
      expect(locales, `${exception.key}: no glossary is registered for the exception's locale`).toContain(exception.locale);
    }
  });

  it("stay out of the content barrel", () => {
    expect(readFileSync(join(contentDir, "index.ts"), "utf8")).not.toMatch(/glossary/i);
  });
});
