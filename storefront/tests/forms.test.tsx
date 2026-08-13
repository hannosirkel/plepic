/**
 * Structural checks for `NewsletterForm` and `ContactForm` — the two forms
 * this unit mounts `TurnstileWidget` and `HoneypotField` into, per the
 * packet's "your forms mount them." Rendered with `renderToStaticMarkup`,
 * consistent with the rest of this suite (no jsdom/Playwright in the tree —
 * see `tests/mockup-layout.test.ts`'s doc comment), so this checks markup
 * shape and accessible wiring, not interactive behaviour.
 *
 * **What this file can and cannot say about the `POST` fix.** Both forms take
 * a Server Function as their `action` (see
 * `src/components/forms/public-form-actions.ts`). Outside Next.js's bundler
 * there is no server reference to resolve, so `react-dom/server` treats the
 * action as an ordinary client function and renders its own neutraliser —
 * `action="javascript:throw …"` — rather than the real `method="POST"` form a
 * built server serves. So the assertion available here is the one that still
 * has teeth: **the form is never a GET**, and it always carries an `action`.
 * Deleting `action={submit}` from either component drops the attribute
 * entirely and reddens these tests.
 *
 * The real shape — `method="POST"`, an unhydrated submission that reaches the
 * server, and the answer rendered into the HTML of the POST response with no
 * field value anywhere near a URL — is asserted against a real build and a
 * running server in `tests/build-and-serve.test.ts`.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { newsletter as newsletterCopy } from "../../content/publisher.js";
import { ContactForm } from "../src/components/forms/ContactForm.js";
import { NewsletterForm } from "../src/components/forms/NewsletterForm.js";
import {
  reportNewsletterNotSent,
} from "../src/components/forms/public-form-actions.js";

describe("NewsletterForm", () => {
  const html = renderToStaticMarkup(<NewsletterForm turnstileSiteKey="test-site-key" nonce="abc" />);

  it("ties its email label to its input", () => {
    const forId = /<label[^>]*htmlFor="([^"]*)"/i.exec(html)?.[1] ?? /<label[^>]*for="([^"]*)"/.exec(html)?.[1];
    expect(forId, "no label/for pairing found").toBeTruthy();
    expect(html).toContain(`id="${forId}"`);
  });

  it("marks the email field required and typed for native validation", () => {
    const emailTag = /<input[^>]*name="email"[^>]*>/.exec(html)?.[0] ?? "";
    expect(emailTag).toContain('type="email"');
    expect(emailTag).toMatch(/required/);
  });

  it("mounts the honeypot, distinctly named for this form", () => {
    expect(html).toContain("newsletter-additional-notes");
    expect(html).toContain("Leave this field empty");
  });

  it("mounts the Turnstile widget with the supplied site key", () => {
    expect(html).toContain('data-sitekey="test-site-key"');
    expect(html).toContain('data-testid="turnstile-newsletter"');
  });

  it("renders no error text before any interaction", () => {
    expect(html).not.toContain('role="alert"');
  });

  it("renders the consent note verbatim from content", () => {
    expect(html).toContain("You can unsubscribe from any message.");
  });
});

describe("ContactForm", () => {
  const html = renderToStaticMarkup(<ContactForm turnstileSiteKey="test-site-key" nonce="abc" />);

  it("renders all four fields, each labelled", () => {
    for (const name of ["name", "email", "subject", "message"]) {
      expect(html, `missing field ${name}`).toMatch(new RegExp(`name="${name}"`));
    }
    expect(html.match(/<label\b/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("uses a real <textarea> for the message field", () => {
    expect(html).toMatch(/<textarea[^>]*name="message"/);
  });

  it("marks every field required", () => {
    for (const name of ["name", "email", "subject", "message"]) {
      const fieldTag = new RegExp(`<(?:input|textarea)[^>]*name="${name}"[^>]*>`).exec(html)?.[0] ?? "";
      expect(fieldTag, `no tag found for ${name}`).toBeTruthy();
      expect(fieldTag).toMatch(/required/);
    }
  });

  it("mounts a distinctly named honeypot and the Turnstile widget", () => {
    expect(html).toContain("contact-additional-notes");
    expect(html).toContain('data-testid="turnstile-contact"');
  });

  it("carries a real submit button with the content-sourced label", () => {
    expect(html).toMatch(/<button type="submit"[^>]*>Send<\/button>/);
  });
});

describe("neither form is a GET form", () => {
  const forms = [
    ["NewsletterForm", renderToStaticMarkup(<NewsletterForm turnstileSiteKey="k" nonce="abc" />)],
    ["ContactForm", renderToStaticMarkup(<ContactForm turnstileSiteKey="k" nonce="abc" />)],
  ] as const;

  for (const [name, html] of forms) {
    const form = /<form\b[^>]*>/.exec(html)?.[0] ?? "";

    it(`${name} renders a form at all`, () => {
      expect(form).not.toBe("");
    });

    it(`${name} declares an action, so the browser has somewhere to post`, () => {
      expect(
        form,
        "a form with no action and no method is a GET to the current URL, " +
          "which puts every field value in the query string",
      ).toMatch(/\saction="/);
    });

    it(`${name} never declares method="get"`, () => {
      expect(form).not.toMatch(/method="get"/i);
    });

    it(`${name} keeps a live region in the document before anything is announced`, () => {
      expect(html).toContain('role="status"');
    });
  }
});

/**
 * **Every completed submission is announced, including consecutive identical
 * ones.**
 *
 * Both forms answer with the same fixed sentence every time, so while the
 * action returned that bare string a second consecutive press handed
 * `useActionState` a value React judges equal to the one it already had:
 * React bailed out, the effect keyed on the outcome never re-ran, focus
 * stayed on the submit button, and the live region recorded **zero
 * mutations**. The answer was still on screen, so this was never a WCAG
 * failure — a screen-reader user simply got silence for a press that had
 * plainly done something.
 *
 * The property below is the one React actually tests. `Object.is(second,
 * first)` was `true` for two identical strings and is `false` for two
 * outcomes; `submissions` is the substantive half, and the message must stay
 * byte-identical while the value around it changes.
 *
 * This suite has no DOM (see this file's head), so what it cannot show is the
 * announcement itself. The counter reaching the rendered answer is asserted
 * end to end against a built server in `tests/build-and-serve.test.ts`, and
 * the live-region mutation count was measured in a browser.
 */
describe("a repeated submission is a new answer, not the same answer again", () => {
  const cases = [["newsletter", reportNewsletterNotSent, newsletterCopy.notSentMessage]] as const;

  for (const [name, action, sentence] of cases) {
    it(`${name}: answers with the fixed sentence from content/, every time`, async () => {
      const first = await action(null);
      const second = await action(first);
      expect(first.message).toBe(sentence);
      expect(second.message).toBe(sentence);
    });

    it(`${name}: returns a value React cannot mistake for the previous one`, async () => {
      const first = await action(null);
      const second = await action(first);
      expect(first.submissions).toBe(1);
      expect(second.submissions).toBe(2);
      expect(
        Object.is(second, first),
        "a second press produces a state React bails out of, so nothing is announced",
      ).toBe(false);
    });
  }
});

/**
 * MIN-10 of review pass 2. `previous` is not a value this server remembers:
 * React serialises the last outcome into the form as a plaintext hidden
 * control and the browser posts it back, so on the unhydrated path it is
 * whatever the client sent. Before the guard, `{"submissions":"…"}` reached
 * `+ 1` as a string and the rendered `data-submission` attribute was built by
 * **concatenation** — measured on a running server as
 * `data-submission="REVIEWER-TAMPERED-COUNT1"`.
 *
 * The property: whatever comes in, what comes out is the fixed `content/`
 * sentence and an integer. A count that cannot be used is treated as no count
 * at all, which is 1 — and nothing throws, because a form press must not be
 * answered with a 500.
 */
describe("a forged previous state cannot become part of the answer", () => {
  const actions = [["newsletter", reportNewsletterNotSent, newsletterCopy.notSentMessage]] as const;

  const forged: readonly (readonly [string, unknown])[] = [
    ["a string count", { submissions: "REVIEWER-TAMPERED-COUNT" }],
    ["markup as the count", { submissions: "<img src=x onerror=alert(1)>" }],
    ["an object as the count", { submissions: { a: 1 } }],
    ["a fractional count", { submissions: 1.5 }],
    ["NaN", { submissions: Number.NaN }],
    ["Infinity", { submissions: Number.POSITIVE_INFINITY }],
    ["a null count", { submissions: null }],
    ["no count at all", { message: "attacker prose" }],
    ["not an object", "not an object"],
    ["an array", []],
    ["undefined", undefined],
  ];

  for (const [name, action, sentence] of actions) {
    for (const [description, previous] of forged) {
      it(`${name}: ${description} is answered with the fixed sentence and 1`, async () => {
        const outcome = await action(previous);
        expect(outcome.message).toBe(sentence);
        expect(outcome.submissions).toBe(1);
      });
    }

    it(`${name}: an integer count is still the one thing it accepts`, async () => {
      expect((await action({ submissions: 41 })).submissions).toBe(42);
      expect((await action(null)).submissions).toBe(1);
    });

    it(`${name}: never returns a count that is not an integer`, async () => {
      for (const [, previous] of forged) {
        expect(Number.isInteger((await action(previous)).submissions)).toBe(true);
      }
    });
  }
});

describe("the Turnstile widget renders at a size that fits the card it sits in", () => {
  it("takes the compact size on both forms, without either passing one", () => {
    // Cloudflare: normal 300x65, flexible 100% with a 300px MINIMUM, compact
    // 150x140. The narrowest of these containers measures 174px.
    for (const html of [
      renderToStaticMarkup(<NewsletterForm turnstileSiteKey="k" nonce="abc" />),
      renderToStaticMarkup(<ContactForm turnstileSiteKey="k" nonce="abc" />),
    ]) {
      expect(html).toContain('data-size="compact"');
      expect(html).not.toContain('data-size="flexible"');
    }
  });
});

describe("both forms render nothing for the Turnstile widget when no site key is configured", () => {
  it("NewsletterForm", () => {
    const html = renderToStaticMarkup(<NewsletterForm turnstileSiteKey={null} nonce={undefined} />);
    expect(html).not.toContain("cf-turnstile");
  });

  it("ContactForm", () => {
    const html = renderToStaticMarkup(<ContactForm turnstileSiteKey={null} nonce={undefined} />);
    expect(html).not.toContain("cf-turnstile");
  });
});
