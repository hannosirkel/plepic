/**
 * Basket and checkout copy — the Klingon edition of `../shop.ts`.
 *
 * This file is a translation, not a revision. Exports, keys, field names, form
 * tokens, link targets and placeholders are those of the English module; only
 * prose is Klingon. The English module records why each string says what it
 * says, and that reasoning is not repeated here.
 *
 * Published under `/tlh` through `siteCopyByLocale`. The mirror test, content
 * scans, glossary check and Klingon word check still read this file.
 *
 * ## What is not here, as in English
 *
 * The sentences the checkout is legally obliged to say are read out of the
 * Klingon legal pages by `storefront/src/components/shop/checkout-terms.ts`.
 * They are not copied into this file, and no amount of money is written here.
 *
 * ## The order button's label
 *
 * `orderButtonLabel` is `DaH yIDIl`, "pay for it now": the Klingon of "Pay
 * now", and the label `content/legal/tlh/terms.ts` quotes, so the checkout and
 * its legal explanation agree. `content/glossary.test.ts` holds the two
 * together.
 *
 * ## Words that agree with the Klingon legal pages
 *
 * - `je'meH ngaSwI'` (basket), `Huch nobmeH Daq` (checkout), `tep ngaSwI' jan`
 *   (parcel machine) and `je'Ha'` (withdrawal) are the glossary's shop terms
 *   and the ones the legal pages use. Where the English says "withdrawal" the
 *   Klingon has the bare stem (`je'Ha'meH …`), as on the returns page.
 * - The six disclosures above the order button carry the names
 *   `content/legal/tlh/terms.ts` lists them under: `Doch Daje'bogh`, `Doch
 *   DIlmeH Huch`, `ngeHmeH 'ap`, `Huch naQ`, `HIjmeH Daq` and `HIjmeH poH
 *   noHlu'bogh`.
 * - A link to a legal page carries that page's title: `ngeHmeH mIw, HIjmeH mIw
 *   je`, `ngevmeH chutmey`, `De' QanmeH mIw`, `je'Ha'meH QIn chovnatlh`.
 * - `vunmeH QIn` (an order), `woqmeH QIn` (its confirmation), `vunmeH leQ` (the
 *   order button), `ngevmeH 'ap (VAT)`, `qum 'ap` (a tax), `HIjmeH Sep` (the
 *   destination set on the site) and `Hoch SepDaq tep wIngeH` are the terms
 *   and shipping pages'.
 * - `wIngevlaHbe'`, "we cannot sell it", is what the terms page says of an item
 *   the shop cannot supply. `Huch wISuqbe'`, "we take no money", says that
 *   nothing is charged.
 *
 * A row that shows the shipping charge is labelled `ngeHmeH 'ap`, the charge,
 * in the basket and in the checkout alike: `ngeHmeH mIw` is the way a parcel
 * is sent, and no figure stands beside that.
 *
 * Country names stay as the shop names them and take no Klingon suffix, so
 * each stands before `Sep`, as on the shipping page.
 */

import type { CallToAction, Link } from "../schema.js";
import type { AddressFieldCopy, PhoneFieldCopy } from "../shop.js";

/**
 * The Klingon of the four formulations the English list holds, in its order:
 * "when you order you must give money", then "buy now", "pay now" and "confirm
 * that you buy". Klingon spelling is case-sensitive, so each is written as it
 * is spelled. `checkout.orderButtonLabel` below is a member, as the English
 * label is of the English list.
 */
export const COMPLIANT_ORDER_BUTTON_LABELS: readonly string[] = [
  "bIvunDI' Huch DanobnIS",
  "DaH yIje'",
  "DaH yIDIl",
  "bIje' 'e' yIwoq",
];

export const unavailableFigure = "Dochmey wIngevlaHbogh neH ngaSDI' je'meH ngaSwI'lIj, 'anglu'";

export const basket = {
  heading: "je'meH ngaSwI'lIj",
  lede: "wa' Quj; qum 'ap chellu'pa' wa' DIlmeH Huch; Hoch SepDaq wIngeH. Huch nobmeH DaqDaq qum 'ap, ngeHmeH 'ap je SImlu'; SImmeH, DaqvetlhDaq HIjmeH Daq DaghItlhbogh lo'lu'.",

  empty: {
    heading: "chIm je'meH ngaSwI'lIj",
    body: "wej vay' ngaS.",
    addLabel: "je'meH ngaSwI'lIjDaq {productName} yIchel",
    browse: {
      label: "wa'DIch Quj De' yIlaD",
      emphasis: "quiet",
      target: { kind: "route", to: "lunarBase" },
    } satisfies CallToAction,
  },

  linesHeading: "Doch Daje'lI'bogh",
  columns: {
    item: "Doch",
    unitPrice: "DIlmeH Huch",
    quantity: "mI'",
    lineTotal: "DochvaD Huch naQ",
    actions: "choH",
  },
  quantityLabel: "mI'",
  quantityAccessibleLabel: "{productName} mI'",
  updateLabel: "yIchoH",
  updateAccessibleLabel: "{productName} mI' yIchoH",
  removeLabel: "yIteq",
  removeAccessibleLabel: "je'meH ngaSwI'lIjvo' {productName} yIteq",
  updatingLabel: "mI' choHlu'taH…",
  addingLabel: "je'meH ngaSwI'lIjDaq chellu'taH…",
  removingLabel: "Dochvam teqlu'taH…",

  /**
   * Composed at render with the two limits, as in English: `Quj mI' naQ
   * yIghItlh — rav: 1, 'aqroS: 10. je'meH ngaSwI'lIj choHlu'pu'be'.` The
   * command stands first, so the two limits follow it as a minimum and a
   * maximum.
   */
  quantityError: {
    prefix: "Quj mI' naQ yIghItlh — rav: ",
    rangeSeparator: ", 'aqroS: ",
    suffix: ". je'meH ngaSwI'lIj choHlu'pu'be'.",
  },

  /** Composed at render with the limit, as in English. */
  limitError: {
    prefix: "wa' vunmeH QInvaD Quj 'aqroS: ",
    suffix: ". DaH mI'vam ngaS je'meH ngaSwI'lIj. pagh chellu'pu'.",
  },

  unavailableLabel: "wIngevlaHbe'",
  unavailableNote:
    "DaH Dochvam wIngevlaHbe'; vaj je'meH ngaSwI'lIj DIlmeH Huch wISImlaHbe'. bItaHmeH Dochvam yIteq.",

  summary: {
    heading: "vunmeH QIn De' potlh",
    goodsLabel: "Dochmey",
    shippingLabel: "ngeHmeH 'ap",
    shippingPending: "Huch nobmeH DaqDaq SImlu'",
    totalLabel: "Huch naQ",
    totalPending: "Huch nobmeH DaqDaq 'anglu'",
  },

  checkout: {
    label: "Huch nobmeH Daq yIghoS",
    emphasis: "primary",
    target: { kind: "route", to: "checkout" },
  } satisfies CallToAction,

  beforeYouBuy: {
    heading: "bIje'pa'",
    body: [
      "bIvunpa' HIjmeH mIw, tep tatlhmeH mIw, bIwuqqa'meH DIb je QIjlu'; bIvunta'DI' wa'DIch QIjlu'be'.",
    ],
    links: [
      { label: "ngeHmeH mIw, HIjmeH mIw je", target: { kind: "route", to: "legalShipping" } },
      {
        label: "tep tatlhmeH mIw, 14 jaj je'Ha'meH DIblIj je",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal" },
      },
      {
        label: "je'Ha'meH QIn chovnatlh",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal-form" },
      },
      { label: "ngevmeH chutmey", target: { kind: "route", to: "legalTerms" } },
    ] satisfies readonly Link[],
  },
} as const;

export const checkout = {
  heading: "Huch nobmeH Daq",
  lede: "HIjmeH Daq, ngeHmeH mIw, Huch nobmeH mIw je. vunmeH leQ Da'uypa', Huch wISuqbe'.",

  empty: {
    heading: "chIm je'meH ngaSwI'lIj",
    body: "Doch DaDIlnISbogh tu'lu'be'.",
    link: {
      label: "je'meH ngaSwI'lIjDaq yIchegh",
      emphasis: "secondary",
      target: { kind: "route", to: "cart" },
    } satisfies CallToAction,
  },

  address: {
    heading: "HIjmeH Daq",
    body: "tep wIngeHmeH Daq, woqmeH QIn wIngeHmeH Daq je.",
    fields: [
      {
        name: "fullName",
        label: "pong naQ",
        control: "input",
        type: "text",
        autoComplete: "name",
        inDeliveryAddress: true,
      },
      {
        name: "streetAddress",
        label: "taw, juH mI' je",
        control: "input",
        type: "text",
        autoComplete: "street-address",
        inDeliveryAddress: true,
      },
      {
        name: "postalCode",
        label: "Daq ngoq",
        control: "input",
        type: "text",
        autoComplete: "postal-code",
        inDeliveryAddress: true,
      },
      {
        name: "city",
        label: "veng vengHom ghap",
        control: "input",
        type: "text",
        autoComplete: "address-level2",
        inDeliveryAddress: true,
      },
      {
        name: "country",
        label: "Sep",
        control: "country",
        type: "text",
        autoComplete: "country-name",
        inDeliveryAddress: true,
        hint: "Hoch SepDaq tep wIngeH.",
      },
      {
        name: "email",
        label: "QIn Daq",
        control: "input",
        type: "email",
        autoComplete: "email",
        inDeliveryAddress: false,
        hint: "DaqvamDaq woqmeH QInlIj wIngeH.",
      },
    ] satisfies readonly AddressFieldCopy[],
    countryUnchosen: "Sep yIwIv",
    missingValue: "DungDaq HIjmeH DaqlIj yIghItlh.",
    phone: {
      label: "ghogh HablI' mI'",
      hint: "Estonia Sep, Finland Sep, Lithuania Sep, Latvia Sep je HurDaq mI'vam poQlu'; loS SepmeyvamDaq poQlu'be'. HIjmeH QInmey, tep SuqmeH QInmey je ngeHmeH, mI'vam QIn DaqlIj ghap lo' Omniva.",
      autoComplete: "tel",
    } satisfies PhoneFieldCopy,
  },

  delivery: {
    heading: "HIjmeH mIw",
    methodLabel: "mIw",
    chargeLabel: "ngeHmeH 'ap",
    chargePending: "ngeHmeH 'ap DaleghmeH, HIjmeH DaqlIj yIghItlh.",
    estimateLabel: "HIjmeH poH noHlu'bogh",
    parcelMachineLabel: "tep ngaSwI' jan",
    parcelMachinePrompt: "tep ngaSwI' jan yIwIv",
    parcelMachineLoading: "tep ngaSwI' janmey tetlh Suqlu'taH…",
    parcelMachineUnavailable:
      "tep ngaSwI' janmey tetlh wISuqlaHbe'. latlh HIjmeH mIw yIwIv, pagh yInIDqa'.",
  },

  payment: {
    heading: "Huch nobmeH mIw",
    cardRegionLabel: "Huch nobmeH De'",
    cardRegionBody:
      "HIjmeH mIw DawIvDI', Hung ghajbogh Huch nobmeH De' ghItlhmeH Daq 'anglu'. mIwmey Dalo'laHbogh wuq janlIj, DaqlIj, Stripe mIw wIlISta'bogh je.",
  },

  beforeYouOrder: {
    heading: "bIvunpa'",
    returnPostageLabel: "Doch tatlhmeH mIw",
    withdrawalLabel: "bIwuqqa'meH DIb",
    withdrawalBody:
      "Doch DaHevDI' tagh 14 jaj poH; qaStaHvIS poHvam bIje'Ha'laH, 'ej meq DaQIjnISbe'. naDev je'Ha'meH chutmey, je'Ha'meH QIn chovnatlh je tu'lu'; rarwI'meychaj ngaSpu' Hoch tenwal Daleghpu'bogh.",
    links: [
      {
        label: "tep tatlhmeH mIw, 14 jaj je'Ha'meH DIblIj je",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal" },
      },
      {
        label: "je'Ha'meH QIn chovnatlh",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal-form" },
      },
      { label: "ngevmeH chutmey", target: { kind: "route", to: "legalTerms" } },
      { label: "De' QanmeH mIw", target: { kind: "route", to: "legalPrivacy" } },
      { label: "ngeHmeH mIw, HIjmeH mIw je", target: { kind: "route", to: "legalShipping" } },
    ] satisfies readonly Link[],
  },

  order: {
    heading: "vunmeH QInlIj",
    goodsLabel: "Doch Daje'bogh",
    goodsPriceLabel: "Doch DIlmeH Huch",
    shippingLabel: "ngeHmeH 'ap",
    vatLabel: "ngevmeH 'ap (VAT): {vatRate}",
    destinationProvisional:
      "naQpa' DungDaq HIjmeH Daq, SIr'o' DaqvamDaq HIjmeH Sep wIvlu'bogh pab mI'meyvam; mI'mey wuq HIjmeH Daq.",
    qualifierPending:
      "ngevmeH 'ap (VAT), ngeHmeH 'ap je SImmeH, DungDaq HIjmeH Daq lo'lu'; naQDI' HIjmeH Daq, naDev 'anglu'. European Union HurDaq qum 'ap, HIjmeH 'ap je poQlu'chugh, yughbe' mI'meyvam.",
    totalLabel: "Huch naQ",
    addressLabel: "HIjmeH Daq",
    estimateLabel: "HIjmeH poH noHlu'bogh",
    totalPending: "naQDI' HIjmeH DaqlIj, 'anglu'",
  },

  /** A member of {@link COMPLIANT_ORDER_BUTTON_LABELS}. See the header. */
  orderButtonLabel: "DaH yIDIl",
  placingLabel: "vunmeH QInlIj ngeHlu'taH…",

  errors: {
    heading: "De' DaghItlhbogh yInuD",
    /**
     * No component composes a sentence from these two any more: the checkout
     * says the whole sentences of `checkout.missing` in `interface.ts`. They
     * are written to stand before a field's label all the same: a Klingon
     * command follows its object, so each is a command and a colon.
     */
    missingFieldPrefix: "yIghItlh: ",
    missingSelectionPrefix: "yIwIv: ",
    invalidEmail: "woqmeH QInlIj wIngeHlaHmeH, QIn Daq lugh yIghItlh.",
    invalidPhone:
      "ghogh HablI' mI' yIghItlh; mI' taghnIS SeplIj ngoq. chovnatlh: +372 5555 5555.",
    unavailableLine: "bIvunpa', Doch wIngevlaHbe'bogh yIteq.",
    paymentNotConnected:
      "vunmeH QIn ngeHlu'be' 'ej Huch wISuqbe': SIr'o' DaqvamDaq wej Huch chaw' mIw rarlu'.",
    actionFailed: "Qapbe'. pagh choHlu'pu'. tugh yInIDqa'.",
    orderFailed: "vunmeH QInlIj wIHevlaHbe'. Huch wISuqpu'be'. tugh yInIDqa'.",
  },
} as const;
