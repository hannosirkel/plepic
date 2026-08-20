/**
 * Which destination a screen's figures were priced for, and therefore what may
 * honestly be said about them.
 *
 * ## Why this is a module and not four lines in a component
 *
 * The advertised price is net, so every figure on a commercial screen belongs
 * to a destination, and the sentence qualifying it names that destination and
 * whether tax is in it. Getting the pairing wrong is not cosmetic: it puts *"No
 * VAT added, delivering to United States"* one line above the order button on a
 * screen showing an Estonian buyer's tax-inclusive figures, which is a false
 * pre-contract disclosure on the exact screen Article 8(2) CRD is about.
 *
 * That defect was fixed inside `CheckoutPageContent` and `StripePaymentReturn`
 * first, and review then demonstrated that neither fix was **defended**. Both
 * components mount their data in effects and the storefront suite is Node-only,
 * so a test can render one populated screen (the checkout has an
 * `initialAddress` seam) and could not render the other at all. Two mutations
 * that reinstated the original defect — one on each component — left the whole
 * suite green. A source-level pin was standing in for coverage, and a pin that
 * cannot fail on the behaviour it names reads as coverage without being any.
 *
 * So the decision lives here, as pure functions over plain values, and
 * `tests/price-qualification.test.ts` drives every state either screen can be
 * in — including the production states the mock layer cannot reach, which is
 * where the second mutation hid. The components are bindings over these; they
 * decide nothing.
 *
 * ## The rule, stated once
 *
 * **The qualification follows whatever priced the figures beside it.** Not the
 * cookie, not the address, but whichever of them the figures on that screen
 * actually came from:
 *
 * - On the checkout, the figures are the delivery address's only once Medusa
 *   has returned totals bound to the address currently on screen. Until then
 *   the goods figure is the basket's, priced for the destination set on the
 *   site, so that destination is the honest thing to name — with a sentence
 *   saying the address will replace it.
 * - On the confirmation page, every figure came from a cart Medusa priced
 *   against a **confirmed** shipping address, so that address decides, and
 *   nothing outside the order gets a say.
 *
 * And where no destination can honestly be named, none is: both entry points
 * return `null` and the copy says the figures follow the delivery address,
 * rather than naming a destination that is not the one being charged.
 */

import { checkout } from "../../../content/shop.js";

import { resolveCatalogue, resolveCataloguePlaceholders } from "./catalogue.js";
import type { ShippingZone } from "./cart.js";
import {
  defaultDestination,
  destinationForCode,
  destinationForCountryName,
  knownDestinationForCode,
  type Destination,
} from "./destination.js";
import { currentAddressTotals, type AddressBoundTotals } from "./store-checkout.js";

export interface PriceQualification {
  /**
   * The destination the figures belong to, or `null` when none can honestly be
   * named. `null` is a state the screen renders differently — never a value to
   * substitute a default for.
   */
  readonly destination: Destination | null;
  /**
   * True when the figures on screen are the ones a **delivery address**
   * produced, rather than the ones the destination set on the site produced.
   */
  readonly addressBound: boolean;
  /**
   * The rate the VAT row quotes, formatted as a percentage.
   *
   * **A string, not the catalogue it came from, and that is the whole of a
   * fix.** This field used to be the `ResolvedCatalogue` the qualification was
   * built from, so a caller holding one of these also held `.priceQualifiers`,
   * `.price` and every other destination-dependent string — resolved against
   * `destination ?? defaultDestination`. Rendering `catalogue.priceQualifiers`
   * instead of {@link text} was therefore a one-property edit that reinstated
   * the defect for an unlisted country: the same order summary, qualified "No
   * VAT added, delivering to United States" instead of saying it could not name
   * a destination.
   *
   * Both screens wanted the catalogue for exactly one thing — the rate on the
   * VAT row — so they get the rate, and {@link vatLabel} already composed. The
   * mutation is not defended against; it cannot be written.
   */
  readonly vatRate: string;
  /**
   * The VAT row's term with its rate resolved — `content/shop.ts`'s
   * `vatLabel` with `{vatRate}` filled in.
   *
   * Composed here so no screen needs a catalogue to render its own summary.
   */
  readonly vatLabel: string;
  /** The sentence the screen renders. Never empty. */
  readonly text: string;
}

function qualify(destination: Destination | null, addressBound: boolean): PriceQualification {
  /*
   * Resolved for the destination when there is one and for the declared default
   * when there is not. That is safe for the **rate** specifically — the rate
   * this deployment charges does not vary by destination — and it is unsafe for
   * every other string on this object, which is exactly why none of them leaves
   * this function. See `PriceQualification.vatRate`.
   */
  const catalogue = resolveCatalogue(undefined, destination ?? defaultDestination);
  const shared = {
    destination,
    addressBound,
    vatRate: catalogue.vatRate,
    vatLabel: resolveCataloguePlaceholders(checkout.order.vatLabel, catalogue),
  };
  if (destination === null) {
    return { ...shared, text: checkout.order.qualifierPending };
  }
  return {
    ...shared,
    text: addressBound
      ? catalogue.priceQualifiers
      : `${catalogue.priceQualifiers} ${checkout.order.destinationProvisional}`,
  };
}

/** What both paths need, whichever priced the figures. */
interface CheckoutQualificationContext {
  /** The country name the delivery-address form currently holds. */
  readonly countryName: string;
  /** The destination set on this site, as an ISO 3166-1 alpha-2 code. */
  readonly destinationCode: string;
}

/**
 * Which of the two pricing paths the screen is on, **and its evidence** —
 * a discriminated union rather than a boolean beside every field either path
 * might use.
 *
 * The boolean it replaces was `mockLayer`, and it inverted silently: flipping
 * it to a constant left the entire suite green, because every test renders a
 * mock scenario and the production binding was exercised by nothing. In
 * production that made `addressBound` true as soon as the address validated —
 * before any delivery method existed — claiming the address's tax treatment
 * over the basket's figures, which are priced for the destination cookie.
 *
 * A union makes that edit not compile: `kind: "mock"` and Medusa's totals
 * cannot appear together, so the argument cannot disagree with the path it
 * claims to be on. It is also the honester shape — `storeTotals` and
 * `addressRevision` mean nothing on the mock path, and `addressComplete` and
 * `deliveryZone` mean nothing on the store path, and a record carrying all four
 * says otherwise.
 */
export type CheckoutQualificationInput =
  | (CheckoutQualificationContext & {
      /** The `?mock=` path: the figures come from `src/lib/cart.ts`. */
      readonly kind: "mock";
      readonly addressComplete: boolean;
      /** The zone the completed address falls in, or `null`. */
      readonly deliveryZone: ShippingZone | null;
    })
  | (CheckoutQualificationContext & {
      /** The served path: the figures come from Medusa. */
      readonly kind: "store";
      /** Medusa's address-bound totals, as the checkout holds them. */
      readonly storeTotals: AddressBoundTotals | null;
      /** The revision of the address currently on screen, or `null` while incomplete. */
      readonly addressRevision: string | null;
    });

/**
 * The qualification for the Article 8(2) block on `/checkout`.
 *
 * `addressBound` on the production path is **not** "the address looks
 * complete": it is "Medusa has returned totals for this exact address". A
 * complete address whose delivery method has not been chosen yet still shows
 * the basket's goods figure, priced for the destination set on the site, so
 * claiming the address's tax treatment over it would be the original defect
 * inverted — the right destination named over the wrong figures.
 */
export function checkoutPriceQualification(
  input: CheckoutQualificationInput,
): PriceQualification {
  const addressBound =
    input.kind === "mock"
      ? input.addressComplete && input.deliveryZone !== null
      : currentAddressTotals(input.storeTotals, input.addressRevision) !== null;

  return qualify(
    addressBound
      ? destinationForCountryName(input.countryName.trim())
      : destinationForCode(input.destinationCode),
    addressBound,
  );
}

/**
 * The qualification for the summary on the Stripe return page.
 *
 * Always address-bound: every figure on that screen came from a cart Medusa
 * priced against a confirmed shipping address. The country therefore comes from
 * the order and is looked up **strictly** — an unrecognised code yields no
 * destination rather than the declared default, because defaulting it would put
 * "No VAT added" over an order that was taxed. See `knownDestinationForCode`.
 */
export function confirmationPriceQualification(countryCode: string): PriceQualification {
  return qualify(knownDestinationForCode(countryCode), true);
}
