/**
 * Resolves `content/`'s **configuration**-sourced placeholders, and decides
 * what a page does when one of them has no value.
 *
 * `src/lib/catalogue.ts` is the same job for the catalogue-sourced quarter of
 * `content/schema.ts`'s `PLACEHOLDERS`. It deliberately leaves every token it
 * does not recognise exactly as written, which is right for a function whose
 * remit is the catalogue — and is precisely how `{merchantContactAddress}`
 * reached a shipping page in plain body type: every visitor to
 * `/support/lunar-base` read "You can also reach us at
 * {merchantContactAddress}." at all three widths. `content/` is read-only
 * here, so the fix is at render, and it is this module.
 *
 * ## Two failure modes, because there are two kinds of copy
 *
 * There are exactly three things a page can do with a sentence quoting a value
 * it does not have: render the brace, fabricate a value, or not render the
 * sentence. The brace is a bug and fabrication is forbidden outright, so the
 * original module dropped the sentence — right for the Support page, where a
 * visitor loses one alternative contact route they could not have used anyway
 * and the contact form beneath it still works.
 *
 * **It is wrong for a legal page, and the second qualified read is the reason
 * this module now has a second mode.** An imprint that silently drops its
 * registration number, its VAT number or its telephone number does not
 * degrade gracefully: it renders as a complete, confident legal notice that is
 * missing a disclosure the law requires, and nobody — visitor, operator or
 * test — can see that anything is absent. That is a compliance defect wearing
 * the costume of a feature.
 *
 * So there is a fourth option for legally required values, and it is the one
 * this module takes: **render the sentence with a named, visible gap where the
 * value belongs, and tell the reader at the top of the page which details are
 * missing.** It is not pretty. It is not supposed to be; it is supposed to be
 * impossible to ship without noticing. `content/schema.ts` marks which
 * placeholders get this treatment (`legallyRequired`).
 *
 * **Which test holds that up, said accurately.** `tests/legal-pages.test.tsx`
 * renders both states against a hand-written fixture; it proves the component
 * behaves, but its fixture supplies every value, so it cannot notice a
 * placeholder that has no variable behind it at all.
 * `tests/runtime-config.test.ts` is what does — it asserts `RUNTIME_ENV_VARS`
 * is exactly the set `src/` reads — together with
 * `tests/build-and-serve.test.ts`, which builds, serves all five routes from a
 * real configured environment, and fails on a gap marker or an incompleteness
 * notice appearing there. Between them the loud state is only ever reachable
 * by misconfiguration rather than by neglect.
 *
 * The gap text is deliberately not a `{brace}`: braces are what
 * `tests/no-unresolved-placeholder.test.tsx` hunts for, and reusing that
 * grammar for a state this module produces on purpose would blind the scanner
 * to the state it exists to catch.
 */

import { isPlaceholderToken, PLACEHOLDER_TABLE } from "../../../content/schema.js";
import type { MerchantConfig } from "../config/runtime-config.js";

/**
 * Every configuration-sourced token this module can resolve, keyed exactly
 * like `content/schema.ts`'s `PLACEHOLDERS`. A value of `null` means
 * "configured nowhere yet", which is not the same as an empty string and is
 * never rendered as one.
 */
export interface ConfigurationPlaceholderValues {
  readonly merchantLegalName: string | null;
  readonly merchantRegisteredAddress: string | null;
  readonly merchantRegistrationNumber: string | null;
  readonly merchantVatNumber: string | null;
  readonly merchantContactAddress: string | null;
  readonly merchantPhoneNumber: string | null;
  readonly returnAddress: string | null;
}

/**
 * A short human name per token, for the gap marker and the page notice.
 *
 * `PLACEHOLDERS[token].description` is a sentence written for a developer
 * reading the model ("Registered address of the merchant, as filed."), which
 * reads badly mid-paragraph. These are the same facts in the words a notice
 * would use.
 */
const LABELS: Readonly<Record<keyof ConfigurationPlaceholderValues, string>> = {
  merchantLegalName: "registered company name",
  merchantRegisteredAddress: "registered address",
  merchantRegistrationNumber: "company registration number",
  merchantVatNumber: "VAT identification number",
  merchantContactAddress: "contact email address",
  merchantPhoneNumber: "telephone number",
  returnAddress: "return address",
};

export type ConfigurationPlaceholderToken = keyof ConfigurationPlaceholderValues;

/** Every token this module knows, sorted. Pinned against `content/` by test. */
export const CONFIGURATION_PLACEHOLDER_TOKENS: readonly ConfigurationPlaceholderToken[] = [
  "merchantContactAddress",
  "merchantLegalName",
  "merchantPhoneNumber",
  "merchantRegisteredAddress",
  "merchantRegistrationNumber",
  "merchantVatNumber",
  "returnAddress",
];

/**
 * Nothing configured. The state every deployment is in until an operator sets
 * the `MERCHANT_*` variables, and the base a caller that only has one of them
 * spreads over — so adding a field to {@link ConfigurationPlaceholderValues}
 * does not silently become a missing property at some other call site.
 */
export const NO_CONFIGURATION_VALUES: ConfigurationPlaceholderValues = {
  merchantLegalName: null,
  merchantRegisteredAddress: null,
  merchantRegistrationNumber: null,
  merchantVatNumber: null,
  merchantContactAddress: null,
  merchantPhoneNumber: null,
  returnAddress: null,
};

/** Projects runtime configuration into the placeholder values it supplies. */
export function placeholderValuesFrom(merchant: MerchantConfig): ConfigurationPlaceholderValues {
  return {
    merchantLegalName: merchant.legalName,
    merchantRegisteredAddress: merchant.registeredAddress,
    merchantRegistrationNumber: merchant.registrationNumber,
    merchantVatNumber: merchant.vatNumber,
    merchantContactAddress: merchant.contactAddress,
    merchantPhoneNumber: merchant.phoneNumber,
    returnAddress: merchant.returnAddress,
  };
}

/** Same grammar as `content/schema.ts`'s own `PLACEHOLDER_PATTERN`. */
const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

function isKnownToken(token: string): token is ConfigurationPlaceholderToken {
  return Object.hasOwn(LABELS, token);
}

/**
 * True when `token` is one `content/schema.ts` marks as a legally required
 * disclosure. Read from the content model rather than restated here, so
 * marking a new placeholder required in one place changes the render in the
 * other.
 */
export function isLegallyRequiredToken(token: string): boolean {
  if (!isPlaceholderToken(token)) return false;
  return PLACEHOLDER_TABLE[token].legallyRequired === true;
}

/** The visible stand-in for a legally required value this deployment lacks. */
export function unconfiguredMarker(token: ConfigurationPlaceholderToken): string {
  return `[not configured: ${LABELS[token]}]`;
}

/** The human name of a token, for a page-level notice. */
export function labelFor(token: ConfigurationPlaceholderToken): string {
  return LABELS[token];
}

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
    if (!isKnownToken(token)) return whole;
    return values[token] ?? whole;
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
 *
 * **For optional prose only.** Anything carrying a legal obligation goes
 * through {@link resolveRequiredProse} instead, which never drops.
 */
export function resolvedParagraphs(
  paragraphs: readonly string[],
  values: ConfigurationPlaceholderValues,
): readonly string[] {
  return paragraphs
    .map((paragraph) => resolveConfigurationPlaceholders(paragraph, values))
    .filter(isFullyResolved);
}

export interface RequiredProse {
  /**
   * Every paragraph given, in order, none dropped. A legally required value
   * this deployment lacks appears as {@link unconfiguredMarker}'s text; a
   * token that is neither known nor legally required is left as written, which
   * `tests/no-unresolved-placeholder.test.tsx` will then catch as the bug it
   * is.
   */
  readonly paragraphs: readonly string[];
  /** Legally required tokens with no configured value, deduplicated and sorted. */
  readonly missing: readonly ConfigurationPlaceholderToken[];
}

/**
 * Resolves prose that carries a legal obligation.
 *
 * Nothing is ever dropped, because on these pages the sentence *is* the
 * disclosure. What is missing is named where it is missing and named again in
 * {@link RequiredProse.missing}, which the page turns into a notice.
 */
export function resolveRequiredProse(
  paragraphs: readonly string[],
  values: ConfigurationPlaceholderValues,
): RequiredProse {
  const missing = new Set<ConfigurationPlaceholderToken>();

  const resolved = paragraphs.map((paragraph) =>
    paragraph.replaceAll(PLACEHOLDER_PATTERN, (whole, token: string) => {
      if (!isKnownToken(token)) return whole;
      const value = values[token];
      if (value !== null) return value;
      if (!isLegallyRequiredToken(token)) return whole;
      missing.add(token);
      return unconfiguredMarker(token);
    }),
  );

  return { paragraphs: resolved, missing: [...missing].toSorted() };
}
