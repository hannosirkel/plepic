/**
 * Privacy notice.
 *
 * Two obligations the plan states directly: record the lawful basis for
 * analytics, and name every third-party processor the site loads. Both are
 * discharged here in prose a person can actually read.
 *
 * Companies are named by company, never by hostname or account identifier —
 * those are configuration. The list has to stay true: if the storefront adds a
 * script from a company that is not named on this page, that is a defect in
 * this page, not a detail.
 *
 * ## What the second qualified read changed, 2026-08-09
 *
 * - **B1, the one blocking finding.** This page used to frame Meta inside "we
 *   use a small number of processors, and this is all of them", and close with
 *   *"we do not share it for anybody else's advertising."* A Facebook Pixel
 *   does not make Meta a processor: Meta uses what it receives for its own
 *   purposes, and under *Fashion ID* (C-40/17) the site operator is a **joint
 *   controller** with Meta for the collection and transmission. So the notice
 *   misstated recipients' roles contrary to Articles 13(1)(e) and 26 GDPR, and
 *   made a factual claim that running the Pixel falsifies — an Article 5(1)(a)
 *   transparency infringement, and the sentence a complaint to the
 *   Andmekaitse Inspektsioon would quote. The section is reframed as "the
 *   companies that handle data when you use this site", and the Meta paragraph
 *   and the closing line are replaced.
 * - **M5.** Article 13(1)(c) wants purpose *and legal basis* per operation, and
 *   only measurement had one; Article 13(1)(f) wants third-country transfers
 *   and their safeguard, and four US processors went unmentioned. Both are now
 *   stated, and the rights list gains Article 18 restriction.
 * - **Minor 5.** The seven-year retention figure (Accounting Act § 12) instead
 *   of only its criterion, a period for contact mail, and the Andmekaitse
 *   Inspektsioon named alongside "your national data protection authority".
 * - **Minor 7.** A short browser-storage table. The consent-first architecture
 *   already satisfies the ePrivacy Article 5(3) core; this is the
 *   good-practice remainder.
 *
 * ## The cookie table is the operator's own content, 2026-08-10
 *
 * The first revision wrote the table as `items`, a term-and-detail pair per
 * entry, and asserted each cookie's lifetime as fact — *"states a lifetime of
 * two years"* — about other companies' products. The operator has now supplied
 * the table itself, and two things changed with it: the durations are **hedged**
 * (*"Up to 2 years"*, *"Varies"*) rather than asserted, and the consent status
 * of each is stated explicitly in the two sentences beneath. Both are
 * reproduced verbatim.
 *
 * It is a `table` rather than `items` because it has four columns and `items`
 * has two. The alternative was folding `Duration` into a parenthetical inside
 * the purpose text, which is how a duration stops being scannable — and the
 * duration is the column a reader actually came for.
 *
 * **The consent answer is prose above the table, not a row in it.** It is not a
 * cookie: it is local storage this site writes itself, so it has no provider
 * and no expiry, and three of the four columns would have been empty. It was
 * disclosed before the operator's table arrived and it still is; dropping it
 * would have quietly lost half of what Minor 7 asked for.
 *
 * ## The basket was the third browser store, and was undisclosed, 2026-08-10
 *
 * `storefront/src/lib/cart-store.tsx` keeps an opaque Medusa cart identifier in
 * `sessionStorage`, and this section named only the consent answer — so the page
 * described two of the three ways this site stores something in a browser and
 * read as though it had described all of them. A sentence now says so, and it
 * is **prose above the table for exactly the reasons the consent answer is**:
 * it is not a cookie, it has no provider and no expiry, and three of the four
 * columns would again have been empty. It is also a disclosure nothing obliges:
 * a basket is storage "strictly necessary for a service the user explicitly
 * requested" under ePrivacy Article 5(3), and it holds no product details or
 * personal data. It is here for transparency, which is why
 * it is a statement rather than a consent question.
 *
 * The sentence deliberately mirrors the consent-answer sentence above it —
 * where it is stored, how long it survives, and what it contains, in that
 * order — so the two read as one pattern rather than as two authors.
 *
 * Its claims were checked against a running build rather than against the
 * comment in `cart-store.tsx`: after adding the game to the basket,
 * `sessionStorage` held only an opaque Medusa cart id, `localStorage` held only
 * the consent decision, and
 * `document.cookie` was empty. If the shape of what is stored ever changes,
 * **this sentence is part of what has to change with it** —
 * `storefront/tests/browser-storage-disclosure.test.ts` derives the set of
 * stores from a walk of `storefront/src/` and fails when one of them has no
 * sentence here.
 *
 * **Minor 6 — newsletter single opt-in — is deliberately not fixed.** It is
 * lawful (Estonian ECA § 103¹ requires prior consent, and EU law mandates
 * double opt-in nowhere); the residual exposure is evidential under Article
 * 7(1) GDPR, and it is a recorded, accepted operator deviation.
 */

import type { LegalPage } from "../schema.js";

export const privacy: LegalPage = {
  route: "legalPrivacy",
  title: "Privacy",
  description:
    "What we collect, why, on what legal basis, who handles it, where it goes, and how to refuse or withdraw consent for analytics.",
  indexable: true,
  sections: ["consent", "processors", "contact"],
  covers: [
    "analytics-lawful-basis",
    "third-party-processors",
    "third-country-transfers",
    "processing-lawful-bases",
  ],
  reviewStatus: "operator-approved",
  body: [
    {
      anchor: "consent",
      heading: "Measurement happens only if you agree",
      covers: ["analytics-lawful-basis"],
      body: [
        "When you first arrive, you are asked whether we may measure how the site is used. Nothing that measures you runs before you answer, and declining is a single click that costs you no functionality.",
        "The lawful basis for analytics and for the advertising measurement pixel is your consent, and nothing else. You may withdraw it at any time from the link in the footer, which reopens the same choice. Withdrawing stops future measurement; it does not retroactively erase what was already collected.",
        "The parts of the site that are not measurement — buying the game, contacting us, reading the rules — need no consent and are unaffected by your answer.",
        "Your answer to the measurement question is stored by this site in your browser's local storage rather than as a cookie. It is kept until you clear your browser data or change the answer, and it records nothing but the word granted or declined.",
        "An opaque identifier for your basket is stored by this site in your browser's session storage rather than as a cookie. It is kept only until you close the tab, and it records no product details, quantities, email address or delivery address.",
      ],
      table: {
        caption: "Cookies this site can set",
        columns: ["Cookie", "Provider", "Purpose", "Duration"],
        rows: [
          ["_ga, _ga_*", "Google Analytics", "Analytics and site usage measurement", "Up to 2 years"],
          ["_fbp", "Meta", "Advertising measurement and analytics", "Up to 3 months"],
          [
            "Cloudflare security cookies",
            "Cloudflare",
            "Security, traffic management and protection against malicious traffic",
            "Varies",
          ],
        ],
        notes: [
          "Google Analytics and Meta cookies are used only with your consent. Cloudflare security cookies are strictly necessary for the operation and security of the site and do not require consent.",
        ],
      },
    },
    {
      anchor: "processors",
      heading: "Who else handles your data",
      covers: ["third-party-processors", "third-country-transfers"],
      body: [
        "These are the companies that handle data when you use this site, and this is all of them.",
        "Cloudflare serves this site's DNS, terminates its encryption, and provides the challenge that protects the contact and newsletter forms from automated abuse. It therefore processes your IP address and request metadata for every page you load. This is not optional: it is how the site is delivered at all.",
        "Stripe processes payments. When you pay, your card details go to Stripe directly and we never receive them. Stripe holds the payment record.",
        "Google Analytics measures how the site is used, only after you consent, and never on our test environment.",
        "If you consent, this site sends Meta an advertising measurement signal so we can see whether our advertising works. Meta also uses what it receives for its own purposes, under its own responsibility; for the collection and sending of this data, we and Meta are joint controllers. Nothing is sent before you consent.",
        "Brevo delivers the newsletter and holds the address you gave us for it, until you unsubscribe.",
        "Order and contact email is sent through our own mail server. It is not handed to a bulk email provider.",
        "Google, Meta, Stripe and Cloudflare are US companies, and using them means some data is processed in the United States. Each participates in the EU–US Data Privacy Framework, and standard contractual clauses apply where it does not cover a transfer.",
        "We do not sell data. Apart from the advertising measurement you can refuse above, no company named here may use your data for its own advertising, and there is no third party on this site that is not named above.",
      ],
    },
    {
      anchor: "contact",
      heading: "Your data, and how to reach us about it",
      covers: ["processing-lawful-bases"],
      body: [
        "The legal bases: fulfilling your order and answering your messages is performance of a contract; keeping order records for seven years is a legal obligation under Estonian accounting law; delivering and defending the site is our legitimate interest; measurement and the newsletter run on your consent alone.",
        "When you order, we hold what an order needs: your name, delivery address, email address, what you bought and what you paid. Estonian accounting law requires us to keep the record for seven years from the end of the financial year the order falls in, and we delete it after that.",
        "When you write to us, we keep the message and your address so we can answer, and so we can find the conversation again if you come back about the same order. We keep it for two years after the last message in the conversation, and then delete it.",
        "When you subscribe to the newsletter, we hold your email address and nothing else. Every message has an unsubscribe link, and using it removes you.",
        "You may ask what we hold about you, ask for it to be corrected, ask for it to be deleted, ask us to pause using it, ask for a copy, or object to how we use it. Write to {merchantContactAddress} and a person will read it.",
        "If we get it wrong you may complain to your national data protection authority. In Estonia that is the Andmekaitse Inspektsioon.",
        "The controller is {merchantLegalName}, {merchantRegisteredAddress}.",
      ],
    },
  ],
};
