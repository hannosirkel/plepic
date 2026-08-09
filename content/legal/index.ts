/**
 * The legal pages, as one list.
 *
 * `content.test.ts` asserts that between them they cover every element in
 * `LEGAL_ELEMENTS`, so a missing obligation fails the build rather than being
 * discovered by a customer. It also asserts that no page still carrying an
 * unresolved placeholder is marked `operator-approved`, so the merchant's
 * identity cannot silently ship as a template string.
 */

import type { LegalPage } from "../schema.js";
import { imprint } from "./imprint.js";
import { privacy } from "./privacy.js";
import { returns } from "./returns.js";
import { shipping } from "./shipping.js";
import { terms } from "./terms.js";

export { imprint, privacy, returns, shipping, terms };

export const legalPages: readonly LegalPage[] = [
  imprint,
  terms,
  shipping,
  returns,
  privacy,
];
