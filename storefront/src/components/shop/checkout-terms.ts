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
 *
 * ## In another edition the sentence is found by its place, not its words
 *
 * The opening words are English, and a translated page does not begin its
 * paragraphs with them. So a sentence is located in the default edition's
 * page, by section anchor and opening words, and read from the **same
 * section and the same position** of the edition's own page. That is safe
 * because `content/mirror.test.ts` holds every translated legal page to the
 * English one in anchors and list lengths: the paragraph at that position is
 * the translation of the one found. Both pages come from
 * `legalPagesByLocale`, so an edition is read from its own files and from no
 * others.
 */

import { legalPagesByLocale } from "../../../../content/legal/index.js";
import { DEFAULT_LOCALE, type Locale, type RouteId } from "../../../../content/routes.js";
import { contentFor, type LegalPage } from "../../../../content/schema.js";

function legalPage(locale: Locale, route: RouteId): LegalPage {
  const page = contentFor(legalPagesByLocale, locale).find((candidate) => candidate.route === route);
  if (page === undefined) {
    throw new Error(`the ${locale} edition has no legal page for the route "${route}"`);
  }
  return page;
}

function paragraph(
  locale: Locale,
  route: RouteId,
  anchor: string,
  opening: string,
  obligation: string,
): string {
  const page = legalPage(DEFAULT_LOCALE, route);
  const index =
    page.body
      .find((candidate) => candidate.anchor === anchor)
      ?.body.findIndex((text) => text.startsWith(opening)) ?? -1;

  if (index === -1) {
    throw new Error(
      `the checkout screen cannot find the ${obligation} sentence in content/legal/${page.route} ` +
        `(section "${anchor}", opening "${opening}"). content/legal/terms.ts says its checkout ` +
        "section is written to match this screen exactly — reword one and the other changes in " +
        "the same commit, or the legal page becomes false.",
    );
  }

  const found = legalPage(locale, route).body.find((candidate) => candidate.anchor === anchor)?.body[index];
  if (found === undefined) {
    throw new Error(
      `the ${locale} edition's ${route} page has no paragraph ${String(index + 1)} in section ` +
        `"${anchor}", where the default edition states the ${obligation} sentence. A translated ` +
        "legal page mirrors the English one section for section and paragraph for paragraph.",
    );
  }

  return found;
}

/** The sentences the checkout screen is obliged to say, in one edition's words. */
export interface CheckoutTerms {
  /**
   * "Placing an order is an offer to buy. The contract exists when we send you a
   * dispatch confirmation, not when you press the button…" — Article 8(2) CRD's
   * companion disclosure: what pressing the button does and does not do.
   */
  readonly contractFormation: string;
  /**
   * The consent line. Rendered immediately above the order button because it
   * says the confirmation is given **by placing the order** — which is why the
   * screen carries no separate tick box: a tick box would contradict the
   * sentence the qualified reader wrote.
   */
  readonly consentLine: string;
  /** The durable-medium promise — Article 8(7) CRD. */
  readonly confirmationPromise: string;
  /** The processor and card-number statement the payment step is built around. */
  readonly cardStatement: string;
  /**
   * Return postage — Articles 6(1)(i) and 14(1) CRD. Only enforceable if
   * disclosed **before** the contract is concluded, which is why it is on this
   * screen and not only on `/legal/returns`.
   */
  readonly returnPostage: string;
  /**
   * The delivery estimate, in the shipping page's own words — one of the six
   * disclosures `content/legal/terms.ts` requires on the screen carrying the
   * order button.
   */
  readonly deliveryEstimate: string;
}

const termsByLocale = new Map<Locale, CheckoutTerms>();

/** {@link CheckoutTerms} as `locale`'s legal pages state them. */
export function checkoutTermsFor(locale: Locale): CheckoutTerms {
  let terms = termsByLocale.get(locale);
  if (terms === undefined) {
    terms = {
      contractFormation: paragraph(
        locale,
        "legalTerms",
        "checkout-acknowledgement",
        "Placing an order is an offer to buy",
        "contract formation",
      ),
      consentLine: paragraph(
        locale,
        "legalTerms",
        "checkout-acknowledgement",
        "By placing the order you confirm",
        "consent",
      ),
      confirmationPromise: paragraph(
        locale,
        "legalTerms",
        "checkout-acknowledgement",
        "You will receive a confirmation by email",
        "confirmation",
      ),
      cardStatement: paragraph(
        locale,
        "legalTerms",
        "checkout-acknowledgement",
        "We accept cards, Apple Pay, Google Pay and PayPal",
        "card number",
      ),
      returnPostage: paragraph(
        locale,
        "legalReturns",
        "returns-process",
        "You pay the cost of returning the parcel",
        "return postage",
      ),
      deliveryEstimate: paragraph(
        locale,
        "legalShipping",
        "delivery",
        "Orders are dispatched within",
        "delivery estimate",
      ),
    };
    termsByLocale.set(locale, terms);
  }
  return terms;
}

/*
 * The default edition's six, under the names they have always had. They are
 * resolved at import, so a reworded English sentence still fails the moment
 * this module loads and not on the first visit to the checkout.
 */
const english = checkoutTermsFor(DEFAULT_LOCALE);

export const CONTRACT_FORMATION = english.contractFormation;
export const CONSENT_LINE = english.consentLine;
export const CONFIRMATION_PROMISE = english.confirmationPromise;
export const CARD_STATEMENT = english.cardStatement;
export const RETURN_POSTAGE = english.returnPostage;
export const DELIVERY_ESTIMATE = english.deliveryEstimate;
