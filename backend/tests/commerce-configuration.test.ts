import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { STRIPE_PAYMENT_PROVIDER_ID } from "../src/config/payment.js";
import {
  MANUAL_FULFILLMENT_PROVIDER_ID,
  REGION_NAME,
  commerceRecords,
  configureCommerce,
  type CommerceConfigurationTarget,
  type CommerceRecord,
} from "../src/commerce/configuration.js";
import {
  DELIVERABLE_COUNTRY_CODES,
  EU_MEMBER_STATE_CODES,
  OMNIVA_FULFILLMENT_PROVIDER_ID,
  PARCEL_MACHINE_COUNTRY_CODES,
  PARCEL_MACHINE_OPTION_NAME,
  PARCEL_MACHINE_ZONE_NAME,
} from "../src/commerce/shipping-model.js";
import {
  ESTONIAN_STANDARD_VAT_PERCENT,
  VAT_RATE_CODE,
  VAT_RATE_NAME,
} from "../src/commerce/tax-model.js";

/**
 * A file from elsewhere in this repository, read as text.
 *
 * The re-check below compares the configuration against the *words* on two
 * surfaces that live in other workspaces, so it reads their sources rather than
 * importing them: `content/` and `storefront/` are separate TypeScript programs
 * and a backend test that imported either would drag their toolchains in behind
 * it. Reading them keeps the assertion on the sentences, which is what a reader
 * of the pages is held to.
 */
function repositoryText(relative: string): string {
  return readFileSync(join(__dirname, "..", "..", relative), "utf8");
}

/**
 * The same file with its comments removed — the words a **reader** meets,
 * rather than the record of the words they used to meet.
 *
 * Needed because `content/legal/shipping.ts` keeps its superseded
 * inclusive-pricing claims in its own doc comment, as the record of what was
 * replaced and why, and a substring check over the raw text cannot tell that
 * apart from the claim being back on the page. Importing the module and reading
 * its body strings would be better still and is not available here: `content/`
 * is a separate TypeScript program and a backend test that imported it would
 * drag that toolchain in behind it — see {@link repositoryText}.
 */
function readerText(relative: string): string {
  return repositoryText(relative)
    .replaceAll(/\/\*[\s\S]*?\*\//g, " ")
    .replaceAll(/\/\/[^\n]*/g, " ");
}

class RecordingTarget implements CommerceConfigurationTarget {
  readonly applied: CommerceRecord[] = [];

  apply(record: CommerceRecord): Promise<void> {
    this.applied.push(record);
    return Promise.resolve();
  }
}

function only<K extends CommerceRecord["kind"]>(
  kind: K,
): Extract<CommerceRecord, { kind: K }>[] {
  return commerceRecords().filter(
    (record): record is Extract<CommerceRecord, { kind: K }> => record.kind === kind,
  );
}

describe("the declared commerce configuration", () => {
  it("is the same sequence of records on every run", () => {
    expect(commerceRecords()).toEqual(commerceRecords());
  });

  it("addresses every record by a key no other record uses", () => {
    const keys = commerceRecords().map((record) => `${record.kind}:${record.key}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("declares its records in dependency order", () => {
    expect(commerceRecords().map((record) => record.kind)).toEqual([
      "store-currency",
      "region",
      ...EU_MEMBER_STATE_CODES.map(() => "tax-region"),
      "stock-location",
      "stock-location-fulfillment-provider",
      "stock-location-fulfillment-provider",
      "fulfillment-set",
      "shipping-profile",
      "sales-channel-stock-location",
      "service-zone",
      "service-zone",
      "service-zone",
      "shipping-option",
      "shipping-option",
      "shipping-option",
      "shipping-option",
    ]);
  });

  /**
   * `storefront/src/lib/cart-store.tsx` lists regions with `limit: 2` and
   * refuses unless it finds exactly one. A second region here is a storefront
   * that cannot create a cart at all.
   */
  it("declares exactly one region, in EUR, reaching every deliverable country", () => {
    const regions = only("region");
    expect(regions).toHaveLength(1);

    const [region] = regions;
    expect(region!.name).toBe(REGION_NAME);
    expect(region!.currencyCode).toBe("EUR");
    expect(region!.countryCodes).toEqual(DELIVERABLE_COUNTRY_CODES);
    expect(region!.countryCodes).toEqual(expect.arrayContaining([...EU_MEMBER_STATE_CODES]));
  });

  /**
   * **EUR 25.00 is the net price and VAT is added**, which is the legacy shop's
   * behaviour and the operator's settled decision. Every price this deployment
   * holds is therefore tax **exclusive**, and both preferences have to say so.
   *
   * They are asserted in one test, together, because they have to *move*
   * together. `@medusajs/pricing` consults the `region_id` preference ahead of
   * the `currency_code` one for any price carrying a `region_id` price rule
   * (`services/pricing-module.js:1191`), so a configuration that flipped the
   * currency alone would be one region-scoped price away from charging the
   * advertised EUR 25.00 and booking EUR 4.84 of VAT out of it — a 19% cut to
   * the net take with no visible symptom.
   * `commerce-medusa-semantics.test.ts` holds the preferences Medusa's own
   * region workflows actually write; this holds the declaration that feeds them.
   */
  it("declares every price tax exclusive, on the currency and on the region alike", () => {
    const currencies = only("store-currency");
    expect(currencies).toHaveLength(1);
    expect(currencies[0]!.currencyCode).toBe("EUR");
    expect(currencies[0]!.taxInclusivePrices).toBe(false);

    const [region] = only("region");
    expect(region!.taxInclusivePrices).toBe(false);
  });

  it("applies the destination's tax region automatically", () => {
    const [region] = only("region");
    expect(region!.automaticTaxes).toBe(true);
  });

  /**
   * One tax region per EU member state, all at Estonia's domestic rate.
   *
   * The shop is below the EUR 10,000 intra-Community distance-selling threshold,
   * so it charges its own country's rate everywhere in the Union rather than the
   * destination's. That is why twenty-seven regions carry one figure instead of
   * twenty-seven — and why the country list is
   * {@link EU_MEMBER_STATE_CODES} itself rather than a second list that could
   * drift from the one the shipping zones are cut by.
   */
  it("declares Estonia's rate in every EU member state and nowhere else", () => {
    const regions = only("tax-region");
    expect(regions.map((region) => region.countryCode)).toEqual([...EU_MEMBER_STATE_CODES]);
    expect(regions).toHaveLength(27);

    for (const region of regions) {
      expect(region.ratePercent, region.countryCode).toBe(ESTONIAN_STANDARD_VAT_PERCENT);
      expect(region.name, region.countryCode).toBe(VAT_RATE_NAME);
      expect(region.code, region.countryCode).toBe(VAT_RATE_CODE);
    }

    // No VAT outside the EU: a rest-of-world destination resolves to no tax
    // region at all, so Medusa's automatic taxes find nothing to apply.
    const taxed = new Set(regions.map((region) => region.countryCode));
    for (const code of DELIVERABLE_COUNTRY_CODES) {
      expect(taxed.has(code), code).toBe(EU_MEMBER_STATE_CODES.includes(code));
    }
  });

  /**
   * The rate a tax region declares must be reachable before anything is priced
   * against it, and the region has to exist before its tax regions are asserted
   * — Medusa's `automatic_taxes` resolves an address through the tax module,
   * which is a different module from the one holding the region.
   */
  it("declares the tax regions after the region and before the stock location", () => {
    const kinds = commerceRecords().map((record) => record.kind);
    expect(kinds.indexOf("tax-region")).toBeGreaterThan(kinds.indexOf("region"));
    expect(kinds.lastIndexOf("tax-region")).toBeLessThan(kinds.indexOf("stock-location"));
  });

  /**
   * Both shipping option workflows run `validateFulfillmentProvidersStep`
   * first, and it refuses an option whose provider is not linked to a stock
   * location behind the zone. Without this record the predeploy Job — an Argo
   * CD sync hook — dies on the first shipping option on every environment.
   *
   * There are two links, one per provider, since 2026-08-26: the parcel
   * machine method needs `omniva_omniva` enabled at the same location the two
   * flat rates need `manual_manual` enabled at.
   */
  it("enables both fulfillment providers at the stock location the zones hang off", () => {
    const links = only("stock-location-fulfillment-provider");
    expect(links.map((link) => link.providerId)).toEqual([
      MANUAL_FULFILLMENT_PROVIDER_ID,
      OMNIVA_FULFILLMENT_PROVIDER_ID,
    ]);

    const locations = only("stock-location").map((location) => location.name);
    for (const link of links) {
      expect(locations, link.providerId).toContain(link.stockLocationName);
    }

    // And both are declared before anything that needs them.
    const kinds = commerceRecords().map((record) => record.kind);
    expect(kinds.indexOf("stock-location-fulfillment-provider")).toBeGreaterThan(
      kinds.indexOf("stock-location"),
    );
    expect(kinds.lastIndexOf("stock-location-fulfillment-provider")).toBeLessThan(
      kinds.indexOf("shipping-option"),
    );
  });

  /** Stripe only. PayPal is a method inside Stripe, never a second provider. */
  it("enables the one Stripe provider in the region and no other", () => {
    const [region] = only("region");
    expect(region!.paymentProviderIds).toEqual([STRIPE_PAYMENT_PROVIDER_ID]);
    expect(STRIPE_PAYMENT_PROVIDER_ID).toBe("pp_stripe_stripe");
  });

  it("declares three zones and four methods, with the frozen amounts", () => {
    const parcelMachineZone = only("service-zone").find(
      (zone) => zone.name === PARCEL_MACHINE_ZONE_NAME,
    );
    expect(parcelMachineZone?.countryCodes).toEqual([...PARCEL_MACHINE_COUNTRY_CODES]);

    expect(only("service-zone").map((zone) => zone.name)).toEqual([
      PARCEL_MACHINE_ZONE_NAME,
      "European Union",
      "Rest of world",
    ]);

    expect(
      only("shipping-option").map((option) => ({
        zone: option.zoneName,
        name: option.optionName,
        currency: option.currency,
        amountMinor: option.amountMinor,
        provider: option.providerId,
      })),
    ).toEqual([
      {
        zone: PARCEL_MACHINE_ZONE_NAME,
        name: "Standard delivery",
        currency: "EUR",
        amountMinor: 700,
        provider: MANUAL_FULFILLMENT_PROVIDER_ID,
      },
      {
        zone: PARCEL_MACHINE_ZONE_NAME,
        name: PARCEL_MACHINE_OPTION_NAME,
        currency: "EUR",
        amountMinor: 0,
        provider: OMNIVA_FULFILLMENT_PROVIDER_ID,
      },
      {
        zone: "European Union",
        name: "Standard delivery",
        currency: "EUR",
        amountMinor: 700,
        provider: MANUAL_FULFILLMENT_PROVIDER_ID,
      },
      {
        zone: "Rest of world",
        name: "Standard delivery",
        currency: "EUR",
        amountMinor: 1200,
        provider: MANUAL_FULFILLMENT_PROVIDER_ID,
      },
    ]);
  });

  /**
   * The free method exists in exactly one zone, and it is served by Omniva
   * and nothing else. The old assertion here said no shipping option was
   * free at all; that decision was reversed on 2026-08-26 for the parcel
   * machine method only, and this is that reversal stated narrowly rather
   * than the old constraint simply deleted.
   */
  it("offers the free method through Omniva only, and every flat rate through the manual provider", () => {
    for (const option of only("shipping-option")) {
      if (option.amountMinor === 0) {
        expect(option.providerId, option.key).toBe(OMNIVA_FULFILLMENT_PROVIDER_ID);
      } else {
        expect(option.providerId, option.key).toBe(MANUAL_FULFILLMENT_PROVIDER_ID);
      }
    }
    expect(only("shipping-option").filter((option) => option.amountMinor === 0)).toHaveLength(1);
  });

  /**
   * ADR `020`: no carrier interface, no quote cache, no fallback contract. The
   * manual provider quotes nothing and calls nothing, which is the whole reason
   * it is the right one for a flat rate — and it is not the provider the free
   * parcel machine method uses.
   */
  it("names the manual fulfillment provider correctly", () => {
    expect(MANUAL_FULFILLMENT_PROVIDER_ID).toBe("manual_manual");
    expect(OMNIVA_FULFILLMENT_PROVIDER_ID).toBe("omniva_omniva");
  });

  it("names a service zone for every shipping option it declares", () => {
    const zones = new Set(only("service-zone").map((zone) => zone.name));
    for (const option of only("shipping-option")) {
      expect(zones.has(option.zoneName), option.key).toBe(true);
    }
  });

  it("applies each record exactly once, in the declared order", async () => {
    const target = new RecordingTarget();
    const summary = await configureCommerce(target);

    expect(summary.records).toBe(commerceRecords().length);
    expect(target.applied).toEqual(commerceRecords());
  });

  it("stops at the first refusal rather than applying the rest", async () => {
    const applied: string[] = [];
    const target: CommerceConfigurationTarget = {
      apply(record) {
        applied.push(record.kind);
        return record.kind === "fulfillment-set"
          ? Promise.reject(new Error("no stock location"))
          : Promise.resolve();
      },
    };

    await expect(configureCommerce(target)).rejects.toThrow("no stock location");
    expect(applied).toEqual([
      "store-currency",
      "region",
      ...EU_MEMBER_STATE_CODES.map(() => "tax-region"),
      "stock-location",
      "stock-location-fulfillment-provider",
      "stock-location-fulfillment-provider",
      "fulfillment-set",
    ]);
  });
});

/**
 * **The re-check.** The product page's price presentation and the legal pages
 * were written before this configuration existed. These hold each statement they
 * make about shipping and tax against the switch in the configuration that makes
 * it true — so a later change to either side goes red here rather than leaving
 * one surface describing a shop the other no longer is.
 */
describe("the pages that describe this configuration", () => {
  const shipping = repositoryText("content/legal/shipping.ts");
  /* The same page without its comments — see `readerText`. */
  const shippingProse = readerText("content/legal/shipping.ts");
  const terms = repositoryText("content/legal/terms.ts");
  const catalogue = repositoryText("storefront/src/lib/catalogue.ts");
  const checkout = repositoryText("storefront/src/lib/store-checkout.ts");

  it('backs "We ship to every country." with a zone for every country', () => {
    expect(shipping).toContain("We ship to every country.");

    const zoned = new Set(
      commerceRecords()
        .filter((record) => record.kind === "service-zone")
        .flatMap((record) => [...record.countryCodes]),
    );
    for (const code of DELIVERABLE_COUNTRY_CODES) {
      expect(zoned.has(code), `${code} is offered but has no service zone`).toBe(true);
    }
  });

  /**
   * **The disagreement this test was holding open is now closed.**
   *
   * The previous revision pinned `content/legal/shipping.ts` to *"Included
   * means contained within that figure rather than added to it"* — not because
   * that was true, but because it was **false and known to be**: the
   * configuration had moved to net prices and the copy had not, and rewording a
   * twice-reviewed legal page was an operator decision this file could not
   * make. So it recorded the disagreement and promised to be rewritten "against
   * the new sentence" when the storefront half landed.
   *
   * That half has landed. The page now says the tax is **added** for a delivery
   * address in the European Union and added nowhere else, and this asserts the
   * new sentence against the two preferences that make it true.
   *
   * **The superseded sentence is refused rather than merely unasserted**, and
   * that matters more than it looks: it survives in the page's own doc comment,
   * as the record of what was replaced and why. A substring check for the new
   * wording alone would have passed on a file that still carried the old claim
   * in its prose — which is exactly the shape of the defect the whole re-check
   * exists to catch — so the refusal is scoped to the page **without its
   * comments**, which is where a reader meets it.
   */
  it("declares tax-exclusive prices, and the legal page now says the tax is added", () => {
    const [currency] = commerceRecords().filter((record) => record.kind === "store-currency");
    expect(currency).toMatchObject({ kind: "store-currency", taxInclusivePrices: false });

    const [region] = commerceRecords().filter((record) => record.kind === "region");
    expect(region).toMatchObject({ kind: "region", taxInclusivePrices: false });

    expect(
      shipping,
      "content/legal/shipping.ts no longer says VAT is added for an EU delivery address",
    ).toContain("we add Estonian value added tax at {vatRate}");
    expect(
      shipping,
      "content/legal/shipping.ts no longer says no EU VAT is added anywhere else",
    ).toContain("For delivery anywhere else no EU VAT is due and none is added.");

    for (const claim of [
      "contained within that figure rather than added to it",
      "It is the same figure for every visitor",
      "VAT included where applicable",
    ]) {
      expect(
        shippingProse,
        `a superseded inclusive-pricing claim is back on the page a buyer reads: "${claim}"`,
      ).not.toContain(claim);
    }
  });

  /**
   * The delivery-address rule, in the sentence that now carries it. The page
   * used to say "which tax applies is worked out from the confirmed delivery
   * address at checkout"; the replacement says the same thing about which
   * *treatment* applies, in the operator's own wording, and adds the half that
   * matters before an address exists — that the destination set on the site
   * decides which figure is shown and never what is charged.
   */
  it("backs the delivery-address tax rule with automatic taxes", () => {
    expect(shipping).toContain(
      "worked out from the delivery address you confirm at checkout",
    );
    expect(shipping).toContain("it never decides what you are charged");

    const [region] = commerceRecords().filter((record) => record.kind === "region");
    expect(region).toMatchObject({ kind: "region", automaticTaxes: true });
  });

  it('backs "calculated at checkout once you have entered a delivery address" with per-zone rates', () => {
    expect(shipping).toContain("calculated at checkout once you have entered a delivery address");
    expect(catalogue).toContain("Shipping is calculated at checkout");

    // Three distinct prices — free, EUR 7.00 and EUR 12.00 — is exactly why
    // the charge cannot be shown before an address: there is no single
    // figure to show.
    const amounts = commerceRecords()
      .filter((record) => record.kind === "shipping-option")
      .map((record) => record.amountMinor);
    expect(new Set(amounts).size).toBe(3);
  });

  /**
   * **The reversal, stated narrowly, at the configuration layer too.**
   *
   * No content page promises free shipping yet — legal/shipping, legal/terms
   * and the catalogue price copy are unchanged by this task and are held to
   * that here, same as before. But the old second half of this assertion said
   * the *configuration* had no free shipping option at all, and the operator's
   * decision of 2026-08-26 reversed exactly that: one method, the Omniva
   * parcel machine, is now free. So that half is replaced with one that pins
   * the free record to the one method and provider the operator named, rather
   * than merely deleted.
   */
  it("promises free shipping on no content page, and configures exactly one free method", () => {
    for (const [name, source] of [
      ["legal/shipping", shipping],
      ["legal/terms", terms],
      ["catalogue price copy", catalogue],
    ] as const) {
      expect(source.toLowerCase(), name).not.toMatch(/free (delivery|shipping|postage)/);
    }

    const free = only("shipping-option").filter((option) => option.amountMinor === 0);
    expect(free).toHaveLength(1);
    expect(free[0]).toMatchObject({
      zoneName: PARCEL_MACHINE_ZONE_NAME,
      optionName: PARCEL_MACHINE_OPTION_NAME,
      providerId: OMNIVA_FULFILLMENT_PROVIDER_ID,
    });
  });

  /**
   * `content/legal/terms.ts` lists "the price of the goods" among the six values
   * a buyer sees above the order button, and `content/legal/shipping.ts` says
   * the advertised figure "is the price a consumer pays for the goods". Under
   * tax-inclusive pricing Medusa's `cart.subtotal` is neither — it is the goods
   * **and** the shipping, both net of tax — so the checkout has to read
   * `item_total`.
   */
  it("reads the price of the goods from the field that is the price of the goods", () => {
    expect(terms).toContain("the price of the goods");
    expect(checkout).toContain("cart.item_total");
    expect(checkout).not.toMatch(/goodsAmount:\s*medusaMajorToMinor\(cart\.subtotal/);
  });

  it("names one payment processor on the terms page and enables one in the region", () => {
    expect(terms).toContain("Stripe");
    const [region] = commerceRecords().filter((record) => record.kind === "region");
    expect(region).toMatchObject({ paymentProviderIds: [STRIPE_PAYMENT_PROVIDER_ID] });
  });
});
