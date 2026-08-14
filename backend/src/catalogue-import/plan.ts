import { MANIFEST_MEMBER, MEDIA_MEMBER_PREFIX, type ArchiveMember } from "./archive.js";
import { mediaPublicUrl } from "./media.js";
import { CatalogueImportRefusal } from "./refusal.js";

/**
 * Everything the import is permitted to seed, and nothing else: the active
 * physical product with its current price and stock and packaged dimensions,
 * the coupons that are still valid, the tax zones and rates, the shipping zones
 * and methods, and the media.
 *
 * The manifest's accepted key set is an allowlist rather than a denylist. A
 * denylist admits whatever the next WooCommerce export happens to call its
 * customer table; an allowlist refuses a section nobody has read.
 */
const ACCEPTED_SECTIONS = new Set([
  "environment",
  "product",
  "coupons",
  "taxRegions",
  "shippingZones",
]);

export type MediaRole = "thumbnail" | "gallery";

export interface PlannedMedia {
  readonly file: string;
  readonly url: string;
  readonly role: MediaRole;
}

export interface PlannedPackaging {
  readonly weightGrams: number;
  readonly lengthMillimetres: number;
  readonly widthMillimetres: number;
  readonly heightMillimetres: number;
}

export interface PlannedProduct {
  readonly handle: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly description: string | null;
  readonly sku: string;
  readonly packaging: PlannedPackaging;
  readonly media: readonly PlannedMedia[];
  readonly price: {
    readonly currency: string;
    readonly amountMinor: number;
    readonly taxIncluded: boolean;
  };
  readonly stock: {
    readonly manageInventory: boolean;
    readonly quantity: number | null;
  };
}

export interface PlannedCoupon {
  readonly code: string;
  readonly type: "percentage" | "fixed";
  readonly value: number;
  readonly expiresAt: string | null;
}

export interface PlannedTaxRegion {
  readonly countryCode: string;
  readonly name: string;
  readonly ratePercent: number;
  readonly code: string;
}

export interface PlannedShippingOption {
  readonly name: string;
  readonly currency: string;
  readonly amountMinor: number;
}

export interface PlannedShippingZone {
  readonly name: string;
  readonly countryCodes: readonly string[];
  readonly options: readonly PlannedShippingOption[];
}

export interface CatalogueImportPlan {
  readonly environment: string;
  readonly product: PlannedProduct;
  readonly coupons: readonly PlannedCoupon[];
  readonly taxRegions: readonly PlannedTaxRegion[];
  readonly shippingZones: readonly PlannedShippingZone[];
}

function malformed(detail: string): never {
  throw new CatalogueImportRefusal("malformed-archive", detail);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    malformed(`${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) malformed(`${label} is not an array`);
  return value;
}

function text(value: unknown, label: string, pattern?: RegExp): string {
  if (typeof value !== "string" || value.trim().length === 0) malformed(`${label} is not a string`);
  const trimmed = (value as string).trim();
  if (pattern !== undefined && !pattern.test(trimmed)) malformed(`${label} is not well formed`);
  return trimmed;
}

function optionalText(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  return text(value, label);
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    malformed(`${label} is not an integer of at least ${String(minimum)}`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") malformed(`${label} is not a boolean`);
  return value;
}

function readManifest(members: readonly ArchiveMember[]): Record<string, unknown> {
  const member = members.find((candidate) => candidate.name === MANIFEST_MEMBER);
  if (member === undefined) malformed(`the archive carries no ${MANIFEST_MEMBER}`);

  let document: unknown;
  try {
    document = JSON.parse(Buffer.from(member.content).toString("utf8"));
  } catch {
    malformed(`${MANIFEST_MEMBER} is not valid JSON`);
  }

  const manifest = object(document, MANIFEST_MEMBER);
  for (const key of Object.keys(manifest)) {
    if (!ACCEPTED_SECTIONS.has(key)) {
      throw new CatalogueImportRefusal(
        "unrecognised-manifest-section",
        `the manifest declares a "${key}" section this import does not read; nothing outside ${[...ACCEPTED_SECTIONS].join(", ")} is imported`,
      );
    }
  }
  return manifest;
}

/**
 * Reads the environment the archive was prepared for, without parsing the rest
 * of it. Called before the identity gate so an archive meant for the other
 * environment is refused on the strength of one field.
 */
export function readManifestEnvironment(members: readonly ArchiveMember[]): unknown {
  return readManifest(members).environment;
}

function readMedia(
  value: unknown,
  members: readonly ArchiveMember[],
): readonly PlannedMedia[] {
  const staged = new Set(
    members
      .filter((member) => member.name.startsWith(MEDIA_MEMBER_PREFIX))
      .map((member) => member.name.slice(MEDIA_MEMBER_PREFIX.length)),
  );

  const media = array(value, "product.media").map((entry, index) => {
    const record = object(entry, `product.media[${String(index)}]`);
    const file = text(record.file, `product.media[${String(index)}].file`);
    const declaredRole = text(record.role, `product.media[${String(index)}].role`);
    const role: MediaRole =
      declaredRole === "thumbnail" || declaredRole === "gallery"
        ? declaredRole
        : malformed(`product.media[${String(index)}].role is not thumbnail or gallery`);
    if (!staged.has(file)) {
      malformed(`product.media[${String(index)}] names ${JSON.stringify(file)}, which the archive does not carry`);
    }
    return { file, url: mediaPublicUrl(file), role };
  });

  const declared = new Set(media.map((entry) => entry.file));
  for (const file of staged) {
    if (!declared.has(file)) {
      malformed(`the archive carries ${JSON.stringify(file)}, which the manifest does not declare`);
    }
  }

  return media;
}

function readProduct(value: unknown, members: readonly ArchiveMember[]): PlannedProduct {
  const product = object(value, "product");
  const variant = object(product.variant, "product.variant");
  const price = object(product.price, "product.price");
  const manageInventory = boolean(variant.manageInventory, "product.variant.manageInventory");
  const stock = variant.stock;

  if (manageInventory === (stock === null)) {
    malformed("product.variant.stock is a count exactly when manageInventory is true");
  }

  return {
    handle: text(product.handle, "product.handle", /^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: text(product.title, "product.title"),
    subtitle: optionalText(product.subtitle, "product.subtitle"),
    description: optionalText(product.description, "product.description"),
    sku: text(variant.sku, "product.variant.sku", /^[A-Z0-9][A-Z0-9-]*$/),
    packaging: {
      weightGrams: integer(variant.weightGrams, "product.variant.weightGrams", 1),
      lengthMillimetres: integer(variant.lengthMillimetres, "product.variant.lengthMillimetres", 1),
      widthMillimetres: integer(variant.widthMillimetres, "product.variant.widthMillimetres", 1),
      heightMillimetres: integer(variant.heightMillimetres, "product.variant.heightMillimetres", 1),
    },
    media: readMedia(product.media, members),
    price: {
      currency: text(price.currency, "product.price.currency", /^[A-Z]{3}$/),
      amountMinor: integer(price.amountMinor, "product.price.amountMinor", 1),
      taxIncluded: boolean(price.taxIncluded, "product.price.taxIncluded"),
    },
    stock: {
      manageInventory,
      quantity: manageInventory ? integer(stock, "product.variant.stock") : null,
    },
  };
}

/**
 * Keeps the coupons that are still valid at `now` and silently drops the rest.
 *
 * Dropping is right here and refusing is right for personal data, because the
 * checkbox scopes the import to "still-valid coupons": an expired coupon is
 * commerce data the operator has every reason to have exported and no reason
 * to have live, whereas a customer record is data that must never arrive at
 * all.
 */
function readCoupons(value: unknown, now: Date): readonly PlannedCoupon[] {
  return array(value, "coupons").flatMap((entry, index) => {
    const coupon = object(entry, `coupons[${String(index)}]`);
    const type = text(coupon.type, `coupons[${String(index)}].type`);
    if (type !== "percentage" && type !== "fixed") {
      malformed(`coupons[${String(index)}].type is not percentage or fixed`);
    }
    const expiresAt = optionalText(coupon.expiresAt, `coupons[${String(index)}].expiresAt`);
    if (expiresAt !== null) {
      const expiry = new Date(expiresAt);
      if (Number.isNaN(expiry.getTime())) {
        malformed(`coupons[${String(index)}].expiresAt is not a date`);
      }
      if (expiry.getTime() <= now.getTime()) return [];
    }
    return [{
      code: text(coupon.code, `coupons[${String(index)}].code`, /^[A-Z0-9][A-Z0-9_-]*$/),
      type,
      value: integer(coupon.value, `coupons[${String(index)}].value`, 1),
      expiresAt,
    }];
  });
}

function readTaxRegions(value: unknown): readonly PlannedTaxRegion[] {
  return array(value, "taxRegions").map((entry, index) => {
    const region = object(entry, `taxRegions[${String(index)}]`);
    const ratePercent = region.ratePercent;
    if (typeof ratePercent !== "number" || !Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      malformed(`taxRegions[${String(index)}].ratePercent is not a percentage`);
    }
    return {
      countryCode: text(region.countryCode, `taxRegions[${String(index)}].countryCode`, /^[A-Z]{2}$/),
      name: text(region.name, `taxRegions[${String(index)}].name`),
      ratePercent,
      code: text(region.code, `taxRegions[${String(index)}].code`),
    };
  });
}

function readShippingZones(value: unknown): readonly PlannedShippingZone[] {
  return array(value, "shippingZones").map((entry, index) => {
    const zone = object(entry, `shippingZones[${String(index)}]`);
    const countryCodes = array(zone.countryCodes, `shippingZones[${String(index)}].countryCodes`).map(
      (code, position) => text(code, `shippingZones[${String(index)}].countryCodes[${String(position)}]`, /^[A-Z]{2}$/),
    );
    if (countryCodes.length === 0) {
      malformed(`shippingZones[${String(index)}].countryCodes is empty`);
    }

    const options = array(zone.options, `shippingZones[${String(index)}].options`).map(
      (option, position) => {
        const label = `shippingZones[${String(index)}].options[${String(position)}]`;
        const record = object(option, label);
        return {
          name: text(record.name, `${label}.name`),
          currency: text(record.currency, `${label}.currency`, /^[A-Z]{3}$/),
          // Zero is the free-shipping method. Flat and free are the only two
          // declared methods; no carrier interface, quote cache or fallback.
          amountMinor: integer(record.amountMinor, `${label}.amountMinor`),
        };
      },
    );
    if (options.length === 0) malformed(`shippingZones[${String(index)}].options is empty`);

    return { name: text(zone.name, `shippingZones[${String(index)}].name`), countryCodes, options };
  });
}

export function readCatalogueImportPlan(
  members: readonly ArchiveMember[],
  now: Date,
): CatalogueImportPlan {
  const manifest = readManifest(members);

  return {
    environment: text(manifest.environment, "environment"),
    product: readProduct(manifest.product, members),
    coupons: readCoupons(manifest.coupons ?? [], now),
    taxRegions: readTaxRegions(manifest.taxRegions ?? []),
    shippingZones: readShippingZones(manifest.shippingZones ?? []),
  };
}
