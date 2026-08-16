import { CatalogueImportRefusal } from "./refusal.js";
import type { ArchiveMember } from "./archive.js";

/**
 * The sections the import refuses outright. Customer accounts and order
 * history are archive-only: a final WooCommerce export is preserved in
 * encrypted backup storage and never imported.
 *
 * The refusal is deliberately louder than a filter. Silently dropping a
 * `customers` section would import the catalogue from an archive that also
 * contained personal data, leave no trace that it did, and make the next
 * operator believe the export was clean. Refusing makes the archive's contents
 * an operator problem before any of it reaches PostgreSQL.
 */
export const REFUSED_SECTIONS: readonly string[] = [
  "users",
  "usermeta",
  "customers",
  "customer",
  "customer_accounts",
  "customer_lookup",
  "sessions",
  "session_store",
  "orders",
  "order_history",
  "order_items",
  "order_itemmeta",
  "subscribers",
  "subscriptions",
  "comments",
  "commentmeta",
  "downloadable_product_permissions",
  "payment_tokens",
  "payment_tokenmeta",
];

/**
 * Normalises a manifest key or archive path segment to the form
 * {@link REFUSED_SECTIONS} is written in: case-insensitive, with the WordPress
 * and WooCommerce table prefixes removed, and `camelCase` flattened, so
 * `wp_woocommerce_sessions`, `WP_Users` and `orderHistory` all land on a
 * refused name.
 */
function normaliseSectionName(value: string): string {
  const flattened = value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return flattened.replace(/^(?:wp_)?(?:woocommerce_|wc_)?/, "").replace(/^wp_/, "");
}

function refusedSection(value: string): string | null {
  return REFUSED_SECTIONS.includes(normaliseSectionName(value)) ? value : null;
}

/**
 * Refuses an archive whose manifest declares, or whose members carry, any
 * personal-data section. The message names the section and never its contents:
 * no customer datum, subscriber address or credential may reach a log.
 */
export function assertNoPersonalData(members: readonly ArchiveMember[]): void {
  for (const member of members) {
    const segment = member.name.split("/")[0] ?? "";
    const refused = refusedSection(segment);
    if (refused !== null) {
      throw new CatalogueImportRefusal(
        "personal-data-present",
        `the archive carries a "${refused}" member; customer accounts and order history are archive-only and are never imported`,
      );
    }
  }

  const manifest = members.find((member) => member.name === "manifest.json");
  if (manifest === undefined) return;

  let document: unknown;
  try {
    document = JSON.parse(Buffer.from(manifest.content).toString("utf8"));
  } catch {
    throw new CatalogueImportRefusal("malformed-archive", "manifest.json is not valid JSON");
  }

  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    throw new CatalogueImportRefusal("malformed-archive", "manifest.json is not a JSON object");
  }

  assertNoRefusedKeyAnywhere(document);
}

/**
 * Walks the whole manifest tree, not just its top level.
 *
 * Top-level detection alone accepted `product.customers`,
 * `product.variant.sessions`, `taxRegions[0].users` and their like: the plan
 * reader ignores keys it does not read, so none of it reached PostgreSQL, but
 * the run reported success and deleted the archive, and the operator was left
 * believing the export was clean. That is exactly the harm the refusal exists
 * to prevent — the refusal is louder than a filter on purpose.
 *
 * The walk is iterative rather than recursive so that a deeply nested hostile
 * manifest is a refusal rather than a stack overflow, and it visits arrays
 * because a WooCommerce export nests its rows inside them.
 */
function assertNoRefusedKeyAnywhere(document: object): void {
  const pending: unknown[] = [document];

  while (pending.length > 0) {
    const value = pending.pop();

    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (typeof value !== "object" || value === null) continue;

    for (const [key, nested] of Object.entries(value)) {
      const refused = refusedSection(key);
      if (refused !== null) {
        throw new CatalogueImportRefusal(
          "personal-data-present",
          `the manifest declares a "${refused}" section; WordPress users, WooCommerce customer accounts, sessions and order history are never imported`,
        );
      }
      pending.push(nested);
    }
  }
}

/**
 * Refuses a personal-data path segment before the generic member-shape check
 * sees it, so an exported `customers/` table is reported as personal data
 * rather than as an unexpected file.
 */
export function assertNoPersonalDataMemberName(name: string): void {
  const segment = name.split(/[/\\]/)[0] ?? "";
  const refused = refusedSection(segment);
  if (refused !== null) {
    throw new CatalogueImportRefusal(
      "personal-data-present",
      `the archive carries a "${refused}" member; customer accounts and order history are archive-only and are never imported`,
    );
  }
}
