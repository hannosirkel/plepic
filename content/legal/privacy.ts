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
 * ## The fourth row is this site's own cookie, 2026-08-18
 *
 * `document.cookie` is no longer empty, and the table is no longer three
 * third-party cookies. `plepic_destination` is set by
 * `storefront/src/components/shop/DestinationSelector.tsx` when a visitor
 * chooses which country the price should be quoted for — necessary because the
 * advertised figure became destination-dependent when VAT started being added
 * to a net price rather than contained in a gross one.
 *
 * **It is a row and not a sentence, which is the opposite of the two stores
 * above it, and the distinction is the one this section has always drawn.** The
 * consent answer and the basket identifier are prose because they are *not*
 * cookies: they have no provider and no expiry, so three of the four columns
 * would be empty. This one is a cookie, with a provider — us — and a duration,
 * so it takes the shape the table exists for.
 *
 * The second note says what a row cannot: that it is set only in response to
 * the visitor's own act, and that it holds a two-letter country code and
 * nothing else. It needs no consent — a preference stored because the user
 * asked for it is storage "strictly necessary for a service the user explicitly
 * requested" under ePrivacy Article 5(3) — and saying so keeps every row's
 * consent status stated, which is how the operator's table of 2026-08-10 was
 * written.
 *
 * The guard is not decorative here either:
 * `storefront/tests/browser-storage-disclosure.test.ts` refuses **any**
 * `document.cookie` write in `storefront/src/` except from the one file it has
 * been told about, precisely so a first-party cookie cannot appear without this
 * table growing.
 *
 * ## The online game, 2026-10-13
 *
 * Lunar Base can be played online under `/play/lunar-base` on this domain. A
 * separate process serves it, from the public repository
 * `plepicgames/lunar-base`, and the product page is about to link to it. Two
 * paragraphs say what that process does with a visitor's data, and every
 * claim in them is taken from that repository's `docs/current/` and its
 * decisions 0007 and 0010, not from this one:
 *
 * - **In `contact`, after the newsletter**, because that section already runs
 *   "when you order", "when you write to us", "when you subscribe": the player
 *   name (server memory only, no account), the session identifier the game
 *   keeps in session storage, the game log (seed and choices by seat number,
 *   deleted 30 days after the game) and the IP address (connection and
 *   new-game limits only, never logged).
 * - **In `processors`, before the transfer paragraph**, because that section
 *   says "this is all of them" and ends "there is no third party on this site
 *   that is not named above". When a game's creator chooses the Jev opponent,
 *   the game server sends TypeSafe what Jev's seat can see of the game. That is
 *   a company handling data on this site, so it is named, with exactly what is
 *   sent. The engine's view carries seat numbers and no names, so no name and
 *   no address goes with it.
 *
 * The session identifier is disclosed in the game's own paragraph and not
 * beside the two stores in `consent`: those are stores `storefront/src/`
 * writes, which `storefront/tests/browser-storage-disclosure.test.ts` derives
 * from a walk of that directory, and the game's client is not in it.
 *
 * **Two things these paragraphs do not settle, and no qualified reader has
 * read them.** They name no legal basis of their own for the game; the
 * existing sentence "delivering and defending the site is our legitimate
 * interest" is the nearest one, and whether it carries the game is the
 * operator's call. And the transfer paragraph still lists four companies:
 * where TypeSafe processes what it is sent is not recorded in either
 * repository, and what it is sent holds no personal data. If either the
 * game's retention or what the Jev request carries changes, **these
 * paragraphs are part of what has to change with it.**
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
          [
            "plepic_destination",
            "Plepic Games",
            "Remembers the destination you asked us to show the price for, so the figure you see is the one for that country",
            "Up to 1 year",
          ],
        ],
        notes: [
          "Google Analytics and Meta cookies are used only with your consent. Cloudflare security cookies are strictly necessary for the operation and security of the site and do not require consent.",
          "The destination cookie is set only when you change the destination yourself, and it holds nothing but the two-letter code of the country you chose. It records nothing about you and is not used for measurement or advertising.",
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
        "TypeSafe runs Jev, a computer opponent that the online Lunar Base game offers. If the person who creates a game chooses Jev, the game server sends TypeSafe what Jev's seat can see of that game: its cards, the scores, the recent moves and the choice to be made, once for each decision Jev makes. Players appear in it as seat numbers only. No player name and no IP address is sent.",
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
        "When you play Lunar Base online, the game asks for a player name and for nothing else: there is no account and no sign-in. The name is shown to the other players and is held only in the memory of the game server, while your session lasts. A random session identifier is kept in your browser's session storage until you close the tab, so that reloading the page keeps your seat. The server keeps a log of each game, which holds the random seed the game started from and the choices made, by seat number, and no name and no IP address. It deletes the log 30 days after the game. Your IP address is used only to limit how many connections and new games come from one address; the game server keeps it in memory and writes it to no log.",
        "You may ask what we hold about you, ask for it to be corrected, ask for it to be deleted, ask us to pause using it, ask for a copy, or object to how we use it. Write to {merchantContactAddress} and a person will read it.",
        "If we get it wrong you may complain to your national data protection authority. In Estonia that is the Andmekaitse Inspektsioon.",
        "The controller is {merchantLegalName}, {merchantRegisteredAddress}.",
      ],
    },
  ],
};
