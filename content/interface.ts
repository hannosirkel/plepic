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
}

export const interfaceCopy: InterfaceCopy = {
  destinationSelector: {
    label: "Delivering to",
    hint: "This decides which price is shown, not what you are charged. The charge follows the delivery address you confirm at checkout.",
    updatingPrice: "Updating the price…",
  },
  home: {
    heroImageAlt:
      "The front and back of the Lunar Base game box, showing the astronaut cover and the component and game summary on the reverse.",
    proofSectionLabel: "Proof",
    featuredCallToActionLabel: "Explore Lunar Base",
    featuredImageAlt: "A hand of Lunar Base cards, fanned out.",
    teamPhotoAlt:
      "The six people who make up Plepic Games, photographed together indoors with copies of the Lunar Base box on the table in front of them.",
  },
  reviews: {
    quotationOpen: "“",
    quotationClose: "”",
    contextSeparator: " — ",
  },
  newsletterForm: {
    emailMissing: "Enter your email address.",
    emailInvalid: "Enter a valid email address.",
  },
  contactForm: {
    nameMissing: "Enter your name.",
    emailMissing: "Enter your email address.",
    emailInvalid: "Enter a valid your email address.",
    subjectMissing: "Enter what is this about?.",
    messageMissing: "Enter message.",
  },
  forms: {
    verificationLabel: "Verification challenge",
  },
  support: {
    faqHeading: "Frequently asked questions",
  },
  rulebook: {
    heading: "Lunar Base rulebook",
    lede: "The complete rulebook, exactly as printed in the box — 25 pages, tagged and selectable rather than a scan, so you can search it, copy from it, and read it with a screen reader.",
    openLabel: "Open the rulebook (PDF)",
    downloadNote: "It is a %megabytes% MB download, so it is worth knowing before you tap it on a phone.",
  },
  product: {
    boxImageAlt: "The Lunar Base box open on a plain background, its lid raised behind the empty tray, with a squared stack of cards topped by the Shackleton main-action card, a small card tuck box, the rulebook standing open, and several round scoring discs arranged in front.",
    victoryHeading: "Four ways to win",
    boxHeading: "What is in the box",
    cardsImageAlt: "A hand of Lunar Base cards, fanned out.",
    baseImageAlt: "A player's base laid out with a station and several module cards attached.",
    factionsSummary: "The six factions",
    tableHeading: "On the table",
    tableImageAlt: "A complete Lunar Base game in progress seen from above, with six branching player bases and cards arranged around the shared play area.",
    watchHeading: "Watch",
    trailerHeading: "Trailer",
    trailerTitle: "Lunar Base Kickstarter Launch Video",
    tutorialHeading: "Tutorial",
    tutorialTitle: "Lunar Base - Tutorial and Playthrough",
    reviewsHeading: "What reviewers say",
    questionsHeading: "Shipping, returns and other questions",
    buyAccessibleLabel: "Buy {productName}",
    safetyIncompleteSingle: "This manufacturer information is incomplete: %missing% has not been configured for this deployment.",
    safetyIncompletePlural: "This manufacturer information is incomplete: %missing% have not been configured for this deployment.",
    videoPendingSuffix: " is not linked yet — it will be embedded from YouTube once a published video id is configured.",
    outOfStock: "Out of stock",
    addingToBasket: "Adding to basket…",
    retryAddingToBasket: "Try adding to basket again",
    basketExpired: "The basket expired; try adding the game again",
  },
  checkout: {
    missing: {
      fullName: "Enter full name.",
      streetAddress: "Enter street and number.",
      postalCode: "Enter postcode.",
      city: "Enter town or city.",
      country: "Choose a country.",
      email: "Enter email address.",
      phone: "Enter phone number.",
    },
    deliveryMethodPrompt: "Choose a delivery method",
    deliveryOptionsLoading: "Updating delivery options…",
    deliveryOptionsFailed: "Delivery options could not be loaded. Check the address and try again.",
    paymentUnavailable: "Payment is unavailable. Please try again later.",
    paymentAwaitingDelivery: "Choose a delivery method to load payment options.",
    paymentOptionsLoading: "Loading payment options…",
    paymentOptionsFailed: "Payment options could not be loaded.",
    paymentOptionsNotReady: "Payment options are not ready. Wait a moment and try again.",
    paymentFormLoading: "Payment options are still loading",
    paymentNotConfirmed: "Payment could not be confirmed. Check the details or choose another method.",
    paymentNotCompleted: "Payment could not be completed. Nothing has been charged.",
    verificationIncomplete: "Complete the verification challenge before placing the order.",
    confirmedHeading: "Order confirmed",
    confirmedBody: "Your order number is %orderNumber%. A confirmation will be sent by email.",
  },
  deliveryMethodNames: {
    standard: "Standard delivery",
    "omniva-parcel-machine": "Omniva parcel machine",
  },
};
