/** Klingon edition of the Lunar Base product copy in ../lunar-base.ts. */
import type { FeatureSpec } from "../lunar-base.js";
import type {
  CallToAction,
  FaqEntry,
  ListItem,
  Prose,
  Section,
  Statement,
} from "../schema.js";

export const pitch: Statement = {
  text: "Lunar Base 'oH 2-6 'ovwI' Dup nav Quj'e'. maSDaq waw' (Base) HoS law' Hoch HoS puS chenmoHmeH bo'ov.",
  source: "official-wording",
};

export const differentiator: Statement = {
  text: "loS Qapla' ngoQ tu'lu', 'ej wa' poH Hoch chavlaHlu'. latlh waw' botmeH, waw'DajDaq vumwI' (Agent) DangeHlaH.",
  source: "official-wording",
};

export const heroFacts: readonly Statement[] = [
  { text: "Quj lanmeH wa' tup poQlu' noH.", source: "E11" },
  { text: "QujmeH 30 tup poQlu' noH.", source: "E10" },
];

export const featuredDescription: Prose = [
  "Lunar Base 'oH 2-6 'ovwI' Dup nav Quj'e'. maSDaq waw' (Base) HoS law' Hoch HoS puS chenmoHmeH bo'ov. nom Qujlu' (30 tup poQlu' noH); Qatlhbe'qu', ngeDqu' ghojmeH, 'ej nom lanlu'.",
  "mach 'aplo' 'ach Doch law' ngaS Lunar Base. QaQqu' navmey ghItlhmeH mIw mIlloghmey je; pIj Qujqa'laHlu', qengmeH ngeD, Qatlhghach choHlaHlu', 'ej pImbogh Qapla' ngoQmeymo' qechmey law' lo'laH 'ovwI'.",
];

export const replayability: Statement = {
  text: "4 pImbogh Qapla' ngoQmey, pImbogh Dupmey, navmey rarbogh ghu', latlh HoS (Influence) navmey je ngaS Quj; vaj pIj Qujqa'laHlu' 'ej Qatlhghach ghurmoHlu'.",
  source: "official-wording",
};

export const gameNightUse: Statement = {
  text: "Quj ram taghmeH ghap Dorpa' QujmeH yIlo'; poQlu'DI' 'ovwI' tIchel ghap tIteq. pagh ramvam Quj potlh yImojmoH: 3 / 5 Quj Qapbogh 'ovwI' yIwIv.",
  source: "official-wording",
};

export const specifications: readonly FeatureSpec[] = [
  {
    term: "nom Qujlu'",
    detail: ["QujmeH 30 tup poQlu' noH. yevtaHvIS yIQuj!"],
    source: "E10",
  },
  {
    term: "pIj Qujqa'laHlu'",
    detail: ["Hoch Quj pIm. latlh navmey chel ghap pImbogh chutmey lo'."],
    source: "official-wording",
  },
  {
    term: "nom tagh",
    detail: ["20 tup qaStaHvIS yIghoj. 1 tup qaStaHvIS yIlan."],
    source: "E11",
  },
  {
    term: "qengmeH ngeD",
    detail: ["qengmeH mach 'aplo'. Dat yIqeng!"],
    source: "E12",
  },
  { term: "'ovwI' De'", detail: ["2 - 6 'ovwI'", "10 + ben"], source: "E9" },
];

export const howItPlays: Section = {
  anchor: "how-it-plays",
  heading: "wej mIw yugh jop",
  body: [
    "vumwI' navmey tIlo'. jop taghDI', DIlmeH Huch yap Daghajchugh, vumwI' navmey law' Dalo'laH. nom waw'lIj yIchenmoH ghap latlh waw' yIbot.",
    "waw'lIjvo' wa' Qu' potlh (Main Action) yIta'. 'ay' (Module) yIchenmoH (Build); nav yIwIv (Draft), yIlel (Draw), yIwoD (Discard), yIngevqa' (Resell); logh Daq (Station) yIjIrmoH (Flip); 'ay' ghap Huch (Credit) yInIH. waw'lIj Qu'meyvo' wa' yIwIv; bIchenmoHDI', jop veb Qu'meylIj choH.",
    "lup Duj (Shuttle) paw 'e' yInuD. nobmeH Daq (Supply) navmey Hoch lo'lu'DI', waw'DajDaq rInbogh SuDbogh 'ej wovbogh moQ (Orb) HochvaD wa' Huch Hev Hoch; ghIq tera'vo' navmey chu' paw.",
  ],
  source: "rulebook",
};

export const teaserVideos: readonly {
  heading: string;
  title: string;
  youTubeId: string;
}[] = [
  {
    heading: "HaSta 1",
    title: "Lunar Base HaSta - 'ay' 1",
    youTubeId: "QZ_Pqf3eY4o",
  },
  {
    heading: "HaSta 2",
    title: "Lunar Base HaSta - 'ay' 2",
    youTubeId: "KSuIqu5qzTM",
  },
  {
    heading: "HaSta 3",
    title: "Lunar Base HaSta - 'ay' 3",
    youTubeId: "JjlDpS2ByXY",
  },
  {
    heading: "HaSta 4",
    title: "Lunar Base HaSta - 'ay' 4",
    youTubeId: "v0lS1aenCXU",
  },
];

export const victoryPathsIntro: Statement = {
  text: "logh qaD DaQapmeH, logh Daq HoS yIlo'. waw'Daq waw' ngan law' yIDabmoH, QeD Qapla' yISuq, maS Huch yIboS, ghap HoS (Influence) law' Hoch HoS puS yISuq.",
  source: "official-wording",
};

export const victoryPaths: readonly ListItem[] = [
  {
    term: "20 maS Huch tIboS",
    detail:
      "ngevmeH Daq yIlo'. Dochmey DapoQbe'bogh tIngevqa'; poQbogh nuvpu'vo' Huch yISuq; cha'logh DIlmeH Huch yap Daghajbe'chugh, pagh yIchenmoH.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "waw'lIjDaq 10 waw' ngan tIDabmoH",
    detail:
      "waw' tIn yIchenmoH. logh DaqDaq 'ay'meyDaq je Dab waw' nganpu'; vaj waw' tIn, rarbogh 'ay'mey je poQ mIwvam. latlh Hoch mIwvam luleghlaH.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "waw'lIjDaq 5 pImbogh QeD Qapla'mey tIchav",
    detail:
      "vagh pImbogh QeD Qapla'mey poQlu'. loS QeD Qapla'mey 'ej wa' rapbogh Qapla' Qapla' ngoQ chavbe'; mI' SImbe'bogh 'ovwI' ghu'vam QaghmoH.",
    source: "rulebook-victory-conditions",
  },
  {
    term: "bIjoptaHvIS poH DorDI', ghoplIjvo' 4 HoS navmey tI'ang",
    detail:
      "tam mIwvam. HoS navmey poQ nIvbogh Quj mIw; navmeyvam DuDDI' neH mIwvam chavlaHlu'. 'ej pagh leghpu'bogh ghopvo' Quj DorlaH.",
    source: "rulebook-victory-conditions",
  },
];

export const victoryPathsNote: Statement = {
  text: "Qapla' ngoQ chavDI' vay', SIbI' Dor Quj. mI' SImmeH jop Qav tu'lu'be'; Qap vay' 'e' 'ang jop Qav.",
  source: "rulebook",
};

export const influenceVariantNote: Statement = {
  text: "wa'DIch QujmeyDaq HoS navmey lo'be'lu' 'e' chup mIw paq; Quj yajDI' Hoch, navmeyvam tIDuD.",
  source: "rulebook",
};

export const inTheBox: readonly ListItem[] = [
  {
    term: "6 logh Daqmey (Stations)",
    detail: "Hoch 'ovwI'vaD wa'; cha' Dop ghaj.",
    source: "components",
  },
  {
    term: "26 vumwI'pu' (Agents)",
    detail: "jop taghDI' DIltaHvIS lo'lu'.",
    source: "components",
  },
  {
    term: "8 HoS navmey (Influences)",
    detail: "nIvbogh Quj mIw, loSDIch Qapla' ngoQ je.",
    source: "components",
  },
  {
    term: "50 'ay'mey (Modules)",
    detail: "Dochmeyvammo' waw'lIj chen.",
    source: "components",
  },
  {
    term: "6 Huch mI' janmey",
    detail: "Hoch 'ovwI'vaD wa'; DaH Huch mI' 'angmeH yIjIrmoH.",
    source: "components",
  },
  {
    term: "mIw paq",
    detail: "chutmey Hoch ngaS; SIr'o' DaqvamDaq je DalaDlaH.",
    source: "rulebook",
  },
];

export const inTheBoxSummary: Statement = {
  text: "90 navmey: 6 logh Daqmey (Stations), 26 vumwI'pu' (Agents), 8 HoS navmey (Influences), 50 'ay'mey (Modules); 6 Huch mI' janmey mIw paq je.",
  source: "components",
};

export const travelsWell: Section = {
  anchor: "travels-well",
  heading: "qengbogh tep ngaSwI'lIjDaq lanlaHlu'",
  body: [
    "12 × 12 × 4 juvmeH mI' (centimetres) tIn 'aplo', 'ej 200 juvmeH mI' (grams) ngI'. qengbogh tep ngaSwI' 'ay'Daq ngeDqu' lanmeH.",
    "Quj Daghajbogh, Quj DaQujbogh je pIm. tach, machbogh juH, nuvpu' ghom wanI' cha'DIch jaj je leng 'aplo'vam; rep wa'maH wa' DorDI' Quj tIn, 'aplo'vam lo'qa'lu'.",
  ],
  source: "E12",
};

export const factions: readonly ListItem[] = [
  {
    term: "Shackleton",
    detail:
      "United Nations DIvI' QaH ghaj; wa' tInbogh, Sepmey law' nganpu' ngaSbogh veng chenmoH, nItebHa' Dabchugh Hoch, logh veng tagh 'e' Har.",
    source: "official-wording",
  },
  {
    term: "Taikotech",
    detail:
      "tlhIlmeH 'ej tInbogh malja'mo' Huch Suqchugh, tera'vo' Humanpu' lengmoHlaH 'e' Har.",
    source: "official-wording",
  },
  {
    term: "Selene Labs",
    detail: "QublaHqu'bogh nuvpu' je', 'ej jul ghomvo' ghoSmeH HeDaq lulan.",
    source: "official-wording",
  },
  {
    term: "Dark Side",
    detail:
      "yagh QeD, ngebbogh leghmeH ghu' je Huch lo'taHvIS, Humanpu' DubmeH 'ov: Duj DaDubpa', beq yIDub.",
    source: "official-wording",
  },
  {
    term: "Imbrium",
    detail:
      "tInbogh malja'mey ghom; ngo' wo' mIw lo': malja' ghap chenmoHmeH HoS lo'taHvIS, HoS law' Hoch HoS puS yImoj.",
    source: "official-wording",
  },
  {
    term: "The Oasis",
    detail:
      "tera' yIn HochvaD maS juH cha'DIch chenmoH; Ha'DIbaHmey, tI, naDev Daq HutlhchoHbogh Hoch je.",
    source: "official-wording",
  },
];

export const purchase = {
  productName: "{productName}",
  availability: "polmeH DaqDaq tu'lu'",
  notes: [
    {
      term: "tu'lu'ghach",
      detail:
        "polmeH DaqDaq tu'lu', 'ej taH ghu'vam. polmeH Daq mI' wISImbe'; vaj tenwalvamDaq nom bIje'nISbe'.",
      source: "stock-policy",
    },
    {
      term: "ngeH",
      detail: "3 malja' jaj qaStaHvIS ngeHlu'.",
      source: "dispatch-window",
    },
    {
      term: "HIjmeH 'ap",
      detail:
        "European Union HurDaq, tep pawDI' HIjmeH 'ap, HIjwI' 'ap je poQ HIjmeH Sep; HevwI' DIl.",
      source: "duties-outside-eu",
    },
  ] satisfies readonly ListItem[],
  callsToAction: [
    {
      label: "je'meH ngaSwI'Daq yIchel",
      emphasis: "primary",
      target: { kind: "route", to: "cart" },
    },
    {
      label: "HIjmeH mIw tatlhmeH mIw je",
      emphasis: "quiet",
      target: { kind: "route", to: "legalShipping" },
    },
  ] satisfies readonly CallToAction[],
} as const;

export const productFaq: readonly FaqEntry[] = [
  {
    question: "ngeHmeH 'ap 'ar poQlu'?",
    answer: [
      "Huch nobmeH DaqDaq HIjmeH DaqlIjmo' ngeHmeH 'ap, qum 'ap je SImlu'. qum 'ap noblu'pa' Quj DIlmeH Huch rap Hoch SepDaq; chellu'bogh Huch neH choH: {priceLine}",
    ],
    source: "shipping-charge",
  },
  {
    question: "nuqDaq ngeHlu'?",
    answer: [
      "Dat. 3 malja' jaj qaStaHvIS vunmeH QInmey ngeHlu'. European Union qo'Daq 3 jajvo' 7 jajDaq paw motlh tep; latlh SepmeyDaq 7 jajvo' 21 jajDaq paw.",
    ],
    source: "delivery-estimates",
  },
  {
    question: "vItatlhlaH'a'?",
    answer: [
      "HIja'. tep pawbogh jajvo' 14 jaj qaStaHvIS bIje'Ha' 'e' yIja'; ghIq 14 jaj qaStaHvIS yItatlh.",
    ],
    source: "withdrawal-terms",
  },
  {
    question: "English Hol mIw paq tu'lu''a'?",
    answer: [
      "'aplo'Daq English Hol mIw paq tu'lu'. bIje'pa' DalaD DaneHchugh, SIr'o' DaqvamDaq mIw paq rap DalaDlaH.",
    ],
    source: "rulebook",
  },
  {
    question: "cha' 'ovwI' QujlaH'a'? jav 'ovwI' je?",
    answer: [
      "cha' mI' jav mI' je QujlaH, 'ach Qujmey pIm. cha' 'ovwI' QujDI', nobmeH DaqDaq vagh navmey tu'lu', 'ej retlhDaq wa' latlh waw' tu'lu'. cha' nuv qaD rur, 'ej nuq poQ jaghlI' 'e' leghlaHlu' motlh.",
      "jav 'ovwI' QujDI', nobmeH DaqDaq Hut navmey tu'lu', 'ej vagh latlh waw'mey tu'lu'; vaj vumwI' navmeyvaD ngoQmey law' tu'lu'. jav 'ovwI'vaD Quj chenmoHlu'pu'; mI'vam 'aqroS 'oH, Qagh rurbe'.",
    ],
    source: "rulebook",
  },
];

export const productSafety = {
  heading: "chenmoHwI' Quj Hung je",
  manufacturer: {
    heading: "chenmoHwI'",
    body: [
      "{merchantLegalName}, {merchantRegisteredAddress}.",
      "QIn Daq: {merchantContactAddress}. ghogh HablI': {merchantPhoneNumber}.",
      "{merchantLegalName} Qujvam chenmoHmoH, 'ej pongDaj lo'taHvIS ngev; vaj European Union Quj Hung chutDaq chenmoHwI' 'oH. Longpack Co., Ltd., Shanghai, China SepDaq, Quj ghItlh 'ej 'ay'mey rarbogh mab chenmoHwI' 'oH; chenmoHwI' mab chenmoHwI' rurbe'.",
    ],
  },
  safety: {
    heading: "Hung De'",
    body: [
      "Dung 'ovwI' De'Daq ben mI' 'oH Qujvam Hung per'e'; QujmeH chupmeH mI' rurbe'. ghu'vam QIj De'vam.",
      "Intertek Testing Services Ltd. Shanghai, China SepDaq, European Union puq Quj Hung chutmey pab 'e' waH; SHAH01338706 nompuq taDaq 14 May 2021 jajDaq Hoch waHlu'DI' Qappu' Quj. DaH je lugh bIng De': ghIq latlh navmey ghItlhlu'be', vaj DaH ngevlu'bogh Qujmey Del.",
    ],
    results: [
      {
        term: "EN71-1:2014+A1:2018",
        detail: "Doch chenmoHmeH HoS, Doch ghu' je — Qap.",
        source: "E16",
      },
      {
        term: "EN71-2:2020",
        detail: "meQlaH 'e' waHlu' — Qap.",
        source: "E16",
      },
      { term: "EN71-3:2019", detail: "'op Dochmey leng — Qap.", source: "E16" },
      {
        term: "EN71-3:2019 European Union chut 2019/1922",
        detail: "Directive 2009/48/EC choH; baS (aluminium) leng — Qap.",
        source: "E16",
      },
    ] satisfies readonly ListItem[],
  },
} as const;
