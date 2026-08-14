import type {
  CatalogueImportPlan,
  PlannedMedia,
  PlannedPackaging,
} from "./plan.js";

/**
 * One thing the import asserts about the catalogue, addressed by a natural key
 * that is a property of the data rather than of the run.
 *
 * The `key` is what makes the import rerunnable. A create-shaped import is
 * idempotent only if something else remembers what it already created; a
 * key-addressed upsert is idempotent because the second application of the same
 * record is the same assertion. That is also why a run interrupted halfway can
 * simply be run again: every record it did apply is one it would apply again to
 * no effect, and every record it did not is still pending.
 */
export type SeedRecord =
  | {
      readonly kind: "product";
      /** The product handle. */
      readonly key: string;
      readonly handle: string;
      readonly title: string;
      readonly subtitle: string | null;
      readonly description: string | null;
      readonly sku: string;
      readonly packaging: PlannedPackaging;
      readonly media: readonly PlannedMedia[];
    }
  | {
      readonly kind: "variant-price";
      /** `<sku>/<currency>`. */
      readonly key: string;
      readonly sku: string;
      readonly currency: string;
      readonly amountMinor: number;
      readonly taxIncluded: boolean;
    }
  | {
      readonly kind: "variant-stock";
      /** The variant SKU. */
      readonly key: string;
      readonly sku: string;
      readonly manageInventory: boolean;
      readonly quantity: number | null;
    }
  | {
      readonly kind: "promotion";
      /** The coupon code. */
      readonly key: string;
      readonly code: string;
      readonly type: "percentage" | "fixed";
      readonly value: number;
      readonly expiresAt: string | null;
    }
  | {
      readonly kind: "tax-region";
      /** The ISO 3166-1 alpha-2 country code. */
      readonly key: string;
      readonly countryCode: string;
      readonly name: string;
      readonly ratePercent: number;
      readonly code: string;
    }
  | {
      readonly kind: "shipping-option";
      /** `<zone name>/<option name>`. */
      readonly key: string;
      readonly zoneName: string;
      readonly countryCodes: readonly string[];
      readonly optionName: string;
      readonly currency: string;
      readonly amountMinor: number;
    };

/** Applies one record by its natural key. Applying it twice is applying it once. */
export interface CatalogueSeedTarget {
  upsert(record: SeedRecord): Promise<void>;
}

/**
 * Turns a plan into the ordered records that assert it. A pure function of the
 * plan: the same archive produces the same records, in the same order, on every
 * run, which is what `tests/catalogue-import.test.ts` compares across two runs.
 */
export function seedRecords(plan: CatalogueImportPlan): readonly SeedRecord[] {
  const { product } = plan;

  return [
    {
      kind: "product",
      key: product.handle,
      handle: product.handle,
      title: product.title,
      subtitle: product.subtitle,
      description: product.description,
      sku: product.sku,
      packaging: product.packaging,
      media: product.media,
    },
    {
      kind: "variant-price",
      key: `${product.sku}/${product.price.currency}`,
      sku: product.sku,
      currency: product.price.currency,
      amountMinor: product.price.amountMinor,
      taxIncluded: product.price.taxIncluded,
    },
    {
      kind: "variant-stock",
      key: product.sku,
      sku: product.sku,
      manageInventory: product.stock.manageInventory,
      quantity: product.stock.quantity,
    },
    ...plan.coupons.map<SeedRecord>((coupon) => ({
      kind: "promotion",
      key: coupon.code,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      expiresAt: coupon.expiresAt,
    })),
    ...plan.taxRegions.map<SeedRecord>((region) => ({
      kind: "tax-region",
      key: region.countryCode,
      countryCode: region.countryCode,
      name: region.name,
      ratePercent: region.ratePercent,
      code: region.code,
    })),
    ...plan.shippingZones.flatMap<SeedRecord>((zone) =>
      zone.options.map<SeedRecord>((option) => ({
        kind: "shipping-option",
        key: `${zone.name}/${option.name}`,
        zoneName: zone.name,
        countryCodes: zone.countryCodes,
        optionName: option.name,
        currency: option.currency,
        amountMinor: option.amountMinor,
      })),
    ),
  ];
}
