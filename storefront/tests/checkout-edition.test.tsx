/**
 * The checkout reads its words from the edition it is given.
 *
 * The proofs are the ones `support-edition.test.tsx` uses: a render under the
 * marker fixture, and a scan of the source for what no static render reaches.
 * Three kinds of words on this page are not `SiteCopy`'s, and each is held to
 * its own source instead:
 *
 * - **the six legal sentences**, which `checkout-terms.ts` reads out of the
 *   edition's legal pages. They are compared with the paragraph at the same
 *   place in that edition's page, found here without calling the module;
 * - **country names**, which are data. An option is labelled with the
 *   edition's name and still submits the English one;
 * - **delivery method names**, which Medusa returns in English. A declared
 *   method is shown under the edition's name and recognised by Medusa's.
 *
 * The address Stripe returns a visitor to is the one value this task changes
 * in what is sent to a provider, so it is read back out of the call itself.
 *
 * Two parts of the page hang on state only an effect sets, which no static
 * render reaches: the options of the delivery method select, and what the
 * page shows once the order is placed. The first is held at the function
 * each option's charge is written by, the second at the component the page
 * renders in that state.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRef, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pagesByLocale } from "../../content/index.js";
import { legalPagesByLocale } from "../../content/legal/index.js";
import {
  CHECKOUT_RETURN_PATH,
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  ROUTE_PATHS,
  type Locale,
  type RouteId,
} from "../../content/routes.js";
import type { Page } from "../../content/schema.js";
import { CheckoutRoute, resolveLocalizedRoute } from "../src/app/localized-routes.js";
import {
  EMPTY_ADDRESS,
  fieldsFor,
  validate,
  type AddressValues,
} from "../src/components/shop/checkout-address.js";
import { CHECKOUT_ORDER_POST_PATH } from "../src/components/shop/checkout-order-post.js";
import { ConsentBanner } from "../src/components/analytics/ConsentManager.js";
import { NotFoundContent } from "../src/app/not-found-content.js";
import { generateMetadata as localizedMetadata } from "../src/app/[locale]/[[...segments]]/page.js";
import { StripePaymentReturn } from "../src/components/shop/StripePaymentReturn.js";
import { checkoutTermsFor, type CheckoutTerms } from "../src/components/shop/checkout-terms.js";
import {
  CheckoutConfirmation,
  CheckoutPageContent,
  deliveryChargeIn,
  deliveryMethodNameIn,
} from "../src/components/shop/CheckoutPageContent.js";
import { ParcelMachinePicker } from "../src/components/shop/ParcelMachinePicker.js";
import { ShopPageShell } from "../src/components/shop/ShopPageShell.js";
import {
  StripePaymentElement,
  checkoutReturnUrl,
  type StripePaymentElementHandle,
} from "../src/components/shop/StripePaymentElement.js";
import { declaredParcelMachineMethod, declaredShippingMethod, formatAmount } from "../src/lib/cart.js";
import { CartProvider } from "../src/lib/cart-store.js";
import { mockCatalogue, resolveCatalogue } from "../src/lib/catalogue.js";
import { CHROME_STRINGS, LANGUAGE_SWITCHER_LABELS } from "../src/lib/chrome-strings.js";
import { deliveryCountries, destinationForCountryName, destinationNameIn } from "../src/lib/destination.js";
import { MOCK_SCENARIOS, type MockScenario } from "../src/lib/mock-cart-actions.js";
import {
  FREE_SHIPPING_LABEL,
  NET_SHIPPING_SUFFIX,
  isParcelMachineOption,
  shippingOptionFigure,
  type GuestShippingOption,
  type ShippingFigureWording,
} from "../src/lib/store-checkout.js";
import { stripeConfirmationForStatus } from "../src/lib/store-payment.js";
import { routeIdForPath } from "../src/lib/urls.js";
import { editionsMarkedIn, markedFor, unmarkedText } from "./helpers/marker-site-copy.js";
import { readerFacingLiterals } from "./helpers/reader-facing-literals.js";

type Editions = typeof import("../../content/editions.js");

/**
 * What Stripe was asked to confirm, as `stripe.confirmPayment` received it, and
 * how it answers: with an error, or with a payment in `status`. `undefined`
 * is an answer that names no payment at all.
 */
const stripe = vi.hoisted(() => ({
  confirmed: [] as { confirmParams?: { return_url?: string } }[],
  loaded: true,
  refuses: false,
  status: "succeeded" as string | undefined,
}));

/**
 * The two states of the served path that only an effect reaches: a basket
 * restored from the browser's storage, and the parcel machine method chosen.
 * This suite has no DOM and runs no effect, so a test sets them here and the
 * two hooks that would have held them hand them over.
 */
const stage = vi.hoisted(() => ({
  restoredBasket: false,
  parcelMachines: null as readonly { zip: string; name: string; group: string }[] | null,
}));

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
/* Every edition publishes the default edition's routes, so the route view answers for each. */
vi.mock("../../content/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../content/index.js")>();
  const pagesByLocale = Object.fromEntries(
    Object.keys(actual.pagesByLocale).map((locale) => [locale, actual.pagesByLocale.en]),
  );
  return { ...actual, pagesByLocale };
});
vi.mock("../src/config/runtime-config.js", () => ({
  getRuntimeConfig: () => ({
    turnstile: { siteKey: "test-site-key" },
    stripe: { publishableKey: "pk_test_example" },
    externalTargets: {},
  }),
}));
vi.mock("../src/config/hosts.js", () => ({
  loadSiteHostConfig: () => ({ testHostnames: ["shop.example.test"] }),
}));
vi.mock("../src/lib/request-host.js", () => ({ getRequestHost: async () => "shop.example.test" }));
vi.mock("../src/lib/nonce.js", () => ({ getRequestNonce: async () => "abc" }));
vi.mock("../src/lib/destination-request.js", async () => {
  const { destinationForCode } = await import("../src/lib/destination.js");
  return { getRequestDestination: async () => destinationForCode("EE") };
});
vi.mock("../src/lib/cart-store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/cart-store.js")>();
  const { basketForScenario } = await import("../src/lib/mock-cart-actions.js");
  return {
    ...actual,
    useCart: () =>
      stage.restoredBasket ? { ...actual.useCart(), lines: basketForScenario("filled").lines } : actual.useCart(),
  };
});
vi.mock("../src/components/shop/useParcelMachineSelection.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/components/shop/useParcelMachineSelection.js")>();
  return {
    ...actual,
    useParcelMachineSelection: (args: Parameters<typeof actual.useParcelMachineSelection>[0]) => {
      const selection = actual.useParcelMachineSelection(args);
      return stage.parcelMachines === null
        ? selection
        : { ...selection, selectedIsParcelMachine: true, parcelMachines: stage.parcelMachines };
    },
  };
});
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { readonly children: ReactNode }) => children,
  PaymentElement: () => null,
  useElements: () => (stripe.loaded ? {} : null),
  useStripe: () =>
    stripe.loaded
      ? {
          confirmPayment: async (request: { confirmParams?: { return_url?: string } }) => {
            stripe.confirmed.push(request);
            return stripe.refuses
              ? { error: { message: "Your card was declined." } }
              : stripe.status === undefined
                ? {}
                : { paymentIntent: { status: stripe.status } };
          },
        }
      : null,
}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: () => ({}) }));
/* A static render runs no effect, so a handle is given to its ref as the render passes. */
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useImperativeHandle: (ref: { current: unknown } | null, create: () => unknown) => {
      if (ref !== null && typeof ref === "object") ref.current = create();
    },
  };
});

const actualEditions = await vi.importActual<Editions>("../../content/editions.js");
const english = actualEditions.siteCopyFor(DEFAULT_LOCALE);
/** The default edition's checkout copy, as `content/shop.ts` holds it. */
const { checkout: englishCheckout } = actualEditions.siteCopyFor(DEFAULT_LOCALE).shop;
const { siteCopyByLocale: fixture } = await import("../../content/editions.js");

const srcDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "src");
const NON_DEFAULT_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

afterEach(() => {
  stripe.confirmed.length = 0;
  stripe.loaded = true;
  stripe.refuses = false;
  stripe.status = "succeeded";
  stage.restoredBasket = false;
  stage.parcelMachines = null;
  vi.unstubAllGlobals();
});

/** `text` as the fixture holds it for `locale`, escaped as a render escapes it. */
const rendered = (locale: string, text: string): string =>
  markedFor(locale, text).replaceAll("&", "&amp;").replaceAll("'", "&#x27;");

const escaped = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");

/** The reserved synthetic address `shop-pages.test.tsx` uses, in `country`. */
function addressIn(country: string): AddressValues {
  return {
    fullName: "Name",
    streetAddress: "Street and number",
    postalCode: "00000",
    city: "Town",
    country,
    email: "example@example.com",
    phone: "+0000000000",
  };
}

interface CheckoutState {
  readonly scenario: MockScenario | null;
  readonly country?: string;
  readonly unhydratedOrderAttempt?: boolean;
}

function checkout(locale: Locale | undefined, state: CheckoutState): string {
  return renderToStaticMarkup(
    <CartProvider scenario={state.scenario} latencyMs={0} destinationCode="EE">
      <CheckoutPageContent
        {...(locale === undefined ? {} : { locale })}
        turnstileSiteKey="test-site-key"
        nonce="abc"
        stripePublishableKey="pk_test_example"
        scenario={state.scenario}
        unhydratedOrderAttempt={state.unhydratedOrderAttempt ?? false}
        latencyMs={0}
        {...(state.country === undefined ? {} : { initialAddress: addressIn(state.country) })}
      />
    </CartProvider>,
  );
}

/** Every state a static render reaches: each `?mock=` state, with and without a complete address. */
const STATES: readonly CheckoutState[] = [
  { scenario: null },
  { scenario: null, unhydratedOrderAttempt: true },
  ...MOCK_SCENARIOS.flatMap((scenario) => [
    { scenario },
    { scenario, country: "Germany" },
    { scenario, country: "United States" },
  ]),
];

const describeState = (state: CheckoutState): string =>
  `${state.scenario ?? "empty"}${state.country === undefined ? "" : `, delivering to ${state.country}`}` +
  (state.unhydratedOrderAttempt === true ? ", after an unhydrated press" : "");

/**
 * The six sentences as `locale`'s legal pages hold them, found without
 * `checkout-terms.ts`: the paragraph is located in the English page by its
 * opening words, and read from the same section and position of the
 * edition's page.
 */
function legalSentences(locale: Locale): CheckoutTerms {
  const sentence = (route: RouteId, anchor: string, opening: string): string => {
    const section = (edition: Locale) =>
      legalPagesByLocale[edition].find((page) => page.route === route)!.body.find((part) => part.anchor === anchor)!;
    const index = section(DEFAULT_LOCALE).body.findIndex((text) => text.startsWith(opening));
    expect(index, opening).toBeGreaterThanOrEqual(0);
    return section(locale).body[index]!;
  };

  return {
    contractFormation: sentence("legalTerms", "checkout-acknowledgement", "Placing an order is an offer to buy"),
    consentLine: sentence("legalTerms", "checkout-acknowledgement", "By placing the order you confirm"),
    confirmationPromise: sentence("legalTerms", "checkout-acknowledgement", "You will receive a confirmation by email"),
    cardStatement: sentence("legalTerms", "checkout-acknowledgement", "We accept cards, Apple Pay, Google Pay and PayPal"),
    returnPostage: sentence("legalReturns", "returns-process", "You pay the cost of returning the parcel"),
    deliveryEstimate: sentence("legalShipping", "delivery", "Orders are dispatched within"),
  };
}

const COUNTRY_SELECT = /<select\b[^>]*autoComplete="country-name"[^>]*>([\s\S]*?)<\/select>/i;

/** The delivery-country options of `html`, as `[value, label]`, the unchosen one left out. */
function countryOptions(html: string): readonly (readonly [string, string])[] {
  const select = COUNTRY_SELECT.exec(html)?.[1] ?? "";
  return [...select.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)]
    .map((match) => [match[1]!, match[2]!] as const)
    .filter(([value]) => value !== "");
}

/** `html` with the country options removed: 249 names are held to their source by {@link countryOptions}. */
const withoutCountryOptions = (html: string): string =>
  html.replace(COUNTRY_SELECT, (select) => select.replace(/<option value="[^"]+"[^>]*>[^<]*<\/option>/g, ""));

/** The words the checkout shows that are not `SiteCopy`'s, each for a reason. */
function wordsFromElsewhere(locale: Locale, state: CheckoutState): readonly string[] {
  return [
    // Read from the edition's legal pages, and held to them below.
    ...Object.values(legalSentences(locale)),
    // The product's name, as printed on the box.
    mockCatalogue.name,
    // The price qualification, which `src/lib/catalogue.ts` words per edition for the
    // destination it names: the one set on the site, or the address's once that is complete.
    ...["Estonia", state.country ?? "Estonia"].flatMap((name) =>
      Object.values(resolveCatalogue(undefined, destinationForCountryName(name)!, locale)).filter(
        (value): value is string => typeof value === "string",
      ),
    ),
    // What the visitor typed, shown back as the delivery address.
    "Name, Street and number, 00000, Town",
    // `HoneypotField`'s label: `aria-hidden` and off-screen, a trap for a script that no visitor reads.
    "Leave this field empty",
  ];
}

describe("the checkout under the marker fixture", () => {
  for (const locale of LOCALES) {
    for (const state of STATES) {
      it(`shows no unmarked sentence and no other edition's in ${locale}: ${describeState(state)}`, () => {
        const html = checkout(locale, state);

        expect(unmarkedText(withoutCountryOptions(html), wordsFromElsewhere(locale, state))).toEqual([]);
        expect(editionsMarkedIn(html)).toEqual([locale]);
      });
    }

    /* A page that rendered nothing would pass the test above. */
    it(`shows the edition's own sentences in ${locale}`, () => {
      const shop = englishCheckout;
      const html = checkout(locale, { scenario: "filled", country: "Germany" });

      for (const sentence of [
        shop.heading,
        shop.address.heading,
        shop.address.fields[0]!.label,
        shop.address.countryUnchosen,
        shop.address.phone.hint,
        shop.delivery.methodLabel,
        shop.payment.cardRegionBody,
        shop.beforeYouOrder.links[0]!.label,
        shop.order.totalLabel,
        shop.orderButtonLabel,
        english.interface.forms.verificationLabel,
        english.interface.deliveryMethodNames.standard,
      ]) {
        expect(html, sentence).toContain(rendered(locale, sentence));
      }

      const empty = checkout(locale, { scenario: null, unhydratedOrderAttempt: true });
      for (const sentence of [shop.empty.heading, shop.empty.link.label, shop.errors.paymentNotConnected]) {
        expect(empty, sentence).toContain(rendered(locale, sentence));
      }
    });
  }

  it("is the default edition's page when no locale is given", () => {
    for (const state of STATES) {
      expect(checkout(undefined, state), describeState(state)).toBe(checkout(DEFAULT_LOCALE, state));
    }
  });

  it("keeps the form posting to the unprefixed order handler in every edition", () => {
    for (const locale of LOCALES) {
      const form = /<form\b[^>]*>/.exec(checkout(locale, { scenario: "filled" }))?.[0] ?? "";

      expect(form, locale).toContain(`action="${CHECKOUT_ORDER_POST_PATH}"`);
      expect(CHECKOUT_ORDER_POST_PATH).toBe("/checkout/order");
    }
  });
});

describe("the checkout's links stay inside its edition", () => {
  for (const locale of LOCALES) {
    const prefix = LOCALE_DEFINITIONS[locale].pathPrefix;

    it(`links the legal pages and the basket under ${locale}'s prefix`, () => {
      const filled = checkout(locale, { scenario: "filled" });
      for (const link of englishCheckout.beforeYouOrder.links) {
        const anchor = "anchor" in link.target ? `#${link.target.anchor}` : "";
        expect(filled, link.label).toContain(
          `<a href="${prefix}${ROUTE_PATHS[link.target.to]}${anchor}">${rendered(locale, link.label)}</a>`,
        );
      }

      expect(checkout(locale, { scenario: null })).toContain(`href="${prefix}${ROUTE_PATHS.cart}"`);
    });
  }

  /* The other branch of `localizedLinkFor`: a route the edition lacks is linked in the default one. */
  it("crosses to the default edition, and says so, for a route the edition does not publish", () => {
    const pages = pagesByLocale as Record<Locale, readonly Page[]>;
    for (const locale of NON_DEFAULT_LOCALES) {
      const published = pages[locale];
      pages[locale] = published.filter((page) => page.route !== "cart");
      try {
        const defaultTag = LOCALE_DEFINITIONS[DEFAULT_LOCALE].languageTag;
        expect(checkout(locale, { scenario: null }), locale).toContain(
          `href="${ROUTE_PATHS.cart}" hrefLang="${defaultTag}"`,
        );
      } finally {
        pages[locale] = published;
      }
    }
  });
});

describe("the sentences read out of the legal pages", () => {
  for (const locale of LOCALES) {
    it(`are ${locale}'s own, from the place the English ones stand in`, () => {
      expect(checkoutTermsFor(locale)).toEqual(legalSentences(locale));
    });

    it(`are the ones the ${locale} checkout shows`, () => {
      const html = checkout(locale, { scenario: "filled", country: "Germany" });
      for (const [name, sentence] of Object.entries(legalSentences(locale))) {
        expect(html, name).toContain(`>${escaped(sentence)}</`);
      }
    });
  }

  it("differ from the English ones in every other edition, none of which the checkout shows", () => {
    const englishSentences = legalSentences(DEFAULT_LOCALE);
    for (const locale of NON_DEFAULT_LOCALES) {
      const html = checkout(locale, { scenario: "filled", country: "Germany" });
      for (const [name, sentence] of Object.entries(englishSentences)) {
        expect(legalSentences(locale)[name as keyof CheckoutTerms], `${locale} ${name}`).not.toBe(sentence);
        expect(html, `${locale} ${name}`).not.toContain(escaped(sentence));
      }
    }
  });
});

/**
 * The served path, `scenario === null`, with a basket in it. The delivery
 * method select, the parcel machine picker and the payment form are here and
 * nowhere else, and each is a component or a sentence of its own that has to
 * be handed the edition.
 */
describe("the served checkout, once a basket is restored", () => {
  const machines = [{ zip: "96091", name: "Tallinna Kristiine keskuse pakiautomaat", group: "Harju maakond" }];
  const served = (locale: Locale, country?: string): string => {
    stage.restoredBasket = true;
    stage.parcelMachines = machines;
    return checkout(locale, { scenario: null, country });
  };

  for (const locale of LOCALES) {
    for (const country of [undefined, "Estonia"]) {
      it(`shows no unmarked sentence and no other edition's in ${locale}${country === undefined ? "" : `, delivering to ${country}`}`, () => {
        const html = served(locale, country);

        expect(
          unmarkedText(withoutCountryOptions(html), [
            ...wordsFromElsewhere(locale, { scenario: null, country }),
            // The carrier's place name, shown as the carrier writes it.
            ...machines.map((machine) => machine.name),
          ]),
        ).toEqual([]);
        expect(editionsMarkedIn(html)).toEqual([locale]);
      });
    }

    it(`asks for a delivery method, a parcel machine and a payment method in ${locale}'s words`, () => {
      const html = served(locale, "Estonia");
      const copy = english.interface.checkout;
      const { delivery } = englishCheckout;

      expect(html).toContain(`<option value="" selected="">${rendered(locale, copy.deliveryMethodPrompt)}</option>`);
      expect(html).toContain(`aria-label="${rendered(locale, delivery.parcelMachineLabel)}"`);
      expect(html).toContain(`<option value="" selected="">${rendered(locale, delivery.parcelMachinePrompt)}</option>`);
      expect(html).toContain(`<option value="${machines[0]!.zip}">${machines[0]!.name}</option>`);
      expect(html).toContain(`<p role="status">${rendered(locale, copy.paymentAwaitingDelivery)}</p>`);
    });
  }
});

describe("the figures", () => {
  it("are written in the edition's number format", () => {
    const rate = declaredShippingMethod.rates.europeanUnion;
    const written = (locale: Locale): string => formatAmount(rate, declaredShippingMethod.currency, locale);
    const distinct = NON_DEFAULT_LOCALES.filter((locale) => written(locale) !== written(DEFAULT_LOCALE));

    // Estonian writes the sign after the figure. With no such edition the loop below would prove nothing.
    expect(distinct).toContain("et");
    for (const locale of distinct) {
      const html = checkout(locale, { scenario: "filled", country: "Germany" });

      expect(html, locale).toContain(`<dd>${written(locale)}</dd>`);
      expect(html, locale).not.toContain(written(DEFAULT_LOCALE));
    }
    expect(checkout(DEFAULT_LOCALE, { scenario: "filled", country: "Germany" })).toContain(
      `<dd>${written(DEFAULT_LOCALE)}</dd>`,
    );
  });
});

describe("the delivery country", () => {
  for (const locale of LOCALES) {
    it(`is labelled with ${locale}'s name for each country and submits the English one`, () => {
      const options = countryOptions(checkout(locale, { scenario: "filled" }));

      expect(options).toHaveLength(deliveryCountries.length);
      expect(options).toEqual(
        deliveryCountries.map((country) => [escaped(country.name), escaped(destinationNameIn(country, locale))]),
      );
    });
  }

  it("reads the Estonian name for Germany under et, with the value still Germany", () => {
    const germany = destinationForCountryName("Germany")!;
    const estonianName = destinationNameIn(germany, "et");
    const html = checkout("et", { scenario: "filled" });

    // A runtime with no Estonian data would answer "Germany", and the two lines below would prove nothing.
    expect(estonianName).not.toBe("Germany");
    expect(html).toContain(`<option value="Germany">${estonianName}</option>`);
    expect(html).not.toContain(">Germany</option>");
  });

  it("is named in the edition's words in the delivery address the order summary states", () => {
    for (const locale of LOCALES) {
      const name = destinationNameIn(destinationForCountryName("Germany")!, locale);
      const html = checkout(locale, { scenario: "filled", country: "Germany" });

      expect(html, locale).toContain(`<dd>Name, Street and number, 00000, Town, ${name}</dd>`);
      // The control still holds, and would submit, the English name.
      expect(html, locale).toMatch(/<option value="Germany" selected="">/);
    }
  });
});

describe("delivery method names", () => {
  const shipping = JSON.parse(
    readFileSync(join(dirname(srcDir), "mock", "shipping.json"), "utf8"),
  ) as { readonly method: { id: string; name: string }; readonly parcelMachine: { id: string; name: string } };
  const declared = [shipping.method, shipping.parcelMachine];

  it("are keyed by the method ids of mock/shipping.json, with its names as the English values", () => {
    expect(declared.map((method) => method.id)).toEqual(["standard", "omniva-parcel-machine"]);
    expect(Object.keys(english.interface.deliveryMethodNames).toSorted()).toEqual(
      declared.map((method) => method.id).toSorted(),
    );
    expect(english.interface.deliveryMethodNames).toEqual(
      Object.fromEntries(declared.map((method) => [method.id, method.name])),
    );
  });

  for (const locale of LOCALES) {
    it(`shows ${locale}'s name for a declared method and any other name as Medusa returns it`, () => {
      for (const method of declared) {
        expect(deliveryMethodNameIn(method.name, locale), method.id).toBe(markedFor(locale, method.name));
      }
      for (const name of ["Express courier", "standard delivery", "Standard delivery ", "omniva-parcel-machine", ""]) {
        expect(deliveryMethodNameIn(name, locale), name).toBe(name);
      }
    });

    it(`names the declared method in the ${locale} delivery summary`, () => {
      const html = checkout(locale, { scenario: "filled", country: "Germany" });

      expect(html).toContain(`<dd>${rendered(locale, shipping.method.name)}</dd>`);
      expect(html).not.toContain(`<dd>${shipping.method.name}</dd>`);
    });
  }

  it("leaves the parcel machine method recognised by the name Medusa returns", () => {
    const option = (name: string): GuestShippingOption => ({
      id: "so_test",
      name,
      amount: 0,
      amountWithTax: null,
      taxInclusive: false,
    });

    expect(isParcelMachineOption(option(shipping.parcelMachine.name))).toBe(true);
    for (const locale of LOCALES) {
      const shown = deliveryMethodNameIn(shipping.parcelMachine.name, locale);
      expect(isParcelMachineOption(option(shown)), locale).toBe(shown === shipping.parcelMachine.name);
    }
  });
});

/**
 * The other half of an option of the delivery method select: `name — charge`.
 * The list is filled by an effect, so no static render shows an option; this
 * is the function each one's charge is written by.
 */
describe("what a delivery method costs, as its option says it", () => {
  const option = (name: string, amount: number, amountWithTax: number | null = null): GuestShippingOption => ({
    id: "so_test",
    name,
    amount,
    amountWithTax,
    taxInclusive: false,
  });
  const rate = declaredShippingMethod.rates.europeanUnion;
  /** The two declared methods as the shop prices them today: one at a net rate, one at nothing. */
  const paid = option(declaredShippingMethod.name, rate);
  const free = option(declaredParcelMachineMethod.name, 0);
  const grossed = option(declaredShippingMethod.name, rate, rate + 168);

  it("prices the declared methods as this suite assumes", () => {
    expect(rate).toBeGreaterThan(0);
    expect(isParcelMachineOption(free)).toBe(true);
  });

  for (const locale of LOCALES) {
    it(`is in ${locale}'s words and number format`, () => {
      const copy = english.interface.checkout;
      const written = (amount: number): string => formatAmount(amount, "EUR", locale);

      // Nothing to pay, inside the EU and outside it.
      expect(deliveryChargeIn(free, true, locale)).toBe(markedFor(locale, copy.deliveryFree));
      expect(deliveryChargeIn(free, false, locale)).toBe(markedFor(locale, copy.deliveryFree));
      // A net rate VAT will be added to: the edition's sentence around the edition's figure.
      expect(deliveryChargeIn(paid, true, locale)).toBe(
        markedFor(locale, copy.deliveryNetCharge).replace("%amount%", written(rate)),
      );
      // A final figure, which is a number and no word.
      expect(deliveryChargeIn(paid, false, locale)).toBe(written(rate));
      expect(deliveryChargeIn(grossed, true, locale)).toBe(written(rate + 168));
    });

    it(`leaves no unmarked word in a ${locale} option, whatever the method costs`, () => {
      const options = [free, paid, grossed].flatMap((method) =>
        [true, false].map(
          (vatApplies) =>
            `<option value="${method.id}">${deliveryMethodNameIn(method.name, locale)} — ${deliveryChargeIn(method, vatApplies, locale)}</option>`,
        ),
      );
      const html = `<select>${options.join("")}</select>`;

      expect(unmarkedText(html, [])).toEqual([]);
      expect(editionsMarkedIn(html)).toEqual([locale]);
      expect(html).not.toContain("%amount%");
    });
  }

  /* The fixture is marked English, so it cannot show this: the default edition's labels are what they were. */
  it("is, with the default edition's words, the label the figure had before an edition could be named", () => {
    const { deliveryFree, deliveryNetCharge } = english.interface.checkout;
    const wording: ShippingFigureWording = { locale: DEFAULT_LOCALE, free: deliveryFree, beforeVat: deliveryNetCharge };

    expect(deliveryFree).toBe(FREE_SHIPPING_LABEL);
    expect(deliveryNetCharge).toBe(`%amount%${NET_SHIPPING_SUFFIX}`);
    for (const method of [free, paid, grossed, { ...paid, taxInclusive: true }]) {
      for (const vatApplies of [true, false]) {
        expect(shippingOptionFigure(method, vatApplies, wording)).toEqual(shippingOptionFigure(method, vatApplies));
      }
    }
    expect(shippingOptionFigure(paid, true).label).toBe(`${formatAmount(rate, "EUR")}${NET_SHIPPING_SUFFIX}`);
  });

  it("decides the same case and the same amount in every edition", () => {
    for (const method of [free, paid, grossed]) {
      for (const vatApplies of [true, false]) {
        const { amount, final } = shippingOptionFigure(method, vatApplies);
        for (const locale of LOCALES) {
          const { deliveryFree, deliveryNetCharge } = fixture[locale]!.interface.checkout;
          expect(
            shippingOptionFigure(method, vatApplies, { locale, free: deliveryFree, beforeVat: deliveryNetCharge }),
            locale,
          ).toMatchObject({ amount, final });
        }
      }
    }
  });
});

/**
 * What the page shows in place of its form once the order is placed: the
 * confirmation, and beneath it a newsletter form that is a component of its
 * own and has to be handed the edition like any other.
 */
describe("the checkout once the order is placed", () => {
  const confirmation = (locale: Locale): string =>
    renderToStaticMarkup(
      <CheckoutConfirmation
        locale={locale}
        displayId={1042}
        email="example@example.com"
        turnstileSiteKey="test-site-key"
        nonce="abc"
      />,
    );

  for (const locale of LOCALES) {
    it(`shows no unmarked sentence and no other edition's in ${locale}`, () => {
      const html = confirmation(locale);

      // `HoneypotField`'s label, as in the form above.
      expect(unmarkedText(html, ["Leave this field empty"])).toEqual([]);
      expect(editionsMarkedIn(html)).toEqual([locale]);
    });

    it(`confirms the order and offers the newsletter in ${locale}'s words`, () => {
      const html = confirmation(locale);
      const copy = english.interface.checkout;
      const { newsletter } = english.publisher;

      expect(html).toContain(rendered(locale, copy.confirmedHeading));
      expect(html).toContain(rendered(locale, copy.confirmedBody).replace("%orderNumber%", "1042"));
      for (const sentence of [
        newsletter.postPurchaseHeading,
        newsletter.postPurchaseBody,
        newsletter.fieldLabel,
        newsletter.postPurchaseConsentLabel,
        newsletter.submitLabel,
      ]) {
        expect(html, sentence).toContain(rendered(locale, sentence));
      }
      expect(html).toContain(`aria-label="${rendered(locale, english.interface.forms.verificationLabel)}"`);
      // Offered, never taken: the address is filled in and the choice is not made.
      expect(html).toContain('value="example@example.com"');
      expect(html).not.toMatch(/name="newsletter-consent"[^>]*checked/);
    });
  }

  it("posts the edition with the newsletter form, so the answer comes back in it, and nothing for the default one", () => {
    for (const locale of NON_DEFAULT_LOCALES) {
      expect(confirmation(locale), locale).toContain(`<input type="hidden" name="locale" value="${locale}"/>`);
    }
    expect(confirmation(DEFAULT_LOCALE)).not.toContain('name="locale"');
  });
});

describe("the address a payment provider returns a visitor to", () => {
  const origin = "https://shop.example.test";

  it("is not a route id, and is declared once beside the route table", () => {
    expect(CHECKOUT_RETURN_PATH).toBe("/checkout/payment-return");
    expect(Object.values(ROUTE_PATHS)).not.toContain(CHECKOUT_RETURN_PATH);
    expect(routeIdForPath(CHECKOUT_RETURN_PATH)).toBeUndefined();
    expect(Object.keys(ROUTE_PATHS)).toEqual([
      "home",
      "lunarBase",
      "about",
      "support",
      "rulebook",
      "cart",
      "checkout",
      "legalImprint",
      "legalTerms",
      "legalPrivacy",
      "legalShipping",
      "legalReturns",
    ]);
  });

  it("keeps the edition's prefix: /checkout/payment-return for en, /et/checkout/payment-return for et", () => {
    expect(checkoutReturnUrl(origin, "en")).toBe(`${origin}/checkout/payment-return`);
    expect(checkoutReturnUrl(origin, "et")).toBe(`${origin}/et/checkout/payment-return`);
    for (const locale of LOCALES) {
      expect(checkoutReturnUrl(origin, locale), locale).toBe(
        `${origin}${LOCALE_DEFINITIONS[locale].pathPrefix}/checkout/payment-return`,
      );
    }
  });

  for (const locale of [undefined, ...LOCALES]) {
    it(`is what Stripe is given as return_url when ${locale ?? "no locale"} is passed`, async () => {
      vi.stubGlobal("window", { location: { origin, assign: () => undefined } });
      const handle = createRef<StripePaymentElementHandle>();

      renderToStaticMarkup(
        <StripePaymentElement
          ref={handle}
          {...(locale === undefined ? {} : { locale })}
          publishableKey="pk_test_example"
          clientSecret="pi_example_secret_example"
        />,
      );
      await expect(handle.current!.confirm()).resolves.toMatchObject({ ok: true });

      const prefix = LOCALE_DEFINITIONS[locale ?? DEFAULT_LOCALE].pathPrefix;
      expect(stripe.confirmed).toEqual([
        {
          elements: {},
          confirmParams: { return_url: `${origin}${prefix}/checkout/payment-return` },
          redirect: "if_required",
        },
      ]);
    });
  }
});

describe("the payment form's own sentences", () => {
  for (const locale of LOCALES) {
    it(`are ${locale}'s where no payment form can be shown`, () => {
      const copy = english.interface.checkout;
      const withoutKey = renderToStaticMarkup(
        <StripePaymentElement ref={createRef()} locale={locale} publishableKey={null} clientSecret="pi_x" />,
      );
      const withoutSession = renderToStaticMarkup(
        <StripePaymentElement ref={createRef()} locale={locale} publishableKey="pk_x" clientSecret={null} />,
      );

      expect(withoutKey).toBe(`<p role="alert">${rendered(locale, copy.paymentUnavailable)}</p>`);
      expect(withoutSession).toBe(`<p role="status">${rendered(locale, copy.paymentAwaitingDelivery)}</p>`);
    });

    /* What a press of the order button is answered with: no render shows it, so the handle is asked. */
    it(`are ${locale}'s when a payment cannot be confirmed`, async () => {
      const copy = english.interface.checkout;
      const confirmation = async (): Promise<unknown> => {
        vi.stubGlobal("window", { location: { origin: "https://shop.example.test", assign: () => undefined } });
        const handle = createRef<StripePaymentElementHandle>();
        renderToStaticMarkup(
          <StripePaymentElement ref={handle} locale={locale} publishableKey="pk_x" clientSecret="pi_x" />,
        );
        return handle.current!.confirm();
      };

      stripe.loaded = false;
      await expect(confirmation()).resolves.toMatchObject({
        ok: false,
        message: markedFor(locale, copy.paymentFormLoading),
      });

      stripe.loaded = true;
      stripe.refuses = true;
      // Stripe's own message is not shown: it is in the language Stripe chose.
      await expect(confirmation()).resolves.toEqual({
        ok: false,
        pending: false,
        reportFailure: true,
        message: markedFor(locale, copy.paymentNotConfirmed),
      });
    });

    /*
     * Stripe can also answer without an error and without having taken the
     * money. `stripeConfirmationForStatus` says which of two things that is,
     * in English; the page shows the message it is handed as it stands.
     */
    it(`are ${locale}'s for a payment Stripe has not settled, and what is done about it is unchanged`, async () => {
      const copy = english.interface.checkout;
      const returnUrl = checkoutReturnUrl("https://shop.example.test", locale);
      const answerFor = async (status: string | undefined) => {
        const assigned: string[] = [];
        vi.stubGlobal("window", {
          location: { origin: "https://shop.example.test", assign: (url: string) => assigned.push(url) },
        });
        const handle = createRef<StripePaymentElementHandle>();
        renderToStaticMarkup(
          <StripePaymentElement ref={handle} locale={locale} publishableKey="pk_x" clientSecret="pi_x" />,
        );
        stripe.status = status;
        return { confirmation: await handle.current!.confirm(), assigned };
      };

      // Still processing: the visitor is sent to the edition's return page, and no failure is reported.
      expect(await answerFor("processing")).toEqual({
        confirmation: {
          ok: false,
          pending: true,
          reportFailure: false,
          message: markedFor(locale, copy.paymentProcessing),
        },
        assigned: [returnUrl],
      });

      // Anything else that is not success, a missing payment included: a failure, and the visitor stays.
      for (const status of ["requires_payment_method", "requires_action", "requires_capture", "canceled", undefined]) {
        expect(await answerFor(status), String(status)).toEqual({
          confirmation: {
            ok: false,
            pending: false,
            reportFailure: true,
            message: markedFor(locale, copy.paymentNotConfirmed),
          },
          assigned: [],
        });
      }

      expect(await answerFor("succeeded")).toEqual({ confirmation: { ok: true }, assigned: [] });
    });
  }

  it("are, in the default edition, the sentences the status helper gives", () => {
    const copy = english.interface.checkout;

    expect(stripeConfirmationForStatus("processing")).toMatchObject({ message: copy.paymentProcessing });
    for (const status of ["requires_payment_method", "requires_capture", "canceled", undefined]) {
      expect(stripeConfirmationForStatus(status), String(status)).toMatchObject({ message: copy.paymentNotConfirmed });
    }
  });
});

describe("the parcel machine picker", () => {
  const machines = [
    { zip: "96091", name: "Tallinna Kristiine keskuse pakiautomaat", group: "Harju maakond, Tallinn" },
    { zip: "96092", name: "Tartu Lõunakeskuse pakiautomaat", group: "Tartu maakond, Tartu" },
  ];
  const picker = (locale: Locale, state: "idle" | "loading" | "error"): string =>
    renderToStaticMarkup(
      <ParcelMachinePicker
        locale={locale}
        machines={state === "idle" ? machines : []}
        value=""
        state={state}
        disabled={false}
        onChange={() => undefined}
      />,
    );

  for (const locale of LOCALES) {
    it(`speaks ${locale}'s words and shows the carrier's place names as they are`, () => {
      const { delivery } = englishCheckout;
      const idle = picker(locale, "idle");

      expect(idle).toContain(`aria-label="${rendered(locale, delivery.parcelMachineLabel)}"`);
      expect(idle).toContain(`<option value="" selected="">${rendered(locale, delivery.parcelMachinePrompt)}</option>`);
      for (const machine of machines) {
        expect(idle).toContain(`<optgroup label="${machine.group}">`);
        expect(idle).toContain(`<option value="${machine.zip}">${machine.name}</option>`);
      }
      expect(unmarkedText(idle, machines.map((machine) => machine.name))).toEqual([]);

      expect(picker(locale, "loading")).toContain(
        `role="status">${rendered(locale, delivery.parcelMachineLoading)}</p>`,
      );
      expect(picker(locale, "error")).toContain(
        `role="alert">${rendered(locale, delivery.parcelMachineUnavailable)}</p>`,
      );
      for (const state of ["idle", "loading", "error"] as const) {
        expect(editionsMarkedIn(picker(locale, state)), state).toEqual([locale]);
      }
    });
  }
});

/**
 * No render reaches a validation error: it appears when a visitor presses the
 * order button. The form used to build a missing field's from a prefix and a
 * lower-cased label, and the default edition must still say exactly that.
 */
describe("the checkout form's validation errors", () => {
  /** An address in which every field fails in the way only a filled one can. */
  const malformed: AddressValues = { ...addressIn("Germany"), email: "not an address", phone: "030 1234567" };

  it("are, in the default edition, the sentences the form built from its labels", () => {
    const shop = englishCheckout;
    const missing: Readonly<Record<string, string>> = english.interface.checkout.missing;

    for (const field of shop.address.fields) {
      const prefix =
        field.control === "country" ? shop.errors.missingSelectionPrefix : shop.errors.missingFieldPrefix;
      expect(missing[field.name], field.name).toBe(`${prefix}${field.label.toLowerCase()}.`);
    }
    expect(missing.phone).toBe(`${shop.errors.missingFieldPrefix}${shop.address.phone.label.toLowerCase()}.`);
    expect(Object.keys(missing).toSorted()).toEqual(
      [...shop.address.fields.map((field) => field.name), "phone"].toSorted(),
    );
  });

  for (const locale of LOCALES) {
    it(`are ${locale}'s own for every field, like the labels beside them`, () => {
      const copy = english.interface.checkout.missing;
      const { errors } = englishCheckout;

      expect(validate(EMPTY_ADDRESS, locale)).toEqual(
        Object.fromEntries(
          fieldsFor(locale).map((field) => [field.name, markedFor(locale, copy[field.name as keyof typeof copy])]),
        ),
      );
      expect(validate({ ...addressIn("Germany"), phone: "" }, locale)).toEqual({
        phone: markedFor(locale, copy.phone),
      });
      expect(validate(malformed, locale)).toEqual({
        email: markedFor(locale, errors.invalidEmail),
        phone: markedFor(locale, errors.invalidPhone),
      });

      const labels = fieldsFor(locale).flatMap((field) => [field.label, field.hint ?? ""]).join("");
      expect(editionsMarkedIn(labels)).toEqual([locale]);
      expect(unmarkedText(labels, [])).toEqual([]);
    });
  }

  it("finds the same fields at fault whatever edition asks", () => {
    for (const values of [EMPTY_ADDRESS, malformed, addressIn("Germany"), { ...addressIn("Estonia"), phone: "" }]) {
      const faults = LOCALES.map((locale) => Object.keys(validate(values, locale)));
      for (const fault of faults) expect(fault).toEqual(Object.keys(validate(values)));
    }
  });
});

describe("the checkout route", () => {
  const chrome = (locale: Locale): readonly string[] => {
    const stringsIn = (value: unknown): readonly string[] =>
      typeof value === "string"
        ? [value]
        : value === null || typeof value !== "object"
          ? []
          : Object.values(value).flatMap(stringsIn);
    return [
      // Header and footer labels: `src/lib/chrome-strings.ts`, keyed by locale.
      ...stringsIn(CHROME_STRINGS[locale]),
      // The language selector names every edition in its own language, on every edition.
      ...Object.values(LANGUAGE_SWITCHER_LABELS),
      // The game's and the publisher's names, and the platforms' own.
      "Lunar Base",
      "Plepic Games",
      "Instagram",
      "Facebook",
    ];
  };
  const requested = (locale: Locale, params: Record<string, string>) =>
    CheckoutRoute({ routeId: "checkout", locale, searchParams: Promise.resolve(params) });

  for (const locale of LOCALES) {
    it(`renders the ${locale} checkout inside the ${locale} shell, in the state the request asked for`, async () => {
      const html = renderToStaticMarkup(await requested(locale, { mock: "filled", order: "not-placed" }));

      expect(html).toBe(
        renderToStaticMarkup(
          <ShopPageShell locale={locale} route="checkout" externalTargets={{}}>
            <CartProvider scenario="filled" destinationCode="EE">
              <CheckoutPageContent
                locale={locale}
                turnstileSiteKey="test-site-key"
                nonce="abc"
                stripePublishableKey="pk_test_example"
                scenario="filled"
                unhydratedOrderAttempt
              />
            </CartProvider>
          </ShopPageShell>,
        ),
      );
      expect(html).toContain(rendered(locale, englishCheckout.errors.paymentNotConnected));
      expect(
        unmarkedText(withoutCountryOptions(html), [
          ...wordsFromElsewhere(locale, { scenario: "filled" }),
          ...chrome(locale),
        ]),
      ).toEqual([]);
    });
  }

  it("answers 404 when an edition does not publish the checkout", async () => {
    const pages = pagesByLocale as Record<Locale, readonly Page[]>;
    const actual = await vi.importActual<typeof import("../../content/index.js")>("../../content/index.js");

    for (const locale of NON_DEFAULT_LOCALES) {
      // With every route published, as this file's registry has it, the resolver serves the view.
      expect(resolveLocalizedRoute(locale, ["checkout"])).toEqual({ locale, routeId: "checkout" });

      const published = pages[locale];
      pages[locale] = actual.pagesByLocale[locale].filter((page) => page.route !== "checkout");
      try {
        expect(pages[locale].some((page) => page.route === "checkout"), locale).toBe(false);
        expect(resolveLocalizedRoute(locale, ["checkout"]), locale).toBeNull();
        await expect(requested(locale, {})).rejects.toMatchObject({ digest: expect.stringContaining("404") });
      } finally {
        pages[locale] = published;
      }
    }
  });
});

describe("the checkout's components hold no sentence of their own", () => {
  it("finds no reader-facing literal in them, fragments of identifiers and one thrown error aside", () => {
    const components = [
      "components/shop/CheckoutPageContent.tsx",
      "components/shop/StripePaymentElement.tsx",
      "components/shop/ParcelMachinePicker.tsx",
      "components/shop/PostPurchaseNewsletterForm.tsx",
    ];
    const found = Object.fromEntries(
      components.map((name) => [name, [...new Set(readerFacingLiterals(name, readFileSync(join(srcDir, name), "utf8")))]]),
    );

    expect(found).toEqual({
      "components/shop/CheckoutPageContent.tsx": [
        // Thrown when the page was served without its runtime configuration: a fault, not copy.
        "Store runtime configuration is unavailable",
        // The suffixes of element ids.
        "-order-blocked",
        "-error",
        "-hint",
        "-phone",
        "-phone-hint",
        "-phone-error",
      ],
      "components/shop/StripePaymentElement.tsx": [],
      "components/shop/ParcelMachinePicker.tsx": [],
      "components/shop/PostPurchaseNewsletterForm.tsx": [],
    });
  });

  /*
   * The two helpers are scanned for what they import, not for literals. What
   * is left in them is the text of errors they throw and, in
   * `checkout-terms.ts`, the English opening words a sentence is located by;
   * what they return is held to the edition above.
   */
  it("reads no English content module in the two helpers", () => {
    for (const name of ["checkout-address.ts", "checkout-terms.ts"]) {
      const code = readFileSync(join(srcDir, "components", "shop", name), "utf8");
      const imported = [...code.matchAll(/^import (type )?[^;]*? from "([^"]+)";/gms)]
        .filter((match) => match[1] === undefined)
        .map((match) => match[2]!);

      expect(imported.filter((path) => path.includes("/content/")).toSorted(), name).toEqual(
        name === "checkout-terms.ts"
          ? ["../../../../content/legal/index.js", "../../../../content/routes.js", "../../../../content/schema.js"]
          : ["../../../../content/editions.js", "../../../../content/routes.js"],
      );
    }
  });
});

/** The fixture is the default edition's copy, marked: a guard that this file tests what it says. */
describe("the fixture", () => {
  it("marks every edition's checkout copy for that edition", () => {
    for (const locale of LOCALES) {
      const copy = fixture[locale]!;
      expect(copy.interface.checkout.deliveryMethodPrompt).toBe(
        markedFor(locale, english.interface.checkout.deliveryMethodPrompt),
      );
      expect(copy.interface.deliveryMethodNames["omniva-parcel-machine"]).toBe(
        markedFor(locale, english.interface.deliveryMethodNames["omniva-parcel-machine"]),
      );
    }
  });
});


describe("payment return, consent, and 404 under the marker fixture", () => {
  for (const locale of NON_DEFAULT_LOCALES) {
    it(`uses ${locale} copy for the payment return's loading, confirmation, and disclosure states`, () => {
      const common = { locale, turnstileSiteKey: "synthetic-site-key", nonce: "nonce" };
      const loading = renderToStaticMarkup(<StripePaymentReturn {...common} />);
      const confirmed = renderToStaticMarkup(
        <StripePaymentReturn {...common} initialOrder={{ orderId: "order-test", displayId: 42 }} />,
      );
      const disclosure = renderToStaticMarkup(
        <StripePaymentReturn {...common} initialDisclosure={{
          currency: "EUR", goods: "Lunar Base × 1", goodsAmount: 2500,
          shippingAmount: 700, orderAmount: 3968, taxAmount: 768,
          countryCode: "EE", address: "Test address", analyticsItems: null,
        }} />,
      );
      expect(loading).toContain(markedFor(locale, english.interface.paymentReturn.loading));
      expect(unmarkedText(loading, [])).toEqual([]);
      expect(confirmed).toContain(markedFor(locale, english.interface.checkout.confirmedHeading));
      expect(unmarkedText(confirmed, ["Leave this field empty"])).toEqual([]);
      expect(disclosure).toContain(markedFor(locale, english.interface.paymentReturn.verificationInstruction));
      expect(unmarkedText(disclosure, [
        ...Object.values(legalSentences(locale)), "Lunar Base", "Test address",
        ...Object.values(resolveCatalogue(undefined, destinationForCountryName("Estonia")!, locale))
          .filter((value): value is string => typeof value === "string"),
      ])).toEqual([]);
      for (const html of [loading, confirmed, disclosure]) {
        expect(editionsMarkedIn(html)).toEqual([locale]);
        expect(html).not.toContain(">Loading your order details…<");
        expect(html).not.toContain(">Complete a fresh verification challenge to finish your order.<");
      }
    });

    it(`uses ${locale} copy for consent and the 404 body`, async () => {
      const banner = renderToStaticMarkup(
        <ConsentBanner locale={locale} onAccept={() => {}} onDecline={() => {}} />,
      );
      const missing = renderToStaticMarkup(await NotFoundContent({ locale }));
      expect(editionsMarkedIn(banner)).toEqual([locale]);
      expect(editionsMarkedIn(missing)).toEqual([locale]);
      expect(banner).toContain(markedFor(locale, english.interface.consent.introduction));
      expect(missing).toContain(markedFor(locale, english.interface.notFound.body));
      expect(missing).toContain(`href="/${locale}"`);
      expect(unmarkedText(banner, [])).toEqual([]);
      // The 404 carries the language selector: its label, and each edition's name.
      expect(
        unmarkedText(missing, [CHROME_STRINGS[locale].languageNavLabel, ...Object.values(LANGUAGE_SWITCHER_LABELS)]),
      ).toEqual([]);
      const metadata = await localizedMetadata({
        params: Promise.resolve({ locale, segments: ["not-a-route"] }),
      });
      expect(metadata.title).toBe(markedFor(locale, english.interface.notFound.title));
      expect(metadata.alternates).toBeUndefined();
    });
  }

  it("serves a published checkout return without adding a route id", async () => {
    const route = resolveLocalizedRoute("et", ["checkout", "payment-return"]);
    expect(route).toEqual({ locale: "et", routeId: "checkout", view: "checkoutReturn" });
    const pages = pagesByLocale as Record<Locale, readonly Page[]>;
    const published = pages.et;
    const actual = await vi.importActual<typeof import("../../content/index.js")>("../../content/index.js");
    pages.et = actual.pagesByLocale.et;
    try {
      expect(resolveLocalizedRoute("et", ["checkout", "payment-return"])).toBeNull();
    } finally {
      pages.et = published;
    }
  });
});
