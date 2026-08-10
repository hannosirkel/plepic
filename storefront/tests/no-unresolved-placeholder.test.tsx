/**
 * No `{token}` ever reaches a visitor's eyes.
 *
 * `content/` carries its variable parts as literal template strings —
 * `{price}`, `{priceLine}`, `{productName}` from the catalogue,
 * `{merchantContactAddress}` and the rest of the merchant identity from
 * configuration (`content/schema.ts`'s `PLACEHOLDERS`). Resolving them at
 * render is this unit's job. **Nothing in this repository failed when one was
 * not resolved**, and two shipped:
 *
 * - `/games/lunar-base`, the "How much is shipping?" answer: *"The price of
 *   the game is the same everywhere: {priceLine}"*. It sits inside a closed
 *   `<details>`, which is exactly why every structural test walked past it —
 *   they asked whether the FAQ *questions* were present, and they were.
 * - `/support/lunar-base`, in plain body type at every width: *"You can also
 *   reach us at {merchantContactAddress}."*
 *
 * Both were visible to a person at 1280, 390 and 320 and invisible to a green
 * suite of 1099 tests. So this file checks the one property that would have
 * caught either: render each real route's component and fail on any
 * brace-delimited token surviving in text a browser will paint.
 *
 * **Closed `<details>` counts.** Its children are in the DOM and in the
 * rendered markup whether or not the disclosure is open — a visitor opens it
 * with one click and a search engine never had to. The extractor below does
 * not special-case `<details>` in either direction, and
 * "the extractor has teeth" proves that against both states rather than
 * asserting it in a comment.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { legalPages } from "../../content/legal/index.js";
import { PLACEHOLDERS } from "../../content/schema.js";
import { ROUTE_PATHS } from "../../content/routes.js";
import { NO_CONFIGURATION_VALUES } from "../src/lib/configuration-placeholders.js";
import { CartProvider } from "../src/lib/cart-store.js";
import { BasketPageContent } from "../src/components/shop/BasketPageContent.js";
import { CheckoutPageContent } from "../src/components/shop/CheckoutPageContent.js";
import { LegalPageContent } from "../src/components/pages/LegalPageContent.js";
import { AboutPageContent } from "../src/components/pages/AboutPageContent.js";
import { RulebookPageContent } from "../src/components/pages/RulebookPageContent.js";
import { SupportPageContent } from "../src/components/pages/SupportPageContent.js";
import { HomepageMockup } from "../src/components/mockups/HomepageMockup.js";
import { LunarBaseMockup } from "../src/components/mockups/LunarBaseMockup.js";

/**
 * The text a browser paints, from rendered markup: tags removed, `<script>`
 * and `<style>` blocks removed with their contents (a JSON-LD blob or a CSS
 * rule is not prose), HTML entities that matter unescaped.
 *
 * `<details>`, `<summary>`, `<dialog>` and anything hidden by CSS are
 * deliberately **not** stripped. Every one of them is content a visitor can
 * reach, and "not visible in the first paint" is precisely the excuse under
 * which the `{priceLine}` defect shipped.
 */
function visibleText(html: string): string {
  return html
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, " ")
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/g, " ")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

/** Same grammar as `content/schema.ts`'s own placeholder pattern. */
const TOKEN_PATTERN = /\{[A-Za-z][A-Za-z0-9]*\}/g;

function unresolvedTokensIn(html: string): readonly string[] {
  return [...new Set(visibleText(html).match(TOKEN_PATTERN) ?? [])].toSorted();
}

/**
 * Every real route that renders `content/` prose, with the props its own
 * `src/app/**` page hands it.
 *
 * `merchantContactAddress: null` is the **unconfigured** state, which is the
 * state every deployment is in today and the one the defect shipped in. The
 * configured state is exercised separately below, so neither branch can
 * regress unseen.
 */
const ROUTES: readonly { readonly path: string; readonly html: string }[] = [
  { path: "/", html: renderToStaticMarkup(<HomepageMockup />) },
  { path: "/games/lunar-base", html: renderToStaticMarkup(<LunarBaseMockup />) },
  { path: "/about", html: renderToStaticMarkup(<AboutPageContent />) },
  {
    path: "/support/lunar-base",
    html: renderToStaticMarkup(
      <SupportPageContent turnstileSiteKey={null} nonce={undefined} merchantContactAddress={null} />,
    ),
  },
  { path: "/support/lunar-base/rulebook", html: renderToStaticMarkup(<RulebookPageContent />) },
  /*
   * The basket and the checkout, in the state a filled basket puts them in —
   * which is the state that quotes `{productName}` (the "Add … to your basket"
   * button, the quantity and remove labels) and renders every figure. The
   * empty state is asserted separately below, because it is the default and
   * carries a different subset of the copy.
   */
  {
    path: "/cart",
    html: renderToStaticMarkup(
      <CartProvider scenario="filled" latencyMs={0}>
        <BasketPageContent />
      </CartProvider>,
    ),
  },
  {
    path: "/checkout",
    html: renderToStaticMarkup(
      <CartProvider scenario="filled" latencyMs={0}>
        <CheckoutPageContent
          turnstileSiteKey={null}
          nonce={undefined}
          scenario="filled"
          latencyMs={0}
        />
      </CartProvider>,
    ),
  },
  /*
   * The five legal routes, in the unconfigured state.
   *
   * They were absent from this list because they rendered `RoutePlaceholder`
   * — a heading and a meta description — and so had no `content/` prose to
   * leave a brace in. They render their pages now, and every one of them
   * quotes the merchant identity, which makes them the routes with the most
   * placeholders on the site and the ones this scan most needed.
   */
  ...legalPages.map((page) => ({
    path: ROUTE_PATHS[page.route],
    html: renderToStaticMarkup(
      <LegalPageContent page={page} values={NO_CONFIGURATION_VALUES} />,
    ),
  })),
];

describe("no unresolved placeholder reaches rendered text on any real route", () => {
  for (const route of ROUTES) {
    it(`${route.path}`, () => {
      expect(
        unresolvedTokensIn(route.html),
        "a content placeholder reached a visitor as a literal brace. Resolve it — from the catalogue " +
          "(src/lib/catalogue.ts) or from configuration (src/lib/configuration-placeholders.ts) — or, " +
          "when the value genuinely does not exist yet, drop the copy that quotes it rather than " +
          "shipping the brace",
      ).toEqual([]);
    });
  }

  it("also holds for an empty basket, which is the default state of both commercial routes", () => {
    for (const html of [
      renderToStaticMarkup(
        <CartProvider scenario={null} latencyMs={0}>
          <BasketPageContent />
        </CartProvider>,
      ),
      renderToStaticMarkup(
        <CartProvider scenario={null} latencyMs={0}>
          <CheckoutPageContent
            turnstileSiteKey={null}
            nonce={undefined}
            scenario={null}
            latencyMs={0}
          />
        </CartProvider>,
      ),
    ]) {
      expect(unresolvedTokensIn(html)).toEqual([]);
    }
  });

  it("also holds with a merchant contact address configured, not only with it suppressed", () => {
    const html = renderToStaticMarkup(
      <SupportPageContent
        turnstileSiteKey={null}
        nonce={undefined}
        merchantContactAddress="hello@example.com"
      />,
    );
    expect(unresolvedTokensIn(html)).toEqual([]);
    expect(visibleText(html)).toContain("hello@example.com");
  });

  it("scanned real pages, not empty strings", () => {
    for (const route of ROUTES) {
      expect(visibleText(route.html).trim().length, `${route.path} rendered nothing`).toBeGreaterThan(400);
    }
  });
});

describe("the extractor has teeth", () => {
  it("sees text inside a closed <details> — the exact place {priceLine} shipped", () => {
    const closed = "<details><summary>How much is shipping?</summary><p>…everywhere: {priceLine}</p></details>";
    expect(unresolvedTokensIn(closed)).toEqual(["{priceLine}"]);
  });

  it("sees the same text when the <details> is open", () => {
    const open = "<details open><summary>How much is shipping?</summary><p>…everywhere: {priceLine}</p></details>";
    expect(unresolvedTokensIn(open)).toEqual(["{priceLine}"]);
  });

  it("sees a token in ordinary body copy", () => {
    expect(unresolvedTokensIn("<p>You can also reach us at {merchantContactAddress}.</p>")).toEqual([
      "{merchantContactAddress}",
    ]);
  });

  it("ignores braces inside a <script> block, which is data rather than prose", () => {
    expect(unresolvedTokensIn('<script type="application/json">{"a":1}</script>')).toEqual([]);
  });

  it("does not fire on prose that merely contains braces with no token grammar", () => {
    expect(unresolvedTokensIn("<p>Use { and } freely, and {2500} is not a token.</p>")).toEqual([]);
  });
});

/**
 * The guard above is only as good as the grammar it looks for, so pin the
 * grammar to `content/`'s own declaration: every token `content/schema.ts`
 * declares must be one this scanner would recognise if it were rendered
 * unresolved.
 */
describe("the scanner's grammar matches content/schema.ts's own placeholders", () => {
  it("would catch every declared placeholder", () => {
    const tokens = Object.keys(PLACEHOLDERS);
    expect(tokens.length).toBeGreaterThan(5);
    for (const token of tokens) {
      expect(unresolvedTokensIn(`<p>${`{${token}}`}</p>`), `{${token}} would not be caught`).toEqual([
        `{${token}}`,
      ]);
    }
  });
});
