/**
 * Basket and checkout copy — the labels, headings and notes the two commercial
 * routes render.
 *
 * ## What is deliberately **not** here
 *
 * The sentences the checkout screen is legally obliged to say are **not
 * duplicated into this file**. `content/legal/terms.ts` states the consent
 * line, the contract-formation sentence, the confirmation promise and the
 * card-number statement, and its own doc comment says the page "is written to
 * match the checkout screen exactly". `content/legal/returns.ts` states who
 * pays return postage; `content/legal/shipping.ts` states the delivery
 * estimate. The checkout screen reads those five strings **out of the legal
 * content objects themselves** — see
 * `storefront/src/components/shop/checkout-terms.ts` — so the screen cannot
 * drift from the page that describes it. Copying them here would have created
 * exactly the second source of truth the legal read exists to prevent.
 *
 * What is here is the surrounding furniture: column headings, button labels,
 * empty-state copy, the names of the six disclosures Article 8(2) requires to
 * sit immediately above the order button, and the messages the mock cart
 * actions produce.
 *
 * ## The order button's label
 *
 * `orderButtonLabel` is the one string in this file with a legal test to pass.
 * Article 8(2) CRD requires the final control to be labelled "order with
 * obligation to pay" **or a corresponding unambiguous formulation** — it does
 * not require the article's own words verbatim. The European Commission's
 * guidance on the Directive names "buy now", "pay now" and "confirm purchase"
 * as compliant formulations, and names "register", "confirm" and "order now"
 * as **not** compliant: a label that reads as an instruction to continue
 * rather than a statement that money is now owed.
 *
 * **Operator instruction, 2026-08-29: replace the article's own wording with
 * "Pay now".** It is one of the Commission's own examples, not an
 * improvisation, and the stake is worth restating here because it is why the
 * guard below exists rather than a hand-typed string: if the button is not
 * compliantly labelled, **the consumer is not bound by the contract**.
 * `content/legal/terms.ts:56` describes what the buyer will see rather than
 * repeating the label, for exactly this reason — a description survives the
 * label changing to another compliant formulation; a quotation does not.
 *
 * {@link COMPLIANT_ORDER_BUTTON_LABELS} is the guard: `orderButtonLabel` must
 * be a member of it, checked in
 * `storefront/tests/shop-pages.test.tsx`. That test used to pin the exact
 * string "Order with obligation to pay" and separately assert the label
 * contained the substring "obligation to pay" — a guard that could only ever
 * pass the wording it was written against, and would have refused "Pay now"
 * exactly as readily as it would have refused "Confirm". Checking membership
 * of the accepted set instead is what lets this file's wording move between
 * compliant formulations without weakening what the test protects: a future
 * edit to "Confirm" or "Order now" still fails, because neither is on the
 * list.
 *
 * No amount of money appears in this file, and none can: `content.test.ts`
 * rejects a currency symbol, a currency code and a decimal amount in any
 * content string. Every figure the basket and the checkout show is resolved at
 * render from `storefront/mock/catalogue.json` and
 * `storefront/mock/shipping.json`.
 */

import type { CallToAction, Link } from "./schema.js";

/**
 * Formulations the European Commission's guidance on Article 8(2) CRD
 * accepts as a "corresponding unambiguous formulation" of "order with
 * obligation to pay" — "buy now", "pay now" and "confirm purchase" — plus the
 * Directive's own wording, which is always compliant by definition. The same
 * guidance names "register", "confirm" and "order now" as **not** compliant,
 * which is exactly why this is a fixed set rather than a free-text field: a
 * label is checked against it, in
 * `storefront/tests/shop-pages.test.tsx`, so a future edit that drifts the
 * label to one of the rejected forms — or to any wording not on this list —
 * fails the suite rather than shipping unnoticed.
 *
 * Compared case-insensitively, because the guidance is about the words rather
 * than their capitalisation.
 */
export const COMPLIANT_ORDER_BUTTON_LABELS: readonly string[] = [
  "order with obligation to pay",
  "buy now",
  "pay now",
  "confirm purchase",
];

/** One field of the delivery address form. `autoComplete` is the HTML token, not copy. */
export interface AddressFieldCopy {
  readonly name: string;
  readonly label: string;
  /**
   * What the field renders as.
   *
   * `"country"` is a **selection over `storefront/mock/countries.json`**, not
   * a text box, and that is a pricing decision rather than a styling one: the
   * shipping charge is one of two operator-frozen rates chosen by whether the
   * delivery address is in the EU, and a rate driven from typed text charges
   * `Estonai`, `eesti` and `EE` the non-EU rate. The list is mock data Task 5
   * replaces with Medusa regions, so it is not repeated here — 249 country
   * names are not copy.
   *
   * The country field keeps the slot, the label and the `autoComplete` token
   * it had as an `<input>`: swapping the control is the smallest change that
   * makes the rate honest, and Task 5's rule is that page composition does not
   * change.
   */
  readonly control: "input" | "country";
  /** The `<input type>`. Ignored by a `"country"` field, which is a `<select>`. */
  readonly type: "text" | "email";
  readonly autoComplete: string;
  /**
   * Whether this field is part of the **postal** address.
   *
   * Article 8(2) CRD names "the delivery address" as one of the six
   * disclosures immediately above the order button, and an email address is
   * not part of one. The form collects both in a single section because a
   * buyer types them together; the disclosure block composes its value from
   * the fields marked here, so the email cannot be concatenated into the
   * address the way a `FIELDS.map(...)` over the whole set once did.
   */
  readonly inDeliveryAddress: boolean;
  /** Shown under the label where the field needs one line of explanation. */
  readonly hint?: string;
}

/**
 * The receiver phone field's own copy — kept **apart** from
 * `checkout.address.fields` (the {@link AddressFieldCopy} array below) rather
 * than as one more entry in it, because unlike every entry there, this field
 * is not *required* of everybody, even though — since 2026-08-29 — it is
 * shown to everybody.
 *
 * OMX — Omniva's shipment-registration API — makes a receiver phone number
 * mandatory for a delivery address anywhere except Estonia, Finland,
 * Lithuania and Latvia, where the buyer's email already satisfies the
 * carrier; a required field nobody's carrier needs is friction that costs
 * orders for no benefit. `phoneRequiredForCountry` in
 * `storefront/src/lib/store-checkout.ts` is what decides, from the country
 * already typed into the address form, whether the field's **absence** is an
 * error — `CheckoutPageContent.tsx` renders the field itself unconditionally
 * now, because an operator-reported defect was that a buyer choosing an
 * Omniva parcel machine (only offered in Estonia, Latvia and Lithuania —
 * three of these same four countries) was never even shown the field, so
 * they had no way to volunteer a number for Omniva's delivery notice. This
 * object's `hint` states the policy honestly rather than only its first
 * half — see it below for the wording, and this codebase's standing rule
 * (`backend/src/modules/omniva/shipment.ts`'s own header) for why it does
 * *not* say "mobile": OMX's pickup notice is sent by email when no phone is
 * given, and a volunteered landline is accepted and forwarded as
 * `contactPhone`, not refused the way it would be if this builder sent it as
 * `contactMobile`.
 */
export interface PhoneFieldCopy {
  readonly label: string;
  readonly hint: string;
  readonly autoComplete: string;
}

/**
 * What a money figure says while the basket holds a line we cannot supply.
 *
 * Both screens use it, from this one string, because both are stating the same
 * thing and a second copy is a second thing to drift. `cartTotals` in
 * `storefront/src/lib/cart.ts` answers `null` rather than `0` for the price of
 * the goods and the total in that state — a basket we cannot sell has no
 * price, and a formatted zero is a statement about a price rather than the
 * absence of one. The checkout's Article 8(2) block stated exactly that: one
 * Lunar Base, costing nothing, with a total that was the shipping charge on
 * its own.
 *
 * It is worded as the two address-dependent figures are ("Shown once your
 * delivery address is complete"), because it is the same kind of sentence: what
 * has to be true before there is a figure to state.
 */
export const unavailableFigure = "Shown once your basket holds only items we can supply";

export const basket = {
  heading: "Your basket",
  lede: "One game, one price before tax, sent anywhere. Tax and shipping are worked out at checkout, from the delivery address you enter there.",

  empty: {
    heading: "Your basket is empty",
    body: "There is nothing in it yet.",
    addLabel: "Add {productName} to your basket",
    browse: {
      label: "Read about the game first",
      emphasis: "quiet",
      target: { kind: "route", to: "lunarBase" },
    } satisfies CallToAction,
  },

  linesHeading: "What you are buying",
  columns: {
    item: "Item",
    unitPrice: "Price",
    quantity: "Quantity",
    lineTotal: "Line total",
    actions: "Change",
  },
  quantityLabel: "Quantity",
  quantityAccessibleLabel: "Quantity of {productName}",
  updateLabel: "Update",
  updateAccessibleLabel: "Update the quantity of {productName}",
  removeLabel: "Remove",
  removeAccessibleLabel: "Remove {productName} from your basket",
  updatingLabel: "Updating the quantity…",
  addingLabel: "Adding it to your basket…",
  removingLabel: "Removing this item…",

  /**
   * What the basket says when a typed quantity is not one a basket can hold —
   * an empty field, something that is not a whole number, or a number outside
   * the accepted range.
   *
   * **It is composed at render, and the range is not written here.** The limit
   * is `MAX_QUANTITY_PER_LINE` in `storefront/src/lib/cart.ts`, which is the
   * one place it exists; repeating it in copy would create a second figure to
   * disagree with. `BasketPageContent.tsx` builds
   * "Enter a whole number of copies, from 1 to 10. Your basket has not been
   * changed." exactly as `checkout.errors.missingFieldPrefix` is composed with
   * a field label, and for the same reason: the content model's
   * brace-placeholder grammar is reserved for the catalogue and the merchant
   * identity, and `content.test.ts` rejects any other token.
   *
   * One message covers all three rejections because it is true of all three
   * and it states the accepted range, which is what a reader needs to correct
   * the entry. What it must never do is *reinterpret* the entry: a cleared
   * field is not "one", and a negative number is not "empty the basket".
   */
  quantityError: {
    prefix: "Enter a whole number of copies, from ",
    rangeSeparator: " to ",
    suffix: ". Your basket has not been changed.",
  },

  /**
   * What the basket says when "Add … to your basket" would push a line past
   * the most one order may carry.
   *
   * Composed with `MAX_QUANTITY_PER_LINE` at render, exactly as
   * {@link basket.quantityError} is and for the same reason: the limit is
   * written in `storefront/src/lib/cart.ts` and nowhere else.
   *
   * It exists because the add action used to *clamp* — an eleventh copy became
   * ten while the screen said "Adding it to your basket…", which is the module
   * reinterpreting a request instead of refusing it. Everything else in the
   * quantity path refuses; this is that path's last silent reinterpretation,
   * and this is what it says instead.
   */
  limitError: {
    prefix: "One order can carry at most ",
    suffix: " copies, and your basket already holds that many. Nothing has been added.",
  },

  unavailableLabel: "Not available",
  /**
   * It read "…so it is not counted in the total", which described the very
   * arithmetic that put a false price and total on the checkout: a basket
   * priced as though the line were not in it. The basket is not priced at all
   * while the line is there — see {@link unavailableFigure} — and this says
   * that instead.
   */
  unavailableNote:
    "We cannot supply this at the moment, so your basket cannot be priced. Remove it to carry on.",

  summary: {
    heading: "Order summary",
    goodsLabel: "Goods",
    shippingLabel: "Shipping",
    shippingPending: "Calculated at checkout",
    totalLabel: "Total",
    totalPending: "Shown at checkout",
  },

  checkout: {
    label: "Go to checkout",
    emphasis: "primary",
    target: { kind: "route", to: "checkout" },
  } satisfies CallToAction,

  /**
   * Article 6(1)(h) requires the withdrawal conditions and the model
   * withdrawal form to be available to the consumer **before** the order is
   * concluded — and the checkout screen may not be the earliest point at which
   * they become reachable. They are in the footer of every page on this site;
   * these two links put them in the buying flow itself, one step ahead of the
   * checkout screen, and the model form is provided in full at the second of
   * them.
   */
  beforeYouBuy: {
    heading: "Before you buy",
    body: [
      "Delivery, returns and the right to change your mind are all set out before you order, not after.",
    ],
    links: [
      { label: "Shipping and delivery", target: { kind: "route", to: "legalShipping" } },
      {
        label: "Returns and your 14-day right to withdraw",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal" },
      },
      {
        label: "Model withdrawal form",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal-form" },
      },
      { label: "Terms of sale", target: { kind: "route", to: "legalTerms" } },
    ] satisfies readonly Link[],
  },
} as const;

export const checkout = {
  heading: "Checkout",
  lede: "Delivery address, shipping and payment. Nothing is charged until you press the order button.",

  empty: {
    heading: "Your basket is empty",
    body: "There is nothing to check out.",
    link: {
      label: "Back to your basket",
      emphasis: "secondary",
      target: { kind: "route", to: "cart" },
    } satisfies CallToAction,
  },

  address: {
    heading: "Delivery address",
    body: "Where the parcel goes, and where the confirmation is sent.",
    fields: [
      {
        name: "fullName",
        label: "Full name",
        control: "input",
        type: "text",
        autoComplete: "name",
        inDeliveryAddress: true,
      },
      {
        name: "streetAddress",
        label: "Street and number",
        control: "input",
        type: "text",
        autoComplete: "street-address",
        inDeliveryAddress: true,
      },
      {
        name: "postalCode",
        label: "Postcode",
        control: "input",
        type: "text",
        autoComplete: "postal-code",
        inDeliveryAddress: true,
      },
      {
        name: "city",
        label: "Town or city",
        control: "input",
        type: "text",
        autoComplete: "address-level2",
        inDeliveryAddress: true,
      },
      {
        // A selection, not a text box, because the shipping charge is priced
        // from it — see `AddressFieldCopy["control"]`. The hint says what the
        // list contains, which is now a checkable claim about the control
        // rather than a promise made beside a field that accepts anything.
        name: "country",
        label: "Country",
        control: "country",
        type: "text",
        autoComplete: "country-name",
        inDeliveryAddress: true,
        hint: "We ship to every country.",
      },
      {
        name: "email",
        label: "Email address",
        control: "input",
        type: "email",
        autoComplete: "email",
        // Not part of the postal address — see `AddressFieldCopy`.
        inDeliveryAddress: false,
        hint: "Your order confirmation goes here.",
      },
    ] satisfies readonly AddressFieldCopy[],
    /**
     * The unchosen state of the country selection. It is a real option rather
     * than a blank one so that a screen reader announces the field as unset
     * instead of announcing whichever country happens to sort first — and so
     * that nobody is defaulted into a zone, and therefore into a price, they
     * did not choose.
     */
    countryUnchosen: "Choose a country",
    missingValue: "Enter your delivery address above.",
    /**
     * See {@link PhoneFieldCopy}. The hint names the four exempt countries
     * rather than leaving the rule implicit, the same choice
     * `content/legal/shipping.ts` already made for the parcel machine
     * countries: a reader who is asked for a phone number is owed the reason,
     * not just the instruction. Rewritten 2026-08-29 from a single sentence
     * that was only ever true in one direction ("The carrier needs this to
     * deliver outside Estonia, Finland, Lithuania and Latvia") to state both
     * halves: the field is shown everywhere now, so a reader inside those
     * four countries needs to be told they may skip it, not left to guess
     * from a sentence that reads as a demand either way.
     */
    phone: {
      label: "Phone number",
      hint: "Required outside Estonia, Finland, Lithuania and Latvia; optional there. Omniva uses it, or your email, to send delivery and pickup notices.",
      autoComplete: "tel",
    } satisfies PhoneFieldCopy,
  },

  delivery: {
    heading: "Delivery",
    methodLabel: "Method",
    chargeLabel: "Shipping",
    chargePending: "Enter your delivery address to see the shipping charge.",
    estimateLabel: "Delivery estimate",
    /**
     * The second `<select>`'s accessible name, shown once the Omniva parcel
     * machine method is chosen. It has no visible `<dt>` of its own — it sits
     * beneath the method it belongs to, inside the same row — so this is
     * the only label a screen reader announces for it, the same pattern
     * {@link methodLabel} already carries for the method `<select>` beside
     * it.
     */
    parcelMachineLabel: "Parcel machine",
    /**
     * The picker's unchosen option. A real option rather than a blank one,
     * for the same reason {@link AddressFieldCopy.control}'s country field
     * has one: a screen reader announces the field as unset, and nobody is
     * defaulted into a machine, and therefore a destination, they did not
     * choose.
     */
    parcelMachinePrompt: "Choose a parcel machine",
    /** Shown beside the picker while the machine list is being fetched. */
    parcelMachineLoading: "Loading parcel machines…",
    /**
     * Shown in place of the picker when the machine list could not be
     * fetched — the backend answers `503` when its own cache and Omniva are
     * both unavailable. Says what to do next rather than only what failed:
     * another method is still on offer, so a buyer is not stranded on this
     * screen. Names no method: {@link methodLabel}'s `<select>` states them,
     * and a name repeated here is a second place for one to go stale.
     */
    parcelMachineUnavailable:
      "The parcel machine list could not be loaded. Choose another delivery method, or try again.",
  },

  payment: {
    heading: "Payment",
    cardRegionLabel: "Payment details",
    cardRegionBody:
      "The secure payment form is shown after you choose delivery. Available methods depend on your device, location and Stripe configuration.",
  },

  beforeYouOrder: {
    heading: "Before you order",
    returnPostageLabel: "Returning it",
    withdrawalLabel: "Changing your mind",
    withdrawalBody:
      "You have 14 days from delivery to withdraw from the contract, for any reason or none. The conditions and the model withdrawal form are here, and have been reachable from every page you have seen.",
    links: [
      {
        label: "Returns and your 14-day right to withdraw",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal" },
      },
      {
        label: "Model withdrawal form",
        target: { kind: "route", to: "legalReturns", anchor: "withdrawal-form" },
      },
      { label: "Terms of sale", target: { kind: "route", to: "legalTerms" } },
      { label: "Privacy notice", target: { kind: "route", to: "legalPrivacy" } },
      { label: "Shipping and delivery", target: { kind: "route", to: "legalShipping" } },
    ] satisfies readonly Link[],
  },

  /**
   * The six disclosures Article 8(2) requires immediately above the order
   * button, in the order `content/legal/terms.ts` lists them: "the goods, the
   * price of the goods, the shipping charge, the total, the delivery address
   * and the delivery estimate".
   *
   * {@link order.vatLabel} is a **seventh** value and does not disturb that
   * order: it is the addend the two net figures above it need to reach the
   * total, placed between the shipping charge and the total because that is
   * where it is added, and it is absent entirely for an order that attracts
   * no VAT — never a row of zero.
   */
  order: {
    heading: "Your order",
    goodsLabel: "The goods",
    goodsPriceLabel: "Price of the goods",
    shippingLabel: "Shipping charge",
    /**
     * The VAT row's term, worded as an **addend** rather than as a
     * breakdown — the opposite of what it said before 2026-08-29, and for the
     * same reason the wording changed then: the decomposition it labels
     * changed.
     *
     * Until this change, the goods and shipping rows above it were grossed —
     * Medusa's `item_total`/`shipping_total`, tax already inside them — so the
     * VAT row was a breakdown of the two figures above it, worded "Includes",
     * and a row headed simply "VAT" would have invited a reader to add it to
     * an already-taxed column and find the total overstated.
     * `storefront/src/lib/store-checkout.ts`'s `assertedCartTotals` now states
     * the opposite invariant: the goods and shipping rows are **net** —
     * `item_total − item_tax_total`, `shipping_total − shipping_tax_total`,
     * the same figures for every destination — and this row is what makes the
     * column sum to the total again. "Includes" would now be false; the
     * refusal that used to guard that word now guards `goods + shipping + tax
     * === total` instead, over the same three fields.
     *
     * `{vatRate}` resolves from the catalogue. The rate is a fact this
     * workspace quotes and never applies; it is declared in
     * `backend/src/commerce/tax-model.ts`.
     */
    vatLabel: "VAT at {vatRate}",
    /**
     * The price qualification when the figures above are the ones **the
     * delivery address produced**, and the qualification therefore follows
     * that address. Rendered as `{priceTaxQualifier}` plus the shipping note,
     * out of the catalogue — there is no string here, deliberately, because
     * the words belong to the one resolver every surface reads.
     *
     * The two below are for the states where the address has not decided the
     * figures yet, and they exist because the honest thing to say then is not
     * a destination.
     */
    /**
     * Appended while the figures still follow the destination set on the site
     * rather than a delivery address.
     *
     * The goods figure on this screen before an address is complete is the
     * basket's, and the basket was priced for the chosen destination — so
     * naming that destination is correct, and saying nothing would leave a
     * provisional figure looking settled. What this adds is the part a reader
     * cannot see: that the address, once complete, is what decides it.
     */
    destinationProvisional:
      "These figures follow the destination set on this site until the delivery address above is complete; the address is what decides them.",
    /**
     * The qualification when no destination can honestly be named at all —
     * the figures are address-bound but the country is not one this site
     * knows, so there is no tax treatment to state.
     *
     * Unreachable from the served form, whose country field is a selection
     * over the same list. It exists because the alternative to an honest
     * refusal here is naming a destination that is not the one being charged,
     * which is exactly the defect this wording replaced.
     */
    qualifierPending:
      "VAT and shipping are worked out from the delivery address above, and are shown here once it is complete. Non-EU taxes and duties, if any, are not included.",
    totalLabel: "Total",
    addressLabel: "Delivery address",
    estimateLabel: "Delivery estimate",
    totalPending: "Shown once your delivery address is complete",
  },

  /**
   * See this file's doc comment: one of the European Commission's own
   * compliant formulations of the Article 8(2) obligation-to-pay requirement
   * — operator instruction, 2026-08-29. Must be a member of
   * {@link COMPLIANT_ORDER_BUTTON_LABELS}.
   */
  orderButtonLabel: "Pay now",
  placingLabel: "Placing your order…",

  errors: {
    heading: "Check the details you entered",
    /**
     * Composed with the field's own label at render —
     * `CheckoutPageContent.tsx` builds "Enter your full name.". It is not a
     * brace-delimited placeholder because the content model's placeholder
     * grammar is reserved for the catalogue and the merchant identity, and
     * `content.test.ts` rejects any token that is not one of those;
     * `ContactForm.tsx` composes its own field errors the same way.
     */
    missingFieldPrefix: "Enter ",
    /**
     * The same message for a field that is chosen rather than typed. "Enter
     * country" is an instruction a reader cannot follow in front of a
     * dropdown, and an error that tells somebody to do the wrong thing is
     * worse than a terse one.
     */
    missingSelectionPrefix: "Choose a ",
    invalidEmail: "Enter an email address we can send your confirmation to.",
    /**
     * The storefront checks presence and a leading `+` and nothing more — see
     * `phoneRequiredForCountry`'s doc comment in
     * `storefront/src/lib/store-checkout.ts` for why the rest (a real
     * national number, no special-tariff range, no Baltic fixed line) is
     * OMX's to refuse at fulfilment rather than this form's to guess at.
     */
    invalidPhone:
      "Enter a phone number that starts with your country's dialling code, for example +372 5555 5555.",
    unavailableLine: "Remove the item we cannot supply before ordering.",
    paymentNotConnected:
      "No order was placed and nothing was charged: card payment is not connected on this site yet.",
    actionFailed: "That did not work. Nothing has changed. Try again in a moment.",
    orderFailed: "We could not place your order. Nothing has been charged. Try again in a moment.",
  },
} as const;
