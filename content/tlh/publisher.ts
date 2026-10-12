/**
 * Publisher copy — the Klingon edition of `../publisher.ts`: who Plepic is,
 * the story, the team, the newsletter.
 *
 * This file is a translation, not a revision. Exports, anchors, source ids,
 * link targets and the price placeholder are the English module's, and the
 * reasoning for each is recorded there. Nothing is added that the English
 * edition does not say.
 *
 * Published under `/tlh` through `siteCopyByLocale`. The mirror test, the
 * content scans and the Klingon word check still read this file.
 *
 * The publisher is `Se'vIr malja'`, the attested phrase for a publishing
 * house. A board game is `'echlet Quj` and a card game `nav Quj`, with the
 * glossary's word for a card. The crowdfunding campaign is `Huch boSmeH Qu'`,
 * "the mission of collecting money". Each is written out in
 * `content/glossary/tlh.ts` (`klingonLegalTerms`).
 *
 * A name takes no Klingon suffix, so the company's name stands before
 * `malja'` and a country's before `Sep`, which carry the suffix. `Quj` is a
 * noun in the lexicon; where it is the verb "play" it stands bare.
 */

import type { CallToAction, Prose, Section, Statement } from "../schema.js";

export const publisherSentence: Statement = {
  text: "'echlet Quj parHa'qu'bogh nuvpu' ghom 'oH Plepic Games malja''e'. Lunar Base chenmoHta' ghomvam: Kickstarter Huch Suqpu'bogh nav Quj 'oH; qaStaHvIS wej DIS juSbogh poH, 'op yuweymeyDaq pupmoHlu'pu'.",
  source: "E8",
};

export const publisherShort: Statement = {
  text: "machbogh 'ej tlhabbogh 'echlet Quj Se'vIr malja'; Tallinn vengDaq Sum. jav nuv, wa' Quj, wej DIS Qu'.",
  source: "E8",
};

export const publisherStory: Section = {
  anchor: "story",
  heading: "jav nuv, wa' Quj, wej DIS",
  body: [
    "DIS 2017 tagh Lunar Base. Estonia SepDaq qaD nap luwuq jav juppu': qengmeH ngeDbogh nav Quj luchenmoHnIS, 'ej nItebHa' Qujvam luQuj luneHbej. wa'DIch pupbe'bogh chovnatlh 'oH; juHDaq chenmoHlu'. qaStaHvIS 'op DIS ngonglu', Quj waHlu', lISlu', mIlloghmey chenmoHlu', 'ej Quj qo' chenmoHlu'; vaj nom rInbogh Dup Quj mach moj chovnatlh. maSDaq mIDmey chenmoHmeH 'ovbogh Humanpu' Del Quj. qaStaHvIS poHvam ghur ghom; qechmey waHlu' 'ej lonlu'; Quj luDub machbogh choH law'qu', 'ej Quj Qav luchenmoH. ghIq Qapchu' Kickstarter Huch boSmeH Qu'. Qu'vammo' 'echlet Quj Se'vIr moj juppu' jInmol, 'ej DaH qo' HochDaq Qujvam luQuj nuvpu'.",
  ],
  source: "E8",
  links: [
    {
      label: "mung lut",
      target: { kind: "external", to: "origin-story" },
      accessibleLabel: "Lunar Base mung lut yIlaD",
    },
  ],
};

/** Editorial source record, mirroring the English edition. It is not rendered. */
export const publisherStorySources: readonly Statement[] = [
  { text: "DIS 2017, jav nuv, Tallinn vengDaq Sum.", source: "E8" },
  { text: "wej DIS: pIj choHlu' Quj, 'ej tIvlu'pa' machmoHlu'taH.", source: "E8" },
  { text: "Kickstarter lo'taHvIS Huch nob nuvpu'; cha'SaD juS mI'chaj. ghIq Quj HIjlu'.", source: "E5" },
  {
    text: "Denmark Sep 'echlet Quj Qe'Daq vaghmaH Quj ngevlu' net noH; Qe'vamDaq Quj chenmoHmeH mIw Dellu', 'ej qaD mIr qaS.",
    source: "E6",
  },
  { text: "DaH jav nuv tu'lu'taH.", source: "E8" },
];

export const team: Section = {
  anchor: "team",
  heading: "jav nuvvam",
  body: ["*tagha'*, ghItlh chu' pIw lutIvtaH"],
  source: "E8",
};

export const newsletter = {
  heading: "pIjHa' QIn pIngeH",
  body: [
    "lo'laHbejbogh De' wIghajDI' neH, QIn wIngeH: Quj chu'; Quj lIngqa'lu'bogh; pagh maSDaq Lunar Base Quj vay'.",
    "bIqI'Ha'meH wa'logh neH leQ Da'uy, 'ej latlhvaD QIn DaqlIj wInobbe'.",
  ] satisfies Prose,
  fieldLabel: "QIn Daq",
  submitLabel: "yIqI'",
  consentNote: "bIqI'DI', rut QIn pIngeH 'e' Dalaj. Hoch QInDaq bIqI'Ha'laH.",
  successMessage: "bIqI'ta'. lo'laHbogh De' wIghajDI' neH, QIn pIngeH.",
  errorMessage: "bIqI'ta'be'. qI'meH Daq yInuD 'ej yInIDqa'.",
  postPurchaseHeading: "bIvunta'DI', QInmeymaj DaHevlaH",
  postPurchaseBody:
    "vunmeH QInlIj choHbe' Doch DawIvbogh. rut Plepic Games De' chu' DaneHchugh neH, yIqI'.",
  postPurchaseConsentLabel: "HIja', QIn DaqvamvaD rut De' chu' QInmey tIngeH.",
} as const;

export const homepageCallsToAction: readonly CallToAction[] = [
  {
    label: "Lunar Base yInuD",
    emphasis: "primary",
    target: { kind: "route", to: "lunarBase" },
  },
  {
    label: "yIje': {price}",
    emphasis: "secondary",
    target: { kind: "route", to: "lunarBase", anchor: "buy" },
    accessibleLabel: "Lunar Base yIje': {price}",
  },
];
