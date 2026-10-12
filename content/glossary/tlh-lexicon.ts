/** Roots used by the Klingon glossary. Add a sourced root before using it in copy. */
export type KlingonWordClass = "noun" | "verb" | "pronoun" | "other";
export type KlingonSource = "TKD" | "KGT" | "KLI" | "coined";

export interface KlingonLexiconEntry {
  readonly wordClass: KlingonWordClass;
  readonly english: string;
  readonly source: KlingonSource;
  /** Required when source is coined; every named root must also occur here. */
  readonly construction?: readonly string[];
}

export const klingonLexicon = {
  tlhIngan: { wordClass: "noun", english: "Klingon", source: "TKD" },
  Hol: { wordClass: "noun", english: "language", source: "TKD" },
  legh: { wordClass: "verb", english: "see", source: "TKD" },
  "qo'": { wordClass: "noun", english: "world", source: "TKD" },
  "Qapla'": { wordClass: "noun", english: "success", source: "TKD" },
  Daq: { wordClass: "noun", english: "place", source: "TKD" },
  logh: { wordClass: "noun", english: "outer space", source: "TKD" },
  vum: { wordClass: "verb", english: "work", source: "TKD" },
  HoS: { wordClass: "noun", english: "strength, power", source: "TKD" },
  "'ay'": { wordClass: "noun", english: "section, part", source: "TKD" },
  Huch: { wordClass: "noun", english: "money", source: "TKD" },
  "mI'": { wordClass: "noun", english: "number", source: "TKD" },
  jan: { wordClass: "noun", english: "device", source: "TKD" },
  nob: { wordClass: "verb", english: "give", source: "TKD" },
  "waw'": { wordClass: "noun", english: "base", source: "TKD" },
  moQ: { wordClass: "noun", english: "sphere", source: "TKD" },
  lup: { wordClass: "verb", english: "transport", source: "TKD" },
  Duj: { wordClass: "noun", english: "ship", source: "TKD" },
  ngan: { wordClass: "noun", english: "inhabitant", source: "TKD" },
  QeD: { wordClass: "noun", english: "science", source: "TKD" },
  "Qu'": { wordClass: "noun", english: "task, duty", source: "TKD" },
  potlh: { wordClass: "verb", english: "be important", source: "TKD" },
  wIv: { wordClass: "verb", english: "choose", source: "TKD" },
  lel: { wordClass: "verb", english: "take out", source: "TKD" },
  woD: { wordClass: "verb", english: "throw away", source: "TKD" },
  ngev: { wordClass: "verb", english: "sell", source: "TKD" },
  chenmoH: { wordClass: "verb", english: "build", source: "TKD" },
  jIr: { wordClass: "verb", english: "rotate", source: "TKD" },
  nav: { wordClass: "noun", english: "paper", source: "TKD" },
  ghom: { wordClass: "noun", english: "group", source: "TKD" },
  ghop: { wordClass: "noun", english: "hand", source: "TKD" },
  ngoQ: { wordClass: "noun", english: "goal", source: "TKD" },
  "chaw'": { wordClass: "verb", english: "allow", source: "TKD" },
  mIw: { wordClass: "noun", english: "procedure", source: "TKD" },
  paq: { wordClass: "noun", english: "book", source: "TKD" },
  "je'": { wordClass: "verb", english: "buy", source: "TKD" },
  ngaS: { wordClass: "verb", english: "contain", source: "TKD" },
  tep: { wordClass: "noun", english: "cargo", source: "TKD" },
} as const satisfies Readonly<Record<string, KlingonLexiconEntry>>;
