/**
 * Structural checks for `NewsletterForm` and `ContactForm` — the two forms
 * this unit mounts `TurnstileWidget` and `HoneypotField` into, per the
 * packet's "your forms mount them." Rendered with `renderToStaticMarkup`,
 * consistent with the rest of this suite (no jsdom/Playwright in the tree —
 * see `tests/mockup-layout.test.ts`'s doc comment), so this checks markup
 * shape and accessible wiring, not interactive behaviour.
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
