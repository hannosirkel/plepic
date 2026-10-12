/**
 * Proof — the Klingon edition of `../proof.ts`: the homepage strip, and the
 * quotations the game page carries.
 *
 * This file is a translation, not a revision. The choice of items, their
 * order, their source ids and the link target are the English module's, and
 * the reasoning for each is recorded there. Nothing is added that the English
 * edition does not say.
 *
 * Staged: `siteCopyByLocale.tlh` is still `null`, so no visitor reaches this
 * copy. The mirror test, the content scans and the Klingon word check read it
 * from disk.
 *
 * The reviewers spoke and wrote in English. Each quotation here is a
 * translation of the attributed passage, keyed to the same source id.
 * Attributions are names and stay as they are; each is on the name list of
 * `scripts/klingon-words.ts`, as are the evidence ids and the retired route
 * that the unrendered `rejected` reasons cite.
 *
 * A player is `'ovwI'`, the attested word for one who plays a competitive
 * game. A review is `Quj chovbogh mu'mey`, "words which assess the game". The
 * proof strip is `nompuq tetlh`, the evidence manifest `nompuq ta`, and a
 * headline `per'a'`. Each is written out in `content/glossary/tlh.ts`
 * (`klingonLegalTerms`).
 */

import type { ProofStrip, Quotation } from "../schema.js";

/**
 * Paul Grogan on the card design — one string, two presentations, as in
 * English: it heads the proof strip and it is quoted on the product page.
 */
export const cardDesignQuote =
  "navmey mIlloghmey, navmey renmeH mIw je qellu'DI' — yajmeH ngeDqu' navmey, lI'qu', 'ej 'IH je. QujmeyDaq ghu'vam chavmeH Qatlh.";

/**
 * Three items, in the English order. The Kickstarter figures stay in the
 * detail of the first item and never in a headline.
 */
export const proofStrip: ProofStrip = {
  items: [
    {
      source: "E5",
      supporting: ["E14", "E15"],
      headline: "2,000 juS Huch nobpu'bogh nuvpu' mI'",
      detail:
        "qaStaHvIS cha' rep ngoQDaj chav Huch boSmeH Qu', 'ej rInDI', ngoQ 4,606 vatlhvI' boSlu'pu'. ghIq Quj ghItlhlu', 'aplo'meyDaq lanlu', 'ej ngeHlu'; Qujmeychaj Hev Huch nobpu'bogh nuvpu'.",
      link: {
        label: "Huch boSmeH Qu' yIlegh",
        target: { kind: "external", to: "kickstarter-campaign" },
        accessibleLabel: "Lunar Base Kickstarter Huch boSmeH Qu' yIlegh",
      },
    },
    {
      source: "E3",
      // Concatenated, as in English: the content scans read this file as text.
      headline: "“" + cardDesignQuote + "”",
      detail: "Paul Grogan, Gaming Rules!",
    },
    {
      source: "E2",
      headline: "“Quj ngaj 'oH, 'ach ram naQ natlhlaHbej.”",
      detail: "Hairy Game Lords",
    },
  ],
  /** The same editorial decisions as the English source; these are not rendered. */
  rejected: [
    {
      source: "E7",
      reason:
        "Finland SepDaq 100 Quj ngev ngevmeH Daq mIr, 'ej Estonia SepDaq 100 Quj ngev latlh mIr, net noH. 'ollu'pu', 'ach mIrmeyvam pong wI'anglaHbe'; vaj pong Hutlhbogh mI' HarnIS SuchwI' — De'vam puj law' Brætspilscaféen De' puj puS, 'ach rap Qu'chaj. /about tenwalDaq poH tetlhDaq 'anglu'pu'; jajmey tetlhDaq Daq qotlh. jaj 2026-08-20 tenwalvetlh teq SIr'o' Daq vu'wI', 'ej poH tetlh teq; vaj DaH SIr'o' DaqDaq E7 'anglu'be'. nompuq taDaq pollu'taH, mI' 'ollu'pu'mo', 'ej chaq ghIq E7 lo'laH tenwal 'ay' chu'; 'ach DaH E7 'ang pagh, 'ej tetlhvam laDDI' vay', pIm ghu' 'e' Harbe'nIS.",
    },
    {
      source: "E1",
      reason:
        "AireCon wanI'Daq 10 Quj nIvqu' wIv Rodney Smith, 'ej wa' 'oH Lunar Base Quj'e'. tetlhvamDaq pongDaj noy law' Hoch pong noy puS; 'ach De'vam neH 'ollaHbe' chu'bogh SuchwI': HaSta teqlu'pu', 'ej HaStavaD rarwI' wIchenmoHlaHbe'; vaj mu'maj neH HarnIS SuchwI'. per'a'Daq mI' 'anglu'chugh, mI'vam 'ollaH SuchwI' net poQ. De'vam 'IHmoHmeH, ghaytan Degh mIllogh lo' renwI' — 'ach mIwvam tuch nompuq ta. Quj tenwalDaq mu'meyDaj 'anglu', 'ej ghu' teH Dellu': 10 Quj nIvqu' 'angbogh HaStaDaq Lunar Base wIvlu'.",
    },
    {
      source: "E6",
      reason:
        "Denmark Sep 'echlet Quj Qe'Daq 50 Quj ngevlu' net noH; Qe'vamDaq Quj chenmoHmeH mIw Dellu' je, 'ej qaD mIr qaS je. 'ollu'pu'. nompuq tetlhDaq wa'DIch 'oH De'vam'e'; 'ach jaj 2026-08-20 choH ghu': E6 qa' E3 'e' wuq SIr'o' Daq vu'wI'. Quj ngevDI' latlh malja', nompuq *Segh* nIvqu' 'oH ghu'vam'e'; 'ach per'a'Daq chu'bogh SuchwI'vaD Qe' lIHlaHbe' vay' — potlhchoHpa' mI', Brætspilscaféen QIjmeH per cha'DIch naQ lo'nISlu'. Se'vIr malja' lutDaq, Hoch 'ay'vaD nompuq ngu'bogh tetlhDaq ratlh De'vam.",
    },
    {
      source: "E4",
      reason:
        "mu'mey DIghajbogh DIqelDI', mu'meyvam QaQ law' Hoch QaQ puS; 'ach nompuq tetlhvaD tIqqu'. vaj Quj tenwalDaq, Quj chovbogh mu'mey 'ay'Daq wa'DIch 'oH; 'ay'vetlhDaq yap Daq.",
    },
    {
      source: "E9",
      reason:
        "'ovwI' mI' — Quj poH, Quj lanmeH poH je (E10, E11) — teH 'ej lI'; 'ach De'maj 'oH, 'ej latlh nuvvo' ghoSbe'. nompuq tetlhDaq, Quj chovbogh mu'mey retlhDaq 'anglu'chugh, voqlu'; 'ach voqlu' 'e' qotlhbe'. 'aplo' retlhDaq, Quj De' tetlhDaq 'angnISlu'; DaH tetlhvetlhDaq tu'lu'.",
    },
  ],
};

/** Quotations for the game page, in the English order and under the same source ids. */
export const quotations: readonly Quotation[] = [
  {
    source: "E4",
    attribution: "Tabletop Games Blog",
    text: "machbogh Quj QaQqu' 'oH Lunar Base Quj'e'. yapbogh Qu'mey, yapbogh qechmey je Dunob, 'ach DuDoy'moHbe'; 'ej nom rInmo', not DalchoH. Qujmey vIghajbogh vIqelDI', 6 'ovwI' 'aqroS laj 'op neH; wa' 'oH Qujvam'e'. vaj juppu'lI' qorDu'lIj ghap DatlhejDI' QaQqu', 'ach lop Quj rurbe'.",
  },
  {
    source: "E2",
    attribution: "Hairy Game Lords",
    text: "qechmey law' ngaS Qujvam; machqu' 'aplo'! qengmeH ngeDqu', 'ach HuchlIjvaD Doch law'qu' DaSuq.",
  },
  {
    source: "E1",
    attribution: "Rodney Smith, Watch It Played",
    text: "mumerqu'bej Dochvam… machqu'bogh 'aplo'vamDaq Hoch tu'lu'. 'ej Dunqu' mIlloghmey! Dojqu'bej.",
    context: "AireCon wanI'Daq wa'maH Quj nIvqu' wIv; wa' 'oH Qujvam'e'.",
  },
  {
    source: "E3",
    attribution: "Paul Grogan, Gaming Rules!",
    text: cardDesignQuote,
  },
  {
    source: "E2",
    attribution: "Hairy Game Lords",
    text: "pIj Qujvam lo'qa'laH vay' — Dun. machqu' Quj, 'ach lInglu'chu'. 'ovwI' belmoHqu'!",
  },
];
