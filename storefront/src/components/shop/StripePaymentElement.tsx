"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { forwardRef, useImperativeHandle, useMemo } from "react";

import { stripeConfirmationForStatus, type StripeConfirmation } from "../../lib/store-payment.js";

export interface StripePaymentElementHandle {
  readonly confirm: () => Promise<StripeConfirmation>;
}

interface InnerPaymentElementProps {
  readonly returnUrl: string;
}

const InnerPaymentElement = forwardRef<StripePaymentElementHandle, InnerPaymentElementProps>(
  function InnerPaymentElement({ returnUrl }, ref) {
    const stripe = useStripe();
    const elements = useElements();

    useImperativeHandle(
      ref,
      () => ({
        async confirm() {
          if (stripe === null || elements === null) {
            return { ok: false, pending: false, message: "Payment options are still loading" };
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
              message: "Payment could not be confirmed. Check the details or choose another method.",
            };
          }
          const confirmation = stripeConfirmationForStatus(result.paymentIntent?.status);
          if (!confirmation.ok && confirmation.pending) window.location.assign(returnUrl);
          return confirmation;
        },
      }),
      [elements, returnUrl, stripe],
    );

    return <PaymentElement options={{ layout: "tabs" }} />;
  },
);

export interface StripePaymentElementProps {
  readonly publishableKey: string | null;
  readonly clientSecret: string | null;
}

/** Loads Stripe.js only once Medusa has produced an amount-bound client secret. */
export const StripePaymentElement = forwardRef<
  StripePaymentElementHandle,
  StripePaymentElementProps
>(function StripePaymentElement({ publishableKey, clientSecret }, ref) {
  const stripe = useMemo(
    () => (publishableKey === null || clientSecret === null ? null : loadStripe(publishableKey)),
    [clientSecret, publishableKey],
  );

  if (publishableKey === null) {
    return <p role="alert">Payment is unavailable. Please try again later.</p>;
  }
  if (clientSecret === null || stripe === null) {
    return <p role="status">Choose a delivery method to load payment options.</p>;
  }

  const returnUrl = `${window.location.origin}/checkout/payment-return`;
  return (
    <Elements key={clientSecret} stripe={stripe} options={{ clientSecret }}>
      <InnerPaymentElement ref={ref} returnUrl={returnUrl} />
    </Elements>
  );
});
