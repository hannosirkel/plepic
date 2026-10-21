/**
 * Interface copy — the Klingon edition of `../interface.ts`: the strings the
 * components write, from the destination selector to the 404 page.
 *
 * This file is a translation, not a revision. The keys and every placeholder,
 * in braces or between percent signs, are those of the English module, which
 * also says what each string is for; only prose is Klingon.
 *
 * Published under `/tlh` through `siteCopyByLocale`. The mirror test, content
 * scans, glossary check and Klingon word check still read this file.
 *
 * ## Sentences a component builds from several strings
 *
 * Klingon puts the object before its verb, so three of them are cut where
 * English is not:
 *
 * - `paymentReturn.loadFailedBeforeLink` ends with the clause "before you try
 *   again", the link `returnToCheckout` is the command that follows it, and
 *   `loadFailedAfterLink` is the full stop. The link is a whole label, because
 *   it also stands alone.
 * - `consent.introduction` ends with the object and the verb of "the privacy
 *   page describes …", `privacyLink` is that sentence's subject, and
 *   `conclusion` is a dash and "read it". The component puts the spaces round
 *   the link.
 * - `product.videoPendingSuffix` follows a video's title, so it opens with a
 *   colon and says the rest of that video as "this video".
 *
 * The form errors are whole sentences, one per field, as in English.
 * `safetyIncompleteSingle` and `safetyIncompletePlural` are one sentence: a
 * Klingon verb does not change with the number of a thing.
 *
 * ## Words that agree with the Klingon legal pages
 *
 * - `je'meH ngaSwI'` (basket), `Huch nobmeH Daq` (checkout), `tep ngaSwI' jan`
 *   (parcel machine) and `mIw paq` (rulebook) are the glossary's words.
 * - `HIjmeH mIw motlh` and `Omniva tep ngaSwI' jan` are the names
 *   `content/legal/tlh/shipping.ts` gives the two delivery methods, and
 *   `DIlnISbe'lu'`, "one need not pay for it", is how that page says the second
 *   is free.
 * - `HIjmeH Sep` is the destination a price is shown for, and `Huch
 *   DanobnISbogh`, "the money you must give", is what the visitor is charged,
 *   as on the shipping page. `Huch wISuqbe'`, "we take no money", says that
 *   nothing is charged.
 * - `ngevmeH 'ap (VAT)` carries its loan, as there.
 * - `vIlaj` and `vIlajQo'`, "I accept it" and "I refuse it", are the two
 *   answers the privacy page describes with the same verb. Klingon has no noun
 *   for consent, so the banner's name is a question.
 * - `'olmeH qaD`, "the challenge for verifying", is the verification challenge;
 *   the privacy page calls it `qaD`.
 *
 * The other phrases coined here are written out in `content/glossary/tlh.ts`
 * (`klingonLegalTerms`). A word the cards print stands in brackets where an
 * image description names a card type.
 */

import type { InterfaceCopy } from "../interface.js";

export const interfaceCopy: InterfaceCopy = {
  destinationSelector: {
    label: "HIjmeH Sep",
    hint: "DIlmeH Huch 'anglu'bogh wuq Sepvam; Huch DanobnISbogh wuqbe'. Huch DanobnISbogh wuq Huch nobmeH DaqDaq HIjmeH Daq Dawoqbogh.",
    updatingPrice: "DIlmeH Huch choHlu'taH…",
  },
  home: {
    heroImageAlt:
      "Lunar Base Quj 'aplo' cha' Dop — tlhop Dop, 'em Dop je: tlhop DopDaq logh lengwI' mIllogh 'anglu'; 'em DopDaq Quj Dochmey tetlh, Quj De' je 'anglu'.",
    proofSectionLabel: "nompuq",
    featuredCallToActionLabel: "Lunar Base yInuD",
    featuredImageAlt: "wa' ghopDaq Lunar Base navmey tu'lu'; Hoch nav leghlu'meH lanlu'.",
    teamPhotoAlt:
      "Plepic Games ghom naQ — jav nuv — 'angbogh mIllogh; wa' pa'Daq nItebHa' tu'lu', 'ej tlhopchajDaq raSDaq Lunar Base 'aplo'mey tu'lu'.",
  },
  reviews: {
    quotationOpen: "“",
    quotationClose: "”",
    contextSeparator: " — ",
  },
  newsletterForm: {
    emailMissing: "QIn DaqlIj yIghItlh.",
    emailInvalid: "QIn Daq lugh yIghItlh.",
  },
  contactForm: {
    nameMissing: "ponglIj yIghItlh.",
    emailMissing: "QIn DaqlIj yIghItlh.",
    emailInvalid: "QIn Daq lugh yIghItlh.",
    subjectMissing: "Doch'e' bopbogh QInlIj yIghItlh.",
    messageMissing: "QIn yIghItlh.",
  },
  forms: {
    verificationLabel: "'olmeH qaD",
  },
  support: {
    faqHeading: "pIj ghellu'bogh mu'tlheghmey",
  },
  rulebook: {
    heading: "Lunar Base mIw paq",
    lede: "tlhIngan Hol mIw paq naQ; 'aplo'Daq tu'lu'bogh English Hol paq rur — 25 tenwal. mIllogh neH ngaSbe': permey ghaj 'ej mu'mey DawIvlaH; vaj mu'mey DanejlaH, mu'mey velqa' DaSuqlaH, 'ej jIH laDbogh jan Dalo'laH.",
    openLabel: "mIw paq yIpoSmoH (PDF)",
    downloadNote: "tIn laDmeH ta: %megabytes% De' juvmeH mI' (MB). ghogh HablI'Daq rarwI' Da'uypa', 'e' yIqel.",
    otherLanguagesHeading: "Hol latlhmeyDaq mIw paq",
    languageSize: "%megabytes% De' juvmeH mI' (MB)",
  },
  product: {
    boxImageAlt: "napbogh DaqDaq poS Lunar Base 'aplo'; chIm 'aplo', 'ej 'emDajDaq Qam 'aplo' SoQmoHwI'. tlhopDajDaq Dochmeyvam lanlu': navmey ghom pup — DungDajDaq Shackleton Qu' potlh (Main Action) nav tu'lu' —, navmey 'aplo' mach, poSbogh 'ej Qambogh mIw paq, 'op toghmeH ghomey je.",
    victoryHeading: "QapmeH loS mIw",
    boxHeading: "'aplo'Daq Dochmey tu'lu'bogh",
    cardsImageAlt: "wa' ghopDaq Lunar Base navmey tu'lu'; Hoch nav leghlu'meH lanlu'.",
    baseImageAlt: "raSDaq lanlu'pu' wa' 'ovwI' waw' (Base): wa' logh Daq (Station) tu'lu', 'ej logh DaqvamDaq 'op 'ay' (Module) navmey rarlu'.",
    factionsSummary: "jav ghommey",
    tableHeading: "raSDaq",
    tableImageAlt: "Dungvo' Lunar Base Quj naQ leghlu'; Qujlu'taH. jav 'ovwI' waw'mey tu'lu' — Sor bartIqmey rur Hoch waw' 'ay'mey —, 'ej nItebHa' Quj Daq lo'lu'bogh retlhDaq navmey lanlu'.",
    watchHeading: "yIlegh",
    trailerHeading: "lIHmeH HaSta",
    trailerTitle: "Lunar Base: Kickstarter Huch boSmeH Qu' taghbogh HaSta",
    tutorialHeading: "ghojmoHmeH HaSta",
    tutorialTitle: "Lunar Base — ghojmoHmeH HaSta, Quj naQ je",
    reviewsHeading: "Quj chovwI'pu' mu'mey",
    questionsHeading: "ngeHmeH mIw, tep tatlhmeH mIw, ghellu'bogh latlh mu'tlheghmey je",
    buyAccessibleLabel: "{productName} yIje'",
    safetyIncompleteSingle: "naQbe' chenmoHwI' De'vam: DaqvamvaD %missing% lanlu'be'pu'.",
    safetyIncompletePlural: "naQbe' chenmoHwI' De'vam: DaqvamvaD %missing% lanlu'be'pu'.",
    videoPendingSuffix: ": wej HaStavam rarlu' — maqlu'pu'bogh HaSta ngoq lanlu'DI', tenwalvamDaq YouTube HaSta 'anglu'.",
    outOfStock: "Hoch ngevlu'pu'",
    playerCount: "%min%–%max% 'ovwI'pu'",
    addingToBasket: "je'meH ngaSwI'Daq chellu'taH…",
    retryAddingToBasket: "je'meH ngaSwI'Daq yIchelqa'",
    basketExpired: "Dorpu' je'meH ngaSwI' poH; Quj yIchelqa'",
    playOnline: {
      heading: "SIr'o'Daq yIQuj",
      body: "SIr'o'Daq Lunar Base yIQuj; DIlnISbe'lu'. latlh nuvpu' De'wI' gholmey ghap DaqaDlaH. bIqI'nISbe'. English Hol lo' SIr'o' Qujvam.",
      linkLabel: "SIr'o'Daq Lunar Base yIQuj",
    },
  },
  checkout: {
    missing: {
      fullName: "pong naQ yIghItlh.",
      streetAddress: "taw, juH mI' je yIghItlh.",
      postalCode: "Daq ngoq yIghItlh.",
      city: "veng vengHom ghap yIghItlh.",
      country: "Sep yIwIv.",
      email: "QIn Daq yIghItlh.",
      phone: "ghogh HablI' mI' yIghItlh.",
    },
    deliveryMethodPrompt: "HIjmeH mIw yIwIv",
    deliveryOptionsLoading: "HIjmeH mIwmey choHlu'taH…",
    deliveryOptionsFailed: "HIjmeH mIwmey wISuqlaHbe'. HIjmeH Daq yInuD 'ej yInIDqa'.",
    deliveryFree: "DIlnISbe'lu'",
    deliveryNetCharge: "%amount% + ngevmeH 'ap (VAT)",
    paymentUnavailable: "DaH Huch nobmeH mIw Dalo'laHbe'. ghIq yInIDqa'.",
    paymentAwaitingDelivery: "Huch nobmeH mIwmey DaSuqmeH, HIjmeH mIw yIwIv.",
    paymentOptionsLoading: "Huch nobmeH mIwmey Suqlu'taH…",
    paymentOptionsFailed: "Huch nobmeH mIwmey wISuqlaHbe'.",
    paymentOptionsNotReady: "wej Huch nobmeH mIwmey Suqlu'. loQ yIloS 'ej yInIDqa'.",
    paymentFormLoading: "Huch nobmeH mIwmey Suqlu'taH; wej rIn",
    paymentNotConfirmed: "Huch nobmeH mIw wIwoqlaHbe'. De' yInuD, pagh latlh mIw yIwIv.",
    paymentProcessing: "Huch nobmeH mIw vu'lu'taH. vunmeH QIn ghu' wInuDtaH.",
    paymentNotCompleted: "Huch nobmeH mIw wIrInmoHlaHbe'. Huch wISuqpu'be'.",
    verificationIncomplete: "bIvunpa', 'olmeH qaD yIrInmoH.",
    confirmedHeading: "vunmeH QIn woqlu'pu'",
    confirmedBody: "vunmeH QInlIj mI': %orderNumber%. QIn DaqlIjDaq woqmeH QIn wIngeH.",
  },
  deliveryMethodNames: {
    standard: "HIjmeH mIw motlh",
    "omniva-parcel-machine": "Omniva tep ngaSwI' jan",
  },
  paymentReturn: {
    heading: "vunmeH QInlIj yIrInmoH",
    loading: "vunmeH QInlIj De' Suqlu'taH…",
    loadFailedBeforeLink: "vunmeH QInlIj De' chu' wISuqlaHbe'. bInIDqa'pa', ",
    loadFailedAfterLink: ".",
    returnToCheckout: "Huch nobmeH DaqDaq yIchegh",
    verificationInstruction: "vunmeH QInlIj DarInmoHmeH, 'olmeH qaD chu' yIrInmoH.",
    completing: "vunmeH QIn rInmoHlu'taH…",
    completionFailed: "bInIDqa'pa' je'meH ngaSwI'lIj yInuD. vunmeH QIn woqpa' ngevmeH Daq, 'anglu'be'.",
  },
  consent: {
    reopenLabel: "De' QanmeH wIvmeylIj yIchoH",
    choicesLabel: "De' QanmeH wIvmey",
    dialogLabel: "De' chabHommeyvaD juvmeH mIwvaD je bIghIb'a'?",
    introduction: "SIr'o' Daq lo'meH mIw wIjuvmeH Google Analytics wIlo'; bIghIbpu'DI' neH wIlo'. chut meq, De' vu'bogh Hoch malja' je Del",
    privacyLink: "De' QanmeH mIw tenwal",
    conclusion: "— yIlaD.",
    agree: "vIlaj",
    decline: "vIlajQo'",
  },
  notFound: {
    title: "tenwal Samlu'be'",
    body: "SIr'o' DaqvamDaq tenwal ngu'be' tenwal Daqvetlh.",
    homeLink: "tenwal wa'DIch yIghoS",
  },
};
