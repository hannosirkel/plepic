/**
 * The home page reads its words from the edition it is given.
 *
 * Two proofs, because neither is enough alone. `marker-fixture.test.ts`
 * shows that each scan used here finds what it is for.
 *
 * 1. **A render under the marker fixture.** Every edition's site copy is
 *    replaced with one whose sentences are all wrapped in marker characters
 *    and named for its edition (`helpers/marker-site-copy.ts`). The home page
 *    is rendered once per locale and whatever is left outside the markers is
 *    listed. The few words allowed there are named below with the table they
 *    come from, so a header or a price note still in English under `et` fails
 *    as surely as a sentence written into a component. The marked sentences
 *    must all be the rendered edition's: a section that was not handed the
 *    locale shows the default edition's, marked and wrong.
 *
 *    The same is asked of `HomeRoute`, the view that both the default
 *    edition's `/` and a prefixed edition's home page render, with its
 *    request-scoped inputs replaced. That is where the locale enters, and
 *    where the catalogue is resolved for it.
 * 2. **A scan of the source.** A render cannot reach a string a component
 *    only shows after an event: the newsletter form's validation errors
 *    appear when a visitor presses Subscribe. So the six components are also
 *    parsed (`helpers/reader-facing-literals.ts`), and any literal a reader
 *    could meet is listed.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_LOCALE, LOCALES, type Locale } from "../../content/routes.js";
import { HomeRoute } from "../src/app/localized-routes.js";
import { ReviewComposite } from "../src/components/ReviewComposite.js";
import { HomepageMockup } from "../src/components/mockups/HomepageMockup.js";
import { resolveCatalogue } from "../src/lib/catalogue.js";
import { CHROME_STRINGS } from "../src/lib/chrome-strings.js";
import { destinationForCode } from "../src/lib/destination.js";
import {
  editionsMarkedIn,
  markedFor,
  unmarkedText,
  withoutMarkedText,
} from "./helpers/marker-site-copy.js";
import { readerFacingLiterals } from "./helpers/reader-facing-literals.js";

type Editions = typeof import("../../content/editions.js");

/*
 * Every locale gets a marked copy of its own, the default one included and
 * `et` included, although `et` has no site copy today. That is the point: the
 * page is rendered as an edition that publishes it would render it, before
 * any such edition exists.
 */
vi.mock("../../content/editions.js", async (importOriginal) => {
  const actual = await importOriginal<Editions>();
  const { markSiteCopy } = await import("./helpers/marker-site-copy.js");
  const source = actual.siteCopyFor("en");
  const siteCopyByLocale = Object.fromEntries(
    Object.keys(actual.siteCopyByLocale).map((locale) => [locale, markSiteCopy(source, locale)]),
  );

  return { ...actual, siteCopyByLocale, siteCopyFor: (locale: string) => siteCopyByLocale[locale] };
});

/*
 * `HomeRoute` reads a request: its nonce, its destination cookie, the store's
 * product and the deployment's configuration. None of them is what this file
 * is about, so each is replaced with a fixed answer. The destination is inside
 * the EU, so the "VAT included" note is on the page to be checked.
 *
 * The page registry is replaced too. `HomeRoute` answers 404 for an edition
 * that does not publish the home page, which is every edition but the default
 * one today; here every edition publishes the default edition's routes.
 */
vi.mock("../src/config/runtime-config.js", () => ({
  getRuntimeConfig: () => ({
    medusa: { backendUrl: "http://backend.test", publishableKey: "pk_test" },
    turnstile: { siteKey: null },
    externalTargets: {},
  }),
}));
vi.mock("../src/lib/nonce.js", () => ({ getRequestNonce: async () => undefined }));
vi.mock("../src/lib/destination-request.js", async () => {
  const { destinationForCode } = await import("../src/lib/destination.js");
  return { getRequestDestination: async () => destinationForCode("EE") };
});
vi.mock("../src/lib/store-product.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/store-product.js")>()),
  loadStoreCatalogueProduct: async (input: { readonly presentation: unknown }) => input.presentation,
}));
vi.mock("../../content/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../content/index.js")>();
  const pagesByLocale = Object.fromEntries(
    Object.keys(actual.pagesByLocale).map((locale) => [locale, actual.pagesByLocale.en]),
  );
  return { ...actual, pagesByLocale };
});

const { siteCopyFor: actualSiteCopyFor } = await vi.importActual<Editions>("../../content/editions.js");
const english = actualSiteCopyFor(DEFAULT_LOCALE);

const srcDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "src");

/** The destination the mocked request carries: inside the EU. */
const catalogueFor = (locale: Locale) =>
  resolveCatalogue(undefined, destinationForCode("EE"), locale);

const homePage = (locale: Locale) =>
  renderToStaticMarkup(<HomepageMockup locale={locale} catalogue={catalogueFor(locale)} />);

function stringsIn(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(stringsIn);
}

/**
 * The words the home page shows that are not `SiteCopy`'s, each for a reason.
 *
 * Nothing here is English by default: the chrome and the price note are read
 * from the tables that hold them **for the locale under test**, so the
 * allowance for `et` is the Estonian label and an English one is reported.
 */
function wordsFromElsewhere(locale: Locale): readonly string[] {
  const catalogue = catalogueFor(locale);
  return [
    // Header and footer labels: `src/lib/chrome-strings.ts`, keyed by locale.
    ...stringsIn(CHROME_STRINGS[locale]),
    // The note under the price: `TAX_VOCABULARY` in `src/lib/catalogue.ts`, keyed by locale.
    catalogue.vatIncludedNote,
    // The product's name is printed on the box and is the same in every edition.
    catalogue.productName,
    // The publisher's name: the `alt` of the footer wordmark.
    "Plepic Games",
    // The platforms' own names, in the footer's social row.
    "Instagram",
    "Facebook",
    // `HoneypotField`'s label: `aria-hidden` and off-screen, a trap for a script that no visitor reads.
    "Leave this field empty",
  ];
}

describe("the home page under the marker fixture", () => {
  for (const locale of LOCALES) {
    const html = homePage(locale);

    it(`shows no unmarked sentence in ${locale}`, () => {
      expect(unmarkedText(html, wordsFromElsewhere(locale))).toEqual([]);
    });

    it(`shows no other edition's sentence in ${locale}`, () => {
      expect(editionsMarkedIn(html)).toEqual([locale]);
    });

    /*
     * A page that rendered nothing would pass the two tests above. These are
     * the sentences this change moved out of the components, and one from
     * each content module the page reads; each must be on the page, marked.
     */
    it(`shows the edition's own sentences in ${locale}`, () => {
      const rendered = (text: string) =>
        markedFor(locale, text).replaceAll("&", "&amp;").replaceAll("'", "&#x27;");
      const expected = [
        english.interface.home.heroImageAlt,
        english.interface.home.proofSectionLabel,
        english.interface.home.featuredCallToActionLabel,
        english.interface.home.featuredImageAlt,
        english.interface.home.teamPhotoAlt,
        english.lunarBase.pitch.text,
        english.publisher.publisherSentence.text,
        english.publisher.publisherShort.text,
        english.publisher.newsletter.submitLabel,
        english.proof.proofStrip.items[0].detail,
      ];
      for (const sentence of expected) expect(html).toContain(rendered(sentence));
    });

    it(`is what the home route renders for ${locale}, price note included`, async () => {
      const served = renderToStaticMarkup(await HomeRoute({ routeId: "home", locale }));

      expect(served).toContain(catalogueFor(locale).vatIncludedNote);
      expect(served).toBe(html);
    });
  }

  it("is the default edition's page when no locale is given", () => {
    expect(renderToStaticMarkup(<HomepageMockup />)).toBe(
      renderToStaticMarkup(<HomepageMockup locale={DEFAULT_LOCALE} />),
    );
  });

  /* The review composite is in this change and on another page, so it is rendered on its own. */
  it("shows no unmarked text in the review composite, its quotation marks included", () => {
    for (const locale of LOCALES) {
      const html = renderToStaticMarkup(<ReviewComposite locale={locale} />);

      expect(unmarkedText(html, [])).toEqual([]);
      expect(editionsMarkedIn(html)).toEqual([locale]);
      expect(html).toContain(markedFor(locale, english.interface.reviews.quotationOpen));
      expect(withoutMarkedText(html)).not.toMatch(/[“”„—–]/);
    }
  });
});

describe("the home page's components hold no sentence of their own", () => {
  /** The six components this change made locale-aware. */
  const components = [
    "components/mockups/HomepageMockup.tsx",
    "components/ProofStripSection.tsx",
    "components/ReviewComposite.tsx",
    "components/TeamPhotoSection.tsx",
    "components/forms/NewsletterForm.tsx",
    "components/SiteFooter.tsx",
  ];

  it("finds no reader-facing literal in them, the three proper nouns in the footer aside", () => {
    const found = Object.fromEntries(
      components.map((name) => [
        name,
        readerFacingLiterals(name, readFileSync(join(srcDir, name), "utf8")),
      ]),
    );

    expect(found).toEqual({
      "components/mockups/HomepageMockup.tsx": [],
      "components/ProofStripSection.tsx": [],
      "components/ReviewComposite.tsx": [],
      "components/TeamPhotoSection.tsx": [],
      "components/forms/NewsletterForm.tsx": [],
      // The platforms' names in the social row, and the publisher's name as the wordmark's `alt`.
      "components/SiteFooter.tsx": ["Instagram", "Facebook", "Plepic Games"],
    });
  });
});
