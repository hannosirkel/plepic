/**
 * The fake Medusa the browser suite runs against.
 *
 * ## It is a model of the shop's commercial facts, not a bag of JSON
 *
 * EUR 25.00 is the **net** price of the goods and EUR 7.00 the net European
 * Union delivery rate; Estonian VAT is added to both for a delivery address in
 * the EU and to neither anywhere else. Every figure below is one of those four
 * declared amounts, and the only arithmetic is `gross - net`, which *names the
 * difference between two declared figures* rather than deriving either — the
 * same rule `storefront/src/lib/catalogue.ts` holds itself to. **There is no
 * rate in this file**, and there must not be: a fake that computed VAT could
 * agree with itself while disagreeing with the shop.
 *
 * ## Why the tax fields are conditional
 *
 * `GET /store/products` returns `calculated_amount_with_tax` and
 * `calculated_amount_without_tax` **only when the request arrived in a tax
 * context** — `@medusajs/medusa/dist/api/store/products/helpers.js`,
 * `wrapProductsWithTaxPrices`, returns before writing either when there is no
 * `country_code`, no tax region for that country, or `automatic_taxes` off.
 * `is_calculated_price_tax_inclusive` is *not* one of those two: it is an input
 * to that calculation and is present either way.
 *
 * This fake reproduces that, rather than serving the tax fields
 * unconditionally, because the storefront **refuses** a response without them
 * (`catalogueProductFromStore` in `src/lib/store-product.ts`) and a fake that
 * always supplied them could not tell a storefront that names its VAT country
 * from one that has stopped doing so. Serving the pre-tax shape is exactly how
 * this file took the browser and screenshot suites red once already: the
 * refusal landed on every render of `/`, so the Next server never became ready
 * and Playwright timed out waiting for it.
 *
 * ## Carts are priced for the address they carry
 *
 * The storefront writes the visitor's destination onto its cart
 * (`applyDestinationToCart`) and the checkout later overwrites it with the real
 * postal address, so a cart's totals are a function of its
 * `shipping_address.country_code` — and the suite exercises **both** sides of
 * the border: the basket and checkout paths quote a cart for the default
 * destination (United States, no VAT), while the Stripe return page reads a
 * cart already bound to a confirmed Estonian address (VAT added). A single
 * static cart could not be honest for both, so the country is recorded per
 * cart and the totals follow it.
 *
 * The catalogue request needs no such treatment: the storefront names one fixed
 * VAT country for it (`VAT_PRICING_COUNTRY_CODE`) so that every visitor and
 * every crawler is served both figures, so there is one catalogue answer.
 *
 * ## The pure half is exported
 *
 * {@link fixtureResponse} is the whole of this fake and touches no socket.
 * `tests/playwright-fixture-agreement.test.ts` drives the storefront's own
 * Store readers against it in the unit suite, which is the gate that ran green
 * while this file served a product every page refused.
 */
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const port = 3199;

/**
 * The declared commercial figures, in Medusa v2's **major units**.
 *
 * `withTax` is the EU figure and `beforeTax` the figure everywhere else — the
 * same two amounts `storefront/mock/catalogue.json` and
 * `storefront/mock/shipping.json` carry, which is what makes a page rendered
 * against this fake the page a buyer would be shown.
 *
 * They are not named for the net and the gross figure, which is what they are,
 * because `tests/no-live-hostname.test.ts` reads a property access on the
 * shorter of those two words as a hostname in a commercial top-level domain and
 * refuses the file. That guard's false positive is a cheaper thing to word
 * around than to weaken.
 */
const GOODS = { beforeTax: 25, withTax: 31 };
const SHIPPING = {
  europeanUnion: { beforeTax: 7, withTax: 8.68 },
  restOfWorld: { beforeTax: 12, withTax: 12 },
};

/**
 * The country codes this fake charges VAT for.
 *
 * A set of one, and deliberately not a copy of `mock/countries.json`: the suite
 * names exactly two countries — `ee`, which is both the catalogue's VAT country
 * and the delivery address on the return page's cart, and `us`, the default
 * destination — and a fake that duplicated the real membership list would be a
 * second place for it to be wrong.
 */
const EU_COUNTRIES = new Set(["ee"]);

const PRODUCT_ID = "prod_lunar_base";
const PRODUCT_TITLE = "Lunar Base";

/** The delivery address the return page's cart was completed with. */
const CONFIRMED_ADDRESS: Readonly<Record<string, string>> = {
  first_name: "Ada",
  address_1: "1 Example Street",
  postal_code: "10115",
  city: "Tallinn",
  country_code: "ee",
};

function euMember(countryCode: string | null): boolean {
  return countryCode !== null && EU_COUNTRIES.has(countryCode.toLowerCase());
}

/**
 * The catalogue answer, in the tax context the request named.
 *
 * `calculated_amount` is the **stored** price, which is the net one, and
 * `is_calculated_price_tax_inclusive` is `false` because it is: this shop adds
 * VAT rather than containing it. The storefront checks those two against each
 * other, so they are not decoration.
 */
function catalogueProduct(countryCode: string | null) {
  const taxContext = countryCode !== null;
  const withTax = euMember(countryCode) ? GOODS.withTax : GOODS.beforeTax;
  return {
    products: [
      {
        id: PRODUCT_ID,
        title: PRODUCT_TITLE,
        variants: [
          {
            id: "variant_lunar_base",
            manage_inventory: true,
            allow_backorder: false,
            inventory_quantity: 12,
            calculated_price: {
              currency_code: "eur",
              calculated_amount: GOODS.beforeTax,
              is_calculated_price_tax_inclusive: false,
              ...(taxContext
                ? {
                    calculated_amount_without_tax: GOODS.beforeTax,
                    calculated_amount_with_tax: withTax,
                  }
                : {}),
            },
          },
        ],
      },
    ],
  };
}

interface FixtureCart {
  /** The cart's `shipping_address`, or `null` until one is written onto it. */
  address: Record<string, string> | null;
  /**
   * Whether the one line has been added. False for a cart the browser has just
   * created, because an empty cart is what Medusa answers with until
   * `POST /store/carts/{id}/line-items` — and the basket reads the response to
   * the request *before* that one.
   */
  lined: boolean;
  /**
   * Whether a delivery method has been added.
   *
   * True for the `cart_return_*` carts, which stand for a checkout that has run
   * to the point of a Stripe redirect, and false for a basket the browser has
   * just created — a fresh Medusa cart has no method and no delivery charge,
   * and the return page's disclosure requires exactly one.
   */
  readonly shipped: boolean;
  /**
   * The variant on the cart's one line. `cart_add_fixture` carries the
   * catalogue's variant because `addStoreCatalogueLine` matches the line it
   * added against the id it read from `/store/products`; the pre-existing carts
   * carry their own, which the analytics assertions name.
   */
  readonly variantId: string;
}

const carts = new Map<string, FixtureCart>();
const completions = new Map<string, string[]>();

function cartState(id: string): FixtureCart {
  const existing = carts.get(id);
  if (existing !== undefined) return existing;
  const preexisting = id.startsWith("cart_return_");
  const created: FixtureCart = {
    address: preexisting ? { ...CONFIRMED_ADDRESS } : null,
    lined: preexisting,
    shipped: preexisting,
    variantId: preexisting ? "variant_fixture" : "variant_lunar_base",
  };
  carts.set(id, created);
  return created;
}

/**
 * The cart, priced for the address it carries.
 *
 * `item_total` and `shipping_total` **include** their tax and `subtotal` does
 * not, which is Medusa's own semantics and the reason the storefront reads the
 * first two rather than the third. `item_tax_total`, `shipping_tax_total` and
 * `tax_total` are the seventh figure the checkout and the return page state
 * separately; the storefront refuses a set of them that does not add up, so
 * they are computed here from the declared pairs rather than typed out.
 */
function cartBody(id: string) {
  const state = cartState(id);
  const country = state.address?.country_code ?? null;
  const vat = euMember(country);
  const goods = state.lined ? (vat ? GOODS.withTax : GOODS.beforeTax) : 0;
  const goodsTax = state.lined ? goods - GOODS.beforeTax : 0;
  const rate = vat ? SHIPPING.europeanUnion : SHIPPING.restOfWorld;
  const shipping = state.shipped ? (vat ? rate.withTax : rate.beforeTax) : 0;
  const shippingTax = state.shipped ? shipping - rate.beforeTax : 0;
  return {
    id,
    currency_code: "eur",
    item_total: goods,
    item_tax_total: goodsTax,
    shipping_total: shipping,
    shipping_tax_total: shippingTax,
    tax_total: goodsTax + shippingTax,
    subtotal: (state.lined ? GOODS.beforeTax : 0) + (state.shipped ? rate.beforeTax : 0),
    total: goods + shipping,
    items: state.lined
      ? [
          {
            id: "line_fixture",
            variant_id: state.variantId,
            variant: { id: state.variantId, manage_inventory: false },
            title: PRODUCT_TITLE,
            // The **stored** unit price, which is net. The line's `total` is
            // what the buyer is charged for it, and it is the figure the basket
            // reads.
            unit_price: GOODS.beforeTax,
            total: goods,
            quantity: 1,
          },
        ]
      : [],
    shipping_methods: state.shipped
      ? [{ amount: rate.beforeTax, is_tax_inclusive: false, shipping_option_id: "so_standard" }]
      : [],
    ...(state.address === null ? {} : { shipping_address: state.address }),
  };
}

export interface FixtureRequest {
  readonly method: string;
  /** The path and query exactly as it arrived, e.g. `/store/products?limit=1&…`. */
  readonly url: string;
  readonly body: string;
  /**
   * The `x-plepic-turnstile-token` header, recorded per cart so the browser
   * suite can assert that no token reached Medusa before the visitor solved the
   * challenge. Empty when the request carried none.
   */
  readonly turnstileToken?: string;
}

export interface FixtureReply {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

function json(value: unknown, status = 200): FixtureReply {
  return { status, contentType: "application/json", body: JSON.stringify(value) };
}

/** The country a cart update writes onto the cart, if it writes one at all. */
function updatedAddress(body: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(body) as { shipping_address?: Record<string, unknown> };
    const address = parsed.shipping_address;
    if (address === undefined || address === null) return null;
    const entries = Object.entries(address).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
    return entries.length === 0 ? null : Object.fromEntries(entries);
  } catch {
    return null;
  }
}

/**
 * The whole fake, as a function of one request.
 *
 * Not pure — a cart remembers the address written onto it and a completion
 * remembers the token it carried — but it touches no socket, which is what lets
 * the unit suite drive the storefront's own Store readers against it.
 */
export function fixtureResponse({ method, url, body, turnstileToken = "" }: FixtureRequest): FixtureReply {
  if (url === "/health") {
    return { status: 200, contentType: "text/plain", body: "ok" };
  }

  if (url === "/store/regions?limit=2" && method === "GET") {
    return json({ regions: [{ id: "region_fixture" }] });
  }

  if (url === "/store/carts" && method === "POST") {
    // A new cart, so whatever the last one was quoted for is forgotten.
    carts.delete("cart_add_fixture");
    return json({ cart: { id: "cart_add_fixture" } });
  }

  const lineItems = /^\/store\/carts\/([\w-]+)\/line-items$/.exec(url);
  if (lineItems !== null && method === "POST") {
    const id = lineItems[1]!;
    cartState(id).lined = true;
    return json({ cart: cartBody(id) });
  }

  /*
   * The first completion of a cart is refused and the second succeeds, which is
   * what the return page's double-submit guard and its failure-then-retry
   * assertions are written against. The tokens are kept so the suite can prove
   * the first request Medusa saw was the one the visitor had solved a challenge
   * for.
   */
  const completion = /^\/store\/carts\/([\w-]+)\/complete$/.exec(url);
  if (completion !== null && method === "POST") {
    const tokens = completions.get(completion[1]!) ?? [];
    tokens.push(turnstileToken);
    completions.set(completion[1]!, tokens);
    return json(
      tokens.length === 1
        ? { type: "cart" }
        : { type: "order", order: { id: "order_fixture", display_id: 42 } },
    );
  }

  const cart = /^\/store\/carts\/([\w-]+)(?:\?.*)?$/.exec(url);
  if (cart !== null && (method === "GET" || method === "POST")) {
    const id = cart[1]!;
    if (method === "POST") {
      const address = updatedAddress(body);
      // Medusa replaces the shipping address rather than merging into it, so a
      // destination write leaves a cart carrying a country and nothing else.
      if (address !== null) cartState(id).address = address;
    }
    return json({ cart: cartBody(id) });
  }

  const inspect = /^\/inspect\/([\w-]+)$/.exec(url);
  if (inspect !== null) {
    return json({ tokens: completions.get(inspect[1]!) ?? [] });
  }

  if (url.startsWith("/store/products?limit=1&fields=") && method === "GET") {
    const country = new URL(url, "http://127.0.0.1").searchParams.get("country_code");
    return json(catalogueProduct(country));
  }

  return json({ message: "fixture route not found" }, 404);
}

const server = createServer((request, response) => {
  const chunks: Buffer[] = [];
  request.on("data", (chunk: Buffer) => chunks.push(chunk));
  request.on("end", () => {
    const answer = fixtureResponse({
      method: request.method ?? "GET",
      url: request.url ?? "",
      body: Buffer.concat(chunks).toString("utf8"),
      turnstileToken: String(request.headers["x-plepic-turnstile-token"] ?? ""),
    });
    response.writeHead(answer.status, { "content-type": answer.contentType });
    response.end(answer.body);
  });
});

// `playwright.config.ts` starts this file with `node`; the unit suite imports
// it. Only the first of those may bind a port.
const entryPoint = globalThis.process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href) {
  server.listen(port, "127.0.0.1");

  for (const signal of ["SIGINT", "SIGTERM"]) {
    globalThis.process.on(signal, () => server.close(() => globalThis.process.exit(0)));
  }
}
