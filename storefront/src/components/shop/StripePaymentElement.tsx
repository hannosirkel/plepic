"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { forwardRef, useImperativeHandle, useMemo } from "react";

import { siteCopyFor } from "../../../../content/editions.js";
import { CHECKOUT_RETURN_PATH, DEFAULT_LOCALE, type Locale } from "../../../../content/routes.js";
import { stripeConfirmationForStatus, type StripeConfirmation } from "../../lib/store-payment.js";
import { localizedPath } from "../../lib/urls.js";

export interface StripePaymentElementHandle {
  readonly confirm: () => Promise<StripeConfirmation>;
}

interface InnerPaymentElementProps {
  readonly returnUrl: string;
  readonly locale: Locale;
}

const InnerPaymentElement = forwardRef<StripePaymentElementHandle, InnerPaymentElementProps>(
  function InnerPaymentElement({ returnUrl, locale }, ref) {
    const copy = siteCopyFor(locale).interface.checkout;
    const stripe = useStripe();
    const elements = useElements();

    useImperativeHandle(
      ref,
      () => ({
        async confirm() {
          if (stripe === null || elements === null) {
            return { ok: false, pending: false, reportFailure: false, message: copy.paymentFormLoading };
          }
          const result = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl },
            redirect: "if_required",
          });
          if (result.error !== undefined) {
            return {
              ok: false,
              pending: false,
              reportFailure: true,
              message: copy.paymentNotConfirmed,
            };
          }
          const confirmation = stripeConfirmationForStatus(result.paymentIntent?.status);
          if (!confirmation.ok && confirmation.pending) window.location.assign(returnUrl);
          return confirmation;
        },
      }),
      [copy, elements, returnUrl, stripe],
    );

    return (
      <PaymentElement
        options={{
          // An accordion showing one item, rather than tabs: card renders
          // open and immediately usable, and everything else -- Link included
          // -- sits behind a single "More payment methods" row. That is the
          // point. Link should be available without being in the way, and a
          // tab strip cannot express "present but quiet": every method
          // competes for one row, and whichever do not fit fall into an
          // overflow whose contents depend on viewport width and on which
          // wallets the device offers. Whether a customer saw Link at all was
          // effectively decided by their screen.
          //
          // `defaultCollapsed: false` is deliberate, against the obvious
          // reading of "unobtrusive". Collapsing everything would cost every
          // customer a click to reach card, the overwhelmingly common path;
          // the goal is to demote the alternatives, not to demote paying.
          layout: {
            type: "accordion",
            defaultCollapsed: false,
            visibleAccordionItemsCount: 1,
          },
          // `link` is named explicitly. Leaving it out did not remove it --
          // Stripe appends eligible methods this list omits, in an order
          // nothing here controls. Naming it is what makes its position a
          // decision rather than an accident.
          paymentMethodOrder: ["card", "apple_pay", "google_pay", "link", "paypal"],
          // `auto` is already the default for all three, so this grants no
          // control it would not otherwise have: for wallets the only other
          // value is `never`, which hides. It stays because it records at the
          // call site that hiding any of them is a decision nobody has taken,
          // and it is where a future "hide Link" would be written.
          wallets: { applePay: "auto", googlePay: "auto", link: "auto" },
        }}
      />
    );
  },
);

export interface StripePaymentElementProps {
  readonly publishableKey: string | null;
  readonly clientSecret: string | null;
  /** The edition the checkout is served in. The default edition's when absent. */
  readonly locale?: Locale;
}

/**
 * Where Stripe sends a visitor back to after a redirect-based payment: the
 * return page of the edition they paid from, on the origin they paid on.
 *
 * So a visitor who paid from `/et/checkout` returns under `/et`. The origin
 * is the browser's own, never a configured one: no per-environment value is
 * built into this bundle.
 */
export function checkoutReturnUrl(origin: string, locale: Locale): string {
  return `${origin}${localizedPath(locale, CHECKOUT_RETURN_PATH)}`;
}

/** Loads Stripe.js only once Medusa has produced an amount-bound client secret. */
export const StripePaymentElement = forwardRef<
  StripePaymentElementHandle,
  StripePaymentElementProps
>(function StripePaymentElement({ publishableKey, clientSecret, locale = DEFAULT_LOCALE }, ref) {
  const copy = siteCopyFor(locale).interface.checkout;
  const stripe = useMemo(
    () => (publishableKey === null || clientSecret === null ? null : loadStripe(publishableKey)),
    [clientSecret, publishableKey],
  );

  if (publishableKey === null) {
    return <p role="alert">{copy.paymentUnavailable}</p>;
  }
  if (clientSecret === null || stripe === null) {
    return <p role="status">{copy.paymentAwaitingDelivery}</p>;
  }

  const returnUrl = checkoutReturnUrl(window.location.origin, locale);
  return (
    <Elements key={clientSecret} stripe={stripe} options={{ clientSecret }}>
      <InnerPaymentElement ref={ref} returnUrl={returnUrl} locale={locale} />
    </Elements>
  );
});
