/**
 * Reader-facing interface copy: the strings that used to be written inside
 * components. They move here as page groups become locale-aware, one group
 * per task, so a translator finds every sentence a visitor reads under
 * `content/` and nowhere else.
 *
 * The type is written out rather than taken from the English value. A
 * `typeof` of an `as const` object is a set of literal types, and no
 * translation is assignable to the literal `"Proof"`.
 *
 * No key here is named like an identifier (`id`, `name`, `type`, `source`,
 * ...): `mirror.test.ts` holds those equal across editions, and every value
 * in this file is prose.
 */
export interface InterfaceCopy {
  readonly destinationSelector: {
    readonly label: string;
    readonly hint: string;
    readonly updatingPrice: string;
  };
  /** The home page. */
  readonly home: {
    /** `alt` of the hero photograph of the box. */
    readonly heroImageAlt: string;
    /** Accessible name of the proof strip's section, which has no heading. */
    readonly proofSectionLabel: string;
    /** The call to action under the featured game's description. */
    readonly featuredCallToActionLabel: string;
    /** `alt` of the photograph beside the featured game's description. */
    readonly featuredImageAlt: string;
    /** `alt` of the team photograph in the publisher story. */
    readonly teamPhotoAlt: string;
  };
  /**
   * Typography around a quotation. Quotation marks and dashes are not the
   * same in every language, so they are copy.
   */
  readonly reviews: {
    readonly quotationOpen: string;
    readonly quotationClose: string;
    /** Between an attribution and its context, spaces included. */
    readonly contextSeparator: string;
  };
  /** The newsletter form's own validation errors, shown before any request. */
  readonly newsletterForm: {
    readonly emailMissing: string;
    readonly emailInvalid: string;
  };
  /**
   * The contact form's own validation errors, shown before any request.
   *
   * One sentence per field and fault. The form used to build them from a
   * lower-cased label, which is not a sentence in every language and changes
   * the spelling of a Klingon word. The English ones are what it built, kept
   * as they were.
   */
  readonly contactForm: {
    readonly nameMissing: string;
    readonly emailMissing: string;
    readonly emailInvalid: string;
    readonly subjectMissing: string;
    readonly messageMissing: string;
  };
  /** Copy every form with a verification challenge shares. */
  readonly forms: {
    /** Accessible name of the challenge widget. */
    readonly verificationLabel: string;
  };
  /**
   * The support page's own heading. Its component list and its tutorial video
   * are the product's, and stand under the product's headings below.
   */
  readonly support: {
    readonly faqHeading: string;
  };
  /** The rulebook page. */
  readonly rulebook: {
    readonly heading: string;
    readonly lede: string;
    readonly openLabel: string;
    /**
     * `%megabytes%` is the size of the file the link opens. Written as
     * `%missing%` is below: braces are for the tokens `schema.ts` declares.
     */
    readonly downloadNote: string;
    /** Shown when this edition's PDF is not yet published. */
    readonly englishRulebookNotice: string;
  };
  /** Copy written by the product page's presentation components. */
  readonly product: {
    readonly boxImageAlt: string;
    readonly victoryHeading: string;
    readonly boxHeading: string;
    readonly cardsImageAlt: string;
    readonly baseImageAlt: string;
    readonly factionsSummary: string;
    readonly tableHeading: string;
    readonly tableImageAlt: string;
    readonly watchHeading: string;
    readonly trailerHeading: string;
    readonly trailerTitle: string;
    readonly tutorialHeading: string;
    readonly tutorialTitle: string;
    readonly reviewsHeading: string;
    readonly questionsHeading: string;
    readonly buyAccessibleLabel: string;
    readonly safetyIncompleteSingle: string;
    readonly safetyIncompletePlural: string;
    readonly videoPendingSuffix: string;
    readonly outOfStock: string;
    readonly addingToBasket: string;
    readonly retryAddingToBasket: string;
    readonly basketExpired: string;
  };
  /** Copy written by the checkout's components. `content/shop.ts` holds the rest of that page. */
  readonly checkout: {
    /**
     * What the error summary says of an address field left empty, by field
     * name: the six of `checkout.address.fields` in `content/shop.ts`, and
     * the phone.
     *
     * One sentence per field, as in `contactForm` above and for its reason.
     * The English ones are what the form built from `missingFieldPrefix` or
     * `missingSelectionPrefix` and a lower-cased label, kept as they were.
     */
    readonly missing: {
      readonly fullName: string;
      readonly streetAddress: string;
      readonly postalCode: string;
      readonly city: string;
      readonly country: string;
      readonly email: string;
      readonly phone: string;
    };
    /** The unchosen option of the delivery method select. */
    readonly deliveryMethodPrompt: string;
    readonly deliveryOptionsLoading: string;
    readonly deliveryOptionsFailed: string;
    /** What a delivery method priced at nothing is shown as, in place of a figure. */
    readonly deliveryFree: string;
    /** A net delivery rate that VAT will be added to. `%amount%` is the rate, in the edition's number format. */
    readonly deliveryNetCharge: string;
    /** Shown where the payment form would be when the deployment has no payment key. */
    readonly paymentUnavailable: string;
    /** Shown where the payment form will be, until a delivery method is chosen. */
    readonly paymentAwaitingDelivery: string;
    readonly paymentOptionsLoading: string;
    readonly paymentOptionsFailed: string;
    /** A press of the order button before the payment form has loaded. */
    readonly paymentOptionsNotReady: string;
    readonly paymentFormLoading: string;
    readonly paymentNotConfirmed: string;
    /** A payment the provider has accepted and not yet settled. The visitor is taken to the return page. */
    readonly paymentProcessing: string;
    readonly paymentNotCompleted: string;
    readonly verificationIncomplete: string;
    readonly confirmedHeading: string;
    /** `%orderNumber%` is the number the shop gave the order. */
    readonly confirmedBody: string;
  };
  /**
   * The names of the delivery methods, keyed by the method ids of
   * `storefront/mock/shipping.json`.
   *
   * Medusa returns a method's name in English, and that name is also how the
   * storefront recognises the method, so it is not translated at its source.
   * The checkout shows the name held here in its place. The English values
   * equal the names in that file: `storefront/tests/checkout-edition.test.tsx`
   * holds both the keys and the values to it.
   */
  readonly deliveryMethodNames: {
    readonly standard: string;
    readonly "omniva-parcel-machine": string;
  };
  readonly paymentReturn: {
    readonly heading: string;
    readonly loading: string;
    readonly loadFailedBeforeLink: string;
    readonly loadFailedAfterLink: string;
    readonly returnToCheckout: string;
    readonly verificationInstruction: string;
    readonly completing: string;
    readonly completionFailed: string;
  };
  readonly consent: {
    readonly reopenLabel: string;
    readonly choicesLabel: string;
    readonly dialogLabel: string;
    readonly introduction: string;
    readonly privacyLink: string;
    readonly conclusion: string;
    readonly agree: string;
    readonly decline: string;
  };
  readonly notFound: {
    readonly title: string;
    readonly body: string;
    readonly homeLink: string;
  };
}

export const interfaceCopy: InterfaceCopy = {
  destinationSelector: {
    label: "Tarne sihtkoht",
    hint: "See määrab kuvatava hinna, mitte sinu lõpliku makstava summa. Tasu sõltub tarneaadressist, mille kinnitad tellimuse vormistamisel.",
    updatingPrice: "Hinna uuendamine…",
  },
  home: {
    heroImageAlt:
      "Lunar Base mängukarbi esi- ja tagakülg: esikaanel astronaut ning tagaküljel osade ja mängu kirjeldus.",
    proofSectionLabel: "Tõendus",
    featuredCallToActionLabel: "Tutvu mänguga Lunar Base",
    featuredImageAlt: "Lehvikuna laiali hoitud Lunar Base kaardid.",
    teamPhotoAlt:
      "Plepic Games’i kuus liiget koos siseruumis; nende ees laual on Lunar Base mängukarbid.",
  },
  reviews: {
    quotationOpen: "„",
    quotationClose: "“",
    contextSeparator: " – ",
  },
  newsletterForm: {
    emailMissing: "Sisesta oma e-posti aadress.",
    emailInvalid: "Sisesta kehtiv e-posti aadress.",
  },
  contactForm: {
    nameMissing: "Sisesta oma nimi.",
    emailMissing: "Sisesta oma e-posti aadress.",
    emailInvalid: "Sisesta kehtiv e-posti aadress.",
    subjectMissing: "Sisesta kirja teema.",
    messageMissing: "Sisesta sõnum.",
  },
  forms: {
    verificationLabel: "Kinnituskontroll",
  },
  support: {
    faqHeading: "Korduma kippuvad küsimused",
  },
  rulebook: {
    heading: "Lunar Base reegliraamat",
    lede: "Täielik reegliraamat täpselt sellisena, nagu see on karbis – 25 lehekülge valitavat teksti, mitte skannitud pildid. Saad tekstist otsida, seda kopeerida ja ekraanilugeriga lugeda.",
    openLabel: "Ava reegliraamat (PDF)",
    downloadNote:
      "Faili suurus on %megabytes% MB; seda on hea teada enne telefonis avamist.",
    englishRulebookNotice: "Reegliraamat on inglise keeles.",
  },
  product: {
    boxImageAlt:
      "Avatud Lunar Base karp ühevärvilisel taustal: kaas on tühja sisuosa taga, kõrval on Shackletoni põhitegevuse kaardiga kaetud kaardipakk, väike kaardikarp, avatud reegliraamat ja ümmargused punktikettad.",
    victoryHeading: "Neli võiduvõimalust",
    boxHeading: "Mis on karbis",
    cardsImageAlt: "Lehvikuna laiali hoitud Lunar Base kaardid.",
    baseImageAlt:
      "Mängija baas koos jaama ja selle külge ühendatud moodulikaartidega.",
    factionsSummary: "Kuus fraktsiooni",
    tableHeading: "Mäng laual",
    tableImageAlt:
      "Ülalt nähtud pooleliolev Lunar Base mäng: ühise mänguala ümber on kuus hargnevat mängijabaasi ja kaardid.",
    watchHeading: "Vaata",
    trailerHeading: "Treiler",
    trailerTitle: "Lunar Base Kickstarter Launch Video",
    tutorialHeading: "Õpetus",
    tutorialTitle: "Lunar Base - Tutorial and Playthrough",
    reviewsHeading: "Mida arvustajad ütlevad",
    questionsHeading: "Saatmine, tagastamine ja muud küsimused",
    buyAccessibleLabel: "Osta {productName}",
    safetyIncompleteSingle:
      "Tootja teave on puudulik: %missing% pole selle kasutuskeskkonna jaoks seadistatud.",
    safetyIncompletePlural:
      "Tootja teave on puudulik: %missing% pole selle kasutuskeskkonna jaoks seadistatud.",
    videoPendingSuffix:
      " pole veel lingitud – see lisatakse YouTube’ist, kui avaldatud video tunnus on seadistatud.",
    outOfStock: "Laost otsas",
    addingToBasket: "Ostukorvi lisamine…",
    retryAddingToBasket: "Proovi uuesti ostukorvi lisada",
    basketExpired: "Ostukorv aegus; proovi mäng uuesti lisada",
  },
  checkout: {
    missing: {
      fullName: "Sisesta täisnimi.",
      streetAddress: "Sisesta tänav ja majanumber.",
      postalCode: "Sisesta sihtnumber.",
      city: "Sisesta linn või asula.",
      country: "Vali riik.",
      email: "Sisesta e-posti aadress.",
      phone: "Sisesta telefoninumber.",
    },
    deliveryMethodPrompt: "Vali tarneviis",
    deliveryOptionsLoading: "Tarnevalikute uuendamine…",
    deliveryOptionsFailed:
      "Tarnevalikuid ei saanud laadida. Kontrolli aadressi ja proovi uuesti.",
    deliveryFree: "Tasuta",
    deliveryNetCharge: "%amount% + käibemaks",
    paymentUnavailable: "Maksmine pole praegu võimalik. Proovi hiljem uuesti.",
    paymentAwaitingDelivery: "Makseviiside laadimiseks vali tarneviis.",
    paymentOptionsLoading: "Makseviiside laadimine…",
    paymentOptionsFailed: "Makseviise ei saanud laadida.",
    paymentOptionsNotReady:
      "Makseviisid pole veel valmis. Oota hetk ja proovi uuesti.",
    paymentFormLoading: "Makseviise laaditakse veel",
    paymentNotConfirmed:
      "Makset ei saanud kinnitada. Kontrolli andmeid või vali teine makseviis.",
    paymentProcessing: "Makset töödeldakse veel. Kontrollime tellimuse olekut.",
    paymentNotCompleted:
      "Makset ei saanud lõpule viia. Sinult pole midagi võetud.",
    verificationIncomplete: "Enne tellimuse esitamist lõpeta kinnituskontroll.",
    confirmedHeading: "Tellimus kinnitatud",
    confirmedBody:
      "Sinu tellimuse number on %orderNumber%. Saadame kinnituse e-postiga.",
  },
  deliveryMethodNames: {
    standard: "Tavapärane tarne",
    "omniva-parcel-machine": "Omniva pakiautomaat",
  },
  paymentReturn: {
    heading: "Lõpeta tellimus",
    loading: "Tellimuse andmete laadimine…",
    loadFailedBeforeLink: "Sinu praeguse tellimuse andmeid ei saanud laadida. ",
    loadFailedAfterLink: " enne uuesti proovimist.",
    returnToCheckout: "Naase tellimuse vormistamise juurde",
    verificationInstruction: "Tellimuse lõpetamiseks tee uus kinnituskontroll.",
    completing: "Tellimuse lõpetamine…",
    completionFailed:
      "Enne uuesti proovimist kontrolli ostukorvi. Tellimus kuvatakse alles siis, kui pood on selle kinnitanud.",
  },
  consent: {
    reopenLabel: "Muuda privaatsusvalikuid",
    choicesLabel: "Privaatsusvalikud",
    dialogLabel: "Küpsiste ja analüütika nõusolek",
    introduction:
      "Kasutame Google Analyticsit saidi kasutuse mõistmiseks ainult sinu nõusolekul. Vaata",
    privacyLink: "privaatsusteadet",
    conclusion: "õigusliku aluse ja kõigi andmetöötlejate kohta.",
    agree: "Nõustun",
    decline: "Keeldun",
  },
  notFound: {
    title: "Lehte ei leitud",
    body: "Sellel aadressil ei ole siin saidil lehte.",
    homeLink: "Mine avalehele",
  },
};
