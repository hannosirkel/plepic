/** A conservative spelling and root check for translated Klingon prose. */
import { klingonLexicon } from "../content/glossary/tlh-lexicon.js";
import { TERM_IDS, TERMS } from "../content/glossary/terms.js";

const CONSONANT = "(?:tlh|ch|gh|ng|[bDHjlmnpqQrStvwy'])";
const CODA = `(?:w'|y'|rgh|${CONSONANT})?`;
const SYLLABLE = new RegExp(`^(?:${CONSONANT}[a e I o u]${CODA})+$`.replaceAll(" ", ""));

/** Closed affix sets from TKD §§4.1–4.2 (see Klingonska Akademien's reference tables). */
export const VERB_PREFIXES = [
  "jI", "vI", "bI", "Da", "qa", "Sa", "cho", "ju", "pI", "wI", "DI",
  "re", "ma", "mu", "nu", "Du", "lI", "nI", "lu", "Su", "bo", "tu",
  "che", "pe", "yI", "tI", "gho", "HI",
] as const;

export const VERB_SUFFIXES = [
  "'egh", "chuq", "nIS", "qang", "rup", "beH", "vIp", "choH", "qa'", "moH",
  "laH", "lu'", "taH", "lI'", "pu'", "ta'", "chu'", "bej",
  "law'", "ba'", "DI'", "chugh", "pa'", "vIS", "bogh", "meH",
  "mo'", "'a'", "jaj", "wI'", "ghach", "be'", "Qo'", "Ha'", "qu'", "neS",
] as const;

export const NOUN_SUFFIXES = [
  "'a'", "Hom", "oy", "pu'", "Du'", "mey", "na'", "Hey", "qoq",
  "wIj", "wI'", "lIj", "lI'", "Daj", "chaj", "maj", "ma'", "raj",
  "ra'", "vam", "vetlh", "Daq", "vo'", "mo'", "vaD", "'e'",
] as const;

/**
 * Names are exempt only with this exact spelling. Extend when copy needs one.
 * A name takes no Klingon suffix: `StripeDaq` is not `Stripe`, and fails.
 */
export const KLINGON_PROPER_NOUNS = [
  // Printed on the box and the cards.
  "Terran Outpost", "The Oasis", "Taikotech", "Dark Side", "Shackleton",
  "Selene Labs", "Imbrium", "Lunar Base", "Plepic Games",
  // Companies and products the legal pages name.
  "Stripe", "Apple Pay", "Google Pay", "PayPal", "Google Analytics", "Google",
  "Meta", "Cloudflare", "Brevo", "Omniva",
  // Institutions and legal instruments, under the names the English pages use.
  "European Union", "European Commission", "Consumer Disputes Committee",
  "Estonian Consumer Protection and Technical Regulatory Authority",
  "Andmekaitse Inspektsioon", "äriregister", "EU–US Data Privacy Framework",
  // Countries, as the shop names them: a carrier needs the real name.
  "Estonia", "Latvia", "Lithuania", "United States",
  // Cookie names. `_ga` also covers `_ga_*`.
  "_ga", "_fbp", "plepic_destination",
] as const;

/**
 * A loan requires a named entry and an explanation in the glossary or copy.
 * `content/glossary/tlh.ts` says what each one stands beside.
 */
export const KLINGON_LOANS: readonly string[] = [
  "VAT", "DNS", "IP", "local storage", "session storage", "granted", "declined",
];

/** English card vocabulary may appear only as a bracketed aid at first use. */
export const PRINTED_CARD_LABELS = TERM_IDS
  .filter((id) => TERMS[id].class === "translated-with-original")
  .flatMap((id) => TERMS[id].forms);

export interface KlingonWordIssue {
  readonly word: string;
  readonly reason: "spelling" | "unknown-root";
}

function hasRoot(word: string, wordClass: "noun" | "verb"): boolean {
  const entry = klingonLexicon[word as keyof typeof klingonLexicon];
  return entry?.wordClass === wordClass;
}

function canStripSuffixes(word: string, wordClass: "noun" | "verb", depth = 0): boolean {
  if (hasRoot(word, wordClass)) return true;
  if (depth >= 8) return false;
  const suffixes = wordClass === "noun" ? NOUN_SUFFIXES : VERB_SUFFIXES;
  return suffixes.some((suffix) =>
    word.length > suffix.length && word.endsWith(suffix) &&
    canStripSuffixes(word.slice(0, -suffix.length), wordClass, depth + 1));
}

export function isKnownKlingonWord(word: string): boolean {
  if (!SYLLABLE.test(word)) return false;
  if (Object.hasOwn(klingonLexicon, word)) return true;
  if (canStripSuffixes(word, "noun") || canStripSuffixes(word, "verb")) return true;
  return VERB_PREFIXES.some((prefix) =>
    word.startsWith(prefix) && word.length > prefix.length &&
    canStripSuffixes(word.slice(prefix.length), "verb"));
}

// The two token syntaxes of `content/mirror.test.ts`. A token is not a word.
const PLACEHOLDER = /\{[A-Za-z][A-Za-z0-9]*\}|%[A-Za-z][A-Za-z0-9]*%/g;

/**
 * The words of `text` the check reads: what is left once placeholders, names,
 * loans and bracketed card labels are removed. Names may span words.
 */
export function klingonWordsIn(
  text: string,
  properNouns: readonly string[] = KLINGON_PROPER_NOUNS,
  loans: readonly string[] = KLINGON_LOANS,
): string[] {
  let remaining = text.replace(PLACEHOLDER, " ");
  for (const label of PRINTED_CARD_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    remaining = remaining.replace(new RegExp(`(?:\\(${escaped}\\)|\\[${escaped}\\])`, "g"), " ");
  }
  for (const name of [...properNouns, ...loans].sort((a, b) => b.length - a.length)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    remaining = remaining.replace(new RegExp(`(?<![A-Za-z'])${escaped}(?![A-Za-z'])`, "g"), " ");
  }
  return remaining.match(/[A-Za-z']+/g) ?? [];
}

export function checkKlingonWords(
  text: string,
  properNouns: readonly string[] = KLINGON_PROPER_NOUNS,
  loans: readonly string[] = KLINGON_LOANS,
): KlingonWordIssue[] {
  const issues: KlingonWordIssue[] = [];
  for (const word of klingonWordsIn(text, properNouns, loans)) {
    if (!SYLLABLE.test(word)) issues.push({ word, reason: "spelling" });
    else if (!isKnownKlingonWord(word)) issues.push({ word, reason: "unknown-root" });
  }
  return issues;
}
