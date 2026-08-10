"use server";

/**
 * What the newsletter and contact forms do when the *browser* submits them
 * rather than React.
 *
 * ## Why the forms need an action at all
 *
 * A `<form>` with neither `method` nor `action` defaults to `method="get"`,
 * and a GET submission serialises **every named control into the query
 * string**. Both public forms shipped that way. An unhydrated press of
 * Subscribe put the visitor's email address into the URL — and from there into
 * the URL bar, the browser's history, the `Referer` header of everything
 * loaded next, and every access log between the tunnel and Loki. The contact
 * form did the same with a name, an email address, a subject and the whole
 * message body.
 *
 * That is not a hypothetical state. The forms are `"use client"` components,
 * so *every* visitor passes through the window between first paint and
 * hydration, and under this application's CSP — `'strict-dynamic'`, see
 * `src/lib/csp.ts` — a nonce mismatch leaves a page that paints and never
 * hydrates at all. JavaScript switched off is the third route in.
 *
 * `src/components/shop/checkout-order-post.ts` records the same defect and the
 * same reasoning for the checkout form, which was fixed first.
 *
 * ## Why a Server Function rather than a route handler
 *
 * The checkout answers this with `method="post" action="/checkout/order"` and
 * a route that redirects back with a fixed marker in the query string. That
 * shape needs three things: a route under `src/app/`, a `searchParams` read in
 * the page, and a marker rendered by the page component. **None of those three
 * files is inside this unit's authority** (see the unit's Files list), and the
 * two forms are mounted inside page components — `HomepageMockup`,
 * `SupportPageContent` — that this unit may not edit either.
 *
 * A Server Function reaches the same guarantee from inside the form component
 * alone. React renders `<form action={formAction}>` as a real `method="POST"`
 * form pointing at the page's own URL, so a press with no JavaScript sends the
 * field values **in a request body**: no query string, no history entry, no
 * `Referer`, no access-log line. Next.js runs the function on the server and
 * re-renders the page with the returned state, which means the answer is in
 * the HTML of the POST response — in the first paint, with no script involved.
 * That is what `useActionState` exists for, and it is the documented
 * progressive-enhancement path.
 *
 * ## What these functions do, and what they refuse to do
 *
 * **They read nothing.** Neither takes the `FormData` argument React passes,
 * so there is no expression anywhere in this module that could read, log or
 * store a field. That is deliberate and it is the same discipline
 * `src/app/checkout/order/route.ts` applies: nothing in this build can honestly
 * receive a subscription or a message. There is no newsletter subsystem (the
 * plan forbids one outright) and no submission host wired to the contact form;
 * both are Task 5's work, together with the server-side Turnstile
 * verification.
 *
 * **They do not fabricate success.** A silent no-op that leaves the page
 * looking as though something was sent is its own defect — arguably a worse one
 * than the URL leak, because the visitor stops waiting for a reply that will
 * never come. Each function returns the sentence its own content module holds
 * for exactly this state: nothing was sent, nothing was stored, and — for the
 * contact form — the email address printed a few lines above is the way through
 * in the meantime.
 *
 * The returned value is a fixed string from `content/`. **No value a visitor
 * typed is ever put in it**, which is the whole point of the exercise.
 */

import { newsletter } from "../../../../content/publisher.js";
import { contactForm } from "../../../../content/support.js";

/** The newsletter form's answer to a submission this build cannot act on. */
export async function reportNewsletterNotSent(): Promise<string> {
  return newsletter.notSentMessage;
}

/** The contact form's answer to a submission this build cannot act on. */
export async function reportContactNotSent(): Promise<string> {
  return contactForm.notSentMessage;
}
