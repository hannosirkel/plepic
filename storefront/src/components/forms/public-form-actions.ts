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
 * Both actions pass bounded `FormData` to server-only relays. Medusa verifies
 * Turnstile, then either upserts the configured provider list or relays the
 * contact message without local persistence or logging.
 *
 * The first argument they *do* bind is the previous answer as the **client
 * posts it back**, and it exists for one reason: see `PublicFormOutcome`
 * below, which also says why it is treated as untrusted input.
 *
 * **They do not fabricate success.** Each returns success only after Medusa
 * answers 204 and otherwise returns its fixed configuration-resolved error
 * copy.
 *
 * The returned message is a fixed string from `content/`. **No value a
 * visitor typed is ever put in it**, which is the whole point of the
 * exercise.
 */

import { newsletter } from "../../../../content/publisher.js";
import { contactForm } from "../../../../content/support.js";
import { getRuntimeConfig } from "../../config/runtime-config.js";
import {
  placeholderValuesFrom,
  resolveConfigurationPlaceholders,
} from "../../lib/configuration-placeholders.js";
import { submitContactMessage } from "./contact-submit.js";
import { submitNewsletterAddress } from "./newsletter-submit.js";

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
 *
 * ## `previous` comes back **in**, and nothing authenticates it
 *
 * React's progressive enhancement serialises the last returned outcome into
 * the form it renders back, as a plaintext hidden control (`$ACTION_1:1`).
 * Nothing signs or encrypts it, so on the unhydrated path `previous` is
 * **whatever the client posted**, not something this server remembers. The
 * declared type is therefore a claim by the sender, not a fact — measured on a
 * running server, a forged `{"submissions":41}` rendered
 * `data-submission="42"`, and a forged `{"submissions":"…"}` was
 * *concatenated* rather than added, because `+ 1` on a string is not
 * arithmetic. {@link nextSubmission} narrows it instead, which is why both
 * actions take `unknown`.
 *
 * **That is a correctness fix and not a security one**, and it should not be
 * read as one: `message` is never read back out of `previous`, React escapes
 * the attribute the count lands in, a cross-site POST is refused by Next.js's
 * `Origin` check, and nothing here is stored or logged. The reason to say it
 * plainly is that **the next unit inherits this argument** — server-side
 * Turnstile verification and the actual submit both live on the far side of
 * it — and the rest of this comment reads as though the outcome only ever
 * travels outward.
 */
export interface PublicFormOutcome {
  /** The sentence to show. Always a fixed string from `content/`. */
  readonly message: string;
  /**
   * Which answer this is, counting from 1: one more than the count the
   * previous answer carried.
   *
   * **Not "how many submissions this form has answered"** — nothing on the
   * server counts anything. On the unhydrated path the previous count arrives
   * from the client (see above), so this is client-asserted and only as
   * trustworthy as the browser that sent it. It is still an integer and still
   * free of anything about the visitor, because {@link nextSubmission}
   * enforces both; its one job is to make two consecutive identical answers
   * two distinct values.
   */
  readonly submissions: number;
}

/**
 * The count for the next answer, given whatever came back in as the previous
 * one.
 *
 * The parameter is `unknown` deliberately. This value is posted by the client,
 * so a declared shape here would be a lie the compiler enforces nowhere at
 * runtime; `unknown` makes narrowing structurally unavoidable rather than a
 * call some later edit can quietly drop.
 *
 * **Anything that is not an integer becomes 1** — the same answer an absent
 * `previous` gets, because a previous state this function cannot use is not a
 * previous state. It never throws: a form press must not be answered with a
 * 500, and the visitor has done nothing wrong even when their browser has.
 * `Number.isInteger` and nothing beyond it is also deliberate. A range check
 * or a cap would be sanitisation theatre over a value that is never stored,
 * never logged and never read back as anything but a number — what the guard
 * has to buy is that a rendered attribute cannot be built out of a string the
 * client chose, and that is bought here.
 */
function nextSubmission(previous: unknown): number {
  const counted =
    typeof previous === "object" && previous !== null && "submissions" in previous
      ? previous.submissions
      : undefined;
  return typeof counted === "number" && Number.isInteger(counted) ? counted + 1 : 1;
}

/** Subscribes one explicitly submitted address through the configured provider relay. */
export async function submitNewsletter(
  previous: unknown,
  formData: FormData,
): Promise<PublicFormOutcome> {
  const result = await submitNewsletterAddress(formData, getRuntimeConfig().medusa);
  return {
    message: result.ok ? newsletter.successMessage : newsletter.errorMessage,
    submissions: nextSubmission(previous),
  };
}

/** Relays a validated contact message without retaining or echoing its fields. */
export async function submitContact(
  previous: unknown,
  formData: FormData,
): Promise<PublicFormOutcome> {
  const runtime = getRuntimeConfig();
  const result = await submitContactMessage(formData, runtime.medusa);
  const error = resolveConfigurationPlaceholders(
    contactForm.errorMessage,
    placeholderValuesFrom(runtime.merchant),
  );
  return {
    message: result.ok ? contactForm.successMessage : error,
    submissions: nextSubmission(previous),
  };
}
