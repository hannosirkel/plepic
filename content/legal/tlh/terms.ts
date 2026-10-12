/**
 * ngevmeH chutmey — the Klingon edition of `../terms.ts`.
 *
 * A translation, not a revision: the English page is the twice-reviewed
 * drafting source, and every structural decision recorded there binds this
 * file too. In particular:
 *
 * - **There is deliberately no ODR-platform link.** The platform was
 *   dismantled in July 2025; its absence is correct in every language.
 * - **The access method is a link, not a hostname**, and the link is an
 *   enhancement rather than the disclosure — the prose naming the Consumer
 *   Disputes Committee discharges the obligation on its own.
 * - The checkout-acknowledgement section is written to match the checkout
 *   screen. It quotes the button as `DaH yIDIl`, "pay for it now": the Klingon
 *   of `orderButtonLabel` in `content/shop.ts`. **The Klingon `shop.ts` is not
 *   written yet; when it lands its `orderButtonLabel` must be these two words,
 *   or this sentence changes in the same commit.**
 *
 * Route, anchors, `covers`, section order, the external target id and every
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
 * The coined terms are written out in `content/glossary/tlh.ts`
 * (`klingonLegalTerms`). `chutmey`, "laws", is the terms; `vunmeH QIn`, "the
 * message for ordering", is an order; `je'wI'`, "buyer", is the consumer and
 * is glossed at first use as one who does not buy for a business. The two
 * Estonian bodies and the European Commission keep the names the English page
 * gives them, each beside a Klingon noun that says what it is. `Huch nobmeH
 * Daq` is the glossary's word for the checkout.
 *
 * Klingon cannot say "can" and "one" on the same verb, so a sentence the
 * English builds on "cannot be" names who cannot.
 */

import type { LegalPage } from "../../schema.js";

export const terms: LegalPage = {
  route: "legalTerms",
  title: "ngevmeH chutmey",
  description:
    "bIvunDI' chutmey Dalajbogh: mab chenmoHmeH mIw, Huch nobmeH DaqDaq Doch Dawoqbogh, Huch nobmeH mIw, Qagh qaSchugh mIw, ghoHlu'chugh QaHlaHbogh yej je.",
  indexable: true,
  sections: ["checkout-acknowledgement", "delivery", "dispute-resolution"],
  covers: ["checkout-acknowledgement", "dispute-resolution"],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "checkout-acknowledgement",
      heading: "Huch nobmeH DaqDaq Doch Dawoqbogh",
      covers: ["checkout-acknowledgement"],
      body: [
        "bIvunDI' bIje' 'e' Dachup neH. tep wIngeHta' 'e' woqbogh QIn pIngeHDI' chen mab. leQ Da'uyDI' chenbe', 'ej Huch nobmeH chaw' Hevlu'DI' chenbe' je.",
        "Huch nobmeH Daq tenwalDaq \"DaH yIDIl\" jatlh leQ Qav per. bIvunDI' Huch DanobnIS 'e' QIjchu' mu'meyvam. vunmeH leQvaD 'op mu'mey laj European Commission chupmeH QIn, 'ej mu'meyvam yugh mu'meyvetlh. leQ DungDaq — jojDaq pagh tu'lu' — wa' jIHDaq Dochmeyvam Dalegh: Doch Daje'bogh, Doch DIlmeH Huch, ngeHmeH 'ap, Huch naQ, HIjmeH Daq, HIjmeH poH noHlu'bogh je.",
        "bIvunDI' Dochmeyvam Dawoq: chutmeyvam De' QanmeH mIw tenwal je DalaDpu' 'ej Dalaj; SIr'o' DaqvamDaq Dellu'bogh mIw Dapab 'ej bIje'; 18 ben rav bIboghpu', pagh bIvun 'e' chaw' 18 ben rav boghpu'bogh nuv.",
        "woqmeH QIn pIngeH. vunmeH QIn, Huch naQ Danobta'bogh, chutmeyvam je ngaS. QInvam yIpol: mab velqa'lIj 'oH.",
        "Huch chaw', Apple Pay, Google Pay, PayPal je DIlaj; Huch nobmeH mIw vu' Stripe. janlIjvaD DaqlIjvaD je mIwmeyvam chaw'DI' Stripe, bIwIvlaH. Huch chaw' mI' not wIlegh 'ej not wIpol. lujchugh Huch nobmeH mIw, pagh ghIq Huch nobHa'lu'chugh, taHbe' vunmeH QIn.",
        "je'wI'pu'vaD (malja'vaD je'be'bogh nuvpu') malja'meyvaD je mangev; rap chutmey. je'wI' chut DIbmey nupmoHbe' tenwalvam mu'mey.",
      ],
      source: "checkout-contract",
    },
    {
      anchor: "delivery",
      heading: "wIngevlaHbogh Doch, DIlmeH Huch, Qagh je",
      covers: [],
      body: [
        "wa' Doch neH wIngev. wIngevlaHbe'chugh — Hoch wIngevta'mo', pagh SeplIjDaq tep wIHIjlaHbe'mo' — pIja' 'ej Huch naQ pInobHa'. latlh Doch wISuqnISbe'.",
        "DIlmeH Huch 'oH bIvunDI' 'anglu'bogh Huch mI''e'. Qaghlu'ba'mo' DIlmeH Huch muj 'anglu'chugh, 'ej bIQubDI' Qagh 'oH 'e' DatlhojlaHchugh, DIlmeH HuchvetlhvaD mangevnISbe'. pIja', 'ej vunmeH QIn wIqIl, pagh DIlmeH Huch lugh Dawoq 'e' wItlhob.",
        "vunmeH QInvaD Qagh qaSchugh, wa'DIch QIn ghongeH: {merchantContactAddress}. ghu' wItI' wIneHqu'; Huch chaw' nobwI' DaghoH wIneHbe'.",
        "chutmeyvam che' {merchantLegalName} Sep chut. je'wI'pu'vaD DIbmey nob Sep DaDabbogh chut, 'ej chutvetlh pabnIS Hoch. DIbmeyvetlh teqbe' chutmeyvam.",
      ],
    },
    {
      anchor: "dispute-resolution",
      heading: "QIn jungeHDI' ghu' wItI'laHbe'chugh",
      covers: ["dispute-resolution"],
      body: [
        "nItebHa' ghu' wItI'laHbe'chugh, 'ej European Union DaDabchugh, Consumer Disputes Committee yejvaD ghu' DaDellaH. Estonian Consumer Protection and Technical Regulatory Authority DIvI'Daq vum yejvam. mIwvam DIlnISbe'lu'. bo'DIjDaq bIjaHlaH je; DIbvetlh vuSbe' tenwalvam.",
      ],
      links: [
        {
          label: "Consumer Disputes Committee yejvaD QIn DangeHmeH mIw",
          target: { kind: "external", to: "consumer-disputes-committee" },
        },
      ],
    },
  ],
};
