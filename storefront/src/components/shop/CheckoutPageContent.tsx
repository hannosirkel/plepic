"use client";

/**
 * `/checkout` — the screen `content/legal/terms.ts` describes.
 *
 * That page is merged, live and has been through two qualified legal reads,
 * and its doc comment says its checkout section "is written to match the
 * checkout screen exactly". It is therefore the specification for this file,
 * and the five sentences it states are not paraphrased here: they are read out
 * of the legal content object by `./checkout-terms.ts` and rendered verbatim.
 *
 * ## Article 8(2) CRD, which is what this layout is for
 *
 * > "The final button on the checkout page is labelled 'Pay now' — one of the
 * > unambiguous formulations the European Commission's guidance accepts for a
 * > button that places an order with an obligation to pay. Immediately above
 * > it you see, on one screen: the goods, the price of the goods, the shipping
 * > charge, the total, the delivery address and the delivery estimate."
 *
 * The "Your order" section is exactly those six disclosures, in exactly that
 * order, in one block whose last elements are the price qualification, the
 * consent line and the button. Everything else a buyer must be told **before
 * being bound** — how the contract forms, who pays return postage, where the
 * withdrawal conditions and the model form are, what happens to a card
 * number — sits above that block, in "Before you order", rather than below the
 * button where a reader could be bound without having passed it.
 *
 * Two things are between the last disclosure and the button, and both belong
 * there. The **price qualification** — `catalogue.priceQualifiers`, which
 * states the destination the figures are quoted for, whether VAT is in them,
 * and what is not — is the catalogue's own qualifier on the figures directly
 * above it, which is where a qualification has to be to qualify anything;
 * `tests/shop-pages.test.tsx` pins the set of what may appear here to exactly
 * that sentence, so a third thing cannot arrive unnoticed. The **consent
 * line** is next, immediately above the control it describes.
 *
 * ## The seventh value, and why it is worded as an addend
 *
 * Article 8(2) names six disclosures. The VAT row is a seventh value between
 * the shipping charge and the total, and it is an **addend, since
 * 2026-08-29** — the opposite of what it was before that date. Prices are net
 * in storage; before this change every figure on this screen was Medusa's
 * gross one, tax already inside it, and the VAT row was a breakdown of the two
 * above it, worded "Includes". The operator's instruction reversed the
 * decomposition instead: the price of the goods and the shipping charge are
 * now the **net** figures — the same for every destination — and this row is
 * what the column needs added to reach the total. `content/shop.ts`'s
 * `vatLabel` says "VAT at …", not "Includes", and `src/lib/store-checkout.ts`
 * refuses a set of totals in which `goods + shipping + tax !== total`.
 *
 * It is **absent** for an order that attracts no VAT, not zero — the same
 * argument `src/lib/cart.ts` makes about formatted zeros. No EU VAT arises on
 * an export at all; a row of zero would state a zero-rating this shop does not
 * apply.
 *
 * ## One paragraph is below the button, deliberately
 *
 * The rule above is about **pre-contract** prose: a disclosure a buyer is
 * entitled to have read before pressing a button that binds them. The
 * confirmation promise — "You will receive a confirmation by email containing
 * the order, the total paid and these terms" — is not one. It is Article 8(7)
 * CRD, a statement about what happens **after** the contract is formed, and
 * nothing about it changes what pressing the button means. It renders below
 * the button, where it reads as the next thing that will happen rather than as
 * a condition of ordering, and it is the last element of the block. So the
 * button is not the final element on the page, and this file no longer claims
 * it is.
 *
 * ## There is no consent tick box, and that is the legal page's decision
 *
 * The consent line reads "**By placing the order** you confirm that you have
 * read and accept these terms and the privacy notice…". A tick box would
 * contradict the sentence a qualified reader wrote: it would make the
 * confirmation an act separate from placing the order. The line is rendered
 * immediately above the button instead, which is what it describes.
 *
 * ## The delivery address is user input, so empty is the state this builds
 *
 * Every field starts empty. There is no fixture of invented people, no stored
 * address, and no placeholder text imitating one. Validation is on submit,
 * per-field, tied to each input with `aria-describedby` and `aria-invalid`,
 * with an error summary that takes focus — the same pattern `ContactForm`
 * already uses on this site.
 *
 * ## The country is chosen, not typed, because the shipping charge is priced
 * from it
 *
 * Shipping is two operator-supplied flat rates on a zone axis: one for a
 * delivery address in an **EU member state** and a higher one for everywhere
 * else. "Member state" rather than "in the EU" is the rule the code implements
 * and the rule the data holds — Åland and the French outermost regions are
 * delivery addresses in the EU and are charged the higher rate, because
 * `euMember` in `storefront/mock/countries.json` is the 27 and nothing wider.
 * A rate driven from a free-text field would charge `Estonai`, `eesti` and
 * `EE` the non-EU rate, and overcharging an EU customer through a spelling
 * difference is a defect rather than an edge case. So the country field is a
 * `<select>` over
 * `storefront/mock/countries.json` — every country, because
 * `content/legal/shipping.ts` says we ship to every country — in the same
 * slot, with the same label and the same `autoComplete` token it had as an
 * `<input>`, which is the smallest composition change that makes the charge
 * honest. `zoneForCountryName` in `src/lib/cart.ts` is what turns the chosen
 * name into a rate, and it answers "no zone" rather than the dearer rate to
 * anything it does not recognise.
 *
 * Changing the country re-derives the charge and the total in the same render,
 * inside the `aria-live="polite"` disclosure list, so the six Article 8(2)
 * values are announced when they move.
 *
 * ## A basket we cannot supply is not priced, and the button says why
 *
 * When any line is out of stock the order cannot be placed, and it could not
 * be placed before this either — `orderMayBePlaced` has always refused it. What
 * the screen did anyway was **state a price and a total for it**: "The goods:
 * Lunar Base × 1", the price of those goods as a formatted zero, and a total
 * that was the shipping charge on its own. Article 8(2) CRD is a disclosure
 * obligation, so refusing
 * the placement does not repair a disclosure that is on the screen and false.
 *
 * `cartTotals` now answers `null` for the price of the goods and the total in
 * that state (`src/lib/cart.ts`), and this block renders the same kind of
 * instruction it already renders for the two figures that wait on a delivery
 * address. Nothing is stated about a basket we cannot sell.
 *
 * The button is not left silent either. It takes `aria-disabled` and is
 * described by a `role="status"` line directly beneath it saying what has to
 * happen first — the idiom every other blocked control in this unit uses, and
 * **not** the `disabled` attribute, which drops focus to the body when it
 * lands on a focused control. It is the only state in which the order button
 * takes `aria-disabled`: an incomplete address must still be pressable,
 * because pressing it is what produces the error summary a reader needs.
 *
 * ## The no-JavaScript order button cannot place an order, and says so
 *
 * Hydrated production checkout mounts Stripe's Payment Element only after
 * Medusa returns a session for the address-bound total currently displayed.
 * Before hydration, or with JavaScript disabled, the POST runs validation and
 * reports that nothing was charged and no order was placed. The alternative —
 * a fabricated confirmation — would tell a person a contract exists when none
 * does.
 *
 * That holds when nothing has hydrated, too. The form carries `method="post"`
 * and an `action`, so a press before hydration — or with JavaScript off —
 * sends the delivery address in a request body and gets the same answer back,
 * rather than putting name, street, postcode, town, country and email into the
 * URL. See `./checkout-order-post.ts`.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { checkout, unavailableFigure } from "../../../../content/shop.js";
import { destinationForCode, destinationForCountryName } from "../../lib/destination.js";
import { checkoutPriceQualification } from "../../lib/price-qualification.js";
import {
  cartTotals,
  catalogueLinesForDestination,
  declaredShippingMethod,
  deliveryCountries,
  formatAmount,
  isAvailable,
  orderMayBePlaced,
  zoneForCountryName,
} from "../../lib/cart.js";
import { useCart } from "../../lib/cart-store.js";
import { forgetMedusaCartId, storedMedusaCartId } from "../../lib/cart-store.js";
import { createMedusaStoreClient } from "../../lib/medusa-client.js";
import type { ClientRuntimeConfig } from "../../lib/client-runtime-config.js";
import {
  addGuestShippingMethod,
  currentAddressTotals,
  defaultShippingOptionId,
  isParcelMachineOption,
  prepareGuestShipping,
  shippingOptionFigure,
  VAT_ADDEND_PREFIX,
  type AddressBoundTotals,
  type GuestShippingOption,
} from "../../lib/store-checkout.js";
import {
  EMPTY_ADDRESS,
  FIELDS,
  guestAddress,
  isPhoneComplete,
  isPostalAddressComplete,
  phoneRequiredForCountryName,
  validate,
  type AddressValues,
} from "./checkout-address.js";
import {
  createSerialPaymentInitializer,
  completeStripeOrder,
  confirmAndCompleteStripeOrder,
  initiateStripePayment,
  type CompletedStoreOrder,
  type StripePaymentSession,
} from "../../lib/store-payment.js";
import {
  analyticsItemsFromCartLines,
  emitBeginCheckout,
  emitPaymentFailure,
  emitPurchase,
  onAnalyticsEnabled,
} from "../../lib/analytics.js";
import { placeMockOrder, type MockScenario, type OrderOutcome } from "../../lib/mock-cart-actions.js";
import { CallToActionLink } from "../mockups/CallToActionLink.js";
import { resolveLinkHref } from "../mockups/link-target.js";
import { HoneypotField } from "../turnstile/HoneypotField.js";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
import { ParcelMachinePicker } from "./ParcelMachinePicker.js";
import { PostPurchaseNewsletterForm } from "./PostPurchaseNewsletterForm.js";
import { useParcelMachineSelection } from "./useParcelMachineSelection.js";
import {
  StripePaymentElement,
  type StripePaymentElementHandle,
} from "./StripePaymentElement.js";
import { CHECKOUT_ORDER_POST_PATH } from "./checkout-order-post.js";
import {
  CARD_STATEMENT,
  CONFIRMATION_PROMISE,
  CONSENT_LINE,
  CONTRACT_FORMATION,
  DELIVERY_ESTIMATE,
  RETURN_POSTAGE,
} from "./checkout-terms.js";
import styles from "../../styles/pages/shop.module.css";

function browserRuntimeConfig(): ClientRuntimeConfig {
  const element = document.getElementById("plepic-runtime-config");
  if (element === null || element.textContent === null) {
    throw new Error("Store runtime configuration is unavailable");
  }
  return JSON.parse(element.textContent) as ClientRuntimeConfig;
}

export interface CheckoutPageContentProps {
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
  readonly stripePublishableKey?: string | null;
  /** The `?mock=` state this route was requested in — see `src/lib/mock-cart-actions.ts`. */
  readonly scenario: MockScenario | null;
  /**
   * True when this render follows a submission the browser made itself,
   * before hydration or with JavaScript off — see `./checkout-order-post.ts`.
   * The outcome is then in the first paint, with no script involved.
   */
  readonly unhydratedOrderAttempt?: boolean;
  /** Overridden to `0` by tests so the order attempt resolves without a timer. */
  readonly latencyMs?: number;
  /**
   * The address the form starts with. **A test seam, and the route never
   * passes it** — for a visitor every field starts empty, which is what
   * `tests/shop-pages.test.tsx` asserts of the served markup.
   *
   * It exists because `storefront/` has no DOM in its test environment, so a
   * test cannot type an address, and the *complete*-address state is where the
   * Article 8(2) invariant has to be checked: all six disclosures rendered as
   * values, with the shipping figure the chosen country's zone dictates. The
   * alternative was asserting that state nowhere.
   */
  readonly initialAddress?: AddressValues;
}

function initialOutcome(
  scenario: MockScenario | null,
  unhydratedOrderAttempt: boolean,
): OrderOutcome | null {
  if (scenario === "error") return { ok: false, reason: "order-failed" };
  if (unhydratedOrderAttempt) return { ok: false, reason: "payment-not-connected" };
  return null;
}

export function CheckoutPageContent({
  turnstileSiteKey,
  nonce,
  stripePublishableKey = null,
  scenario,
  unhydratedOrderAttempt = false,
  latencyMs,
  initialAddress = EMPTY_ADDRESS,
}: CheckoutPageContentProps) {
  const { lines, destinationCode } = useCart();
  const baseId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const paymentElementRef = useRef<StripePaymentElementHandle>(null);

  const [values, setValues] = useState<AddressValues>(initialAddress);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [placing, setPlacing] = useState(scenario === "placing");
  const [outcome, setOutcome] = useState<OrderOutcome | null>(() =>
    initialOutcome(scenario, unhydratedOrderAttempt),
  );
  const [shippingOptions, setShippingOptions] = useState<readonly GuestShippingOption[]>([]);
  /* The completed address these options belong to. It prevents an old-zone
     option being submitted during the debounce for a changed address. */
  const [shippingOptionsAddress, setShippingOptionsAddress] = useState<string | null>(null);
  const [selectedShippingOption, setSelectedShippingOption] = useState("");
  const [storeTotals, setStoreTotals] = useState<AddressBoundTotals | null>(null);
  const [shippingState, setShippingState] = useState<"idle" | "loading" | "error">("idle");
  const [paymentSession, setPaymentSession] = useState<
    { readonly revision: string; readonly value: StripePaymentSession } | null
  >(null);
  const [paymentState, setPaymentState] = useState<"idle" | "loading" | "error">("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [challengeRevision, setChallengeRevision] = useState(0);
  const [completedOrder, setCompletedOrder] = useState<CompletedStoreOrder | null>(null);
  const shippingRequest = useRef(0);
  const paymentRequest = useRef(0);
  const initializePayment = useRef(createSerialPaymentInitializer()).current;
  /*
   * True only while a real attempt is in flight, which is what the
   * double-submit guard actually means. `?mock=placing` *paints* the busy
   * state with nothing behind it to resolve it, so a guard on `placing` alone
   * swallowed every press and left the state unescapable without a reload.
   */
  const attemptInFlight = useRef(false);

  useEffect(() => {
    if (scenario !== null) return;
    const analyticsItems = analyticsItemsFromCartLines(lines);
    if (analyticsItems === null) return;
    const value = analyticsItems.reduce(
      (sum, item) => sum + item.unitAmount * (item.quantity ?? 1),
      0,
    );
    return onAnalyticsEnabled(() => emitBeginCheckout({
      currency: analyticsItems[0]!.currency,
      value,
      items: analyticsItems,
    }));
  }, [lines, scenario]);

  /*
   * The **postal** address alone — country, street, postcode, city, name,
   * email — with no regard to the phone. See `checkout-address.ts`'s doc
   * comment for the defect this split fixes: gating this on the phone too
   * (Task 8's mistake) blocked the delivery method `<select>` from ever
   * loading outside Estonia, Finland, Lithuania and Latvia, because the
   * phone has no bearing on which delivery methods exist or what they cost.
   */
  const addressComplete = isPostalAddressComplete(values);
  const addressRevision = addressComplete ? JSON.stringify(guestAddress(values)) : null;
  /*
   * The zone, and therefore the charge, is a function of the chosen country
   * and nothing else. It is withheld until the whole address is complete
   * because `content/legal/shipping.ts` promises the charge "once you have
   * entered a delivery address" — and an unrecognised country is no zone at
   * all rather than the dearer one.
   */
  const deliveryZone = addressComplete ? zoneForCountryName((values.country ?? "").trim()) : null;
  /*
   * The mock basket is priced when the provider mounts, for the destination set
   * on the site; the address entered here may be somewhere else. Re-pricing the
   * lines for the address is what stops the goods figure and the shipping
   * figure being quoted for two different places — which is what Medusa does on
   * the real path, for the same reason. See `catalogueLinesForDestination`.
   */
  const mockDestination =
    (addressComplete ? destinationForCountryName((values.country ?? "").trim()) : null) ??
    destinationForCode(destinationCode);
  const mockTotals = useMemo(
    () => cartTotals(catalogueLinesForDestination(lines, mockDestination), { deliveryZone }),
    [lines, deliveryZone, mockDestination],
  );
  const pendingStoreTotals = useMemo(
    () => ({
      ...cartTotals(lines, { deliveryZone: null }),
      shippingAmount: null,
      orderAmount: null,
      taxAmount: null,
      shippingTaxAmount: null,
    }),
    [lines],
  );
  const totals =
    scenario === null
      ? currentAddressTotals(storeTotals, addressRevision) ?? pendingStoreTotals
      : mockTotals;
  /*
   * **The qualification follows whatever priced the figures beside it**, and
   * the deciding is in `src/lib/price-qualification.ts` rather than here.
   *
   * It moved because it could not be defended here. This component mounts its
   * totals in effects and the storefront suite is Node-only, so the production
   * branch of that decision was unreachable from any test — a mutation
   * collapsing it to the mock layer's rule left the whole suite green while
   * making the block claim a delivery address's tax treatment over the
   * basket's figures. As a pure function over plain values, every state either
   * path can be in is driven directly in
   * `tests/price-qualification.test.ts`.
   */
  const qualification = checkoutPriceQualification(
    scenario === null
      ? {
          kind: "store",
          storeTotals,
          addressRevision,
          countryName: values.country ?? "",
          destinationCode,
        }
      : {
          kind: "mock",
          addressComplete,
          deliveryZone,
          countryName: values.country ?? "",
          destinationCode,
        },
  );
  const unavailable = lines.some((line) => !isAvailable(line));
  const blockedNoteId = `${baseId}-order-blocked`;
  /*
   * Field **names**, not `AddressFieldCopy` objects: `phone` is not one of
   * `FIELDS` (see this file's doc comment on `phoneRequiredForCountryName`),
   * but its error belongs in the same summary as every other field's, or a
   * reader who presses the order button with the phone field newly required
   * and empty would get no link to it at all.
   */
  const errorList = [...FIELDS.map((field) => field.name), "phone"].filter(
    (name) => errors[name] !== undefined,
  );
  /*
   * Whether the phone is *required* for the country currently typed in —
   * not whether the field is shown, which is unconditional now (see
   * `checkout-address.ts`'s doc comment, "The phone field is always shown,
   * and this is deliberate policy"). Read once here — rather than recomputed
   * at each of its call sites below — so the render and (via `errors`) the
   * validation that already ran can never see two different answers for the
   * same values. Drives only the input's HTML `required` attribute and the
   * hint text below; it does not gate rendering, and there is no longer a
   * reset effect that clears the field when a country stops requiring one —
   * the field is never hidden now, so a value a buyer typed voluntarily is
   * never silently discarded out from under them.
   */
  const phoneRequiredNow = phoneRequiredForCountryName(values.country ?? "");

  /*
   * The chosen delivery method. Read here rather than only inside the hook
   * below, because `selectShippingOption` needs it too — deriving it once,
   * from `selectedShippingOption`, is what keeps the method `<select>` and
   * the machine picker unable to disagree about which method is chosen.
   */
  const selectedShippingOptionRecord = shippingOptions.find(
    (option) => option.id === selectedShippingOption,
  );
  /*
   * The Omniva parcel machine method's second control — the fetched machine
   * list, the chosen zip, and `selectParcelMachine` — lives in this hook
   * rather than in this component. See `useParcelMachineSelection.ts`'s doc
   * comment for why. `addSelectedShippingMethod`, defined below, is the one
   * thing it does not own: both this component's `selectShippingOption` and
   * the hook's `selectParcelMachine` end in that same call.
   */
  const {
    selectedIsParcelMachine,
    parcelMachines,
    parcelMachineZip,
    parcelMachineState,
    selectParcelMachine,
    resetParcelMachineSelection,
  } = useParcelMachineSelection({
    selectedOption: selectedShippingOptionRecord,
    shippingOptionsAddress,
    addressRevision,
    countryName: values.country ?? "",
    attemptInFlight,
    shippingRequest,
    clearTotals: () => setStoreTotals(null),
    addMethod: addSelectedShippingMethod,
    // A factory, not a client: `createMedusaStoreClient` throws when
    // `window` is undefined, and this component still renders once on the
    // server for the initial HTML. See `useParcelMachineSelection.ts`'s doc
    // comment on `createClient` for the `/checkout` 500 this replaces.
    createClient: () => createMedusaStoreClient(browserRuntimeConfig().medusa),
  });
  const payableRevision =
    scenario === null &&
    addressRevision !== null &&
    selectedShippingOption !== "" &&
    totals.orderAmount !== null
      ? JSON.stringify({
          addressRevision,
          selectedShippingOption,
          amount: totals.orderAmount,
          currency: totals.currency,
        })
      : null;

  useEffect(() => {
    const request = ++shippingRequest.current;
    setShippingOptions([]);
    setShippingOptionsAddress(null);
    setSelectedShippingOption("");
    setStoreTotals(null);
    /*
     * A machine chosen for the address that just changed is a machine chosen
     * for an address that no longer exists. Reset here, synchronously, for
     * the same effect/event-gap reason the four resets above already are —
     * without it a buyer who backs out to a new country would keep a
     * previous country's zip selected underneath a picker that no longer
     * shows it. `resetParcelMachineSelection` is `useParcelMachineSelection`'s
     * own reset, stable across renders, so it is safe to call unconditionally
     * here without appearing in this effect's dependency list.
     */
    resetParcelMachineSelection();
    if (scenario !== null || !addressComplete) {
      setShippingState("idle");
      return;
    }
    const cartId = storedMedusaCartId();
    if (cartId === null) {
      setShippingState("idle");
      return;
    }
    let active = true;
    // Clear synchronously in this effect and tag results with the address
    // revision; the render-time equality below closes the effect/event gap.
    const timer = window.setTimeout(() => {
      setShippingState("loading");
      void prepareGuestShipping(
        createMedusaStoreClient(browserRuntimeConfig().medusa),
        cartId,
        guestAddress(values),
      ).then(
        (options) => {
          if (!active || request !== shippingRequest.current || addressRevision !== JSON.stringify(guestAddress(values))) return;
          setShippingOptions(options);
          setShippingOptionsAddress(addressRevision);
          /*
           * Operator instruction, 2026-08-29: EE/LV/LT starts on the Omniva
           * parcel machine method; every other address starts unchosen, as
           * it always has. `defaultShippingOptionId` decides which — see its
           * doc comment in `src/lib/store-checkout.ts` — and this is its one
           * call site, reached exactly once per address each time a fetch
           * for that address actually settles. It does not call
           * `addSelectedShippingMethod`: a machine has not been chosen, so
           * nothing is added to the cart yet, exactly as picking the method
           * by hand with no zip already does not (see `selectShippingOption`
           * below).
           */
          setSelectedShippingOption(defaultShippingOptionId(options));
          setShippingState("idle");
        },
        () => {
          if (!active || request !== shippingRequest.current) return;
          setShippingOptions([]);
          setShippingOptionsAddress(null);
          setSelectedShippingOption("");
          setShippingState("error");
        },
      );
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [addressComplete, addressRevision, scenario, values]);

  useEffect(() => {
    const request = ++paymentRequest.current;
    setPaymentSession(null);
    setPaymentError(null);
    if (payableRevision === null || totals.orderAmount === null) {
      setPaymentState("idle");
      return;
    }
    const cartId = storedMedusaCartId();
    if (cartId === null) {
      setPaymentState("error");
      return;
    }
    let active = true;
    setPaymentState("loading");
    void initializePayment(async () => {
      if (!active || request !== paymentRequest.current) return null;
      return initiateStripePayment(createMedusaStoreClient(browserRuntimeConfig().medusa), cartId, {
        amount: totals.orderAmount!,
        currency: totals.currency,
      });
    }).then(
      (value) => {
        if (value === null || !active || request !== paymentRequest.current) return;
        setPaymentSession({ revision: payableRevision, value });
        setPaymentState("idle");
      },
      () => {
        if (!active || request !== paymentRequest.current) return;
        setPaymentState("error");
      },
    );
    return () => {
      active = false;
    };
  }, [initializePayment, payableRevision, totals.currency, totals.orderAmount]);

  function selectShippingOption(optionId: string): void {
    // This is intentionally a runtime guard as well as a disabled control:
    // a stale event must not attach the previous address's delivery method.
    if (
      attemptInFlight.current ||
      shippingOptionsAddress !== addressRevision ||
      addressRevision === null
    ) return;
    // Invalidates a response already in flight for the previous selection,
    // even in the branch below that issues no new request of its own.
    ++shippingRequest.current;
    const chosen = shippingOptions.find((option) => option.id === optionId);
    /*
     * Choosing the Omniva parcel machine method with no machine chosen yet
     * must not call the Store API — `addGuestShippingMethod` refuses to add
     * a method with nowhere to collect the parcel from, and failing on a
     * choice that is not wrong yet, only incomplete, is the wrong response
     * to it. The selection is recorded and the method waits; `<select>`'s
     * `selectedIsParcelMachine` render below is what makes the machine
     * picker appear, and `selectParcelMachine` is what actually adds the
     * method, once a zip exists for it to carry.
     */
    if (chosen !== undefined && isParcelMachineOption(chosen) && parcelMachineZip === "") {
      setSelectedShippingOption(optionId);
      setStoreTotals(null);
      return;
    }
    setSelectedShippingOption(optionId);
    setStoreTotals(null);
    if (optionId === "") return;
    if (chosen === undefined) {
      setShippingState("error");
      return;
    }
    addSelectedShippingMethod(chosen, isParcelMachineOption(chosen) ? parcelMachineZip : undefined);
  }

  /**
   * The Store API call both `selectShippingOption` above and
   * `useParcelMachineSelection`'s `selectParcelMachine` end in: add exactly
   * the chosen method, carrying a parcel machine zip when there is one to
   * carry.
   *
   * Factored out because the two are different decisions about *whether* to
   * add a method — one over the method itself, one over the machine a method
   * it already carries needs — that converge on the same request once the
   * decision is "yes". Keeping the request in one place is what keeps the
   * shown-versus-charged guard inside `addGuestShippingMethod` wired to a
   * single call site instead of two that could drift. It stays in this
   * component rather than moving into the hook alongside
   * `selectParcelMachine`, because `selectShippingOption` needs it too, and a
   * function two callers share belongs where both can reach it without one
   * importing the other.
   */
  function addSelectedShippingMethod(chosen: GuestShippingOption, zip: string | undefined): void {
    const selectedAddressRevision = addressRevision;
    const cartId = storedMedusaCartId();
    if (selectedAddressRevision === null || cartId === null) {
      setShippingState("error");
      return;
    }
    const request = ++shippingRequest.current;
    setShippingState("loading");
    /*
     * `addGuestShippingMethod` takes the whole option, not its id, because it
     * carries the guard: the figure this `<select>` just showed for it has to
     * be the figure Medusa then charged, or nothing is rendered and the order
     * stays unplaceable. That refusal arrives here as a rejected promise and
     * lands in the `error` state below, which is the state that shows no
     * total.
     */
    void addGuestShippingMethod(
      createMedusaStoreClient(browserRuntimeConfig().medusa),
      cartId,
      chosen,
      deliveryZone === "europeanUnion",
      zip,
    ).then(
      (nextTotals) => {
        if (request !== shippingRequest.current) return;
        setStoreTotals({ addressRevision: selectedAddressRevision, totals: nextTotals });
        setShippingState("idle");
      },
      () => {
        if (request === shippingRequest.current) setShippingState("error");
      },
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const turnstileToken = new FormData(event.currentTarget).get("cf-turnstile-response");
    if (attemptInFlight.current) return;
    // Leaves a painted `?mock=placing` rather than being swallowed by it. In
    // every other case this is already `false`, because a real attempt in
    // flight returned above.
    setPlacing(false);

    const nextErrors = validate(values);
    setErrors(nextErrors);
    setOutcome(null);

    if (Object.keys(nextErrors).length > 0) {
      // Focus the summary rather than the first field: a keyboard or screen
      // reader user gets the whole list and can choose, which is what SC 3.3.1
      // is for. The summary's own links move focus to each field.
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    /*
     * THE ARTICLE 8(2) INVARIANT. No order placement succeeds in any state
     * where all six Article 8(2) values are not displayed as values — see
     * `orderMayBePlaced` in `src/lib/cart.ts`, which is where it is stated and
     * where a test drives it. It subsumes the empty-basket and unavailable-line
     * refusals this line used to make, and adds the one they were missing: a
     * complete-looking address whose country yields no zone leaves the shipping
     * charge and the total unshown, and nobody may be bound by a screen that
     * has not shown them the total.
     *
     * `parcelMachineNeedsZip` is the seventh: the Omniva parcel machine method
     * selected with no machine chosen carries every one of the six values —
     * the method's own charge included, since it is priced at zero and Free
     * is a value — and would otherwise be placeable with no collectable
     * destination.
     *
     * `phoneIncomplete` is the eighth, added fixing the Task 8 regression:
     * `addressComplete` above is postal-only now, so it is this flag, not
     * that one, that keeps an order unplaceable while OMX needs a phone
     * number for the chosen country and none valid has been given —
     * `nextErrors` just refused the same submission on the same ground, so by
     * the time this runs `isPhoneComplete(values)` is already true whenever
     * it matters; this is the belt this codebase's other invariants wear
     * beside their braces (see `assertedCartTotals`'s doc comment in
     * `src/lib/store-checkout.ts` for the same kind of redundant check kept
     * on purpose), so the refusal survives even if a future edit removes the
     * earlier one.
     */
    if (
      !orderMayBePlaced({
        lines,
        addressComplete,
        totals,
        parcelMachineNeedsZip: selectedIsParcelMachine && parcelMachineZip === "",
        phoneIncomplete: !isPhoneComplete(values),
      })
    ) return;
    if (
      typeof turnstileToken !== "string" ||
      turnstileToken.trim().length === 0 ||
      turnstileToken.trim().length > 4096
    ) {
      setPaymentError("Complete the verification challenge before placing the order.");
      return;
    }

    attemptInFlight.current = true;
    setPlacing(true);
    if (scenario !== null) {
      void placeMockOrder({ latencyMs, failing: scenario === "error" }).then((result) => {
        attemptInFlight.current = false;
        setPlacing(false);
        setOutcome(result);
        window.requestAnimationFrame(() => outcomeRef.current?.focus());
      });
      return;
    }

    const cartId = storedMedusaCartId();
    const session = paymentSession;
    const analyticsItems = analyticsItemsFromCartLines(lines);
    if (
      cartId === null ||
      payableRevision === null ||
      session?.revision !== payableRevision ||
      paymentElementRef.current === null
    ) {
      attemptInFlight.current = false;
      setPlacing(false);
      setPaymentError("Payment options are not ready. Wait a moment and try again.");
      return;
    }
    setPaymentError(null);
    void confirmAndCompleteStripeOrder(
      () => paymentElementRef.current!.confirm(),
      () => completeStripeOrder(
        createMedusaStoreClient(browserRuntimeConfig().medusa),
        cartId,
        turnstileToken,
      ),
      (stage) => {
        if (totals.orderAmount === null) return;
        emitPaymentFailure({
          failureStage: stage,
          currency: totals.currency,
          value: totals.orderAmount,
        });
      },
    ).then(
      (order) => {
        if (analyticsItems !== null && totals.orderAmount !== null) {
          emitPurchase({
            transactionId: order.orderId,
            currency: totals.currency,
            value: totals.orderAmount,
            items: analyticsItems,
          });
        }
        forgetMedusaCartId();
        setCompletedOrder(order);
        attemptInFlight.current = false;
        setPlacing(false);
      },
      (error: unknown) => {
        attemptInFlight.current = false;
        setPlacing(false);
        setPaymentError(
          error instanceof Error
            ? error.message
            : "Payment could not be completed. Nothing has been charged.",
        );
        setChallengeRevision((value) => value + 1);
        window.requestAnimationFrame(() => outcomeRef.current?.focus());
      },
    );
  }

  const outcomeMessage =
    outcome === null
      ? null
      : outcome.reason === "order-failed"
        ? checkout.errors.orderFailed
        : checkout.errors.paymentNotConnected;

  if (completedOrder !== null) {
    return (
      <section className={styles.card} aria-labelledby="checkout-confirmation-heading">
        <h1 id="checkout-confirmation-heading" className={styles.heading}>
          Order confirmed
        </h1>
        <p className={styles.body}>
          Your order number is {String(completedOrder.displayId)}. A confirmation will be sent by
          email.
        </p>
        <PostPurchaseNewsletterForm
          defaultEmail={values.email ?? ""}
          turnstileSiteKey={turnstileSiteKey}
          nonce={nonce}
        />
      </section>
    );
  }

  if (lines.length === 0) {
    return (
      <>
        <div className={styles.intro}>
          <h1 className={styles.heading}>{checkout.heading}</h1>
          {/* The empty basket keeps its lede on `/cart`; this dropped its own,
              which was the only inconsistency between the two empty states. */}
          <p className={styles.lede}>{checkout.lede}</p>
        </div>

        {/* An unhydrated submission lands here: without JavaScript there is no
            restored basket, so the answer has to be legible on the empty
            checkout as well, or it would look like the order went through. */}
        <div className={styles.alertAnchor} role="alert">
          {outcomeMessage === null ? null : (
            <p className={styles.error} ref={outcomeRef} tabIndex={-1}>
              {outcomeMessage}
            </p>
          )}
        </div>

        <section className={styles.card} aria-labelledby="checkout-empty-heading">
          <h2 id="checkout-empty-heading" className={styles.sectionHeading}>
            {checkout.empty.heading}
          </h2>
          <p className={styles.body}>{checkout.empty.body}</p>
          <div className={styles.actions}>
            <CallToActionLink action={checkout.empty.link} />
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <div className={styles.intro}>
        <h1 className={styles.heading}>{checkout.heading}</h1>
        <p className={styles.lede}>{checkout.lede}</p>
      </div>

      {/* Always in the document, so anything put into it is announced rather
          than merely appearing. `display: contents`, so an empty one costs no
          box and no gap. */}
      <div className={styles.alertAnchor} role="alert">
        {errorList.length > 0 ? (
          <div className={styles.error} ref={errorSummaryRef} tabIndex={-1}>
            <h2 className={styles.errorHeading}>{checkout.errors.heading}</h2>
            <ul>
              {errorList.map((name) => (
                <li key={name}>
                  <a href={`#${baseId}-${name}`}>{errors[name]}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {outcomeMessage === null ? null : (
          <p className={styles.error} ref={outcomeRef} tabIndex={-1}>
            {outcomeMessage}
          </p>
        )}
        {unavailable ? <p className={styles.error}>{checkout.errors.unavailableLine}</p> : null}
      </div>

      {/* `method` and `action` are load-bearing, not decoration: without them a
          press before hydration is a GET that puts the delivery address in the
          URL. See `./checkout-order-post.ts`. `handleSubmit` calls
          `preventDefault()` first, so a hydrated page never navigates. */}
      <form
        className={styles.checkoutForm}
        method="post"
        action={CHECKOUT_ORDER_POST_PATH}
        onSubmit={handleSubmit}
        noValidate
      >
        <section className={styles.card} aria-labelledby="checkout-address-heading">
          <h2 id="checkout-address-heading" className={styles.sectionHeading}>
            {checkout.address.heading}
          </h2>
          <p className={styles.body}>{checkout.address.body}</p>

          <div className={styles.fields}>
            {FIELDS.map((field) => {
              const fieldId = `${baseId}-${field.name}`;
              const errorId = `${fieldId}-error`;
              const hintId = `${fieldId}-hint`;
              const error = errors[field.name];
              const describedBy = [
                field.hint === undefined ? null : hintId,
                error === undefined ? null : errorId,
              ]
                .filter((id): id is string => id !== null)
                .join(" ");

              /** Everything an `<input>` and a `<select>` need identically. */
              const shared = {
                id: fieldId,
                name: field.name,
                required: true,
                autoComplete: field.autoComplete,
                value: values[field.name] ?? "",
                disabled: placing,
                "aria-invalid": error !== undefined,
                "aria-describedby": describedBy === "" ? undefined : describedBy,
                onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
                  if (attemptInFlight.current) return;
                  const next = event.currentTarget.value;
                  setValues((current) => ({ ...current, [field.name]: next }));
                },
              };

              return (
                <div className={styles.fieldGroup} key={field.name}>
                  <label className={styles.fieldLabel} htmlFor={fieldId}>
                    {field.label}
                  </label>
                  {field.hint === undefined ? null : (
                    <p id={hintId} className={styles.fieldHint}>
                      {field.hint}
                    </p>
                  )}
                  {/* One control swapped for another, because the charge is
                      priced from this answer — see the file's doc comment. The
                      identity, the name, the `autoComplete` token, the
                      required-ness and the whole error wiring are the *same
                      object* for both, so the two branches cannot drift apart
                      into one control that announces itself and one that does
                      not. */}
                  {field.control === "country" ? (
                    <select {...shared} className={`${styles.field} ${styles.select}`}>
                      {/* Nobody is defaulted into a country, and so nobody is
                          defaulted into a shipping rate. */}
                      <option value="">{checkout.address.countryUnchosen}</option>
                      {deliveryCountries.map((country) => (
                        <option key={country.code} value={country.name}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input {...shared} className={styles.field} type={field.type} />
                  )}
                  {error === undefined ? null : (
                    <p id={errorId} className={styles.fieldError}>
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
            {/* Not one of `FIELDS`, and — since 2026-08-29 — shown for every
                destination rather than only outside Estonia, Finland,
                Lithuania and Latvia. See `checkout-address.ts`'s doc comment
                ("The phone field is always shown, and this is deliberate
                policy") for why: a buyer choosing an Omniva parcel machine
                needs the chance to volunteer a number even though OMX does
                not strictly require one there. `required` still follows
                `phoneRequiredNow`, so the browser's own validation UI and
                assistive tech both still say "optional" inside those four
                countries and "required" everywhere else — only *presence* is
                relaxed, never the field's existence on screen. */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor={`${baseId}-phone`}>
                {checkout.address.phone.label}
              </label>
              <p id={`${baseId}-phone-hint`} className={styles.fieldHint}>
                {checkout.address.phone.hint}
              </p>
              <input
                id={`${baseId}-phone`}
                name="phone"
                type="tel"
                required={phoneRequiredNow}
                autoComplete={checkout.address.phone.autoComplete}
                value={values.phone ?? ""}
                disabled={placing}
                aria-invalid={errors.phone !== undefined}
                aria-describedby={[
                  `${baseId}-phone-hint`,
                  errors.phone === undefined ? null : `${baseId}-phone-error`,
                ]
                  .filter((id): id is string => id !== null)
                  .join(" ")}
                onChange={(event) => {
                  if (attemptInFlight.current) return;
                  const next = event.currentTarget.value;
                  setValues((current) => ({ ...current, phone: next }));
                }}
                className={styles.field}
              />
              {errors.phone === undefined ? null : (
                <p id={`${baseId}-phone-error`} className={styles.fieldError}>
                  {errors.phone}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="checkout-delivery-heading">
          <h2 id="checkout-delivery-heading" className={styles.sectionHeading}>
            {checkout.delivery.heading}
          </h2>
          <dl className={styles.summary}>
            <div className={styles.summaryRow}>
              <dt>{checkout.delivery.methodLabel}</dt>
              <dd>
                {scenario === null ? (
                  <>
                    <select
                      className={`${styles.field} ${styles.select}`}
                      aria-label={checkout.delivery.methodLabel}
                      value={selectedShippingOption}
                      disabled={
                        shippingState === "loading" ||
                        placing ||
                        shippingOptions.length === 0 ||
                        shippingOptionsAddress !== addressRevision
                      }
                      onChange={(event) => selectShippingOption(event.currentTarget.value)}
                    >
                      <option value="">Choose a delivery method</option>
                      {/* Never a bare `option.amount`. That is the net rate, and
                          rendering it unmarked beside a summary charging the
                          gross one is two prices for one delivery — see
                          `shippingOptionFigure`. */}
                      {shippingOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name} — {shippingOptionFigure(option, deliveryZone === "europeanUnion").label}
                        </option>
                      ))}
                    </select>
                    {/* The second control the Omniva parcel machine method
                        needs: a specific machine. Beneath the method select,
                        inside the same row, so the two read as one choice
                        made in two steps rather than two separate rows. */}
                    {selectedIsParcelMachine ? (
                      <ParcelMachinePicker
                        label={checkout.delivery.parcelMachineLabel}
                        prompt={checkout.delivery.parcelMachinePrompt}
                        machines={parcelMachines}
                        value={parcelMachineZip}
                        loading={
                          parcelMachineState === "loading"
                            ? checkout.delivery.parcelMachineLoading
                            : null
                        }
                        errorMessage={
                          parcelMachineState === "error"
                            ? checkout.delivery.parcelMachineUnavailable
                            : null
                        }
                        disabled={shippingState === "loading" || placing || parcelMachineState === "loading"}
                        onChange={selectParcelMachine}
                      />
                    ) : null}
                  </>
                ) : declaredShippingMethod.name}
              </dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>{checkout.delivery.chargeLabel}</dt>
              <dd>
                {totals.shippingAmount === null
                  ? checkout.delivery.chargePending
                  : formatAmount(totals.shippingAmount, totals.currency)}
              </dd>
            </div>
            <div className={`${styles.summaryRow} ${styles.summaryProse}`}>
              <dt>{checkout.delivery.estimateLabel}</dt>
              <dd>{DELIVERY_ESTIMATE}</dd>
            </div>
          </dl>
          {scenario === null && shippingState === "loading" ? (
            <p className={styles.note} role="status">Updating delivery options…</p>
          ) : null}
          {scenario === null && shippingState === "error" ? (
            <p className={styles.error} role="alert">Delivery options could not be loaded. Check the address and try again.</p>
          ) : null}
        </section>

        <section className={styles.card} aria-labelledby="checkout-payment-heading">
          <h2 id="checkout-payment-heading" className={styles.sectionHeading}>
            {checkout.payment.heading}
          </h2>
          <p className={styles.body}>{CARD_STATEMENT}</p>
          <div
            className={styles.cardPlaceholder}
            role="group"
            aria-label={checkout.payment.cardRegionLabel}
          >
            <p className={styles.cardPlaceholderLabel}>{checkout.payment.cardRegionLabel}</p>
            {scenario === null ? (
              <StripePaymentElement
                ref={paymentElementRef}
                publishableKey={stripePublishableKey}
                clientSecret={
                  paymentSession?.revision === payableRevision
                    ? paymentSession.value.clientSecret
                    : null
                }
              />
            ) : (
              <p className={styles.note}>{checkout.payment.cardRegionBody}</p>
            )}
            {paymentState === "loading" ? <p role="status">Loading payment options…</p> : null}
            {paymentState === "error" ? (
              <p className={styles.error} role="alert">Payment options could not be loaded.</p>
            ) : null}
            {paymentError === null ? null : (
              <p className={styles.error} role="alert" ref={outcomeRef} tabIndex={-1}>
                {paymentError}
              </p>
            )}
          </div>

          <HoneypotField formName="checkout" />
          <div className={styles.turnstile}>
            <TurnstileWidget siteKey={turnstileSiteKey} nonce={nonce} formName="checkout" resetKey={challengeRevision} />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="checkout-before-heading">
          <h2 id="checkout-before-heading" className={styles.sectionHeading}>
            {checkout.beforeYouOrder.heading}
          </h2>
          <p className={styles.body}>{CONTRACT_FORMATION}</p>

          <h3 className={styles.subHeading}>{checkout.beforeYouOrder.returnPostageLabel}</h3>
          <p className={styles.body}>{RETURN_POSTAGE}</p>

          <h3 className={styles.subHeading}>{checkout.beforeYouOrder.withdrawalLabel}</h3>
          <p className={styles.body}>{checkout.beforeYouOrder.withdrawalBody}</p>
          <ul className={styles.linkList}>
            {checkout.beforeYouOrder.links.map((link) => (
              <li key={link.label}>
                <a href={resolveLinkHref(link.target)}>{link.label}</a>
              </li>
            ))}
          </ul>
        </section>

        {/* Article 8(2): the six disclosures, the catalogue's qualification of
            the two figures in them, the consent line, the button — and then
            the Article 8(7) confirmation promise, which is post-contract. See
            this file's doc comment for why each of those is where it is. */}
        <section className={styles.orderCard} aria-labelledby="checkout-order-heading">
          <h2 id="checkout-order-heading" className={styles.sectionHeading}>
            {checkout.order.heading}
          </h2>

          <dl className={styles.summary} aria-live="polite">
            <div className={styles.summaryRow}>
              <dt>{checkout.order.goodsLabel}</dt>
              <dd>
                {lines
                  .map((line) => `${line.productName} × ${String(line.quantity)}`)
                  .join(", ")}
              </dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>{checkout.order.goodsPriceLabel}</dt>
              {/* No figure at all while a line cannot be supplied — see this
                  file's doc comment. A formatted zero is a statement about a price
                  rather than the absence of one, and it described a basket
                  other than the one listed directly above it. */}
              <dd>
                {totals.goodsAmount === null
                  ? unavailableFigure
                  : formatAmount(totals.goodsAmount, totals.currency)}
              </dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>{checkout.order.shippingLabel}</dt>
              <dd>
                {totals.shippingAmount === null
                  ? checkout.delivery.chargePending
                  : formatAmount(totals.shippingAmount, totals.currency)}
              </dd>
            </div>
            {/* The seventh value, and an **addend to the two net rows above
                it**, since 2026-08-29 — see `content/shop.ts`'s `vatLabel` and
                the refusal in `src/lib/store-checkout.ts` that makes
                `goods + shipping + tax === total` hold. The "+" prefix is the
                same mark `shippingOptionFigure`'s "+ VAT" suffix already uses
                for a net figure awaiting tax, read here as "add this".

                Absent, not zero, when no VAT arises. `null` is "nobody has
                been asked" (the mock layer, and the pre-address state); `0` is
                Medusa's answer for a destination outside the EU. Neither is a
                row: a formatted zero here would state a zero-rating this shop
                does not apply, which is the same argument `src/lib/cart.ts`
                makes about a price of nothing. */}
            {totals.taxAmount !== null && totals.taxAmount > 0 ? (
              <div className={styles.summaryRow}>
                <dt>{qualification.vatLabel}</dt>
                <dd>{VAT_ADDEND_PREFIX}{formatAmount(totals.taxAmount, totals.currency)}</dd>
              </div>
            ) : null}
            <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
              <dt>{checkout.order.totalLabel}</dt>
              {/* Two different reasons there is no total, and they are not the
                  same sentence: an address that is not finished yet, and a
                  basket that cannot be sold. The second is the one a reader
                  cannot resolve on this screen, so it wins when both hold. */}
              <dd>
                {totals.orderAmount !== null
                  ? formatAmount(totals.orderAmount, totals.currency)
                  : totals.goodsAmount === null
                    ? unavailableFigure
                    : checkout.order.totalPending}
              </dd>
            </div>
            <div className={`${styles.summaryRow} ${styles.summaryProse}`}>
              <dt>{checkout.order.addressLabel}</dt>
              <dd>
                {/* The postal address only. `FIELDS.map(...)` over the whole
                    set concatenated the email address into the value Article
                    8(2) names as "the delivery address"; `inDeliveryAddress`
                    in `content/shop.ts` is what separates them. */}
                {addressComplete
                  ? FIELDS.filter((field) => field.inDeliveryAddress)
                      .map((field) => values[field.name])
                      .join(", ")
                  : checkout.address.missingValue}
              </dd>
            </div>
            <div className={`${styles.summaryRow} ${styles.summaryProse}`}>
              <dt>{checkout.order.estimateLabel}</dt>
              <dd>{DELIVERY_ESTIMATE}</dd>
            </div>
          </dl>

          <p className={styles.note}>{qualification.text}</p>

          <p className={styles.consentLine}>{CONSENT_LINE}</p>

          {/* `aria-disabled`, never `disabled`: the attribute lands on a
              control a keyboard user may be standing on, and `disabled` would
              drop their focus to the body — the same reason every basket
              control gives. The handler refuses the press; this is what tells
              assistive technology so, and `aria-describedby` makes the reason
              part of the button's own announcement rather than something a
              reader has to go and find. An incomplete address is deliberately
              *not* in this condition: that press has work to do. */}
          <button
            type="submit"
            className={styles.orderButton}
            aria-busy={placing}
            aria-disabled={unavailable}
            aria-describedby={unavailable ? blockedNoteId : undefined}
          >
            {placing ? checkout.placingLabel : checkout.orderButtonLabel}
          </button>

          {/* Below the button rather than above it: the consent line is
              "immediately above the control it describes" and nothing may be
              interposed there. It is a `role="status"` so a reader who arrives
              at the button by keyboard is told why it will not act, instead of
              relying on the page-top alert some 4,000 pixels above. */}
          {unavailable ? (
            <p id={blockedNoteId} className={styles.pending} role="status">
              {checkout.errors.unavailableLine}
            </p>
          ) : null}

          <p className={styles.note}>{CONFIRMATION_PROMISE}</p>
        </section>
      </form>
    </>
  );
}
