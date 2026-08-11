/**
 * The legal pages, as one list per locale.
 *
 * `content.test.ts` asserts that between them they cover every element in
 * `LEGAL_ELEMENTS`, so a missing obligation fails the build rather than being
 * discovered by a customer. It also asserts that no page still carrying an
 * unresolved placeholder is marked `operator-approved`, so the merchant's
 * identity cannot silently ship as a template string.
 *
 * ## Why the locale is declared here and not in the five files
 *
 * `imprint.ts`, `terms.ts`, `shipping.ts`, `returns.ts` and `privacy.ts` carry
 * **two qualified-reader reviews** and every page is
 * `draft-pending-operator-input`. Registering the English edition by writing
 * its locale key *around* those files rather than a `locale:` field *inside*
 * each of them leaves all five at a literally empty diff, which is a property
 * a reviewer can check with `git diff` instead of by reading five legal
 * notices for changed wording. The registration is one key in one object; the
 * copy is untouched, and demonstrably so.
 *
 * A second edition is a sibling directory of content files plus a second key
 * here. Nothing else in this package, and nothing in the renderer, learns a
 * new shape.
 */

import { contentFor, type LegalPage, type LocalizedContent } from "../schema.js";
import { DEFAULT_LOCALE } from "../routes.js";
import { imprint } from "./imprint.js";
import { privacy } from "./privacy.js";
import { returns } from "./returns.js";
import { shipping } from "./shipping.js";
import { terms } from "./terms.js";
import { imprint as imprintEt } from "./et/imprint.js";
import { privacy as privacyEt } from "./et/privacy.js";
import { returns as returnsEt } from "./et/returns.js";
import { shipping as shippingEt } from "./et/shipping.js";
import { terms as termsEt } from "./et/terms.js";

export { imprint, privacy, returns, shipping, terms };

/** The English edition, in the order a reader meets it. */
const english: readonly LegalPage[] = [imprint, terms, shipping, returns, privacy];

/**
 * The Estonian edition — the `et/` sibling directory, in the same reading
 * order. Its five files are translations of the five above: same anchors,
 * same `covers`, same placeholders, Estonian prose. Every page is
 * `draft-pending-operator-input` until the qualified reader's acceptance is
 * recorded as an operator act.
 */
const estonian: readonly LegalPage[] = [imprintEt, termsEt, shippingEt, returnsEt, privacyEt];

/**
 * The legal set, per locale. Total over `Locale`: a new locale does not
 * compile until it is registered here — see `schema.ts`'s
 * {@link LocalizedContent}.
 */
export const legalPagesByLocale: LocalizedContent<readonly LegalPage[]> = {
  en: english,
  et: estonian,
};

/**
 * The default locale's legal set.
 *
 * Kept as a named export because it is what every locale-independent
 * check — coverage of `LEGAL_ELEMENTS`, one section per obligation, the
 * cookie table's shape — is written against, and those properties are
 * properties of an edition, checked per edition.
 */
export const legalPages: readonly LegalPage[] = contentFor(legalPagesByLocale, DEFAULT_LOCALE);
