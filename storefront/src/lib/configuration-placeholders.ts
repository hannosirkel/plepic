/**
 * Resolves `content/`'s **configuration**-sourced placeholders, and drops the
 * copy that still has an unresolved one in it.
 *
 * `src/lib/catalogue.ts` is the same job for the catalogue-sourced quarter of
 * `content/schema.ts`'s `PLACEHOLDERS`. It deliberately leaves every token it
 * does not recognise exactly as written, which is right for a function whose
 * remit is the catalogue — and is precisely how
 * `{merchantContactAddress}` reached a shipping page in plain body type:
 * every visitor to `/support/lunar-base` read "You can also reach us at
 * {merchantContactAddress}." at all three widths. `content/` is read-only
 * here, so the fix is at render, and it is this module.
 *
 * ## Why unresolved copy is dropped rather than rendered
 *
 * `content/schema.ts` marks the merchant identity placeholders
 * `unresolved: true`: the values do not exist yet, and the plan forbids
 * inventing them ("never publish fabricated…", and the merchant's own
 * address is not this unit's to invent). So there are exactly three things a
 * page can do with a sentence that quotes one — render the brace, fabricate
 * a value, or not render the sentence — and only the third is honest. A
 * visitor loses one alternative contact route they could not have used
 * anyway; the contact form directly beneath it still works.
 *
 * When an operator sets the variable, the sentence appears, resolved. Nothing
 * else has to change.
 */

import type { MerchantConfig } from "../config/runtime-config.js";

/**
 * Every configuration-sourced token this module can resolve today, keyed
 * exactly like `content/schema.ts`'s `PLACEHOLDERS`. A value of `null` means
 * "configured nowhere yet", which is not the same as an empty string and is
 * never rendered as one.
 */
export interface ConfigurationPlaceholderValues {
  readonly merchantContactAddress: string | null;
}

/** Projects runtime configuration into the placeholder values it supplies. */
export function placeholderValuesFrom(merchant: MerchantConfig): ConfigurationPlaceholderValues {
  return { merchantContactAddress: merchant.contactAddress };
}

/** Same grammar as `content/schema.ts`'s own `PLACEHOLDER_PATTERN`. */
const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/**
 * Substitutes every configuration-sourced `{token}` in `text` that has a
 * configured value. A token with no value — and any token this module does
 * not know — is left exactly as written, so {@link isFullyResolved} can then
 * see it and the caller can drop the copy rather than ship a brace.
 */
export function resolveConfigurationPlaceholders(
  text: string,
  values: ConfigurationPlaceholderValues,
): string {
  return text.replaceAll(PLACEHOLDER_PATTERN, (whole, token: string) => {
    if (token === "merchantContactAddress") return values.merchantContactAddress ?? whole;
    return whole;
  });
}

/** True when no `{token}` at all survives in `text`. */
export function isFullyResolved(text: string): boolean {
  return !new RegExp(PLACEHOLDER_PATTERN.source).test(text);
}

/**
 * Resolves each entry and keeps only the ones that came out clean.
 *
 * Written to take and return a list because that is the shape `content/`'s
 * prose has (`Section.body` is a paragraph array): dropping is per paragraph,
 * so losing an unresolvable sentence never takes a resolvable one with it.
 */
export function resolvedParagraphs(
  paragraphs: readonly string[],
  values: ConfigurationPlaceholderValues,
): readonly string[] {
  return paragraphs
    .map((paragraph) => resolveConfigurationPlaceholders(paragraph, values))
    .filter(isFullyResolved);
}
