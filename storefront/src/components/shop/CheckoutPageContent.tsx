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
 * > "The final button on the checkout page is labelled to say that pressing it
 * > places an order with an obligation to pay. Immediately above it you see,
 * > on one screen: the goods, the price of the goods, the shipping charge, the
 * > total, the delivery address and the delivery estimate."
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
 * there. The **price qualification** ("VAT included where applicable. Shipping
 * calculated at checkout. Non-EU taxes and duties, if any, are not included.")
 * is the catalogue's own qualifier on the two figures directly above it, which
 * is where a qualification has to be to qualify anything;
 * `tests/shop-pages.test.tsx` pins the set of what may appear here to exactly
 * that sentence, so a third thing cannot arrive unnoticed. The **consent
 * line** is next, immediately above the control it describes.
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
 * ## The order button cannot place an order in this build, and says so
 *
 * Stripe elements and server-side Turnstile verification are deferred. The
 * card step is a labelled placeholder region and nothing else — no card field,
 * no fake card number, not even a disabled one. Pressing the order button runs
 * the real validation, then reports that nothing was charged and no order was
 * placed, because that is true. The alternative — a fabricated confirmation —
 * would tell a person a contract exists when none does.
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
import type { AddressFieldCopy } from "../../../../content/shop.js";
import { resolveCatalogue } from "../../lib/catalogue.js";
import {
  cartTotals,
  declaredShippingMethod,
  deliveryCountries,
  formatAmount,
  isAvailable,
  orderMayBePlaced,
  zoneForCountryName,
} from "../../lib/cart.js";
import { useCart } from "../../lib/cart-store.js";
import { storedMedusaCartId } from "../../lib/cart-store.js";
import { createMedusaStoreClient } from "../../lib/medusa-client.js";
import type { ClientRuntimeConfig } from "../../lib/client-runtime-config.js";
import {
  addGuestShippingMethod,
  prepareGuestShipping,
  type GuestShippingOption,
} from "../../lib/store-checkout.js";
import { placeMockOrder, type MockScenario, type OrderOutcome } from "../../lib/mock-cart-actions.js";
import { CallToActionLink } from "../mockups/CallToActionLink.js";
import { resolveLinkHref } from "../mockups/link-target.js";
import { HoneypotField } from "../turnstile/HoneypotField.js";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
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

const FIELDS: readonly AddressFieldCopy[] = checkout.address.fields;

type AddressValues = Readonly<Record<string, string>>;

const EMPTY_ADDRESS: AddressValues = Object.fromEntries(FIELDS.map((field) => [field.name, ""]));

function browserRuntimeConfig(): ClientRuntimeConfig {
  const element = document.getElementById("plepic-runtime-config");
  if (element === null || element.textContent === null) {
    throw new Error("Store runtime configuration is unavailable");
  }
  return JSON.parse(element.textContent) as ClientRuntimeConfig;
}

function guestAddress(values: AddressValues) {
  return {
    fullName: values.fullName ?? "",
    streetAddress: values.streetAddress ?? "",
    postalCode: values.postalCode ?? "",
    city: values.city ?? "",
    country: values.country ?? "",
    email: values.email ?? "",
  };
}

/** Deliberately permissive: enough to catch a typo, never enough to reject a real address. */
function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validate(values: AddressValues): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};

  for (const field of FIELDS) {
    const value = (values[field.name] ?? "").trim();
    if (value.length === 0) {
      // "Enter country" is an instruction nobody can follow in front of a
      // dropdown, so a chosen field asks to be chosen.
      const prefix =
        field.control === "country"
          ? checkout.errors.missingSelectionPrefix
          : checkout.errors.missingFieldPrefix;
      errors[field.name] = `${prefix}${field.label.toLowerCase()}.`;
      continue;
    }
    if (field.type === "email" && !isPlausibleEmail(value)) {
      errors[field.name] = checkout.errors.invalidEmail;
    }
  }

  return errors;
}

function isComplete(values: AddressValues): boolean {
  return Object.keys(validate(values)).length === 0;
}

export interface CheckoutPageContentProps {
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
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
  scenario,
  unhydratedOrderAttempt = false,
  latencyMs,
  initialAddress = EMPTY_ADDRESS,
}: CheckoutPageContentProps) {
  const catalogue = resolveCatalogue();
  const { lines } = useCart();
  const baseId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLParagraphElement>(null);

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
  const [storeTotals, setStoreTotals] = useState<ReturnType<typeof cartTotals> | null>(null);
  const [shippingState, setShippingState] = useState<"idle" | "loading" | "error">("idle");
  const shippingRequest = useRef(0);
  /*
   * True only while a real attempt is in flight, which is what the
   * double-submit guard actually means. `?mock=placing` *paints* the busy
   * state with nothing behind it to resolve it, so a guard on `placing` alone
   * swallowed every press and left the state unescapable without a reload.
   */
  const attemptInFlight = useRef(false);

  const addressComplete = isComplete(values);
  const addressRevision = addressComplete ? JSON.stringify(guestAddress(values)) : null;
  /*
   * The zone, and therefore the charge, is a function of the chosen country
   * and nothing else. It is withheld until the whole address is complete
   * because `content/legal/shipping.ts` promises the charge "once you have
   * entered a delivery address" — and an unrecognised country is no zone at
   * all rather than the dearer one.
   */
  const deliveryZone = addressComplete ? zoneForCountryName((values.country ?? "").trim()) : null;
  const mockTotals = useMemo(() => cartTotals(lines, { deliveryZone }), [lines, deliveryZone]);
  const pendingStoreTotals = useMemo(
    () => ({ ...cartTotals(lines, { deliveryZone: null }), shippingAmount: null, orderAmount: null }),
    [lines],
  );
  const totals = scenario === null ? storeTotals ?? pendingStoreTotals : mockTotals;
  const unavailable = lines.some((line) => !isAvailable(line));
  const blockedNoteId = `${baseId}-order-blocked`;
  const errorList = FIELDS.filter((field) => errors[field.name] !== undefined);

  useEffect(() => {
    const request = ++shippingRequest.current;
    setShippingOptions([]);
    setShippingOptionsAddress(null);
    setSelectedShippingOption("");
    setStoreTotals(null);
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
          setSelectedShippingOption("");
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

  function selectShippingOption(optionId: string): void {
    // This is intentionally a runtime guard as well as a disabled control:
    // a stale event must not attach the previous address's delivery method.
    if (shippingOptionsAddress !== addressRevision) return;
    const request = ++shippingRequest.current;
    setSelectedShippingOption(optionId);
    setStoreTotals(null);
    if (optionId === "") return;
    const cartId = storedMedusaCartId();
    if (cartId === null) {
      setShippingState("error");
      return;
    }
    setShippingState("loading");
    void addGuestShippingMethod(
      createMedusaStoreClient(browserRuntimeConfig().medusa),
      cartId,
      optionId,
    ).then(
      (nextTotals) => {
        if (request !== shippingRequest.current) return;
        setStoreTotals(nextTotals);
        setShippingState("idle");
      },
      () => {
        if (request === shippingRequest.current) setShippingState("error");
      },
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
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
     */
    if (!orderMayBePlaced({ lines, addressComplete, totals })) return;

    attemptInFlight.current = true;
    setPlacing(true);
    void placeMockOrder({ latencyMs, failing: scenario === "error" }).then((result) => {
      attemptInFlight.current = false;
      setPlacing(false);
      setOutcome(result);
      window.requestAnimationFrame(() => outcomeRef.current?.focus());
    });
  }

  const outcomeMessage =
    outcome === null
      ? null
      : outcome.reason === "order-failed"
        ? checkout.errors.orderFailed
        : checkout.errors.paymentNotConnected;

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
              {errorList.map((field) => (
                <li key={field.name}>
                  <a href={`#${baseId}-${field.name}`}>{errors[field.name]}</a>
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
                "aria-invalid": error !== undefined,
                "aria-describedby": describedBy === "" ? undefined : describedBy,
                onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
                  <select
                    className={`${styles.field} ${styles.select}`}
                    aria-label={checkout.delivery.methodLabel}
                    value={selectedShippingOption}
                    disabled={
                      shippingState === "loading" ||
                      shippingOptions.length === 0 ||
                      shippingOptionsAddress !== addressRevision
                    }
                    onChange={(event) => selectShippingOption(event.currentTarget.value)}
                  >
                    <option value="">Choose a delivery method</option>
                    {shippingOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} — {formatAmount(option.amount, "EUR")}
                      </option>
                    ))}
                  </select>
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
          {/* The card step, deferred to Task 5. A labelled region and nothing
              else: no card field, no fabricated instrument, not even a
              disabled one. */}
          <div
            className={styles.cardPlaceholder}
            role="group"
            aria-label={checkout.payment.cardRegionLabel}
            data-checkout-placeholder="card"
          >
            <p className={styles.cardPlaceholderLabel}>{checkout.payment.cardRegionLabel}</p>
            <p className={styles.note}>{checkout.payment.cardRegionBody}</p>
          </div>

          <HoneypotField formName="checkout" />
          <div className={styles.turnstile}>
            <TurnstileWidget siteKey={turnstileSiteKey} nonce={nonce} formName="checkout" />
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

          <p className={styles.note}>{catalogue.priceQualifiers}</p>

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
