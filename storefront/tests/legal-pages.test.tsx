/**
 * The five legal pages and the product page's GPSR block, rendered.
 *
 * Two properties, and they pull in opposite directions on purpose.
 *
 * 1. **Configured, nothing is missing.** Every legally required value
 *    resolves, no brace survives, no gap marker appears, and no page shows the
 *    incompleteness notice. This is the assertion that makes the whole
 *    arrangement a *guarantee* rather than a runtime hope: a legally required
 *    placeholder added to `content/` with no matching `MERCHANT_*` variable,
 *    or a variable that stops being read, fails here.
 * 2. **Unconfigured, nothing is hidden.** Every missing value is named where
 *    it belongs and named again in a page-level notice, and **no paragraph is
 *    dropped**. `src/lib/configuration-placeholders.ts` explains why an
 *    imprint gets the opposite treatment to the Support page: a legal notice
 *    that quietly loses a disclosure looks complete, and looking complete is
 *    the whole defect.
 *
 * `tests/no-unresolved-placeholder.test.tsx` is the brace-hunting scan and now
 * covers these routes too; this file is about the states either side of it.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { legalPages, legalPagesByLocale } from "../../content/legal/index.js";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "../../content/routes.js";
import type { ExternalTargetUrls } from "../src/config/runtime-config.js";
import {
  mockCatalogue,
  PRICE_HEADLINE_SEPARATOR,
  resolveCatalogue,
  resolveCataloguePlaceholders,
} from "../src/lib/catalogue.js";
import { contentFor, PLACEHOLDER_TABLE } from "../../content/schema.js";
import { LegalPageContent } from "../src/components/pages/LegalPageContent.js";
import { ProductSafetyBlock } from "../src/components/ProductSafetyBlock.js";
import {
  CONFIGURATION_PLACEHOLDER_TOKENS,
  NO_CONFIGURATION_VALUES,
  labelFor,
  placeholderValuesFrom,
  resolveRequiredProse,
  resolvedParagraphs,
  type ConfigurationPlaceholderValues,
} from "../src/lib/configuration-placeholders.js";

/**
 * A complete, obviously-not-real identity. Reserved example values only — the
 * real one belongs in the private inventory and reaches a pod as environment,
 * never as a committed fixture.
 */
const CONFIGURED: ConfigurationPlaceholderValues = {
  merchantLegalName: "Example Trader OU",
  merchantRegisteredAddress: "1 Example Street, Example Town, Example County",
  merchantRegistrationNumber: "EXAMPLE-12345678",
  merchantVatNumber: "EXAMPLE-VAT-1",
  merchantContactAddress: "hello@example.com",
  merchantPhoneNumber: "+000 00 000000",
  returnAddress: "2 Example Street, Example Town, Example County",
};

function visibleText(html: string): string {
  return html
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, " ")
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/g, " ")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

/**
 * The one external destination a legal page's obligation depends on, as a
 * deployment supplies it. A reserved example host, for the same reason the
 * identity above is obviously not real.
 */
const CONFIGURED_TARGETS: ExternalTargetUrls = {
  "consumer-disputes-committee": "https://disputes.example.org/committee",
};

/*
 * `locale` matters: pass 2 of this unit's review found the per-edition loops
 * rendering Estonian content through the default edition's renderer -- English
 * chrome, English marker word, English notice, English collation -- so they
 * proved their properties of the Estonian *content* and assumed them of the
 * Estonian *render*. Every per-edition loop below passes its own locale.
 */
function render(
  page: (typeof legalPages)[number],
  values: ConfigurationPlaceholderValues,
  externalTargets: ExternalTargetUrls = CONFIGURED_TARGETS,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return renderToStaticMarkup(
    <LegalPageContent page={page} locale={locale} values={values} externalTargets={externalTargets} />,
  );
}

/**
 * Each edition's failure-mode strings, as **literals**. The renderer takes
 * them from `chrome-strings.ts` and `configuration-placeholders.ts`; pass 2
 * demonstrated that every Estonian entry there could be reverted to English
 * with the suite green, because nothing pinned the values -- the total
 * `Record<Locale, ...>` types enforce that an `et` key exists, not what is in
 * it. These are the strings a reader meets when a deployment is
 * misconfigured, interpolated into the middle of legal sentences, so they are
 * pinned in the reader's own language here.
 */
const EDITION_FAILURE_LANGUAGE: Readonly<
  Record<
    Locale,
    {
      readonly markerPrefix: string;
      readonly imprintMarkers: readonly string[];
      readonly returnsMarker: string;
      readonly noticeHeading: string;
      /**
       * A distinctive fragment of the notice *body* -- the sentence following
       * the heading that carries the disclaimer itself.
       *
       * Pinned because review pass 3 replaced the Estonian `noticeBody` with
       * the English function verbatim and all 1865 tests stayed green. An
       * unconfigured Estonian imprint could therefore serve the Estonian
       * heading "See teade on puudulik." above an English paragraph, and the
       * suite written in this unit to prevent exactly that would not have
       * noticed. The heading and the draft note either side of it were already
       * pinned; this is the longest reader-facing string between them, and the
       * one that says the page is not a complete legal notice.
       */
      readonly noticeBodyFragment: string;
      readonly draftNote: string;
    }
  >
> = {
  en: {
    markerPrefix: "[not configured: ",
    imprintMarkers: [
      "[not configured: registered company name]",
      "[not configured: registered address]",
      "[not configured: company registration number]",
      "[not configured: VAT identification number]",
      "[not configured: contact email address]",
      "[not configured: telephone number]",
    ],
    returnsMarker: "[not configured: return address]",
    noticeHeading: "This notice is incomplete.",
    noticeBodyFragment:
      "this page is not a complete legal notice and should not be relied on as one",
    draftNote: "Draft, pending the operator’s approval.",
  },
  et: {
    markerPrefix: "[seadistamata: ",
    imprintMarkers: [
      "[seadistamata: registreeritud ärinimi]",
      "[seadistamata: registrijärgne aadress]",
      "[seadistamata: registrikood]",
      "[seadistamata: käibemaksukohustuslasena registreerimise number]",
      "[seadistamata: e-posti kontaktaadress]",
      "[seadistamata: telefoninumber]",
    ],
    returnsMarker: "[seadistamata: tagastusaadress]",
    noticeHeading: "See teade on puudulik.",
    noticeBodyFragment:
      "ei ole see leht täielik õiguslik teade ja sellele ei saa sellisena tugineda",
    draftNote: "Mustand, ootab haldaja heakskiitu.",
  },
};

describe("the resolver knows exactly the tokens content/ declares from configuration", () => {
  it("resolves every configuration-sourced placeholder and no others", () => {
    const declared = Object.entries(PLACEHOLDER_TABLE)
      .filter(([, placeholder]) => placeholder.source === "configuration")
      .map(([token]) => token)
      .toSorted();

    expect(
      [...CONFIGURATION_PLACEHOLDER_TOKENS].toSorted(),
      "a configuration placeholder content/ declares that this module cannot resolve would " +
        "reach a visitor as a brace, or be dropped with its paragraph",
    ).toEqual(declared);
  });

  it("gives every token a human label for the notice", () => {
    for (const token of CONFIGURATION_PLACEHOLDER_TOKENS) {
      expect(labelFor(token).length, `${token} has no label`).toBeGreaterThan(3);
    }
  });

  it("projects a runtime MerchantConfig onto every one of them", () => {
    const values = placeholderValuesFrom({
      legalName: "a",
      registeredAddress: "b",
      registrationNumber: "c",
      vatNumber: "d",
      contactAddress: "e",
      phoneNumber: "f",
      returnAddress: "g",
    });
    expect(Object.values(values).filter((value) => value === null)).toEqual([]);
  });
});

/*
 * Both loops below run over every edition, not over the default one. The two
 * properties they hold — configured, nothing is missing; unconfigured,
 * nothing is hidden — are properties of a page as served, and the Estonian
 * pages are served to exactly the consumer the translation exists for. A
 * loop over `legalPages` alone would have proved them of the English pages
 * and assumed them of the Estonian ones.
 */
describe("configured, the legal pages carry every required disclosure", () => {
  for (const locale of LOCALES) {
  for (const page of contentFor(legalPagesByLocale, locale)) {
    it(`${locale}:${page.route} resolves everything and shows no notice`, () => {
      const html = render(page, CONFIGURED, CONFIGURED_TARGETS, locale);
      const text = visibleText(html);

      expect(text, "an unresolved placeholder reached a visitor").not.toMatch(
        /\{[A-Za-z][A-Za-z0-9]*\}/,
      );
      for (const edition of LOCALES) {
        expect(
          text,
          "a legally required value is unconfigured in the configured case",
        ).not.toContain(EDITION_FAILURE_LANGUAGE[edition].markerPrefix);
      }
      expect(html).not.toContain("legal-incomplete-notice");
      expect(text.trim().length, `${page.route} rendered nothing`).toBeGreaterThan(600);
    });

    it(`${locale}:${page.route} renders every string its content declares`, () => {
      const text = visibleText(render(page, CONFIGURED, CONFIGURED_TARGETS, locale));
      const served = (source: string): string =>
        resolveRequiredProse(
          [resolveCataloguePlaceholders(source, resolveCatalogue())],
          CONFIGURED,
        ).paragraphs[0] ?? "";

      for (const section of page.body) {
        expect(text, `${page.route} dropped the heading ${section.heading}`).toContain(
          section.heading,
        );
        for (const paragraph of section.body) {
          expect(text, `${page.route} dropped a paragraph`).toContain(served(paragraph));
        }
        /*
         * Every field of `LegalSection`, not the two a reviewer happened to
         * look at. `callout` and `table` were added for the operator's price
         * presentation and cookie table, and a loop written against `body` and
         * `items` would have gone silently blind to both — which is the exact
         * defect class this component exists to close.
         */
        if (section.callout !== undefined) {
          expect(text, `${page.route} dropped a callout`).toContain(served(section.callout.lead));
          expect(text, `${page.route} dropped a callout`).toContain(served(section.callout.detail));
        }
        for (const item of section.items ?? []) {
          expect(text, `${page.route} dropped a list item`).toContain(item.term);
        }
        if (section.table !== undefined) {
          for (const cell of [
            section.table.caption,
            ...section.table.columns,
            ...section.table.rows.flat(),
            ...(section.table.notes ?? []),
          ]) {
            expect(text, `${page.route} dropped a table cell`).toContain(served(cell));
          }
        }
      }
    });
  }
  }

  for (const locale of LOCALES) {
    const edition = contentFor(legalPagesByLocale, locale);

    it(`${locale}: states the whole trader identity on the imprint, telephone number included`, () => {
      const imprint = edition.find((page) => page.route === "legalImprint");
      const text = visibleText(render(imprint!, CONFIGURED, CONFIGURED_TARGETS, locale));

      for (const value of [
        CONFIGURED.merchantLegalName,
        CONFIGURED.merchantRegisteredAddress,
        CONFIGURED.merchantRegistrationNumber,
        CONFIGURED.merchantVatNumber,
        CONFIGURED.merchantContactAddress,
        CONFIGURED.merchantPhoneNumber,
      ]) {
        expect(text).toContain(value);
      }
    });

    it(`${locale}: states the return address on the returns page`, () => {
      const returnsPage = edition.find((page) => page.route === "legalReturns");
      expect(
        visibleText(render(returnsPage!, CONFIGURED, CONFIGURED_TARGETS, locale)),
      ).toContain(CONFIGURED.returnAddress);
    });
  }
});

describe("unconfigured, the legal pages are loud rather than quiet", () => {
  for (const locale of LOCALES) {
  for (const page of contentFor(legalPagesByLocale, locale)) {
    it(`${locale}:${page.route} drops no paragraph and shows no brace`, () => {
      const configured = visibleText(render(page, CONFIGURED, CONFIGURED_TARGETS, locale));
      const unconfigured = visibleText(render(page, NO_CONFIGURATION_VALUES, {}, locale));

      expect(unconfigured, "a brace reached a visitor").not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);

      for (const section of page.body) {
        const declared = [
          ...section.body,
          ...(section.callout === undefined
            ? []
            : [section.callout.lead, section.callout.detail]),
          ...(section.table === undefined
            ? []
            : [
                section.table.caption,
                ...section.table.columns,
                ...section.table.rows.flat(),
                ...(section.table.notes ?? []),
              ]),
        ];

        for (const paragraph of declared) {
          // The string's fixed words survive even when its values do not.
          const stem = resolveCataloguePlaceholders(paragraph, resolveCatalogue())
            .split(/\{[A-Za-z][A-Za-z0-9]*\}/)[0]
            ?.trim() ?? "";
          if (stem.length < 12) continue;
          expect(unconfigured, `${page.route} dropped: ${stem.slice(0, 48)}`).toContain(stem);
        }
      }

      // Never shorter in substance: the notice adds text, nothing is removed.
      expect(unconfigured.length).toBeGreaterThan(configured.length * 0.9);
    });
  }
  }

  it("names every missing detail on the imprint, in the text and in the notice", () => {
    const imprint = legalPages.find((page) => page.route === "legalImprint");
    const html = render(imprint!, NO_CONFIGURATION_VALUES, {});
    const text = visibleText(html);

    expect(html).toContain("legal-incomplete-notice");
    for (const label of [
      "registered company name",
      "registered address",
      "company registration number",
      "VAT identification number",
      "contact email address",
      "telephone number",
    ]) {
      expect(text, `the imprint hides its missing ${label}`).toContain(
        `[not configured: ${label}]`,
      );
    }
  });

  it("never fabricates a value, and never renders an empty one", () => {
    for (const locale of LOCALES) {
      for (const page of contentFor(legalPagesByLocale, locale)) {
        const text = visibleText(render(page, NO_CONFIGURATION_VALUES, {}, locale));
        // No sentence ends up with a dangling ", ." or "at ." where a value
        // went — nor the Estonian equivalent, "aadressil ." and kin.
        expect(text, `${locale}:${page.route} rendered an empty value`).not.toMatch(
          /\b(?:at|to|is|aadressil|aadress|on)\s+[.,]/,
        );
      }
    }
  });
});

/**
 * The failure-mode strings, per edition, against the literal table above.
 * This is what stops `CHROME_STRINGS.et`, `MARKER_WORDS.et` or `LABELS.et`
 * quietly reverting to English: the rendered Estonian page must carry the
 * Estonian marker, label set, notice heading and draft note, character for
 * character, and the English page the English ones.
 */
describe("each edition fails loudly in its own language", () => {
  for (const locale of LOCALES) {
    const language = EDITION_FAILURE_LANGUAGE[locale];
    const edition = contentFor(legalPagesByLocale, locale);

    it(`${locale}: marks every missing imprint detail with its own marker and labels`, () => {
      const imprint = edition.find((page) => page.route === "legalImprint");
      const text = visibleText(render(imprint!, NO_CONFIGURATION_VALUES, {}, locale));

      for (const marker of language.imprintMarkers) {
        expect(text, `the ${locale} imprint does not carry ${marker}`).toContain(marker);
      }
      for (const other of LOCALES) {
        if (other === locale) continue;
        expect(
          text,
          `the ${locale} imprint carries another edition's marker word`,
        ).not.toContain(EDITION_FAILURE_LANGUAGE[other].markerPrefix);
      }
    });

    it(`${locale}: marks the missing return address on the returns page`, () => {
      const returnsPage = edition.find((page) => page.route === "legalReturns");
      expect(
        visibleText(render(returnsPage!, NO_CONFIGURATION_VALUES, {}, locale)),
      ).toContain(language.returnsMarker);
    });

    /*
     * The draft note is asserted **absent**, and that is the whole inversion:
     * all ten pages are `operator-approved`, so no visitor is served a legal
     * page labelled a draft. It is asserted here — on the page rendered with
     * *nothing* configured — deliberately. The incompleteness notice and the
     * draft note are independent: one is about this deployment's environment,
     * the other about the operator's approval, and the pairing that used to be
     * asserted made the second look like a consequence of the first. A page
     * that is missing its registry code still says so; it does not additionally
     * claim to be unapproved.
     *
     * The per-edition string is still pinned, because the assertion has to be
     * able to fail: `draftNote` is compared character for character against the
     * literal table above, so a `CHROME_STRINGS.et` that reverted to English
     * would be caught by the sibling marker tests, and this one cannot pass
     * merely by looking for a string no edition produces.
     */
    it(`${locale}: announces incompleteness in its own words, and calls no page a draft`, () => {
      const imprint = edition.find((page) => page.route === "legalImprint");
      const text = visibleText(render(imprint!, NO_CONFIGURATION_VALUES, {}, locale));
      expect(text).toContain(language.noticeHeading);
      expect(text).toContain(language.noticeBodyFragment);
      expect(text, `the ${locale} imprint is served labelled a draft`).not.toContain(
        language.draftNote,
      );
    });

    it(`${locale}: serves no legal page labelled a draft`, () => {
      for (const page of edition) {
        expect(page.reviewStatus, `${page.route} is still a draft`).toBe("operator-approved");
        const text = visibleText(render(page, NO_CONFIGURATION_VALUES, {}, locale));
        expect(text, `${page.route} is served labelled a draft`).not.toContain(language.draftNote);
      }
    });
  }
});

describe("the two failure modes stay distinct", () => {
  const paragraphs = ["Write to {merchantContactAddress}.", "This one has no token."];

  it("optional prose drops the sentence it cannot resolve", () => {
    expect(resolvedParagraphs(paragraphs, NO_CONFIGURATION_VALUES)).toEqual([
      "This one has no token.",
    ]);
  });

  it("required prose keeps it, names the gap, and reports what is missing", () => {
    const result = resolveRequiredProse(paragraphs, NO_CONFIGURATION_VALUES);
    expect(result.paragraphs).toEqual([
      "Write to [not configured: contact email address].",
      "This one has no token.",
    ]);
    expect(result.missing).toEqual(["merchantContactAddress"]);
  });

  it("required prose reports nothing missing once the value is configured", () => {
    const result = resolveRequiredProse(paragraphs, CONFIGURED);
    expect(result.missing).toEqual([]);
    expect(result.paragraphs[0]).toBe("Write to hello@example.com.");
  });

  it("uses a marker the brace scanner would not mistake for a resolved token", () => {
    const result = resolveRequiredProse(["{merchantVatNumber}"], NO_CONFIGURATION_VALUES);
    expect(result.paragraphs[0]).not.toMatch(/[{}]/);
  });
});

/**
 * The out-of-court body, and the two classes of missing thing.
 *
 * M4 added the section; the first revision then added the access method as a
 * configurable link and put it in the **legally required** gap set, so an
 * unconfigured deployment marked `/legal/terms` incomplete over a URL. The
 * operator, with the qualified reviewer's manual verification on 2026-08-10,
 * confirmed that naming the Consumer Disputes Committee **without** an access
 * method satisfies Article 6(1)(t) CRD. The link is a real improvement and it
 * stays; what had to change is its consequence, because an optional
 * enhancement must not make a legally complete page announce itself as
 * incomplete.
 *
 * The last test in this block is the one that matters, and it is deliberately
 * one test rather than two: it renders a single page in a single state and
 * asserts that a missing **destination** is silent while a missing **value** is
 * loud. Split across two fixtures, a mutation that flattened both classes into
 * "quiet" would still pass one of them.
 */
describe("the dispute-resolution section names the body, and the link only enhances it", () => {
  const terms = legalPages.find((page) => page.route === "legalTerms");
  const section = terms?.body.find((candidate) => candidate.anchor === "dispute-resolution");

  it("names the forum in its own prose, which is what discharges the obligation", () => {
    expect(section, "the dispute-resolution section is gone").toBeDefined();
    expect((section?.body ?? []).join(" ")).toContain(
      "you may refer the dispute to the Consumer Disputes Committee at the Estonian Consumer " +
        "Protection and Technical Regulatory Authority. The procedure is free of charge.",
    );
  });

  it("declares the access method in content, as a target id and never as a URL", () => {
    const link = section?.links?.[0];
    expect(link, "the access method was deleted rather than degraded").toBeDefined();
    expect(link?.target.kind).toBe("external");
    expect(link?.target.kind === "external" ? link.target.to : undefined).toBe(
      "consumer-disputes-committee",
    );
    // The label is copy, not an address: no scheme and no host in content.
    expect(link?.label).not.toMatch(/[a-z][a-z0-9+.-]*:\/\/|\.[a-z]{2,}\b/i);
  });

  it("renders it as a real link when a deployment configures the address", () => {
    const html = render(terms!, CONFIGURED);
    expect(html).toContain('href="https://disputes.example.org/committee"');
    expect(visibleText(html)).toContain("How to reach the Consumer Disputes Committee");
    expect(html, "a configured deployment showed a gap").not.toContain("[not configured");
  });

  it("degrades quietly when no address is configured: the sentence stands, the page does not complain", () => {
    const html = render(terms!, CONFIGURED, {});
    const text = visibleText(html);

    // The disclosure is the sentence, and it is untouched.
    expect(text).toContain(
      "you may refer the dispute to the Consumer Disputes Committee at the Estonian Consumer " +
        "Protection and Technical Regulatory Authority. The procedure is free of charge.",
    );

    // The page is legally complete, and says nothing to the contrary.
    expect(html, "an optional link made a complete page announce itself incomplete").not.toContain(
      "legal-incomplete-notice",
    );
    expect(text).not.toContain("[not configured");
    expect(text).not.toContain("web address of the dispute resolution body");

    // Never invented, never a dead link, never a brace.
    expect(html).not.toContain('href="https://disputes.example.org/committee"');
    expect(html).not.toContain('href="#"');
    expect(text).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
  });

  it("keeps the two classes apart on one page, in one state", () => {
    /*
     * Nothing configured at all: no merchant identity and no destination. The
     * identity set is a set of required *disclosures*, so it is named where it
     * is missing and enumerated in the notice; the destination is an
     * enhancement, so it is absent and unmentioned.
     */
    const html = render(terms!, NO_CONFIGURATION_VALUES, {});
    const text = visibleText(html);

    expect(html, "the identity set stopped being loud").toContain("legal-incomplete-notice");
    expect(text).toContain("[not configured: contact email address]");
    expect(text).toContain("[not configured: registered company name]");

    expect(
      text,
      "the dispute-resolution URL is back in the notice — an enhancement gating page completeness",
    ).not.toContain("web address of the dispute resolution body");
    expect(text).toContain(
      "you may refer the dispute to the Consumer Disputes Committee at the Estonian Consumer " +
        "Protection and Technical Regulatory Authority.",
    );
  });
});

/**
 * The VAT section says one thing about tax, and it is the operator's.
 *
 * Minor 2 of the second read exists because *"that figure is inclusive of value
 * added tax"* is untrue of an export. The operator supplied the replacement on
 * 2026-08-10, as two lines with the first emphasised, and it is applied here
 * **and** in `src/lib/catalogue.ts` so the product page cannot contradict it.
 *
 * The euro figure is `{price}` and never a literal, which is the whole reason
 * the placeholder mechanism exists — `tests/no-hardcoded-price.test.ts` and
 * `content/content.test.ts` hold up the other two corners of that.
 */
/**
 * The words each edition's VAT callout must be made of, per tax treatment.
 *
 * This table is what binds the **Estonian** callout to data. The English one
 * was pinned character-for-character to `catalogue.priceHeadline` from the
 * start; the Estonian one could be edited into a flat "sisaldab käibemaksu" —
 * the exact unqualified claim the English page is forbidden from making, and
 * false for a non-EU buyer — with every test green, because the edition
 * boundary hid it from the pin rather than containing the hazard: an Estonian
 * reader buys from the same English product page, so a legal/product
 * contradiction crosses editions freely.
 *
 * Total over `Locale` and selected on `product.price.taxIncluded`, so a
 * third edition does not compile until its wording for **both** tax states is
 * written down, and flipping the catalogue's tax treatment goes red in every
 * language at once. The English column is itself pinned to
 * `src/lib/catalogue.ts`'s own composition below, so this table cannot drift
 * from the operator's wording either.
 */
const VAT_CALLOUT_LANGUAGE: Readonly<
  Record<
    Locale,
    {
      readonly taxIncluded: string;
      readonly taxExcluded: string;
      readonly shippingNote: string;
    }
  >
> = {
  en: {
    taxIncluded: "VAT included where applicable",
    taxExcluded: "VAT calculated at checkout",
    shippingNote: "Shipping calculated at checkout. Non-EU taxes and duties, if any, are not included.",
  },
  et: {
    taxIncluded: "sisaldab käibemaksu, kui see kuulub tasumisele",
    taxExcluded: "käibemaks arvutatakse tellimuse vormistamisel",
    shippingNote:
      "Saatekulu arvutatakse tellimuse vormistamisel. Väljaspool Euroopa Liitu kohalduvad maksud ja lõivud, kui neid on, hinnas ei sisaldu.",
  },
};

describe("the VAT section makes one statement about tax", () => {
  const shipping = legalPages.find((page) => page.route === "legalShipping");
  const vat = shipping?.body.find((candidate) => candidate.anchor === "vat");

  /**
   * The language table's English column is the catalogue's own words, in both
   * tax states — so the per-edition binding below and the catalogue cannot
   * disagree about what either state says, and the `taxExcluded` variant is
   * proved against the resolver rather than trusted.
   */
  it("keeps the language table's English column identical to the catalogue's composition", () => {
    const included = resolveCatalogue({
      ...mockCatalogue,
      price: { ...mockCatalogue.price, taxIncluded: true },
    });
    const excluded = resolveCatalogue({
      ...mockCatalogue,
      price: { ...mockCatalogue.price, taxIncluded: false },
    });

    expect(included.priceTaxQualifier).toBe(VAT_CALLOUT_LANGUAGE.en.taxIncluded);
    expect(excluded.priceTaxQualifier).toBe(VAT_CALLOUT_LANGUAGE.en.taxExcluded);
    expect(included.priceShippingNote).toBe(VAT_CALLOUT_LANGUAGE.en.shippingNote);
    expect(excluded.priceShippingNote).toBe(VAT_CALLOUT_LANGUAGE.en.shippingNote);
  });

  /**
   * Every edition's callout states the catalogue's **current** tax treatment,
   * in its own language. Removing the conditional from the Estonian lead, or
   * flipping `taxIncluded` in the catalogue while any edition's callout still
   * asserts the old treatment, goes red here.
   */
  for (const locale of LOCALES) {
    it(`${locale}: states the catalogue's tax treatment, and no other`, () => {
      const language = VAT_CALLOUT_LANGUAGE[locale];
      const page = contentFor(legalPagesByLocale, locale).find(
        (candidate) => candidate.route === "legalShipping",
      );
      const callout = page?.body.find((candidate) => candidate.anchor === "vat")?.callout;
      const qualifier = mockCatalogue.price.taxIncluded
        ? language.taxIncluded
        : language.taxExcluded;

      expect(callout, `${locale}'s VAT callout is gone`).toBeDefined();
      expect(callout?.lead).toBe(`{price}${PRICE_HEADLINE_SEPARATOR}${qualifier}`);
      expect(callout?.detail).toBe(language.shippingNote);
    });
  }

  it("carries the operator's price presentation as an emphasised line and a plain one", () => {
    expect(vat?.callout, "the VAT section's price presentation is gone").toBeDefined();
    expect(vat?.callout?.lead).toBe("{price} · VAT included where applicable");
    expect(vat?.callout?.detail).toBe(
      "Shipping calculated at checkout. Non-EU taxes and duties, if any, are not included.",
    );
  });

  it("binds the figure to the catalogue and never writes it down", () => {
    const strings = [
      ...(vat?.body ?? []),
      vat?.callout?.lead ?? "",
      vat?.callout?.detail ?? "",
    ].join("\n");

    expect(strings, "the VAT section is gone").not.toBe("");
    expect(strings, "the section states no price at all").toContain("{price}");
    expect(strings, "a price literal reached a legal page").not.toMatch(/[€$£]|\d+[.,]\d{2}/);
    expect(
      strings,
      "{priceLine} restates in one sentence what the callout already presents as two lines",
    ).not.toContain("{priceLine}");
  });

  it("serves the resolved figure, emphasised, with the qualification beside it", () => {
    const html = render(shipping!, CONFIGURED);
    const text = visibleText(html);

    expect(text).toContain(`${resolveCatalogue().price} · VAT included where applicable`);
    expect(text).toContain("Non-EU taxes and duties, if any, are not included.");
    // The emphasis is the operator's formatting, not the renderer's taste.
    expect(html).toMatch(/<strong[^>]*>[^<]*VAT included where applicable<\/strong>/);
  });

  it("serves no unqualified VAT claim anywhere on the page", () => {
    const text = visibleText(render(shipping!, CONFIGURED));
    expect(
      text,
      "the page asserts VAT is included, unqualified",
    ).not.toMatch(/VAT included(?! where applicable)/);
  });

  /**
   * **Unify was not delete — this is the assertion that says so.**
   *
   * The operator answered "unify to my wording" on 2026-08-10 to a callout and
   * a Minor 2 replacement sentence that qualified VAT in different words one
   * line apart. The *phrasing* that went is the reader's; the *substance* is
   * not the operator's to have dropped, because they were not asked about it.
   * Two things had to survive, and this fails if either goes:
   *
   * 1. **How the tax sits in the figure** — contained within it, not added to
   *    it. "Included" alone does not say that; a net price with tax still to
   *    come is also, loosely, a price with tax "included" in what is owed.
   * 2. **That the figure is identical where no tax is due** — the export case
   *    Minor 2 was written for.
   */
  it("still says how the tax sits in the figure, and that the figure is the same where none is due", () => {
    const text = visibleText(render(shipping!, CONFIGURED)).replaceAll(/\s+/g, " ");

    expect(
      text,
      "the page no longer says the tax is contained within the figure rather than added to it",
    ).toMatch(/contained within that figure rather than added to it/);
    expect(
      text,
      "the page no longer says the figure is unchanged where no VAT is due",
    ).toMatch(/does not change[^.]*including where no VAT is due at all/);
  });

  /**
   * And the duplication itself: the qualification is stated **once**. The
   * callout's "where applicable" is the operator's conditional; the body must
   * not restate it in a second vocabulary, which is exactly what "Where VAT is
   * due on your order … where it is not due" did one line below it.
   */
  it("states the conditional once, in the operator's words", () => {
    const vatText = [
      vat?.callout?.lead ?? "",
      vat?.callout?.detail ?? "",
      ...(vat?.body ?? []),
    ].join(" ");

    expect(vatText).toContain("VAT included where applicable");
    expect(
      vatText,
      "the body restates the callout's conditional in its own words, one line below it",
    ).not.toMatch(/[Ww]here VAT is due/);
  });

  /**
   * The legal page and the product surfaces carry the operator's emphasised
   * line **character for character**, from two different places —
   * `content/legal/shipping.ts`'s `callout.lead` and `src/lib/catalogue.ts`'s
   * `priceHeadline`. Nothing but this pin stops one of them being edited
   * alone, and the operator's own recorded reasoning is that a legal page
   * saying "where applicable" over a product page saying something else moves
   * the contradiction up one level, to the more prominent page.
   */
  it("carries the identical emphasised line and second line to the ones the product surfaces render", () => {
    const catalogue = resolveCatalogue();
    expect(resolveCataloguePlaceholders(vat?.callout?.lead ?? "", catalogue)).toBe(
      catalogue.priceHeadline,
    );
    expect(vat?.callout?.detail).toBe(catalogue.priceShippingNote);
  });
});

/**
 * The cookie table, which the operator supplied on 2026-08-10 as four columns.
 *
 * The column that matters to this test is `Duration`: the model's `items`
 * shape holds two fields, and the way a four-column disclosure gets lost is by
 * being folded into a parenthetical inside the third. So the assertion is not
 * that the table exists but that **every cell of it reaches the reader**.
 */
describe("the cookie table reaches the reader in all four columns", () => {
  const privacy = legalPages.find((page) => page.route === "legalPrivacy");
  const consent = privacy?.body.find((candidate) => candidate.anchor === "consent");

  it("renders a real table, with a caption and a header row", () => {
    const html = render(privacy!, CONFIGURED);
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toMatch(/<th[^>]*scope="col"/);
    expect(html).toMatch(/<th[^>]*scope="row"/);
  });

  it("serves every column heading and every cell", () => {
    const text = visibleText(render(privacy!, CONFIGURED));
    const table = consent?.table;
    expect(table, "the cookie table is gone").toBeDefined();

    expect(text).toContain(table!.caption);
    for (const column of table!.columns) {
      expect(text, `the table dropped the ${column} column`).toContain(column);
    }
    for (const row of table!.rows) {
      for (const cell of row) {
        expect(text, `the table dropped the cell "${cell}"`).toContain(cell);
      }
    }
  });

  it("serves the operator's two sentences about consent, verbatim and under the table", () => {
    const text = visibleText(render(privacy!, CONFIGURED));
    expect(text).toContain("Google Analytics and Meta cookies are used only with your consent.");
    expect(text).toContain(
      "Cloudflare security cookies are strictly necessary for the operation and security of the " +
        "site and do not require consent.",
    );
  });

  it("keeps the consent answer disclosed even though it is not a cookie", () => {
    const text = visibleText(render(privacy!, CONFIGURED));
    expect(text).toContain("in your browser's local storage rather than as a cookie");
  });
});

describe("the product page's GPSR block", () => {
  it("states the manufacturer, its address and both contact routes when configured", () => {
    const text = visibleText(renderToStaticMarkup(<ProductSafetyBlock values={CONFIGURED} />));

    expect(text).toContain(CONFIGURED.merchantLegalName);
    expect(text).toContain(CONFIGURED.merchantRegisteredAddress);
    expect(text).toContain(CONFIGURED.merchantContactAddress);
    expect(text).toContain(CONFIGURED.merchantPhoneNumber);
    expect(text).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
    expect(text).not.toContain("[not configured");
  });

  it("names the contract producer as the producer and never as the manufacturer", () => {
    const text = visibleText(renderToStaticMarkup(<ProductSafetyBlock values={CONFIGURED} />));

    expect(text).toContain("Longpack");
    expect(text).toContain("contract producer");
    // The sentence naming Longpack must not also call it the manufacturer.
    const sentence = text
      .split(/(?<=\.)\s/)
      .find((candidate) => candidate.includes("Longpack"));
    expect(sentence, "no sentence names the contract producer").toBeDefined();
    expect(sentence, "the contract producer is described as the manufacturer").toContain(
      "is not the manufacturer",
    );
  });

  it("presents the certification as test results and not as an accolade", () => {
    const html = renderToStaticMarkup(<ProductSafetyBlock values={CONFIGURED} />);
    const text = visibleText(html).toLowerCase();

    for (const word of ["award", "laurel", "wreath", "badge", "trophy", "medal", "winner", "seal of"]) {
      expect(text, `the safety block styles its certificate as an accolade: ${word}`).not.toContain(
        word,
      );
    }

    expect(text).toContain("shah01338706");
    expect(text).toContain("pass");
  });

  it("does not repeat the age marking FeatureSpecStrip already renders", () => {
    const text = visibleText(renderToStaticMarkup(<ProductSafetyBlock values={CONFIGURED} />));
    expect(text).not.toContain("Age 10+");
  });

  it("names its gaps rather than dropping the Article 19 disclosure", () => {
    const html = renderToStaticMarkup(<ProductSafetyBlock values={NO_CONFIGURATION_VALUES} />);
    const text = visibleText(html);

    expect(html).toContain("product-safety-incomplete-notice");
    expect(text).toContain("[not configured: registered address]");
    expect(text).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
    // The safety results need no configuration and must survive intact.
    expect(text).toContain("SHAH01338706");
    expect(text).toContain("Flammability");
  });
});
