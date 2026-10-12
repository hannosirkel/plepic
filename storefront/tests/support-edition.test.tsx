/**
 * The support page, the rulebook page and the two public forms read their
 * words from the edition they are given, and a form is answered in the
 * edition it was rendered in.
 *
 * The proofs are the two `home-edition.test.tsx` uses, a render under the
 * marker fixture and a scan of the source, and one more that a form needs.
 *
 * **A form's answer is not in any static render.** It is written by a Server
 * Function after a press, and the form shows it from `useActionState`. So
 * each form is rendered, the hidden fields it would post are read back out of
 * its markup and handed to the real Server Function, and the form is rendered
 * again holding the answer. Nothing between the edition a page was rendered
 * in and the sentence a visitor reads is assumed: a form that did not post
 * its edition, or a function that read another field, shows the default
 * edition's sentence here, marked and wrong.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { pagesByLocale } from "../../content/index.js";
import { DEFAULT_LOCALE, LOCALES, LOCALE_DEFINITIONS, type Locale } from "../../content/routes.js";
import type { Page } from "../../content/schema.js";
import { RulebookRoute, SupportRoute } from "../src/app/localized-routes.js";
import { ContactForm, contactFields } from "../src/components/forms/ContactForm.js";
import { NewsletterForm } from "../src/components/forms/NewsletterForm.js";
import { submitContact, submitNewsletter } from "../src/components/forms/public-form-actions.js";
import { RulebookPageContent } from "../src/components/pages/RulebookPageContent.js";
import { SupportPageContent } from "../src/components/pages/SupportPageContent.js";
import { CHROME_STRINGS, LANGUAGE_SWITCHER_LABELS } from "../src/lib/chrome-strings.js";
import { editionsMarkedIn, markedFor, unmarkedText } from "./helpers/marker-site-copy.js";
import { readerFacingLiterals } from "./helpers/reader-facing-literals.js";

type Editions = typeof import("../../content/editions.js");
type Outcome = Awaited<ReturnType<typeof submitContact>>;

/** What the test decides for the two things a render cannot: the relay's answer and the form's state. */
const stage = vi.hoisted(() => ({ relayed: true, outcome: null as unknown }));

/* Every locale gets a marked copy of its own, as in `home-edition.test.tsx`. */
vi.mock("../../content/editions.js", async (importOriginal) => {
  const actual = await importOriginal<Editions>();
  const { markSiteCopy } = await import("./helpers/marker-site-copy.js");
  const source = actual.siteCopyFor("en");
  const siteCopyByLocale = Object.fromEntries(
    Object.keys(actual.siteCopyByLocale).map((locale) => [locale, markSiteCopy(source, locale)]),
  );

  return { ...actual, siteCopyByLocale, siteCopyFor: (locale: string) => siteCopyByLocale[locale] };
});
/* Every edition publishes the default edition's routes, so each route view answers for each. */
vi.mock("../../content/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../content/index.js")>();
  const pagesByLocale = Object.fromEntries(
    Object.keys(actual.pagesByLocale).map((locale) => [locale, actual.pagesByLocale.en]),
  );
  return { ...actual, pagesByLocale };
});
vi.mock("../src/config/runtime-config.js", () => ({
  getRuntimeConfig: () => ({
    medusa: { backendUrl: "http://backend.test", publishableKey: "pk_test" },
    turnstile: { siteKey: "test-site-key" },
    merchant: { legalName: null, registeredAddress: null, registrationNumber: null, vatNumber: null, contactAddress: "hello@example.com", phoneNumber: null, returnAddress: null },
    externalTargets: {},
  }),
}));
vi.mock("../src/lib/nonce.js", () => ({ getRequestNonce: async () => "abc" }));
/* The relays to Medusa: what they do with a post is `contact-submit.test.ts`'s and `newsletter-submit.test.ts`'s. */
vi.mock("../src/components/forms/contact-submit.js", () => ({
  submitContactMessage: async () => ({ ok: stage.relayed }),
}));
vi.mock("../src/components/forms/newsletter-submit.js", () => ({
  submitNewsletterAddress: async () => ({ ok: stage.relayed }),
}));
/* A static render never holds an answer, so the hook that holds it is handed one. */
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: (action: unknown, initial: unknown) => [stage.outcome ?? initial, action, false],
  };
});

const actualEditions = await vi.importActual<Editions>("../../content/editions.js");
const english = actualEditions.siteCopyFor(DEFAULT_LOCALE);
const { siteCopyByLocale: fixture } = await import("../../content/editions.js");

const srcDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "src");

function stringsIn(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(stringsIn);
}

/** The words these pages show that are not `SiteCopy`'s, each for a reason. */
function wordsFromElsewhere(locale: Locale): readonly string[] {
  return [
    // Header and footer labels: `src/lib/chrome-strings.ts`, keyed by locale.
    ...stringsIn(CHROME_STRINGS[locale]),
    // The language selector names every edition in its own language, on every edition.
    ...Object.values(LANGUAGE_SWITCHER_LABELS),
    // The game's name, as printed on the box: the header's link to its page.
    "Lunar Base",
    // The publisher's name, as the footer wordmark's `alt`, and the platforms' own names.
    "Plepic Games",
    "Instagram",
    "Facebook",
    // `HoneypotField`'s label: `aria-hidden` and off-screen, a trap for a script that no visitor reads.
    "Leave this field empty",
  ];
}

/** `text` as the fixture holds it for `locale`, escaped as a render escapes it. */
const rendered = (locale: string, text: string): string =>
  markedFor(locale, text).replaceAll("&", "&amp;").replaceAll("'", "&#x27;");

const supportPage = (locale: Locale): string =>
  renderToStaticMarkup(
    <SupportPageContent locale={locale} turnstileSiteKey="test-site-key" nonce="abc" merchantContactAddress="hello@example.com" />,
  );
const rulebookPage = (locale: Locale): string => renderToStaticMarkup(<RulebookPageContent locale={locale} />);

describe("the support page under the marker fixture", () => {
  for (const locale of LOCALES) {
    const html = supportPage(locale);

    it(`shows no unmarked sentence and no other edition's in ${locale}`, () => {
      expect(unmarkedText(html, wordsFromElsewhere(locale))).toEqual([]);
      expect(editionsMarkedIn(html)).toEqual([locale]);
    });

    /* A page that rendered nothing would pass the test above. */
    it(`shows the edition's own sentences in ${locale}`, () => {
      const expected = [
        english.interface.support.faqHeading,
        english.interface.product.boxHeading,
        english.interface.product.tutorialHeading,
        english.interface.product.tutorialTitle,
        english.interface.forms.verificationLabel,
        english.support.supportIntro.heading,
        english.support.rulesFaq[0]!.question,
        english.support.contactForm.submitLabel,
        english.lunarBase.inTheBox[0]!.term,
        english.support.contact.body[1]!.replace("{merchantContactAddress}", "hello@example.com"),
      ];
      for (const sentence of expected) expect(html).toContain(rendered(locale, sentence));
    });

    it(`links the rulebook inside ${locale}`, () => {
      expect(html).toContain(`href="${LOCALE_DEFINITIONS[locale].pathPrefix}/support/lunar-base/rulebook"`);
    });

    it(`is what the support route renders for ${locale}`, async () => {
      expect(renderToStaticMarkup(await SupportRoute({ routeId: "support", locale }))).toBe(html);
    });
  }

  it("is the default edition's page when no locale is given", () => {
    expect(
      renderToStaticMarkup(
        <SupportPageContent turnstileSiteKey="test-site-key" nonce="abc" merchantContactAddress="hello@example.com" />,
      ),
    ).toBe(supportPage(DEFAULT_LOCALE));
  });
});

describe("the rulebook page under the marker fixture", () => {
  for (const locale of LOCALES) {
    const html = rulebookPage(locale);

    it(`shows no unmarked sentence and no other edition's in ${locale}`, () => {
      expect(unmarkedText(html, wordsFromElsewhere(locale))).toEqual([]);
      expect(editionsMarkedIn(html)).toEqual([locale]);
    });

    it(`shows the edition's own sentences in ${locale}, the file's size inside its sentence`, () => {
      const copy = english.interface.rulebook;
      const size = /(\d+[.,]\d) MB/.exec(html)?.[1];

      expect(size).toBeDefined();
      for (const sentence of [copy.heading, copy.lede, copy.openLabel, copy.downloadNote.replace("%megabytes%", size!)]) {
        expect(html).toContain(rendered(locale, sentence));
      }
      expect(html).not.toContain("%megabytes%");
    });

    it(`is what the rulebook route renders for ${locale}`, () => {
      expect(renderToStaticMarkup(RulebookRoute({ routeId: "rulebook", locale }))).toBe(html);
    });
  }

  it("is the default edition's page when no locale is given", () => {
    expect(renderToStaticMarkup(<RulebookPageContent />)).toBe(rulebookPage(DEFAULT_LOCALE));
  });

  it("uses the Estonian PDF after its document is published", () => {
    const html = rulebookPage("et");
    expect(html).toContain('href="/documents/lunar-base-rulebook-et.pdf"');
    expect(html).toContain('hrefLang="et"');
    expect(html).not.toContain("Reegliraamat on inglise keeles.");
  });
});

interface PublicForm {
  readonly name: string;
  readonly render: (locale: Locale) => ReactElement;
  readonly action: (previous: unknown, formData: FormData) => Promise<Outcome>;
  /** The default edition's sentence for each answer, as a configured deployment resolves it. */
  readonly sent: string;
  readonly notSent: string;
}

const PUBLIC_FORMS: readonly PublicForm[] = [
  {
    name: "newsletter",
    render: (locale) => <NewsletterForm locale={locale} turnstileSiteKey="test-site-key" nonce="abc" />,
    action: submitNewsletter,
    sent: english.publisher.newsletter.successMessage,
    notSent: english.publisher.newsletter.errorMessage,
  },
  {
    name: "contact",
    render: (locale) => <ContactForm locale={locale} turnstileSiteKey="test-site-key" nonce="abc" />,
    action: submitContact,
    sent: english.support.contactForm.successMessage,
    notSent: english.support.contactForm.errorMessage.replace("{merchantContactAddress}", "hello@example.com"),
  },
];

/** The hidden controls a browser would post from `html`, as it would post them. */
function hiddenFieldsOf(html: string): FormData {
  const form = new FormData();
  for (const [tag] of html.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g)) {
    const name = /name="([^"]*)"/.exec(tag)?.[1];
    if (name !== undefined) form.append(name, /value="([^"]*)"/.exec(tag)?.[1] ?? "");
  }
  return form;
}

/** `form` rendered in `locale`, pressed, and rendered again holding the answer. */
async function answered(form: PublicForm, locale: Locale, relayed: boolean): Promise<string> {
  stage.relayed = relayed;
  stage.outcome = null;
  const outcome = await form.action(null, hiddenFieldsOf(renderToStaticMarkup(form.render(locale))));
  stage.outcome = outcome;
  try {
    return renderToStaticMarkup(form.render(locale));
  } finally {
    stage.outcome = null;
  }
}

const answerIn = (html: string): string | undefined =>
  /<p\b[^>]*data-submission="1"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1];

describe("a public form is answered in the edition it was rendered in", () => {
  for (const form of PUBLIC_FORMS) {
    for (const locale of LOCALES) {
      for (const [state, relayed, sentence] of [
        ["success", true, form.sent],
        ["error", false, form.notSent],
      ] as const) {
        it(`${form.name}: its ${state} state in ${locale} shows that edition's sentence and no unmarked one`, async () => {
          const html = await answered(form, locale, relayed);

          expect(answerIn(html)).toBe(rendered(locale, sentence));
          expect(unmarkedText(html, wordsFromElsewhere(locale))).toEqual([]);
          expect(editionsMarkedIn(html)).toEqual([locale]);
        });
      }
    }

    it(`${form.name}: posts its edition from every edition but the default, which posts what it always did`, () => {
      for (const locale of LOCALES) {
        const posted = hiddenFieldsOf(renderToStaticMarkup(form.render(locale)));
        expect(posted.get("locale"), locale).toBe(locale === DEFAULT_LOCALE ? null : locale);
      }
    });
  }
});

/**
 * The field is whatever the client posted. A value that is not a declared
 * locale is not an edition, and the answer is the default edition's: never a
 * thrown error, which a visitor would meet as a 500.
 */
describe("a post that names no edition this site has is answered in the default one", () => {
  const undeclared: readonly (readonly [string, FormDataEntryValue])[] = [
    ["an unknown code", "xx"],
    ["a declared code in another case", "ET"],
    ["a language tag with a region", "en-GB"],
    ["an empty value", ""],
    ["a property every object has", "constructor"],
    ["the prototype's name", "__proto__"],
    ["markup", "<script>alert(1)</script>"],
    ["a file", new File(["et"], "locale.txt")],
  ];

  for (const form of PUBLIC_FORMS) {
    for (const [description, value] of undeclared) {
      it(`${form.name}: ${description}`, async () => {
        for (const [relayed, sentence] of [[true, form.sent], [false, form.notSent]] as const) {
          stage.relayed = relayed;
          const post = new FormData();
          post.set("locale", value);

          expect((await form.action(null, post)).message).toBe(markedFor(DEFAULT_LOCALE, sentence));
        }
      });
    }

  }
});

/**
 * No render reaches a validation error: it appears when a visitor presses
 * Send. The form used to build each one from a lower-cased label, and the
 * default edition must still say exactly that.
 */
describe("the contact form's validation errors", () => {
  it("are, in the default edition, the sentences the form built from its labels", () => {
    for (const field of contactFields(english)) {
      const label = field.label.toLowerCase();

      expect(field.missing).toBe(`Enter ${label}.`);
      expect(field.invalid).toBe(field.type === "email" ? `Enter a valid ${label}.` : undefined);
    }
  });

  it("are the edition's own in every edition, like the labels beside them", () => {
    for (const locale of LOCALES) {
      const words = contactFields(fixture[locale]!).flatMap((field) => [field.label, field.missing, field.invalid ?? ""]);

      expect(words).toHaveLength(12);
      expect(editionsMarkedIn(words.join("")), locale).toEqual([locale]);
      expect(unmarkedText(words.join(""), []), locale).toEqual([]);
    }
  });
});

/**
 * Each view asks the page registry itself, as `HomeRoute` does: an edition
 * that does not publish the page has no site copy to render it from, and the
 * answer is a 404, not the error `siteCopyFor` throws.
 */
describe("a route view answers 404 for an edition that does not publish its page", () => {
  const pages = pagesByLocale as Record<Locale, readonly Page[]>;
  const notFound = { digest: expect.stringContaining("404") };

  it("the support route and the rulebook route", async () => {
    const edition = LOCALES.find((locale) => locale !== DEFAULT_LOCALE)!;
    const published = pages[edition];
    pages[edition] = published.filter((page) => page.route !== "support" && page.route !== "rulebook");
    try {
      await expect(SupportRoute({ routeId: "support", locale: edition })).rejects.toMatchObject(notFound);
      expect(() => RulebookRoute({ routeId: "rulebook", locale: edition })).toThrow(expect.objectContaining(notFound));
    } finally {
      pages[edition] = published;
    }
  });
});

describe("the support group's components hold no sentence of their own", () => {
  it("finds no reader-facing literal in them, two fragments of identifiers aside", () => {
    const components = [
      "components/pages/SupportPageContent.tsx",
      "components/pages/RulebookPageContent.tsx",
      "components/forms/ContactForm.tsx",
      "components/forms/form-locale.tsx",
      "components/forms/public-form-actions.ts",
      "components/turnstile/TurnstileWidget.tsx",
    ];
    const found = Object.fromEntries(
      components.map((name) => [name, readerFacingLiterals(name, readFileSync(join(srcDir, name), "utf8"))]),
    );

    expect(found).toEqual({
      "components/pages/SupportPageContent.tsx": [],
      "components/pages/RulebookPageContent.tsx": [],
      // The suffix of a field error's element id.
      "components/forms/ContactForm.tsx": ["-error"],
      "components/forms/form-locale.tsx": [],
      "components/forms/public-form-actions.ts": [],
      // The prefix of the widget's `data-testid`.
      "components/turnstile/TurnstileWidget.tsx": ["turnstile-"],
    });
  });
});
