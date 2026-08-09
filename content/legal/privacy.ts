/**
 * Privacy notice.
 *
 * Two obligations the plan states directly: record the lawful basis for
 * analytics, and name every third-party processor the site loads. Both are
 * discharged here in prose a person can actually read.
 *
 * Processors are named by company, never by hostname or account identifier —
 * those are configuration. The list has to stay true: if the storefront adds a
 * script from a company that is not named on this page, that is a defect in
 * this page, not a detail.
 */

import type { LegalPage } from "../schema.js";

export const privacy: LegalPage = {
  route: "legalPrivacy",
  title: "Privacy",
  description:
    "What we collect, why, who processes it on our behalf, and how to refuse or withdraw consent for analytics.",
  indexable: true,
  sections: ["consent", "processors", "contact"],
  covers: [],
  reviewStatus: "draft-pending-operator-input",
  body: [
    {
      anchor: "consent",
      heading: "Measurement happens only if you agree",
      body: [
        "When you first arrive, you are asked whether we may measure how the site is used. Nothing that measures you runs before you answer, and declining is a single click that costs you no functionality.",
        "The lawful basis for analytics and for the advertising measurement pixel is your consent, and nothing else. You may withdraw it at any time from the link in the footer, which reopens the same choice. Withdrawing stops future measurement; it does not retroactively erase what was already collected.",
        "The parts of the site that are not measurement — buying the game, contacting us, reading the rules — need no consent and are unaffected by your answer.",
      ],
    },
    {
      anchor: "processors",
      heading: "Who else handles your data",
      body: [
        "We use a small number of processors, and this is all of them.",
        "Cloudflare serves this site's DNS, terminates its encryption, and provides the challenge that protects the contact and newsletter forms from automated abuse. It therefore processes your IP address and request metadata for every page you load. This is not optional: it is how the site is delivered at all.",
        "Stripe processes payments. When you pay, your card details go to Stripe directly and we never receive them. Stripe holds the payment record.",
        "Google Analytics measures how the site is used, only after you consent, and never on our test environment.",
        "Meta receives an advertising measurement signal, only after you consent, and never on our test environment.",
        "Brevo delivers the newsletter and holds the address you gave us for it, until you unsubscribe.",
        "Order and contact email is sent through our own mail server. It is not handed to a bulk email provider.",
        "We do not sell data, we do not share it for anybody else's advertising, and there is no processor on this site that is not named above.",
      ],
    },
    {
      anchor: "contact",
      heading: "Your data, and how to reach us about it",
      body: [
        "When you order, we hold what an order needs: your name, delivery address, email address, what you bought and what you paid. We keep it as long as tax and accounting law requires us to, and then no longer.",
        "When you write to us, we keep the message and your address so we can answer, and so we can find the conversation again if you come back about the same order.",
        "When you subscribe to the newsletter, we hold your email address and nothing else. Every message has an unsubscribe link, and using it removes you.",
        "You may ask what we hold about you, ask for it to be corrected, ask for it to be deleted, ask for a copy, or object to how we use it. Write to {merchantContactAddress} and a person will read it. If we get it wrong you may complain to your national data protection authority.",
        "The controller is {merchantLegalName}, {merchantRegisteredAddress}.",
      ],
    },
  ],
};
