/**
 * tep tatlhmeH mIw, je'Ha'meH DIb je — the Klingon edition of `../returns.ts`.
 *
 * A translation, not a revision. The English page is the twice-reviewed
 * drafting source; the decisions recorded there bind this file:
 *
 * - **The withdrawal period is 14 days**, the statutory figure, left there by
 *   an operator decision of 2026-08-09. It is not "corrected" here.
 * - The model withdrawal form is *provided*, not referred to.
 * - Return-transit risk sits with the trader once proof of postage is shown;
 *   no sentence here puts it on the buyer.
 * - The legal guarantee of conformity is stated positively, with the
 *   two-month notification duty.
 *
 * Route, anchors, `covers`, section order and every placeholder token are
 * identical to the English page.
 *
 * Staged: the file is not registered in `../index.ts`, so no visitor reaches
 * it yet. The mirror test, the content scans and the Klingon word check read
 * it from disk.
 *
 * `reviewStatus` is `operator-approved`: the operator approved every
 * translation of the site-translation job in advance on 2026-10-10, legal
 * pages included. The field records that advance approval. No separate reading
 * of this Klingon wording is recorded here, and the approval is not a standing
 * one for whatever this page may later say: a change to its substance needs
 * its own reading.
 *
 * `je'Ha'` is the glossary's word for withdrawal: "un-buy". The glossary check
 * reads a form at the start of a word, so wherever the English says
 * "withdrawal" the Klingon has the bare stem (`je'Ha'meH …`) and not only a
 * verb with a prefix (`bIje'Ha'`). The other coined terms are written out in
 * `content/glossary/tlh.ts` (`klingonLegalTerms`): `chut 'Ip`, "the law's
 * promise", is the legal guarantee, and `tep DangeHta' 'e' tobbogh nompuq`,
 * "evidence which proves that you have sent the parcel", is proof of postage.
 *
 * To give notice is `maq`, "proclaim". The carrier is excluded from "somebody
 * you nominated" by a sentence of its own. A card of the game is `nav`, as in
 * the glossary's word for the deck, and the game's components are `Dochmey`
 * and not `'ay'mey`, which is the glossary's Module.
 */

import type { LegalPage } from "../../schema.js";

export const returns: LegalPage = {
  route: "legalReturns",
  title: "tep tatlhmeH mIw, je'Ha'meH DIb je",
  description:
    "je'Ha'meH DIblIj (14 jaj), DIbvam Dalo'meH mIw, je'Ha'meH QIn chovnatlh, tep tatlhmeH 'ap nobbogh nuv, tep DatatlhmeH Daq, Huch nobHa'meH mIw je.",
  indexable: true,
  sections: ["withdrawal", "withdrawal-form", "returns-process", "legal-guarantee"],
  covers: [
    "withdrawal-process",
    "withdrawal-deadline",
    "model-withdrawal-form",
    "return-postage-liability",
    "return-address",
    "legal-guarantee-of-conformity",
  ],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "withdrawal",
      heading: "bIwuqqa'meH 14 jaj Daghaj",
      covers: ["withdrawal-process", "withdrawal-deadline"],
      body: [
        "malja'vaD bIje'be'chugh, bIje'Ha'laH 'ej meq DaQIjnISbe'.",
        "14 jaj 'oH je'Ha'meH poH'e'. Doch DaHevDI' tagh poHvam; Doch Hevchugh nuv DawIvbogh, HevDI' nuvvetlh tagh. Doch HevDI' HIjwI' taghbe' poH.",
        "bIje'Ha'meH, Dorpa' 14 jaj, bIje'Ha' 'e' yImaq. QIn ghongeH: {merchantContactAddress}. vunmeH QIn mI', bIje'Ha' 'e' maqbogh wa' mu'tlhegh je ngaSnIS QIn — yap. DaneHchugh, bIngDaq je'Ha'meH QIn chovnatlh Dalo'laH, 'ach Dalo'nISbe'. QIn DangeHbe'chugh 'ach tep DatatlhDI', bIje'Ha'ta' je; 'ach nom paw QIn, 'ej QIn wIHevDI' tep wIloSlaH.",
        "Huch wInobHa'meH 14 jaj nob chut. bIje'Ha' 'e' DamaqDI' tagh poHvam. QIn DangeHbe'chugh 'ej tep neH DatatlhDI', tagh poHvam tep wIHevDI', pagh tep DangeHta' 'e' tobbogh nompuq wIHevDI'.",
      ],
      source: "withdrawal-terms",
    },
    {
      anchor: "withdrawal-form",
      heading: "je'Ha'meH QIn chovnatlh",
      covers: ["model-withdrawal-form"],
      body: [
        "je'Ha'meH QIn chovnatlh (DaneHchugh neH yIlo'):",
        "HevwI': {merchantLegalName}, {merchantRegisteredAddress}, {merchantContactAddress}: Dochmeyvam vIje'meH mab vIlajpu'; DaH jIje'Ha' 'e' vImaq: …",
        "vunmeH jaj / HevmeH jaj: …",
        "je'wI' pong, je'wI' Daq je: …",
        "tlhI' (navDaq ghItlhlu'chugh neH), jaj.",
      ],
      source: "withdrawal-terms",
    },
    {
      anchor: "returns-process",
      heading: "tep DatatlhmeH mIw, HuchlIj DaHevmeH mIw je",
      covers: ["return-postage-liability", "return-address"],
      body: [
        "bIje'Ha' 'e' DamaqDI', Dorpa' 14 jaj Doch yItatlh. tatlhmeH Daq: {returnAddress}.",
        "tep tatlhmeH 'ap Danob SoH. tep ghochlaHbogh ngeHmeH mIw yIlo', 'ej tep DangeHta' 'e' tobbogh nompuq yIpol. nompuqvam Da'angDI', Huch wInobHa'nIS, lengtaHvIS tep je. tep ghochlaHbogh ngeHmeH mIwmey tIqel. wa' mIw qutlh law' Hoch qutlh puS; mIwvetlh yIwIv. latlh Doch wIpoQbe'.",
        "bIje'Ha' 'e' DamaqDI', Dorpa' 14 jaj DochvaD Huch Danobta'bogh, ngeHmeH 'ap motlh je pInobHa'. HIjmeH mIwmaj motlh DawIvbe'chugh, 'ej nom HIjbogh mIw, waghbogh mIw ghap DawIvchugh, ngeHmeH 'ap motlh neH pInobHa'. Doch wIHevpa', pagh tep DangeHta' 'e' tobbogh nompuq Da'angpa', Huch wIpollaH; wanI' wa'DIch neH wIloS.",
        "Huch wInobHa'meH, Huch DanobmeH mIw Dalo'pu'bogh wIlo'; pagh DanobnIS.",
        "Quj 'aplo' DapoSmoHlaH 'ej Quj DanuDlaH — ngevmeH DaqDaq DanuDlaH je. 'ach Quj Dochmey DatatlhDI', QIHlu'pu'chugh pagh naQbe'chugh, 'ej Quj DanuDmeH neH Dalo'be'mo' qaSchugh ghu'vam, Huch wInobHa'bogh wInupmoHlaH; lo'laHghach nupbogh wISIm.",
        "pawDI' Doch, Duy'chugh, QIHlu'pu'chugh, pagh Dellu'bogh Doch rurbe'chugh, latlh chut DIbmey Daghaj; DIbmeyvetlh choHbe' tenwalvam. Dachchugh wa' Quj nav, pagh pawDI' 'aplo' beQmoHlu'pu'chugh, QIn ghongeH: {merchantContactAddress}. ghu' wItI'. ghu'vetlhvaD je'Ha'meH mIw yIlo'Qo'.",
      ],
      source: "return-postage",
    },
    {
      anchor: "legal-guarantee",
      heading: "chut 'IplIj — latlh DIb 'oH",
      covers: ["legal-guarantee-of-conformity"],
      body: [
        "je'Ha'meH DIb (14 jaj) Daghaj, 'ej latlh DIb Daghaj je: chut 'Ip nob European Union chut — mab pabnIS Doch. Doch HIjlu'DI' tagh cha' DIS poH. qaStaHvIS poHvam, HIjlu'DI' Duy' ghajchugh Doch, mangoy'. qaStaHvIS DIS wa'DIch, Duy' tu'lu'chugh, HIjlu'DI' Duy' ghajpu' Doch net Har; teHbe' 'e' wItobchugh neH, net Harbe'. Duy' Datu'DI', Dorpa' cha' jar ghoja'. Doch wItI', Doch wIqa', DIlmeH Huch wInupmoH, pagh Huch pInobHa'. pagh DanobnIS.",
      ],
    },
  ],
};
