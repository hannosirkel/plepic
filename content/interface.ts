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
}

export const interfaceCopy: InterfaceCopy = {
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
};
