/**
 * What a language says about each term of `terms.ts`.
 *
 * A glossary is total over the term list: a language that has one has an entry
 * for every id, so a term added to `terms.ts` does not compile until each
 * registered language has decided it.
 *
 * ## Form syntax
 *
 * `forms` and `forbidden` are matched against whole words, and case counts,
 * because Klingon spelling is case-sensitive. List a capitalised form where a
 * term can open a sentence.
 *
 * | Written | Matches |
 * | --- | --- |
 * | `Stapel` | the word, and nothing longer |
 * | `Modul*` | a stem: the word and any ending |
 * | `*basis` | the end of a compound |
 * | `discard pile` | the words in order, across any white space |
 *
 * Where two matches overlap, the longer one stands and the shorter is not
 * counted, so "Lunar Base" is not also a use of "Base".
 */

import type { RulebookLanguage } from "../rulebook-documents.js";
import type { TermId } from "./terms.js";

export interface GlossaryEntry {
  /**
   * The agreed translation, in its dictionary form. A term of class
   * `as-printed` repeats the English term.
   */
  readonly term: string;
  /**
   * Every spelling a translated string may use for the term: inflected forms,
   * or stems. A term of class `as-printed` repeats the English forms, and the
   * check holds the translation to exactly those.
   */
  readonly forms: readonly string[];
  /** Variants that must not appear in any translated string. */
  readonly forbidden: readonly string[];
  /** Why this word, where the choice needs a reason. */
  readonly note?: string;
}

export type Glossary = Readonly<Record<TermId, GlossaryEntry>>;

/**
 * Every language the rulebook is printed in has a glossary, whether or not it
 * is a site edition. English has none, because English is what the
 * translations are checked against.
 */
export type GlossaryLocale = Exclude<RulebookLanguage, "en">;
export type GlossaryRegistry = Readonly<Record<GlossaryLocale, Glossary>>;

/**
 * The keys whose strings the check does not read: identifiers and link
 * targets, by the name of the property or of the list a string is an item of.
 * A name ending in `Id` counts too. `mirror.test.ts` holds each to the English
 * string, so the check skips one only while it is still that string. Every
 * other string is read, translated or not.
 *
 * The list repeats the mirror test's and need not agree with it to be safe. A
 * name missing here makes the check read an identifier, and it says so; a name
 * listed in error exempts only a string nobody changed.
 */
export const IDENTIFIER_KEYS: readonly string[] = [
  "anchor", "autoComplete", "control", "covers", "emphasis", "href", "id",
  "indexable", "kind", "name", "path", "reviewStatus", "route", "sections",
  "source", "src", "supporting", "to", "type", "url", "youTubeId",
];

/** The three ways a translated string can fail the check. */
export const GLOSSARY_RULES = ["forbidden-variant", "missing-term", "altered-as-printed"] as const;

export type GlossaryRule = (typeof GLOSSARY_RULES)[number];

/**
 * One string the check would fail and a person has decided to let pass.
 *
 * `key` is the key the failure names. `reason` is read by the next translator,
 * so it says what the string means, and never "false positive".
 */
export interface GlossaryException {
  readonly locale: keyof GlossaryRegistry;
  readonly key: string;
  readonly term: TermId;
  readonly rule: GlossaryRule;
  readonly reason: string;
}
