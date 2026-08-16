import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { STRIPE_PAYMENT_PROVIDER_ID } from "../src/config/payment.js";
import {
  FULFILLMENT_PROVIDER_ID,
  REGION_NAME,
  commerceRecords,
  configureCommerce,
  type CommerceConfigurationTarget,
  type CommerceRecord,
} from "../src/commerce/configuration.js";
import {
  DELIVERABLE_COUNTRY_CODES,
  EU_MEMBER_STATE_CODES,
} from "../src/commerce/shipping-model.js";

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
      "region",
      "stock-location",
      "fulfillment-set",
      "shipping-profile",
      "sales-channel-stock-location",
      "service-zone",
      "service-zone",
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
   * `content/legal/shipping.ts`: "Included means contained within that figure
   * rather than added to it." That sentence is true of what Medusa computes only
   * while this flag is set — without it Medusa treats EUR 25.00 as a net price
   * and adds the destination's VAT on top, and the checkout would present a
   * total the product page never advertised.
   */
  it("prices tax inclusively and applies the destination's tax region automatically", () => {
    const [region] = only("region");
    expect(region!.taxInclusivePrices).toBe(true);
    expect(region!.automaticTaxes).toBe(true);
  });

  /** Stripe only. No PayPal provider, at launch or by accident. */
  it("enables the one Stripe provider in the region and no other", () => {
    const [region] = only("region");
    expect(region!.paymentProviderIds).toEqual([STRIPE_PAYMENT_PROVIDER_ID]);
    expect(STRIPE_PAYMENT_PROVIDER_ID).toBe("pp_stripe_stripe");
  });

  it("declares the two zones and their two flat rates, with no free method", () => {
    expect(only("service-zone").map((zone) => zone.name)).toEqual([
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
        zone: "European Union",
        name: "Standard delivery",
        currency: "EUR",
        amountMinor: 700,
        provider: FULFILLMENT_PROVIDER_ID,
      },
      {
        zone: "Rest of world",
        name: "Standard delivery",
        currency: "EUR",
        amountMinor: 1200,
        provider: FULFILLMENT_PROVIDER_ID,
      },
    ]);
  });

  /**
   * ADR `020`: no carrier interface, no quote cache, no fallback contract. The
   * manual provider quotes nothing and calls nothing, which is the whole reason
   * it is the right one for a flat rate.
   */
  it("serves both options from the manual fulfillment provider", () => {
    expect(FULFILLMENT_PROVIDER_ID).toBe("manual_manual");
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
    expect(applied).toEqual(["region", "stock-location", "fulfillment-set"]);
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

  it('backs "contained within that figure rather than added to it" with tax-inclusive prices', () => {
    expect(shipping).toContain("contained within that figure rather than added to it");

    const [region] = commerceRecords().filter((record) => record.kind === "region");
    expect(region).toMatchObject({ kind: "region", taxInclusivePrices: true });
  });

  it("backs the delivery-address tax rule with automatic taxes", () => {
    expect(shipping).toContain(
      "which tax applies is worked out from the confirmed delivery address at checkout",
    );

    const [region] = commerceRecords().filter((record) => record.kind === "region");
    expect(region).toMatchObject({ kind: "region", automaticTaxes: true });
  });

  it('backs "calculated at checkout once you have entered a delivery address" with per-zone rates', () => {
    expect(shipping).toContain("calculated at checkout once you have entered a delivery address");
    expect(catalogue).toContain("Shipping calculated at checkout.");

    // Two zones at two different prices is exactly why the charge cannot be
    // shown before an address: there is no single figure to show.
    const amounts = commerceRecords()
      .filter((record) => record.kind === "shipping-option")
      .map((record) => record.amountMinor);
    expect(new Set(amounts).size).toBe(2);
  });

  it("promises free shipping on no surface, because no method is free", () => {
    for (const [name, source] of [
      ["legal/shipping", shipping],
      ["legal/terms", terms],
      ["catalogue price copy", catalogue],
    ] as const) {
      expect(source.toLowerCase(), name).not.toMatch(/free (delivery|shipping|postage)/);
    }
    expect(
      commerceRecords().filter(
        (record) => record.kind === "shipping-option" && record.amountMinor === 0,
      ),
    ).toEqual([]);
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
