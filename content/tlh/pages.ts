/**
 * The page registry — the Klingon edition of `../pages.ts`: a title and a
 * description per route.
 *
 * Routes, `indexable` and the section lists are the English ones; only the
 * titles and descriptions are Klingon. Both are unique within the edition, the
 * legal pages included, and a description written here stays within 160
 * characters.
 *
 * Staged: `pagesByLocale.tlh` still holds the legal set alone, so no visitor
 * reaches these six routes in Klingon. The mirror test, the content scans and
 * the Klingon word check read this file from disk.
 *
 * `je'meH ngaSwI'` (basket), `Huch nobmeH Daq` (checkout), `mIw paq`
 * (rulebook), `waw'` (Base) and `vumwI'` (Agent) are the words of
 * `content/glossary/tlh.ts`. The basket's title is the header's label for it.
 */

import { legalPagesByLocale } from "../legal/index.js";
import type { Page } from "../schema.js";

export const marketingPages: readonly Page[] = [
  {
    route: "home",
    title: "Plepic Games",
    description:
      "machbogh 'ej tlhabbogh 'echlet Quj Se'vIr malja'; Tallinn vengDaq Sum. jav nuv, wa' Quj, wej DIS Qu' — 'ej raSDaq Quj lanmeH yap wa' tup noHlu'bogh.",
    indexable: true,
    sections: ["proof", "story", "newsletter"],
  },
  {
    route: "lunarBase",
    title: "Lunar Base — 2-6 'ovwI'pu'vaD Dup nav Quj",
    description:
      "maS waw' HoSghaj law' Hoch HoSghaj puS — waw'vetlh yIchenmoH. QapmeH loS mIw, gholpu'lI' botbogh vumwI'pu', 90 nav, 30 tup noHlu'bogh, buq 'ellaHbogh 'aplo'.",
    indexable: true,
    sections: [
      "aboutgame",
      "how-it-plays",
      "victory-paths",
      "in-the-box",
      "travels-well",
      "video_trailer",
      "reviews",
      "shipping-and-returns",
      "buy",
    ],
  },
  {
    route: "support",
    title: "Lunar Base QaH, Quj mIwmey je",
    description:
      "mIw paq naQ, raSDaq pIj ghellu'bogh mu'tlheghmey, Quj Dochmey tetlh, ghojmoHmeH HaSta, QIn jungeHmeH mIw je.",
    indexable: true,
    sections: ["rules-faq", "components", "contact"],
  },
  {
    route: "rulebook",
    title: "Lunar Base mIw paq",
    description:
      "Lunar Base mIw paq naQ; 'aplo'Daq tu'lu'bogh paq rurchu'. DalaDlaH 'ej mu'mey DanejlaH.",
    indexable: true,
    sections: [],
  },
  {
    route: "cart",
    title: "je'meH ngaSwI'",
    description: "Doch Daje'rupbogh, ngeHmeH 'ap yughbogh Huch naQ je.",
    indexable: false,
    sections: ["buy"],
  },
  {
    route: "checkout",
    title: "Huch nobmeH Daq",
    description: "HIjmeH Daq, ngeHmeH mIw, Huch nobmeH mIw je.",
    indexable: false,
    sections: ["checkout-acknowledgement"],
  },
];

/** Every page of the Klingon edition, marketing and legal alike. */
export const pages: readonly Page[] = [...marketingPages, ...legalPagesByLocale["tlh"]];
