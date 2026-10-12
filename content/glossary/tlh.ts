/** Klingon terms. A note names the roots of every new phrase or compound. `klingonLegalTerms` holds the legal vocabulary. */
import type { Glossary } from "./schema.js";

export const klingonGlossary = {
  station: { term: "logh Daq", forms: ["logh Daq*"], forbidden: [], note: "Coined phrase: logh (outer space) + Daq (place)." },
  agent: { term: "vumwI'", forms: ["vumwI'*"], forbidden: [], note: "Coined agent noun: vum (work) + -wI' (one who does)." },
  influence: { term: "HoS", forms: ["HoS*"], forbidden: [], note: "HoS is power, the effect represented by Influence." },
  module: { term: "'ay'", forms: ["'ay'*"], forbidden: [], note: "'ay' is a part of the player's Base." },
  credit: { term: "Huch", forms: ["Huch*"], forbidden: [], note: "Huch is money; the printed Credit is the game's unit." },
  creditCounter: { term: "Huch mI' jan", forms: ["Huch mI' jan*"], forbidden: [], note: "Coined phrase: Huch (money) + mI' (number) + jan (device)." },
  supply: { term: "nobmeH Daq", forms: ["nobmeH Daq*"], forbidden: [], note: "Coined phrase: nob (give) + -meH (for the purpose of) + Daq (place); the face-up card display." },
  base: { term: "waw'", forms: ["waw'*"], forbidden: [], note: "waw' is a base, here the player's built area." },
  orb: { term: "moQ", forms: ["moQ*"], forbidden: [], note: "moQ is a sphere." },
  shuttle: { term: "lup Duj", forms: ["lup Duj*"], forbidden: [], note: "Coined phrase: lup (transport) + Duj (ship)." },
  colonist: { term: "waw' ngan", forms: ["waw' ngan*"], forbidden: [], note: "Coined phrase: waw' (base) + ngan (inhabitant)." },
  scientificAchievement: { term: "QeD Qapla'", forms: ["QeD Qapla'*"], forbidden: [], note: "Coined phrase: QeD (science) + Qapla' (success)." },
  mainAction: { term: "Qu' potlh", forms: ["Qu' potlh*"], forbidden: [], note: "Coined phrase: Qu' (task) + potlh (be important)." },
  draft: { term: "wIv", forms: ["wIv*"], forbidden: [], note: "wIv means choose; take a card from the Supply." },
  draw: { term: "lel", forms: ["lel*"], forbidden: [], note: "lel means take out; take a card from the deck." },
  discard: { term: "woD", forms: ["woD*"], forbidden: [], note: "woD means throw away." },
  resell: { term: "ngevqa'", forms: ["ngevqa'*"], forbidden: [], note: "Coined inflection: ngev (sell) + -qa' (again)." },
  build: { term: "chenmoH", forms: ["chenmoH*"], forbidden: [], note: "chenmoH means build." },
  flip: { term: "jIrmoH", forms: ["jIrmoH*"], forbidden: [], note: "Coined inflection: jIr (rotate) + -moH (cause to)." },
  deck: { term: "navmey ghom", forms: ["navmey ghom*"], forbidden: [], note: "Coined phrase: nav (paper) + -mey (plural) + ghom (group), a card stack." },
  hand: { term: "ghop", forms: ["ghop*"], forbidden: [], note: "ghop is the hand, used for held cards." },
  discardPile: { term: "navmey woDlu'bogh ghom", forms: ["navmey woDlu'bogh ghom*"], forbidden: [], note: "Coined phrase: nav (paper) + -mey, woD (throw away) + -lu' (indefinite subject) + -bogh (relative), ghom (group)." },
  victoryCondition: { term: "Qapla' ngoQ", forms: ["Qapla' ngoQ*"], forbidden: [], note: "Coined phrase: Qapla' (success) + ngoQ (goal)." },
  terranOutpost: { term: "Terran Outpost", forms: ["Terran Outpost"], forbidden: [] },
  theOasis: { term: "The Oasis", forms: ["The Oasis"], forbidden: [] },
  taikotech: { term: "Taikotech", forms: ["Taikotech"], forbidden: [] },
  darkSide: { term: "Dark Side", forms: ["Dark Side"], forbidden: [] },
  shackleton: { term: "Shackleton", forms: ["Shackleton"], forbidden: [] },
  seleneLabs: { term: "Selene Labs", forms: ["Selene Labs"], forbidden: [] },
  imbrium: { term: "Imbrium", forms: ["Imbrium"], forbidden: [] },
  lunarBase: { term: "Lunar Base", forms: ["Lunar Base"], forbidden: [] },
  plepicGames: { term: "Plepic Games", forms: ["Plepic Games"], forbidden: [] },
  rulebook: { term: "mIw paq", forms: ["mIw paq*"], forbidden: [], note: "Coined phrase: mIw (procedure) + paq (book)." },
  basket: { term: "je'meH ngaSwI'", forms: ["je'meH ngaSwI'*"], forbidden: [], note: "Coined phrase: je' (buy) + -meH (for the purpose of), ngaS (contain) + -wI' (thing that does)." },
  checkout: { term: "Huch nobmeH Daq", forms: ["Huch nobmeH Daq*"], forbidden: [], note: "Coined phrase: Huch (money) + nob (give) + -meH (for the purpose of) + Daq (place)." },
  parcelMachine: { term: "tep ngaSwI' jan", forms: ["tep ngaSwI' jan*"], forbidden: [], note: "Coined phrase: tep (cargo) + ngaS (contain) + -wI' (thing that does) + jan (device)." },
  withdrawal: { term: "je'Ha'", forms: ["je'Ha'*"], forbidden: [], note: "Coined inflection: je' (buy) + -Ha' (undo), for withdrawal from a purchase." },
} as const satisfies Glossary;

/**
 * A word or phrase of the legal pages that `terms.ts` does not list.
 *
 * `terms.ts` holds the words a player meets on a card, in the rulebook and in
 * the shop, and `glossary.test.ts` holds every language to them. Legal
 * vocabulary is not on that list, and Klingon has none of its own, so the
 * constructions the legal pages agreed on are written down here: a later
 * page that needs "VAT" or "an order" uses the same words.
 *
 * `note` begins "Coined" or "Attested" and names each root before its gloss in
 * brackets; `scripts/klingon-words.test.ts` requires every root named to be in
 * the lexicon. `loan` is the international word that stands in brackets beside
 * the term, and is on the loan list of `scripts/klingon-words.ts`.
 */
export interface KlingonLegalTerm {
  readonly term: string;
  readonly english: string;
  readonly note: string;
  readonly loan?: string;
}

export const klingonLegalTerms = {
  // The site and the order.
  website: { term: "SIr'o' Daq", english: "web site", note: "Coined phrase: SIr'o' (network, web) + Daq (place)." },
  page: { term: "tenwal", english: "page of the site", note: "Attested noun: tenwal (page in a book), used for a page of the site." },
  button: { term: "leQ", english: "button", note: "Attested noun: leQ (switch), used for a button on a page." },
  link: { term: "rarwI'", english: "link", note: "Coined agent noun: rar (connect) + -wI' (thing which does)." },
  shop: { term: "ngevmeH Daq", english: "shop", note: "Coined phrase: ngev (sell) + -meH (for the purpose of) + Daq (place)." },
  order: { term: "vunmeH QIn", english: "an order", note: "Coined phrase: vun (order from a catalogue) + -meH (for the purpose of) + QIn (message)." },
  orderConfirmation: { term: "woqmeH QIn", english: "confirmation of an order or of dispatch", note: "Coined phrase: woq (confirm) + -meH (for the purpose of) + QIn (message)." },
  payNow: { term: "DaH yIDIl", english: "\"Pay now\", the label of the order button", note: "Coined phrase: DaH (now) + DIl (pay for), in the imperative. The Klingon shop copy must label the button with these words." },
  guidance: { term: "chupmeH QIn", english: "guidance", note: "Coined phrase: chup (recommend) + -meH (for the purpose of) + QIn (message)." },
  terms: { term: "chutmey", english: "the terms of sale", note: "Attested noun: chut (law) in the plural, used for the terms of a contract." },
  consumer: { term: "je'wI'", english: "consumer", note: "Coined agent noun: je' (buy) + -wI' (one who does). Glossed at first use as one who does not buy for a business." },
  seller: { term: "ngevwI'", english: "seller", note: "Coined agent noun: ngev (sell) + -wI' (one who does)." },

  // Money.
  price: { term: "DIlmeH Huch", english: "price", note: "Attested phrase of The Klingon Dictionary: DIl (pay for) + -meH (for the purpose of) + Huch (money)." },
  total: { term: "Huch naQ", english: "the total", note: "Coined phrase: Huch (money) + naQ (be whole)." },
  payment: { term: "Huch nobmeH mIw", english: "payment", note: "Coined phrase: Huch (money) + nob (give) + -meH (for the purpose of) + mIw (procedure)." },
  refund: { term: "Huch nobHa'", english: "to refund", note: "Coined phrase: Huch (money) + nob (give) + -Ha' (undo)." },
  paymentCard: { term: "Huch chaw'", english: "payment card", note: "Attested phrase for a credit card: Huch (money) + chaw' (permit)." },
  invoice: { term: "ghogh'ot", english: "invoice", note: "Attested noun: ghogh'ot (bill, payment request)." },
  vat: { term: "ngevmeH 'ap", english: "value added tax", loan: "VAT", note: "Coined phrase: ngev (sell) + -meH (for the purpose of) + 'ap (dues, toll), built like the attested customs fee below. The loan follows in brackets at first use on a page." },
  tax: { term: "qum 'ap", english: "a tax", note: "Coined phrase: qum (government) + 'ap (dues, toll)." },
  shippingCharge: { term: "ngeHmeH 'ap", english: "shipping charge", note: "Coined phrase: ngeH (send) + -meH (for the purpose of) + 'ap (dues, toll)." },
  importDuty: { term: "HIjmeH 'ap", english: "import duty, customs fee", note: "Attested phrase of the qepHom'a' 2020 word list: HIj (deliver, transport goods) + -meH (for the purpose of) + 'ap (dues, toll)." },
  carrierFee: { term: "HIjwI' 'ap", english: "carrier's handling fee", note: "Coined phrase: HIjwI' (carrier) + 'ap (dues, toll)." },
  accountingLaw: { term: "Huch ta chut", english: "accounting law", note: "Coined phrase: Huch (money) + ta (record) + chut (law)." },
  financialYear: { term: "Huch DIS", english: "financial year", note: "Coined phrase: Huch (money) + DIS (year)." },

  // Delivery and returns.
  parcel: { term: "tep", english: "parcel", note: "Attested noun: tep (cargo), used for a parcel as in the glossary's parcel machine." },
  carrier: { term: "HIjwI'", english: "carrier", note: "Coined agent noun: HIj (deliver, transport goods) + -wI' (one who does)." },
  recipient: { term: "HevwI'", english: "recipient", note: "Coined agent noun: Hev (receive) + -wI' (one who does)." },
  deliveryAddress: { term: "HIjmeH Daq", english: "delivery address", note: "Coined phrase: HIj (deliver) + -meH (for the purpose of) + Daq (place)." },
  destinationCountry: { term: "HIjmeH Sep", english: "destination country", note: "Coined phrase: HIj (deliver) + -meH (for the purpose of) + Sep (region)." },
  country: { term: "Sep", english: "country", note: "Attested noun: Sep (region), used for a country. A country's name stands before it and takes no suffix." },
  businessDay: { term: "malja' jaj", english: "business day", note: "Coined phrase: malja' (business) + jaj (day)." },
  strike: { term: "vumQo'", english: "to strike", note: "Coined inflection: vum (work) + -Qo' (refuse). Not the glossary's Agent, the worker." },
  proofOfPostage: { term: "tep DangeHta' 'e' tobbogh nompuq", english: "proof of postage", note: "Coined phrase: tep (cargo) + ngeH (send) + 'e' (that) + tob (prove) + nompuq (evidence), evidence which proves that you have sent the parcel." },
  withdrawalForm: { term: "je'Ha'meH QIn chovnatlh", english: "model withdrawal form", note: "Coined phrase: je' (buy) + -Ha' (undo) + -meH (for the purpose of) + QIn (message) + chovnatlh (specimen)." },
  legalGuarantee: { term: "chut 'Ip", english: "legal guarantee", note: "Coined phrase: chut (law) + 'Ip (oath, promise)." },

  // The merchant.
  emailAddress: { term: "QIn Daq", english: "e-mail address", note: "Coined phrase: QIn (message) + Daq (place)." },
  telephone: { term: "ghogh HablI'", english: "telephone", note: "Attested phrase of HolQeD 5.2: ghogh (voice) + HablI' (data transceiving device)." },
  commercialRegister: { term: "malja' tetlh", english: "commercial register", note: "Coined phrase: malja' (business) + tetlh (list)." },

  // Data protection.
  privacy: { term: "De' QanmeH mIw", english: "privacy, data protection", note: "Coined phrase: De' (data) + Qan (protect) + -meH (for the purpose of) + mIw (procedure)." },
  legalBasis: { term: "chut meq", english: "legal basis", note: "Coined phrase: chut (law) + meq (reason). Not the glossary's Base." },
  consent: { term: "ghIb", english: "to consent", note: "Attested verb: ghIb (consent). Klingon has no noun for it." },
  withdrawConsent: { term: "ghIbHa'", english: "to withdraw consent", note: "Coined inflection: ghIb (consent) + -Ha' (undo)." },
  analytics: { term: "juvmeH mIw", english: "analytics, measurement", note: "Coined phrase: juv (measure) + -meH (for the purpose of) + mIw (procedure)." },
  advertising: { term: "vep", english: "advertising", note: "Attested noun: vep (announcement, advertisement)." },
  controller: { term: "De' SeHwI'", english: "controller of personal data", note: "Coined phrase: De' (data) + SeH (control) + -wI' (one who does)." },
  standardContractualClauses: { term: "mab 'ay'mey motlh", english: "standard contractual clauses", note: "Coined phrase: mab (contract) + 'ay' (section) in the plural + motlh (be standard)." },
  newsletter: { term: "De' chu' QIn", english: "newsletter", note: "Coined phrase: De' (data) + chu' (be new), the attested phrase for news, + QIn (message)." },
  subscribe: { term: "qI'", english: "to subscribe", note: "Attested verb: qI' (register for, sign up for). To unsubscribe adds -Ha' (undo)." },
  cookie: { term: "De' chabHom", english: "cookie", note: "Coined phrase: De' (data) + chab (pie, tart) with -Hom (diminutive), the attested word for the biscuit." },
  browser: { term: "SIr'o' leghmeH jan", english: "browser", note: "Coined phrase: SIr'o' (web) + legh (see) + -meH (for the purpose of) + jan (device)." },
  localStorage: { term: "polmeH Daq", english: "the browser's local storage", loan: "local storage", note: "Coined phrase: pol (keep) + -meH (for the purpose of) + Daq (place). The loan is the name a browser shows." },
  sessionStorage: { term: "polmeH Daq ru'", english: "the browser's session storage", loan: "session storage", note: "Coined phrase: pol (keep) + -meH (for the purpose of) + Daq (place) + ru' (be temporary). The loan is the name a browser shows." },
  granted: { term: "chaw'lu'", english: "granted, the stored consent answer", loan: "granted", note: "Coined inflection: chaw' (allow) + -lu' (indefinite subject). The loan is the literal word the site stores." },
  declined: { term: "lajQo'lu'", english: "declined, the stored consent answer", loan: "declined", note: "Coined inflection: laj (accept) + -Qo' (refuse) + -lu' (indefinite subject). The loan is the literal word the site stores." },
  dns: { term: "SIr'o' pong tetlh", english: "the domain name system", loan: "DNS", note: "Coined phrase: SIr'o' (network) + pong (name) + tetlh (list). The loan stands first and the phrase explains it." },
  ipAddress: { term: "jan ngu'bogh mI'", english: "IP address", loan: "IP", note: "Coined phrase: jan (device) + ngu' (identify) + -bogh (which) + mI' (number). The loan stands first, before the noun for number, and the phrase explains it." },
} as const satisfies Readonly<Record<string, KlingonLegalTerm>>;
