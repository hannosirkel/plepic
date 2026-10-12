/**
 * Support copy — the Klingon edition of `../support.ts`: rules help, the
 * rulebook link and contact.
 *
 * This file is a translation, not a revision. Exports, anchors, source ids,
 * link targets and the contact placeholder are the English module's. Every
 * rules answer is the rulebook's answer, as in English.
 *
 * Published under `/tlh` through `siteCopyByLocale`. The mirror test, the
 * content scans and the Klingon word check still read this file.
 *
 * The rules answers use the words of `content/glossary/tlh.ts`, because they
 * will be read beside the rulebook: `mIw paq` (rulebook), `Qapla' ngoQ`
 * (victory condition), `HoS` (Influence), `QeD Qapla'` (scientific
 * achievement), `navmey ghom` (deck), `navmey woDlu'bogh ghom` (discard pile),
 * `ghop` (hand), `Qu' potlh` (Main Action), `waw'` (Base) and `vumwI'`
 * (Agent). A word the cards print stands in brackets at its first use.
 *
 * Table talk the glossary's term list does not hold is in `klingonLegalTerms`
 * there, so the rulebook text can use it again: a player is `'ovwI'`, to take
 * one's turn is `jop`, to shuffle is `DuD`, to play a card is `lo'` and to
 * carry out an action is `ta'`. A question is `mu'tlhegh`, a sentence, with
 * the verb `ghel`, because Klingon has no noun for it.
 *
 * `Quj` is a noun in the lexicon; where it is the verb "play" it stands bare.
 */
import type { FaqEntry, Link, Section } from "../schema.js";

export const supportIntro: Section = {
  anchor: "rules-faq",
  heading: "Quj mIwmey, QaH je",
  body: [
    "SIr'o' DaqvamDaq mIw paq naQ tu'lu', 'ej raSDaq pIj ghellu'bogh mu'tlheghmey tu'lu' je. naDev mu'tlheghlIj janglu'be'chugh, QIn ghongeH — QInmeyvetlh laD jav nuv, 'ej nav boghoHbogh renta' wa'.",
  ],
};

export const printedRulebookNote: Section = {
  anchor: "rules-faq",
  heading: "mIw paqDaq ghItlhlu'bogh SIr'o' Daqvo' bIghoSchugh",
  body: [
    "Daq lugh DaSamta'. DaH naDev DungeH Quj SIr'o' Daq ngo', 'ej tenwalvamDaq DaH lo'lu'bogh Quj mIwmey, pIj ghellu'bogh mu'tlheghmey, pImbogh Quj mIwmey je tu'lu'.",
  ],
  source: "rulebook",
};

export const rulebookLink: Link = {
  label: "mIw paq yIlaD",
  target: { kind: "route", to: "rulebook" },
  accessibleLabel: "Lunar Base mIw paq yIlaD",
};

export const rulesFaq: readonly FaqEntry[] = [
  {
    question: "joptaHvIS wa' 'ovwI', Qapla' ngoQ luta' cha' nuv. Qap 'Iv?",
    answer: [
      "ngoQmey'e' ta'pu'bogh wa' nuv law' law' ngoQmey'e' ta'pu'bogh latlh nuv law' puS — Qap nuvvam. rapchugh ngoQmey ta'lu'pu'bogh mI', nItebHa' Qap.",
    ],
    source: "rulebook",
  },
  {
    question: "Quj wa'DIch wItaghDI', HoS (Influence) navmey DIlo'nIS'a'?",
    answer: [
      "ghobe'. baw'pa' 'ovwI'pu', navmeyvam lo'lu'be' 'e' chup mIw paq; ghIq, navmey noblu'pa', navmey ghomDaq DuDlu' 'e' chup. QapmeH mIw loSDIch luchel, 'ej navmeyvammo' pImchoH latlh wej mIw net jem.",
    ],
    source: "rulebook",
  },
  {
    question: "vagh nav 'oS'a' vagh QeD Qapla'?",
    answer: [
      "pImbogh vagh Qapla' 'oS. rapchugh cha' Qapla', wa'logh neH toghlu'. Qagh 'oH; 'ovwI'pu' lujmoH.",
    ],
    source: "rulebook",
  },
  {
    question: "natlhlu'pu' navmey ghom. DaH nuq?",
    answer: [
      "navmey ghom chu' DachenmoHmeH, navmey woDlu'bogh ghom yIDuD, 'ej navmey tIleltaH.",
    ],
    source: "rulebook",
  },
  {
    question: "nav 'ar vIpollaH?",
    answer: ["DaneHbogh Hoch yIpol. ghop navmey vuSbogh mI' tu'lu'be'."],
    source: "rulebook",
  },
  {
    question: "tagh 'Iv?",
    answer: [
      "qaStaHvIS DaHjaj nungbogh 30 jaj, wa' 'ovwI' leng nI' law' Hoch leng nI' puS; tagh 'ovwI'vam. ghIq, vebbogh QujmeyDaq, tagh QapwI' poS DopDaq ba'bogh 'ovwI'.",
    ],
    source: "rulebook",
  },
  {
    question: "jIjoptaHvIS, Qu' potlh (Main Action) vIta'DI', latlh vIta'laH'a'?",
    answer: [
      "ghobe' — bIjopDI', wa' Qu' potlh neH yIta'; waw'lIjDaq (Base) Data'laHbogh Qu' potlh yIwIv. Qu' potlh Data'pa', vumwI' (Agent) navmey Dalo'laH — mI' DaneHbogh — bIH DaDIllaHchugh.",
    ],
    source: "rulebook",
  },
];

export const contact: Section = {
  anchor: "contact",
  heading: "QIn ghongeH",
  body: [
    "Quj mIwmey bopchugh QInlIj, Dachchugh wa' nav, Quj ngev neHchugh ngevmeH Daq, pagh vunmeH QInlIj De' chu' DaHevbe'chugh — wa' DaqDaq neH paw Hoch QIn. qaStaHvIS wa' jaj cha' jaj ghap majang.",
    "QIn Daqvam Dalo'laH je: {merchantContactAddress}.",
  ],
};

export const contactForm = {
  nameLabel: "ponglIj",
  emailLabel: "QIn DaqlIj",
  subjectLabel: "nuq bop QInlIj?",
  messageLabel: "QIn",
  submitLabel: "yIngeH",
  successMessage: "pItlho' — QInlIj wIHevta'.",
  errorMessage:
    "QIn ngeHlu'be'. yInIDqa', pagh QIn DaqvamDaq QIn ghongeH: {merchantContactAddress}.",
  notSentMessage:
    "pagh ngeHlu'. QIn DaqmajDaq QInmey ngeHbe' QIn ghItlhmeH Daqvam; vaj QInlIj HIjlu'be' 'ej pollu'be'. QIn Daqmaj yIlo' — DungDaq tu'lu'.",
} as const;
