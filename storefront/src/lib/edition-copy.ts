/**
 * The copy a client component is rendered with, chosen on the server.
 *
 * **Why this module exists.** `content/editions.ts` holds every edition's
 * copy, and a client component that looks its words up there by `locale`
 * puts all of it — four editions of every page — into the browser bundle of
 * every page that renders the component. Instead, the Server Component that
 * renders a client component calls one of the functions below and passes the
 * result as a prop, so the browser receives one edition's strings, and only
 * the ones that component reads.
 *
 * **Only what the component renders.** A prop is serialized into the page, so
 * a section passed whole would also send the sentences only the server uses —
 * a Server Function's reply with an unresolved `{merchantContactAddress}` in
 * it, for one. Each type below picks the fields its component reads.
 *
 * **The rule this keeps.** A `"use client"` module may import the *types*
 * here (`import type`), which compile away. It never imports a function from
 * this module or a value from `content/editions.ts`, or the bundle grows back.
 * `tests/client-bundle-copy.test.ts` walks the client import graph and fails
 * if it reaches `content/editions.ts`.
 */
import { siteCopyFor, type SiteCopy } from "../../../content/editions.js";
import type { InterfaceCopy } from "../../../content/interface.js";
import type { Locale } from "../../../content/routes.js";
import type { RouteLinks } from "../components/mockups/route-links.js";
import type { CheckoutAddressCopy } from "../components/shop/checkout-address.js";
import { checkoutTermsFor, type CheckoutTerms } from "../components/shop/checkout-terms.js";
import { localizedLinkFor, routeLinksFor } from "./seo.js";

/** What `NewsletterForm` says: its labels, its validation errors and the challenge's name. */
type Newsletter = SiteCopy["publisher"]["newsletter"];

export interface NewsletterFormCopy {
  readonly newsletter: Pick<Newsletter, "heading" | "fieldLabel" | "submitLabel" | "consentNote">;
  readonly errors: InterfaceCopy["newsletterForm"];
  readonly verificationLabel: string;
}

export function newsletterFormCopy(locale: Locale): NewsletterFormCopy {
  const copy = siteCopyFor(locale);
  const { heading, fieldLabel, submitLabel, consentNote } = copy.publisher.newsletter;
  return {
    newsletter: { heading, fieldLabel, submitLabel, consentNote },
    errors: copy.interface.newsletterForm,
    verificationLabel: copy.interface.forms.verificationLabel,
  };
}

/** What `ContactForm` says: its heading, its field labels, their errors and the challenge's name. */
export interface ContactFormCopy {
  readonly heading: string;
  readonly labels: Pick<
    SiteCopy["support"]["contactForm"],
    "nameLabel" | "emailLabel" | "subjectLabel" | "messageLabel" | "submitLabel"
  >;
  readonly errors: InterfaceCopy["contactForm"];
  readonly verificationLabel: string;
}

export function contactFormCopy(locale: Locale): ContactFormCopy {
  return contactFormCopyFrom(siteCopyFor(locale));
}

/** {@link contactFormCopy}, from an edition's copy already in hand. */
export function contactFormCopyFrom(copy: SiteCopy): ContactFormCopy {
  const { nameLabel, emailLabel, subjectLabel, messageLabel, submitLabel } = copy.support.contactForm;
  return {
    heading: copy.support.contact.heading,
    labels: { nameLabel, emailLabel, subjectLabel, messageLabel, submitLabel },
    errors: copy.interface.contactForm,
    verificationLabel: copy.interface.forms.verificationLabel,
  };
}

/** What `AddToCartButton` says while it works, and where it sends the reader afterwards. */
export interface AddToCartCopy {
  readonly outOfStock: string;
  readonly addingToBasket: string;
  readonly retryAddingToBasket: string;
  readonly basketExpired: string;
  /** The basket in the reader's edition, as `localizedLinkFor` resolves it. */
  readonly basketHref: string;
}

export function addToCartCopy(locale: Locale): AddToCartCopy {
  const { outOfStock, addingToBasket, retryAddingToBasket, basketExpired } = siteCopyFor(locale).interface.product;
  return { outOfStock, addingToBasket, retryAddingToBasket, basketExpired, basketHref: localizedLinkFor(locale, "cart").href };
}

/** What `DestinationSelector` says. */
export type DestinationSelectorCopy = InterfaceCopy["destinationSelector"];

export function destinationSelectorCopy(locale: Locale): DestinationSelectorCopy {
  return siteCopyFor(locale).interface.destinationSelector;
}

/** What the consent banner and its reopen control say. */
export type ConsentCopy = InterfaceCopy["consent"];

export function consentCopy(locale: Locale): ConsentCopy {
  return siteCopyFor(locale).interface.consent;
}

/**
 * What the basket, the checkout and the payment return say, and what they
 * link to. One object for the three because they share most of it: the shop
 * copy, the checkout's interface strings, the terms it quotes and the address
 * form. Nested client components (the parcel-machine picker, the payment
 * element, the post-purchase newsletter form) are handed it by their parent.
 */
export interface ShopCopy {
  /** The edition's `content/shop.ts`. */
  readonly content: SiteCopy["shop"];
  readonly checkout: InterfaceCopy["checkout"];
  readonly deliveryMethodNames: InterfaceCopy["deliveryMethodNames"];
  readonly paymentReturn: InterfaceCopy["paymentReturn"];
  readonly verificationLabel: string;
  readonly newsletter: Pick<
    Newsletter,
    "postPurchaseHeading" | "postPurchaseBody" | "fieldLabel" | "postPurchaseConsentLabel" | "submitLabel"
  >;
  /** The checkout's legal statements, as the edition's legal pages word them. */
  readonly terms: CheckoutTerms;
  readonly address: CheckoutAddressCopy;
  /** Every route's link from the edition's pages, for the shop's own links. */
  readonly routeLinks: RouteLinks;
}

export function shopCopy(locale: Locale): ShopCopy {
  const { shop, interface: ui, publisher } = siteCopyFor(locale);
  return {
    content: shop,
    checkout: ui.checkout,
    deliveryMethodNames: ui.deliveryMethodNames,
    paymentReturn: ui.paymentReturn,
    verificationLabel: ui.forms.verificationLabel,
    newsletter: pickPostPurchase(publisher.newsletter),
    terms: checkoutTermsFor(locale),
    address: checkoutAddressCopy(locale),
    routeLinks: routeLinksFor(locale),
  };
}

/** The address form's copy in `locale`: see `CheckoutAddressCopy`. */
export function checkoutAddressCopy(locale: Locale): CheckoutAddressCopy {
  const { shop, interface: ui } = siteCopyFor(locale);
  return {
    fields: shop.checkout.address.fields,
    missing: ui.checkout.missing,
    invalidEmail: shop.checkout.errors.invalidEmail,
    invalidPhone: shop.checkout.errors.invalidPhone,
  };
}

function pickPostPurchase({
  postPurchaseHeading,
  postPurchaseBody,
  fieldLabel,
  postPurchaseConsentLabel,
  submitLabel,
}: Newsletter): ShopCopy["newsletter"] {
  return { postPurchaseHeading, postPurchaseBody, fieldLabel, postPurchaseConsentLabel, submitLabel };
}
