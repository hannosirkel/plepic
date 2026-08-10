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

import { ContactForm } from "../src/components/forms/ContactForm.js";
import { NewsletterForm } from "../src/components/forms/NewsletterForm.js";

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
