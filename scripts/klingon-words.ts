/** A conservative spelling and root check for translated Klingon prose. */
import { klingonLexicon } from "../content/glossary/tlh-lexicon.js";
import type { KlingonLexiconEntry } from "../content/glossary/tlh-lexicon.js";
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
  // The company and the computer opponent the privacy page names for the online game.
  "TypeSafe", "Jev",
  // Institutions and legal instruments, under the names the English pages use.
  "European Union", "European Commission", "Consumer Disputes Committee",
  "Estonian Consumer Protection and Technical Regulatory Authority",
  "Andmekaitse Inspektsioon", "äriregister", "EU–US Data Privacy Framework",
  // Countries, as the shop names them: a carrier needs the real name.
  "Estonia", "Latvia", "Lithuania", "United States", "Finland", "Denmark",
  // Places, companies and events the publisher and proof copy name.
  "Tallinn", "Kickstarter", "AireCon", "Brætspilscaféen",
  // Names, report ids and English wording printed in the product copy.
  "English", "United Nations", "Longpack Co., Ltd.", "Shanghai", "China", "Intertek Testing Services Ltd.",
  "SHAH01338706", "May", "EN71-1:2014+A1:2018", "EN71-2:2020", "EN71-3:2019",
  "Directive 2009/48/EC",
  // Reviewers and their outlets, as the quotations attribute them.
  "Paul Grogan", "Gaming Rules", "Hairy Game Lords", "Tabletop Games Blog",
  "Rodney Smith", "Watch It Played",
  // Evidence ids and the retired route that the proof module's unrendered reasons cite.
  "E3", "E6", "E7", "E10", "E11", "/about",
  // The video host the interface copy names.
  "YouTube",
  // Cookie names. `_ga` also covers `_ga_*`.
  "_ga", "_fbp", "plepic_destination",
  // Card titles the rulebook names, the address it prints, and the letters of its diagrams.
  "Double Agent", "Experimental Borehole", "Mormon Scientist", "Space Elevator",
  "lunarbasegame.com", "A", "B", "C",
  // Printed names in the example turns, story, and credits on rulebook sheets 16–24.
  "Alice", "Bob", "Kim", "Solicitor", "Inflatable Habitat", "Fusion Reactor",
  "Depot", "Rovers", "Rover", "Dome", "Laika’s Memorial", "Laika’s Paradise",
  "Beruang Engineers", "United States of Africa", "Garuna", "Mah", "Ilmatar",
  "Meztli", "Chang’e", "UN", "LUNARFLEET", "LUNARBASE",
  "Lunar Base Collector’s Bundle", "Silver Türk", "Joosep Simm", "Kaido Koort",
  "Martin Paroll", "Ladislava Bohacova", "Erkki Lindpere", "Mart Redi",
  "James Bowman", "Leila Toomet", "Hanno Sirkel", "Ole Busborg Jensen",
  "Indrek Kempi", "Farhad Omid", "Zachary Fissel", "Jevgeni Kabanov",
  "Kaido Vaade", "Meelis Müür", "Lambert Chow", "Juhan Hion",
  "Mart Rasva", "Rainer Jürgenson", "Margus Niitsoo", "Sam R",
  "David Wilson", "Kye Moseley", "Kristi Seemen", "Boris Schirra",
  "Emil Andre Hallen", "Francesco Sabbatini", "Paul Ambs", "Patrick Grunau",
  "Lauri Peil", "Ricardo Job-Reese", "Rémi Camberlein", "Nick Dillon",
  "Erin Reed", "Chris Kuivenhoven", "Sergio Ruiz Fernández", "Brenden Brzozowski",
  "Ruben Parras", "Alexander Welsz", "Michael Allan", "Owen Williams", "Mudd Law",
] as const;

/**
 * A loan requires a named entry and an explanation in the glossary or copy.
 * `content/glossary/tlh.ts` says what each one stands beside.
 */
export const KLINGON_LOANS: readonly string[] = [
  "VAT", "DNS", "IP", "local storage", "session storage", "granted", "declined",
  "centimetres", "grams", "aluminium", "MB", "PDF",
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
  const entry: KlingonLexiconEntry | undefined = klingonLexicon[word as keyof typeof klingonLexicon];
  return entry?.wordClass === wordClass || entry?.alsoWordClass === wordClass;
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

// The two token syntaxes of `content/mirror.test.ts`, and a frame the rulebook text names (`{s09.f11a}`). A token is not a word.
const PLACEHOLDER = /\{[A-Za-z][A-Za-z0-9]*\}|%[A-Za-z][A-Za-z0-9]*%|\{s\d\d\.f\d\d[a-z]?\}/g;

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
