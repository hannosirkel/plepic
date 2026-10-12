/** Klingon terms. A note names the roots of every new phrase or compound. `klingonLegalTerms` holds the legal vocabulary and the site vocabulary `terms.ts` does not list. */
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
  mainAction: { term: "Qu' potlh", forms: ["Qu' potlh*", "Qu'mey potlh"], forbidden: [], note: "Coined phrase: Qu' (task) + potlh (be important). The plural suffix stands on the noun: Qu'mey potlh." },
  draft: { term: "wIv", forms: ["wIv*", "DawIv*"], forbidden: [], note: "wIv means choose; take a card from the Supply. A verb prefix stands before the root, so the forms list each one the copy uses." },
  draw: { term: "lel", forms: ["lel*", "yIlel*", "Dalel*"], forbidden: [], note: "lel means take out; take a card from the deck." },
  discard: { term: "woD", forms: ["woD*", "DawoD*"], forbidden: [], note: "woD means throw away." },
  resell: { term: "ngevqa'", forms: ["ngevqa'*", "yIngevqa'*", "tIngevqa'*"], forbidden: [], note: "Coined inflection: ngev (sell) + -qa' (again). The imperative adds yI- or tI-." },
  build: { term: "chenmoH", forms: ["chenmoH*", "yIchenmoH*", "tIchenmoH*", "DachenmoH*"], forbidden: [], note: "chenmoH means build. A command takes the prefix yI- or tI- and \"you build\" takes Da-, so the forms list each." },
  flip: { term: "jIrmoH", forms: ["jIrmoH*", "DajIrmoH*"], forbidden: [], note: "Coined inflection: jIr (rotate) + -moH (cause to)." },
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
 * A word or phrase of the legal pages or of the site copy that `terms.ts` does
 * not list.
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
  price: { term: "DIlmeH Huch", english: "price; in the rulebook, the cost of a card", note: "Attested phrase of The Klingon Dictionary: DIl (pay for) + -meH (for the purpose of) + Huch (money)." },
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
  declined: { term: "lajlu'Qo'", english: "declined, the stored consent answer", loan: "declined", note: "Coined inflection: laj (accept) + -lu' (indefinite subject) + -Qo' (refuse), which stands last. The loan is the literal word the site stores." },
  dns: { term: "SIr'o' pong tetlh", english: "the domain name system", loan: "DNS", note: "Coined phrase: SIr'o' (network) + pong (name) + tetlh (list). The loan stands first and the phrase explains it." },
  ipAddress: { term: "jan ngu'bogh mI'", english: "IP address", loan: "IP", note: "Coined phrase: jan (device) + ngu' (identify) + -bogh (which) + mI' (number). The loan stands first, before the noun for number, and the phrase explains it." },

  // The publisher and the game (T038). The product copy and the rulebook use these words again.
  publisher: { term: "Se'vIr malja'", english: "publisher, publishing house", note: "Attested phrase of the paq'batlh word list: Se'vIr (publication) + malja' (business)." },
  boardGame: { term: "'echlet Quj", english: "board game", note: "Coined phrase: 'echlet (board) + Quj (game), the attested phrase for a game board turned round." },
  cardGame: { term: "nav Quj", english: "card game", note: "Coined phrase: nav (paper), the glossary's word for a card, + Quj (game)." },
  strategyGame: { term: "Dup Quj", english: "strategy game", note: "Coined phrase: Dup (strategy) + Quj (game)." },
  campaign: { term: "Huch boSmeH Qu'", english: "crowdfunding campaign", note: "Coined phrase: Huch (money) + boS (collect) + -meH (for the purpose of) + Qu' (task, mission)." },
  originStory: { term: "mung lut", english: "origin story", note: "Coined phrase: mung (origin) + lut (story)." },
  artwork: { term: "mIllogh", english: "artwork, illustration", note: "Attested noun: mIllogh (picture, depiction)." },
  video: { term: "HaSta", english: "video", note: "Attested noun: HaSta (video, moving images). On a ship it is the visual display." },
  review: { term: "Quj chovbogh mu'mey", english: "review of the game", note: "Coined phrase: Quj (game) + chov (assess, evaluate) + -bogh (which) + mu' (word) in the plural." },
  tournament: { term: "qaD mIr", english: "tournament", note: "Attested phrase of the qep'a' 2018 word list: qaD (challenge) + mIr (chain)." },
  retailChain: { term: "ngevmeH Daq mIr", english: "retail chain", note: "Coined phrase: ngev (sell) + -meH (for the purpose of) + Daq (place) + mIr (chain)." },
  componentList: { term: "Quj Dochmey tetlh", english: "list of the game's components", note: "Coined phrase: Quj (game) + Doch (thing) in the plural + tetlh (list)." },
  form: { term: "QIn ghItlhmeH Daq", english: "contact form", note: "Coined phrase: QIn (message) + ghItlh (write) + -meH (for the purpose of) + Daq (place). The sign-up form is built the same way on the verb for subscribing." },

  // Table talk of the rules help (T038), for the rulebook text to use again.
  player: { term: "'ovwI'", english: "player", note: "Attested noun of the qep'a' 2020 word list: 'ovwI' (competitor, player of a competitive game)." },
  turn: { term: "jop", english: "to take one's turn", note: "Attested verb of the qep'a' 2019 word list: jop (take one's turn in a game). With -taHvIS it says during a turn." },
  shuffle: { term: "DuD", english: "to shuffle", note: "Attested verb: DuD (mix), used for shuffling cards." },
  playCard: { term: "lo'", english: "to play a card", note: "Attested verb: lo' (use), used for playing a card." },
  takeAction: { term: "ta'", english: "to carry out an action, to meet a condition", note: "Attested verb: ta' (accomplish), used with the glossary's Main Action and its victory condition." },
  question: { term: "mu'tlhegh", english: "a question", note: "Attested noun: mu'tlhegh (sentence), with the verb ghel (ask a question). Klingon has no noun for a question." },
  faq: { term: "pIj ghellu'bogh mu'tlheghmey", english: "frequently asked questions", note: "Coined phrase: pIj (often) + ghel (ask a question) + -lu' (indefinite subject) + -bogh (which) + mu'tlhegh (sentence) in the plural." },

  // Table talk of the rulebook text (T042), sheets 1 to 13.
  startingPlayer: { term: "taghwI'", english: "starting player", note: "Coined agent noun: tagh (begin a process) + -wI' (one who does)." },
  step: { term: "mIw", english: "a step of setup or of a turn", note: "Attested noun: mIw (step, stage in a procedure)." },
  take: { term: "tlhap", english: "to take a card", note: "Attested verb: tlhap (take). The glossary's Draft and Draw are the named actions, not this word." },
  faceUp: { term: "'anglu'taHvIS", english: "face-up", note: "Coined inflection: 'ang (show, reveal) + -lu' (indefinite subject) + -taHvIS (while), while it is shown." },
  faceDown: { term: "So'lu'taHvIS", english: "face-down", note: "Coined inflection: So' (hide) + -lu' (indefinite subject) + -taHvIS (while), while it is hidden." },
  flavourText: { term: "lut mu'mey", english: "flavour text", note: "Coined phrase: lut (story) + mu' (word) in the plural." },
  orbHalf: { term: "moQ bID", english: "half of an Orb", note: "Coined phrase: moQ (sphere), the glossary's Orb, + bID (half)." },
  wild: { term: "tlhab", english: "wild, of a gray Orb that stands for any colour", note: "Attested verb: tlhab (be free), used for an Orb that is free to be any colour." },
  colour: { term: "rItlh", english: "colour", note: "Attested noun: rItlh (pigment, paint, dye), used for the colour of an Orb." },
  red: { term: "Doq", english: "red", note: "Attested verb: Doq (be red, be orange). It stands after its noun." },
  yellow: { term: "SuD 'ej wov", english: "yellow", note: "Attested phrase of Klingon for the Galactic Traveler: SuD (be green, blue or yellow) + wov (be light). Two verbs cannot both stand after a noun, so one takes -bogh: SuDbogh moQ wov." },
  blue: { term: "SuD 'ej Hurgh", english: "blue", note: "Attested phrase of the Talk Now! Klingon word list: SuD (be green, blue or yellow) + Hurgh (be dark). Beside a noun it is built like yellow." },
  gray: { term: "qIj 'ej wov", english: "gray", note: "Attested phrase of the Talk Now! Klingon word list: qIj (be black) + wov (be light). Beside a noun it is built like yellow." },

  // Editorial words of the proof module's reasons, which no page renders.
  proofStrip: { term: "nompuq tetlh", english: "proof strip", note: "Coined phrase: nompuq (evidence) + tetlh (roll, list)." },
  evidenceManifest: { term: "nompuq ta", english: "evidence manifest", note: "Coined phrase: nompuq (evidence) + ta (record)." },
  headline: { term: "per'a'", english: "headline", note: "Coined inflection: per (label) + -'a' (augmentative)." },
  operator: { term: "SIr'o' Daq vu'wI'", english: "the site's operator", note: "Coined phrase: SIr'o' (web) + Daq (place) + vu' (manage) + -wI' (one who does)." },
  // Product units and the named substance in the safety report (T039).
  centimetres: { term: "juvmeH mI'", english: "centimetres", loan: "centimetres", note: "Coined phrase: juv (measure) + -meH (for the purpose of) + mI' (number). The loan preserves the physical unit." },
  grams: { term: "juvmeH mI'", english: "grams", loan: "grams", note: "Coined phrase: juv (measure) + -meH (for the purpose of) + mI' (number). The loan preserves the mass unit." },
  aluminium: { term: "baS", english: "aluminium", loan: "aluminium", note: "Attested noun: baS (metal). The loan specifies the metal tested in the report." },

  // The interface, the basket and the checkout (T040).
  megabytes: { term: "De' juvmeH mI'", english: "megabytes", loan: "MB", note: "Coined phrase: De' (data) + juv (measure) + -meH (for the purpose of) + mI' (number). The loan preserves the unit of a file's size." },
  pdf: { term: "laDmeH ta", english: "a PDF document", loan: "PDF", note: "Coined phrase: laD (read) + -meH (for the purpose of) + ta (record). The loan is the format's name, which a browser shows." },
  orderButton: { term: "vunmeH leQ", english: "the order button", note: "Coined phrase: vun (order from a catalogue) + -meH (for the purpose of) + leQ (switch), as on the terms page." },
  goods: { term: "Doch Daje'bogh", english: "the goods", note: "Coined phrase: Doch (thing) + je' (buy) + -bogh (which), the thing which you buy, as the terms page lists it." },
  quantity: { term: "mI'", english: "quantity", note: "Attested noun: mI' (number), used for the number of copies in the basket." },
  shipping: { term: "ngeHmeH mIw", english: "shipping", note: "Coined phrase: ngeH (send) + -meH (for the purpose of) + mIw (procedure)." },
  deliveryMethod: { term: "HIjmeH mIw", english: "delivery, a delivery method", note: "Coined phrase: HIj (deliver) + -meH (for the purpose of) + mIw (procedure). Standard delivery adds motlh (be standard)." },
  deliveryEstimate: { term: "HIjmeH poH noHlu'bogh", english: "delivery estimate", note: "Coined phrase: HIj (deliver) + -meH (for the purpose of) + poH (period of time) + noH (estimate) + -lu' (indefinite subject) + -bogh (which)." },
  postcode: { term: "Daq ngoq", english: "postcode", note: "Coined phrase: Daq (place) + ngoq (code). A country's dialling code is built the same way on Sep (region)." },
  phoneNumber: { term: "ghogh HablI' mI'", english: "phone number", note: "Coined phrase: ghogh (voice) + HablI' (data transceiving device), the attested phrase for a telephone, + mI' (number)." },
  paymentForm: { term: "Huch nobmeH De' ghItlhmeH Daq", english: "payment form", note: "Coined phrase: Huch (money) + nob (give) + -meH (for the purpose of) + De' (data) + ghItlh (write) + -meH (for the purpose of) + Daq (place), built like the contact form." },
  verificationChallenge: { term: "'olmeH qaD", english: "verification challenge", note: "Coined phrase: 'ol (verify) + -meH (for the purpose of) + qaD (challenge)." },
  privacyChoice: { term: "De' QanmeH wIv", english: "privacy choice", note: "Coined phrase: De' (data) + Qan (protect) + -meH (for the purpose of) + wIv (choice)." },
  homePage: { term: "tenwal wa'DIch", english: "home page", note: "Coined phrase: tenwal (page) + wa'DIch (first), as in the header." },
  pageAddress: { term: "tenwal Daq", english: "the address of a page", note: "Coined phrase: tenwal (page) + Daq (place), built like the e-mail address." },
  trailer: { term: "lIHmeH HaSta", english: "trailer", note: "Coined phrase: lIH (introduce) + -meH (for the purpose of) + HaSta (video)." },
  tutorial: { term: "ghojmoHmeH HaSta", english: "tutorial video", note: "Coined phrase: ghoj (learn) + -moH (cause) + -meH (for the purpose of) + HaSta (video)." },
  reviewer: { term: "Quj chovwI'", english: "reviewer", note: "Coined phrase: Quj (game) + chov (assess, evaluate) + -wI' (one who does)." },
  faction: { term: "ghom", english: "faction", note: "Attested noun: ghom (group), used for one of the game's six factions." },
  astronaut: { term: "logh lengwI'", english: "astronaut", note: "Coined phrase: logh (outer space) + leng (travel) + -wI' (one who does)." },
  lid: { term: "SoQmoHwI'", english: "lid of a box", note: "Coined agent noun: SoQ (be closed) + -moH (cause) + -wI' (thing which does)." },
  scoringDisc: { term: "toghmeH gho", english: "scoring disc", note: "Coined phrase: togh (count) + -meH (for the purpose of) + gho (circle). Not the glossary's Orb, the sphere." },
  screenReader: { term: "jIH laDbogh jan", english: "screen reader", note: "Coined phrase: jIH (viewing screen) + laD (read) + -bogh (which) + jan (device)." },
} as const satisfies Readonly<Record<string, KlingonLegalTerm>>;
