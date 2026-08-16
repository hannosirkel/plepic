import { createHash } from "node:crypto";

import { buildArchive, type TarMember } from "./tar.js";

/**
 * The commerce document a staged archive carries, in the shape the import
 * accepts. Every value here is synthetic: the archive the operator will stage
 * is an ignored input and no customer, subscriber or credential datum may ever
 * reach a fixture.
 */
export const manifest = {
  environment: "test",
  product: {
    handle: "lunar-base",
    title: "Lunar Base",
    subtitle: "A cooperative card game",
    description: "Build a base on the moon before your oxygen runs out.",
    variant: {
      sku: "LUNAR-BASE-01",
      manageInventory: false,
      stock: null,
      weightGrams: 310,
      lengthMillimetres: 220,
      widthMillimetres: 160,
      heightMillimetres: 60,
    },
    price: { currency: "EUR", amountMinor: 2500, taxIncluded: true },
    media: [
      { file: "lunar-base-box.webp", role: "thumbnail" },
      { file: "lunar-base-table.webp", role: "gallery" },
    ],
  },
  coupons: [
    { code: "LUNAR10", type: "percentage", value: 10, expiresAt: "2027-01-01T00:00:00.000Z" },
    { code: "EXPIRED5", type: "percentage", value: 5, expiresAt: "2025-01-01T00:00:00.000Z" },
  ],
  taxRegions: [
    { countryCode: "EE", name: "Estonia", ratePercent: 22, code: "EE-VAT" },
  ],
} as const;

/**
 * A manifest carrying the section the import no longer reads.
 *
 * Shipping zones and methods are declared in `src/commerce/shipping-model.ts`
 * now, so an export that still carries them is refused rather than applied —
 * see `plan.ts`'s `SUPERSEDED_SECTIONS`.
 */
export const manifestWithSupersededShippingZones = {
  ...manifest,
  shippingZones: [
    {
      name: "European Union",
      countryCodes: ["EE", "DE"],
      options: [{ name: "Standard delivery", currency: "EUR", amountMinor: 700 }],
    },
  ],
} as const;

export const boxImage = Buffer.from("synthetic-box-image-bytes", "utf8");
export const tableImage = Buffer.from("synthetic-table-image-bytes", "utf8");

export function manifestMember(document: unknown = manifest): TarMember {
  return { name: "manifest.json", content: JSON.stringify(document) };
}

export function mediaMembers(): readonly TarMember[] {
  return [
    { name: "media/", typeflag: "5" },
    { name: "media/lunar-base-box.webp", content: boxImage },
    { name: "media/lunar-base-table.webp", content: tableImage },
  ];
}

/** A complete, well-formed archive. Extra members are appended after the media. */
export function validArchive(extra: readonly TarMember[] = [], document: unknown = manifest): Buffer {
  return buildArchive([manifestMember(document), ...mediaMembers(), ...extra]);
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
