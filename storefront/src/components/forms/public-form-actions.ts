"use server";

/**
 * What the newsletter and contact forms do when the *browser* submits them
 * rather than React.
 *
 * ## Why the forms need an action at all
 *
 * A `<form>` with neither `method` nor `action` defaults to `method="get"`,
 * and a GET submission serialises **every named control into the query
 * string** — every one, not only the ones a visitor typed into. Both public
 * forms shipped that way, and the count is therefore one higher on each form
 * than the typed fields suggest:
 *
 * | form | controls in the URL | which |
 * |---|---|---|
 * | newsletter | **2 of 2** | `email`, `additional-notes` |
 * | contact | **5 of 5** | `name`, `email`, `subject`, `message`, `additional-notes` |
 *
 * `additional-notes` is the **honeypot** (`../turnstile/HoneypotField.tsx`
 * names it), so the anti-spam field a visitor cannot see was being published
 * alongside the ones they filled in — with its emptiness, which is what tells
 * a reader of the log whether the honeypot caught anything, in plain sight.
 * Measured on a rebuilt base revision, an unhydrated press of Subscribe
 * produced `/?email=…&additional-notes=`. From the URL it goes to the URL bar,
 * the browser's history, the `Referer` header of everything loaded next, and
 * every access log between the tunnel and Loki.
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
 * **They read nothing a visitor typed.** React calls a `useActionState`
 * action with two arguments, `(previousState, formData)`. Neither function
 * here binds the second one, so there is no expression anywhere in this
 * module that could read, log or store a field — the `FormData` object has no
 * name in this file and cannot acquire one without editing it. That is
 * deliberate and it is the same discipline `src/app/checkout/order/route.ts`
 * applies: nothing in this build can honestly receive a subscription or a
 * message. There is no newsletter subsystem (the plan forbids one outright)
 * and no submission host wired to the contact form; both are Task 5's work,
 * together with the server-side Turnstile verification.
 *
 * The first argument they *do* bind is this module's own previous return
 * value, and it exists for one reason: see `PublicFormOutcome` below.
 *
 * **They do not fabricate success.** A silent no-op that leaves the page
 * looking as though something was sent is its own defect — arguably a worse one
 * than the URL leak, because the visitor stops waiting for a reply that will
 * never come. Each function returns the sentence its own content module holds
 * for exactly this state: nothing was sent, nothing was stored, and — for the
 * contact form — the email address printed a few lines above is the way through
 * in the meantime.
 *
 * The returned message is a fixed string from `content/`. **No value a
 * visitor typed is ever put in it**, which is the whole point of the
 * exercise.
 */

import { newsletter } from "../../../../content/publisher.js";
import { contactForm } from "../../../../content/support.js";

/**
 * What a public form's action returns.
 *
 * `message` is the whole answer, and it is **a fixed string from `content/`**:
 * no value a visitor typed is ever put in it, which is the point of the
 * exercise. `submissions` carries no information for the reader at all — it
 * exists so that two consecutive identical answers are two distinct values.
 *
 * ## Why a counter is not decoration
 *
 * These functions returned the bare sentence, so a second press produced the
 * *same string* and `useActionState` handed back a value React judges equal to
 * the last one. Both forms key their focus effect on that value, so the effect
 * did not re-run; and the live region's text was unchanged, so the DOM inside
 * it was not touched either. Measured on the second consecutive hydrated
 * submit: focus stayed on the submit button and the `role="status"` region
 * recorded **zero mutations** — a sighted visitor saw the answer still on
 * screen (so this was never a WCAG failure) while a screen-reader user got
 * silence for a press that had plainly done something.
 *
 * Incrementing a counter makes every completed submission a new value, which
 * re-runs the effect. The forms then also key the rendered paragraph on it, so
 * the announcement itself is a real DOM change rather than a repaint of
 * identical text. See `NewsletterForm.tsx`'s `alertAnchor` block.
 *
 * It is a number and not a timestamp or a random id deliberately: it is
 * serialised into the form as the next submission's `previous` argument, so it
 * has to be small, stable and obviously free of anything about the visitor.
 */
export interface PublicFormOutcome {
  /** The sentence to show. Always a fixed string from `content/`. */
  readonly message: string;
  /** How many submissions this form has answered, counting from 1. */
  readonly submissions: number;
}

/** The count for the next answer, given the answer before it (if any). */
function nextSubmission(previous: PublicFormOutcome | null): number {
  return (previous?.submissions ?? 0) + 1;
}

/** The newsletter form's answer to a submission this build cannot act on. */
export async function reportNewsletterNotSent(
  previous: PublicFormOutcome | null,
): Promise<PublicFormOutcome> {
  return { message: newsletter.notSentMessage, submissions: nextSubmission(previous) };
}

/** The contact form's answer to a submission this build cannot act on. */
export async function reportContactNotSent(
  previous: PublicFormOutcome | null,
): Promise<PublicFormOutcome> {
  return { message: contactForm.notSentMessage, submissions: nextSubmission(previous) };
}
