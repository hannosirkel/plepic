/**
 * ngeHmeH mIw, HIjmeH mIw je — the Klingon edition of `../shipping.ts`.
 *
 * A translation, not a revision. The English page is the drafting source, and
 * the operator's wording of its price section binds this file:
 *
 * - **The figure is never written here.** `{price}`, `{priceNet}`,
 *   `{priceGross}`, `{priceVat}` and `{vatRate}` resolve from the catalogue,
 *   and the callout's lead is the two tokens and nothing else.
 * - The advertised figure is the price **before** tax. Estonian VAT is added
 *   for a delivery address in the European Union and nowhere else.
 * - The destination set on the site decides which price is *shown* and never
 *   what is *charged*; the last-but-one paragraph says so.
 * - Estonia, Latvia and Lithuania are named one by one, and the parcel machine
 *   method is the one price stated outright: it is free.
 *
 * Route, anchors, `covers`, section order, the callout's shape and every
 * placeholder token are identical to the English page.
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
 * Four charges are kept apart, each built on `'ap`, "dues, toll", after the
 * attested `HIjmeH 'ap`, "customs fee": `ngeHmeH 'ap` is the shipping charge,
 * `ngevmeH 'ap` is VAT, `qum 'ap` is a tax in general, and `HIjmeH 'ap` itself
 * is the import duty. `DIlmeH Huch` is the dictionary's own phrase for a
 * price. They are written out in `content/glossary/tlh.ts`
 * (`klingonLegalTerms`).
 *
 * Country names stay as the shop names them, because a carrier needs the real
 * name. A name takes no Klingon suffix, so each stands before `Sep`,
 * "country", which carries the suffix. `tep ngaSwI' jan` is the glossary's
 * word for the parcel machine and `Huch nobmeH Daq` its word for the checkout.
 * A strike is "when people refuse to work", because the glossary's Agent is
 * `vumwI'`, "worker".
 */

import type { LegalPage } from "../../schema.js";

export const shipping: LegalPage = {
  route: "legalShipping",
  title: "ngeHmeH mIw, HIjmeH mIw je",
  description:
    "tep wIngeHmeH Sepmey, ngeHmeH poH, HIjmeH poH, ngeHmeH 'ap SImmeH mIw, Daleghbogh DIlmeH HuchDaq qum 'ap chelmeH mIw je.",
  indexable: true,
  sections: ["delivery", "vat"],
  covers: ["delivery-terms", "dispatch-estimate", "vat-presentation"],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "delivery",
      heading: "tep wIngeHmeH Sepmey, poH je",
      covers: ["delivery-terms", "dispatch-estimate"],
      body: [
        "Hoch SepDaq tep wIngeH.",
        "Hoch HIjmeH DaqvaD HIjmeH mIw motlh DawIvlaH. European Union SepDaq HIjmeH Daq tu'lu'chugh, wa' 'ap choHbe'bogh Danob; latlh DaqDaq tu'lu'chugh, wa' 'ap choHbe'bogh Danob je, 'ach 'apvam jen law' European Union 'ap jen puS. Huch nobmeH DaqDaq 'ap SImlu'. Estonia SepDaq, Latvia SepDaq, Lithuania SepDaq ghap HIjmeH DaqlIj tu'lu'chugh, Omniva tep ngaSwI' jan DawIvlaH; mIwvam DIlnISbe'lu'.",
        "Huch wIHevDI', Dorpa' 3 malja' jaj tep wIngeH. tep wIngeHDI', European Union SepmeyDaq motlh qaStaHvIS 3–7 malja' jaj paw tep; latlh SepmeyDaq motlh qaStaHvIS 7–21 malja' jaj paw.",
        "poHmeyvam noH neH HIjwI'; lay'be'. poHmeyvam choHlaH wanI'meyvam: Sep veHDaq tep nuDlu'DI', vumlu'Qo'DI', qaStaHvIS QISmaS nungbogh cha' Hogh. paSqu'chugh tep, QIn ghongeH: {merchantContactAddress}. tep wInej.",
        "not pawchugh tep, poH chu' DawuqlaH; yapnIS poHvam. Dorpa' poHvam pawbe'chugh tep, vunmeH QIn DaqIllaH, 'ej Huch naQ pInobHa'.",
        "Hoch vunmeH QInvaD wa' ngeHmeH 'ap Danob. HIjmeH Daq DaghItlhta'DI', Huch nobmeH DaqDaq ngeHmeH 'ap SImlu'. Huch Danobpa' 'ap qar Dalegh; Huch Danobta'DI' not 'ap choHlu'.",
        "European Union HurDaq tep wIngeHchugh, pawDI' tep chaq HIjmeH 'ap, qum 'ap, HIjwI' 'ap je poQlu'. 'apmeyvam poQ HIjmeH Sep; nobnIS HevwI'; DIboSbe' maH. DISImbe', 'ej DInoHlaHbe'.",
      ],
      source: "delivery-estimates",
    },
    {
      anchor: "vat",
      heading: "DIlmeH Huch 'angmeH mIw",
      covers: ["vat-presentation"],
      callout: {
        lead: "{price} · {priceTaxQualifier}",
        detail:
          "Huch nobmeH DaqDaq ngeHmeH 'ap SImlu'. European Union SepDaq tep HIjlu'chugh, ngeHmeH 'apDaq ngevmeH 'ap (VAT) chellu'. latlh Sep qum 'ap, HIjmeH 'ap je yughbe' DIlmeH Huch.",
      },
      body: [
        "qum 'ap chellu'pa', Quj DIlmeH Huch: {priceNet}. Hoch DaqDaq rap mI'vam; pIm qum 'ap chellu'bogh neH.",
        "European Union DaqDaq tep HIjlu'chugh, Estonia ngevmeH 'ap (VAT) wIchel: {vatRate}. vaj Doch DIlmeH Huch: {priceGross} — {priceNet}, ngevmeH 'ap {priceVat} je — 'ej Huchvam Danob.",
        "latlh DaqDaq tep HIjlu'chugh, European Union ngevmeH 'ap poQlu'be' 'ej chellu'be'. Doch DIlmeH Huch: {priceNet}, 'ej Huchvam Danob.",
        "rap ngeHmeH 'ap mIw. qum 'ap chellu'pa' ngeHmeH 'ap 'anglu'. European Union DaqDaq tep HIjlu'chugh, Estonia ngevmeH 'ap chellu': {vatRate}. latlh DaqDaq HIjlu'chugh, chellu'be'. Huch Danobpa', 'ap qar Dalegh; qum 'ap yugh.",
        "ghu'lIj wuqmeH, Huch nobmeH DaqDaq HIjmeH Daq Dawoqbogh lo'lu'. HIjmeH Daq DaghItlhpa', mI' 'anglu'bogh wuqmeH, SIr'o' DaqvamDaq wIvlu'bogh HIjmeH Sep lo'lu'; HIjmeH Sepvam DachoHlaH. Huch DanobnISbogh not wuq HIjmeH Sepvam.",
        "malja' je'wI'pu': malja'vaD je'be'bogh nuvpu'vaD DIlmeH Huch 'anglu'. Estonia ngevmeH 'ap chellu'chugh, Huch nobmeH DaqDaq, Huch Danobpa', 'ap mI' 'anglu' 'ej nIteb 'anglu'. malja'lIj Huch De'vaD qum 'ap QIjbogh ghogh'ot DapoQchugh, bIvunpa' QIn ghongeH: {merchantContactAddress}.",
      ],
      source: "price-presentation",
    },
  ],
};
