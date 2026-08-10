/**
 * The five sentences the checkout screen is obliged to say, read **out of the
 * merged legal content objects themselves** rather than copied beside them.
 *
 * `content/legal/terms.ts` opens with the reason this module exists: its
 * checkout section "is written to match the checkout screen exactly; if the
 * button label or the consent line changes in the storefront, this page
 * changes in the same commit." Two files saying the same thing in two places
 * is precisely the arrangement that lets one of them quietly stop being true —
 * and a false legal page is a compliance defect, not a copy inconsistency. So
 * the screen renders the legal page's own strings, and there is no second
 * copy to drift.
 *
 * ## Why a missing sentence throws
 *
 * Each lookup below matches a paragraph by its opening words. If a future edit
 * to `content/legal/` rewords one of them, the lookup fails, and the honest
 * outcome is a loud failure rather than a checkout screen that quietly stops
 * disclosing something the law requires and the legal page still claims it
 * discloses. Every one of these is an Article 6 or Article 8 CRD obligation:
 * silently omitting one is the worst available outcome, so it is the one
 * outcome this module makes impossible. `tests/shop-pages.test.tsx` asserts
 * all five resolve, so the failure surfaces in the suite rather than in
 * production.
 *
 * `content/legal/` is read-only to this unit. Nothing here edits it; this is a
 * reader.
 */

import { returns } from "../../../../content/legal/returns.js";
import { shipping } from "../../../../content/legal/shipping.js";
import { terms } from "../../../../content/legal/terms.js";
import type { LegalPage } from "../../../../content/schema.js";

function paragraph(page: LegalPage, anchor: string, opening: string, obligation: string): string {
  const section = page.body.find((candidate) => candidate.anchor === anchor);
  const found = section?.body.find((text) => text.startsWith(opening));

  if (found === undefined) {
    throw new Error(
      `the checkout screen cannot find the ${obligation} sentence in content/legal/${page.route} ` +
        `(section "${anchor}", opening "${opening}"). content/legal/terms.ts says its checkout ` +
        "section is written to match this screen exactly — reword one and the other changes in " +
        "the same commit, or the legal page becomes false.",
    );
  }

  return found;
}

/**
 * "Placing an order is an offer to buy. The contract exists when we send you a
 * dispatch confirmation, not when you press the button…" — Article 8(2) CRD's
 * companion disclosure: what pressing the button does and does not do.
 */
export const CONTRACT_FORMATION = paragraph(
  terms,
  "checkout-acknowledgement",
  "Placing an order is an offer to buy",
  "contract formation",
);

/**
 * The consent line. Rendered immediately above the order button because it
 * says the confirmation is given **by placing the order** — which is why the
 * screen carries no separate tick box: a tick box would contradict the
 * sentence the qualified reader wrote.
 */
export const CONSENT_LINE = paragraph(
  terms,
  "checkout-acknowledgement",
  "By placing the order you confirm",
  "consent",
);

/** The durable-medium promise — Article 8(7) CRD. */
export const CONFIRMATION_PROMISE = paragraph(
  terms,
  "checkout-acknowledgement",
  "You will receive a confirmation by email",
  "confirmation",
);

/** The card-number statement the payment step is built around. */
export const CARD_STATEMENT = paragraph(
  terms,
  "checkout-acknowledgement",
  "We accept payment by card",
  "card number",
);

/**
 * Return postage — Articles 6(1)(i) and 14(1) CRD. Only enforceable if
 * disclosed **before** the contract is concluded, which is why it is on this
 * screen and not only on `/legal/returns`.
 */
export const RETURN_POSTAGE = paragraph(
  returns,
  "returns-process",
  "You pay the cost of returning the parcel",
  "return postage",
);

/**
 * The delivery estimate, in the shipping page's own words — one of the six
 * disclosures `content/legal/terms.ts` requires on the screen carrying the
 * order button.
 */
export const DELIVERY_ESTIMATE = paragraph(
  shipping,
  "delivery",
  "Orders are dispatched within",
  "delivery estimate",
);
