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
 * Article 8(2) of the Consumer Rights Directive requires the final control to
 * be labelled with "order with obligation to pay" or a corresponding
 * unambiguous formulation, and `content/legal/terms.ts` states that the button
 * "is labelled to say that pressing it places an order with an obligation to
 * pay" — a description of the label rather than the label itself. This is the
 * article's own canonical formulation, unabbreviated. Do not shorten it to
 * "Order", "Buy" or "Confirm": that is the single most-cited defect in EU
 * distance-selling enforcement, and shortening it would also make the legal
 * page false.
 *
 * No amount of money appears in this file, and none can: `content.test.ts`
 * rejects a currency symbol, a currency code and a decimal amount in any
 * content string. Every figure the basket and the checkout show is resolved at
 * render from `storefront/mock/catalogue.json` and
 * `storefront/mock/shipping.json`.
 */

import type { CallToAction, Link } from "./schema.js";

/** One field of the delivery address form. `autoComplete` is the HTML token, not copy. */
export interface AddressFieldCopy {
  readonly name: string;
  readonly label: string;
  readonly type: "text" | "email";
  readonly autoComplete: string;
  /** Shown under the label where the field needs one line of explanation. */
  readonly hint?: string;
}

export const basket = {
  heading: "Your basket",
  lede: "One game, one price, sent anywhere. Shipping is added at checkout once you have entered a delivery address.",

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
  removingLabel: "Removing this item…",
  unavailableLabel: "Not available",
  unavailableNote:
    "We cannot supply this at the moment, so it is not counted in the total. Remove it to carry on.",

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
      { name: "fullName", label: "Full name", type: "text", autoComplete: "name" },
      {
        name: "streetAddress",
        label: "Street and number",
        type: "text",
        autoComplete: "street-address",
      },
      { name: "postalCode", label: "Postcode", type: "text", autoComplete: "postal-code" },
      { name: "city", label: "Town or city", type: "text", autoComplete: "address-level2" },
      {
        name: "country",
        label: "Country",
        type: "text",
        autoComplete: "country-name",
        hint: "We ship to every country.",
      },
      {
        name: "email",
        label: "Email address",
        type: "email",
        autoComplete: "email",
        hint: "Your order confirmation goes here.",
      },
    ] satisfies readonly AddressFieldCopy[],
    missingValue: "Enter your delivery address above.",
  },

  delivery: {
    heading: "Delivery",
    methodLabel: "Method",
    chargeLabel: "Shipping",
    chargePending: "Enter your delivery address to see the shipping charge.",
    estimateLabel: "Delivery estimate",
  },

  payment: {
    heading: "Payment",
    cardRegionLabel: "Card details",
    cardRegionBody:
      "The card form from our payment processor is shown here. It is not connected on this site yet, so the order button below cannot take a payment.",
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
   */
  order: {
    heading: "Your order",
    goodsLabel: "The goods",
    goodsPriceLabel: "Price of the goods",
    shippingLabel: "Shipping charge",
    totalLabel: "Total",
    addressLabel: "Delivery address",
    estimateLabel: "Delivery estimate",
    totalPending: "Shown once your delivery address is complete",
  },

  /** See this file's doc comment: Article 8(2)'s own formulation, unabbreviated. */
  orderButtonLabel: "Order with obligation to pay",
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
    invalidEmail: "Enter an email address we can send your confirmation to.",
    unavailableLine: "Remove the item we cannot supply before ordering.",
    paymentNotConnected:
      "No order was placed and nothing was charged: card payment is not connected on this site yet.",
    actionFailed: "That did not work. Nothing has changed. Try again in a moment.",
    orderFailed: "We could not place your order. Nothing has been charged. Try again in a moment.",
  },
} as const;
