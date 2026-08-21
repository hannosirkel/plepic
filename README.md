# Plepic

The Plepic Games storefront and Medusa backend monorepo.

## Workspaces

- `storefront/` — the Next.js App Router application shell serving the entire
  public site: host-based redirects and the test-hostname `noindex` gate
  (`src/proxy.ts`), per-route SEO metadata and the sitemap/`robots.txt`
  contract (`src/lib/seo.ts`, `src/lib/sitemap-contract.ts`), the
  consent-gated Google Analytics loader and the Cloudflare Turnstile widget,
  and the one runtime-config object every per-environment value (base URL,
  measurement ID, site key, merchant contact address) is read into
  server-side and handed to the browser — never a `NEXT_PUBLIC_*` variable. See
  [`storefront/src/config/runtime-config.ts`](./storefront/src/config/runtime-config.ts)
  for that mechanism and [`storefront/src/config/redirect-map.ts`](./storefront/src/config/redirect-map.ts)
  for the redirect map's documented shape. Production catalogue, basket,
  address, shipping totals, and payment sessions come from Medusa through the
  same-origin `/store-api` allowlist. Named `?mock=` states remain isolated to
  development and declared test hosts.

  **Redirect-map operation.** Convert a Task 1 operator map into the runtime
  map with explicit paths:

  ```bash
  npm run --workspace storefront redirect-map:transform -- \
    --input /path/to/operator-map.json \
    --output /path/to/runtime-map.json
  ```

  The command reads no Orange path itself. It ignores `metadata.counts`,
  selects only entries marked `drives_storefront_redirect_table`, normalizes
  their hosts to lowercase, and maps each target path back through the real
  `ROUTE_PATHS` vocabulary. Before writing, it validates through
  `parseRedirectMap` and replays every entry through `resolveRedirect`.
  Malformed, duplicate, ambiguous, or unresolvable input fails without
  replacing the destination. Successful output is deterministic single-line
  JSON with one trailing newline, written by atomic replacement with mode
  `0600`.

  Mount that output as a file and set `REDIRECT_MAP_PATH` to it at runtime.
  Each successfully parsed operator override source logs one
  `redirect_map_loaded` event per process; the bundled fallback fixture does
  not. Repeat requests use the memoised map without another log. A broken
  source remains fail-open to no host redirects and logs once. Restart the
  storefront after changing the mounted map so the process parses the new
  source contents.

  **The basket and the checkout, and the legal page that specifies them.**
  `src/app/cart/page.tsx` and `src/app/checkout/page.tsx` render
  `src/components/shop/`; the production path stores only an opaque Medusa cart
  ID in tab-scoped storage, while `src/lib/mock-cart-actions.ts` supplies only
  the explicitly gated visual states.
  `content/legal/terms.ts` is merged, live and says its checkout section "is
  written to match the checkout screen exactly", so it is the specification:
  the consent line, the contract-formation sentence, the confirmation promise
  and the card-number statement are **read out of that content object** by
  `src/components/shop/checkout-terms.ts` and rendered verbatim, along with the
  return-postage sentence from `content/legal/returns.ts` and the delivery
  estimate from `content/legal/shipping.ts`. There is no second copy to drift,
  and a reworded legal paragraph is a loud failure rather than a checkout that
  quietly stops disclosing something.

  Article 8(2) CRD is what the checkout's layout is for: the final control is
  labelled **"Order with obligation to pay"**, and immediately above it, in one
  block, are the six disclosures the legal page lists — the goods, the price of
  the goods, the shipping charge, the total, the delivery address and the
  delivery estimate. Two things sit between the last of them and the button:
  the catalogue's price qualification, which qualifies the two figures directly
  above it, and then the consent line. Everything a buyer must be told **before
  being bound** sits above that block. One paragraph is below the button — the
  Article 8(7) confirmation promise, which is a statement about what happens
  *after* the contract is formed and changes nothing about what pressing the
  button means; it is the last element of the block, so the button is not. There
  is no consent tick box, because the consent line says the confirmation is
  given *by placing the order*.

  The checkout form posts. A `<form>` with no `method` is a GET, so a press
  before hydration — or with JavaScript switched off — would put the delivery
  address into the URL, the browser history, the `Referer` header and every
  access log on the path. It carries `method="post"` and an action instead:
  `src/app/checkout/order/route.ts` reads nothing out of the body and answers
  `303` back to the checkout with a fixed marker, and the page says in its
  first paint that no order was placed and nothing was charged. Hydrated
  checkout uses Medusa's maintained Stripe PaymentIntent provider; the no-JS
  POST deliberately never attempts payment. See
  [`storefront/src/components/shop/checkout-order-post.ts`](./storefront/src/components/shop/checkout-order-post.ts).

  The shipping charge and the total are `null` until a delivery address is
  complete, because `content/legal/shipping.ts` says shipping is calculated at
  checkout once an address has been entered — so the basket says "Calculated at
  checkout" rather than showing a figure that does not exist yet.
  [`storefront/mock/shipping.json`](./storefront/mock/shipping.json) declares
  one method and **two flat rates on a zone axis** — EUR 7.00 to a delivery
  address in an **EU member state**, EUR 12.00 to one anywhere else, both
  operator-supplied on 2026-08-10. Flat rates only: the plan forbids calculated
  carrier rates. The live Medusa shipping options are seeded to those same two
  figures by
  [`backend/src/commerce/shipping-model.ts`](./backend/src/commerce/shipping-model.ts),
  and `backend/tests/commerce-shipping-model.test.ts` holds this file's two
  rates and this file's 27 `euMember` flags to that model in both directions —
  so the figure the checkout prices with and the figure Medusa charges cannot
  drift apart. "Member state" rather than "in the EU" is the rule the code
  implements: Åland, French Guiana, Guadeloupe, Martinique, Réunion and Mayotte
  are delivery addresses in the EU and are charged the higher rate, because the
  flag they are selected by is membership of the 27 and nothing wider.

  **The country is chosen, not typed, because the charge is priced from it.**
  A rate driven from a free-text field charges `Estonai`, `eesti` and `EE` the
  non-EU rate, and overcharging an EU customer through a spelling difference is
  a defect rather than an edge case. The country field is a `<select>` over
  [`storefront/mock/countries.json`](./storefront/mock/countries.json) — all 249
  ISO 3166-1 entries, because the legal page says we ship to every country — in
  the same slot, with the same label and the same `autoComplete` token it had as
  an `<input>`. That file's `euMember` flag is **exactly the 27 member states**, which
  is the one field here whose failure mode is a silent mispricing, so
  `tests/shop-pages.test.tsx` pins all 27 by name and by ISO code.
  `zoneForCountryName` answers *no zone* rather than the dearer rate to anything
  it does not recognise, so an unrecognised country leaves the charge and the
  total unshown instead of guessing at somebody's expense.

  **The Article 8(2) invariant is a function, not a paragraph.**
  `orderMayBePlaced` (`src/lib/cart.ts`) states it — *no order placement can
  succeed in any state where all six Article 8(2) values are not displayed as
  values* — and the checkout's submit handler is a call to it. It is written
  that way because a paragraph decays silently the moment somebody makes the
  order button optimistic; `tests/shop-pages.test.tsx` names the invariant where
  it drives it, in both the incomplete-address and the complete-address state.

  **A basket holding something we cannot supply has no price and no total.**
  `cartTotals` answers `null` rather than `0` for the price of the goods, and
  the total follows it, so neither screen states a figure for a basket that
  cannot be sold. Excluding the unavailable line from the sum instead put
  the price of the goods as a formatted zero, and a total that was the shipping
  charge alone, into the Article 8(2) block — beside a "The goods" row still
  listing the item. A refused placement does not repair a disclosure that is on
  the screen and false. Both figures render the same kind of instruction the two
  address-dependent figures already do, the order button takes `aria-disabled`,
  and a `role="status"` line directly beneath it — which is also the button's
  `aria-describedby` — says what has to happen first. That is the only state in
  which the order button is `aria-disabled`: an incomplete address must stay
  pressable, because pressing it is what produces the error summary.

  The payment step mounts Stripe's Payment Element only after Medusa has
  returned an amount-bound session matching the total on screen. Only a
  successful Stripe confirmation followed by an explicit Medusa order clears
  the cart and shows confirmation; processing redirects return through
  `/checkout/payment-return`. Standard Store cart completion is server-gated by
  Cloudflare Turnstile; the checkout sends its bounded response only in the
  dedicated completion header. A redirect return renders a fresh Turnstile
  challenge and requires an explicit completion submission, so no one-use
  response crosses the payment-provider redirect. `?mock=` requests either route in a given state
  (`filled`, `updating`, `removing`, `unavailable`, `error`, `placing`) so the
  loading and error layouts can be inspected on a real device; it belongs to
  the mock data layer and leaves with it.

  Payment-method availability stays in the Stripe Payment Method Configuration
  selected at runtime by `STRIPE_PAYMENT_METHOD_CONFIGURATION_ID`. The test and
  live configurations must expose the same set: Card and PayPal are enabled;
  Bancontact, EPS, MB WAY and Satispay are disabled. Link remains enabled for
  Card, and Apple Pay and Google Pay remain automatic wallet choices for an
  eligible device, browser and location. The Payment Element presents eligible
  wallets first, then Card and PayPal; all of them confirm the same
  Medusa-owned Stripe PaymentIntent. Enabling PayPal or registering wallet
  domains is an operator action in both Stripe modes, not an application secret
  or a second payment provider.

  **`?mock=` is inert in production, and that is enforced rather than
  promised.** Requesting a scenario writes the requested basket into
  `sessionStorage` — deliberately, so `/cart?mock=filled` and the `/checkout`
  you navigate to next agree — which means a link of that shape sent to a
  stranger would put an item in their basket. `isMockLayerEnabled`
  (`src/lib/mock-cart-actions.ts`) is asked before the parameter is parsed at
  all, and answers **no by default**: yes only for a hostname the deployment
  declared in `SITE_TEST_HOSTNAMES` — the same validated set that drives
  `X-Robots-Tag: noindex` and the disallow-all `robots.txt` — or for a
  development host (`localhost`, `*.localhost`, `127.0.0.1`, `[::1]`). The
  hostname set is read from the process environment per request, like every
  other per-environment value here, so nothing about the gate is baked into an
  image. On a live hostname `?mock=filled` is a `/cart` with an ignored query
  string.

  **Both browser stores this site writes are disclosed on `/legal/privacy`.**
  The basket lives in `sessionStorage` and the analytics consent decision in
  `localStorage`; neither is a cookie, so neither is a row in the page's cookie
  table — they are two sentences of prose above it, each naming where it is
  kept, how long it survives and what it holds.
  `tests/browser-storage-disclosure.test.ts` walks `src/` for Web Storage
  writes and requires a sentence per store found.

  Purchase-funnel measurement is the closed GA4 set `view_item`,
  `add_to_cart`, `begin_checkout`, `purchase`, and `payment_failure`. The
  central typed emitter starts disabled, is opened only by the same consent
  decision that loads Google Analytics, and remains disabled on every declared
  test host. Events attempted before consent are dropped rather than queued;
  withdrawing consent closes the emitter again. It adds no storage key.

  Commerce payloads contain only the Medusa product or variant identifier,
  product name, quantity, uppercase currency, and monetary values. `purchase`
  additionally uses the Medusa order ID as `transaction_id`, so GA4 can
  deduplicate a retried client event. `payment_failure` carries only the closed
  stage `stripe_confirmation` or `order_completion`. Email and postal
  addresses, cart IDs, Turnstile responses, payment payloads, and free-form
  error text never enter analytics.

  **That guard is a floor, not a proof, and this paragraph has twice claimed
  otherwise.** It said a third store "cannot be added without the notice growing
  with it"; corrected, it admitted "two things it does not see" and presented
  that pair as the whole set. Review demonstrated a further escape each time, in
  the half the text was most confident about. **Read what follows as what is
  known to escape, never as what can.** A green run means the known forms are
  absent; it is not evidence that nothing is stored and nothing is set.

  What the walk does protect, each proved by making it fail: the **removal** of
  a disclosure (deleting a sentence, or a store ceasing to be written, which
  trips the scan's own non-vacuity check); the arrival of a **new module**
  writing browser storage, since the write sites are pinned to
  `cart-store.tsx` and `ConsentManager.tsx`; and a **first-party cookie** set
  through any of the forms it recognises — a `document.cookie` assignment,
  `.cookies.set(` on a `NextRequest` or `NextResponse` jar, and `cookies()`
  from `next/headers`. The last two were added after review pass 2 showed both
  passing green, which matters because Task 5's Medusa checkout is exactly the
  unit that would persist a cart id as a server-set cookie, and a first-party
  cookie with no row in a table captioned "Cookies this site can set" is the
  worst outcome this page has.

  Known escapes: a store outside Web Storage and cookies (IndexedDB, Cache
  Storage); a cookie written through a form the scan does not recognise, of
  which an aliased receiver — `const jar = document; jar.cookie = …` — is the
  honest example, since no text scan follows an assignment; and **a new key in
  an area already disclosed.**

  **That last one is a live hazard for Task 5 and not a hypothetical.** The
  shipped sentence says the basket store "records nothing but which game you
  chose and how many", and it is operator-approved copy on a page carrying two
  qualified-reader reviews. Task 5 replaces this provider's persistence with a
  Medusa cart id and builds the real checkout, so Task 5 is the unit that will
  meet this: caching a shipping address, an email address or an order draft
  would make that sentence false. A *second module* doing so is now caught; a
  second key inside `cart-store.tsx` itself is not, because the write is
  `setItem(STORAGE_KEY, …)` — an identifier — and asserting permitted keys
  statically needs constant resolution the scan does not do. That residue is
  deferred deliberately. **If Task 5 stores anything in a browser beyond a
  product id and a quantity, `/legal/privacy` has to change with it, and no
  guard will necessarily say so — it is a review item, not a red build.**

  **The real routes.** `src/app/page.tsx`, `src/app/games/lunar-base/page.tsx`,
  `src/app/about/page.tsx`, `src/app/support/lunar-base/page.tsx` and
  `src/app/support/lunar-base/rulebook/page.tsx` render genuine page
  composition, not the `RoutePlaceholder` every route used to. The homepage
  and the Lunar Base page are `HomepageMockup` and `LunarBaseMockup`
  (`src/components/mockups/`) developed into routes in place, rather than
  copied elsewhere — both now take an optional `catalogue` prop so the same
  component renders identically in a unit test (the default, `storefront/mock/catalogue.json`)
  and in the real route (the same default, threaded explicitly). About and
  Support are new, purpose-built page components under
  `src/components/pages/`.

  **The mock catalogue is a contract, not a fixture.**
  [`storefront/mock/catalogue.json`](./storefront/mock/catalogue.json) mirrors
  the values Task 5's live Medusa catalogue will be seeded with — one
  product, EUR 25.00 VAT included, in stock, 2–6 players, ~30 minutes, 90
  cards, age 10+. `src/lib/catalogue.ts` resolves `content/`'s catalogue
  placeholders (`{price}`, `{priceLine}`, `{productName}`)
  against it at render time — the two previous units correctly left those
  placeholders literal, because `content/` was not theirs to resolve against a
  catalogue that did not exist yet. `tests/no-hardcoded-price.test.ts` fails
  the build if a price literal appears anywhere outside that one file.

  **It is also the only source of the price a search engine is told.** The
  canonical product page's `Product`/`Offer` JSON-LD used to be built from
  four environment variables (`CATALOGUE_MOCK_PRICE_AMOUNT`,
  `_PRICE_CURRENCY`, `_AVAILABILITY`, `_PRODUCT_NAME`) while the visible page
  read `mock/catalogue.json`, so a single request to a single page could
  publish one price to a crawler and a different one to a person — and, in
  the default state with nothing configured, omit `offers` entirely, so the
  page advertised a price to people and none at all to search engines.
  Nothing failed and nothing warned. Those four variables are gone. The price,
  currency, availability and product name are identical in every environment,
  so they were never per-environment configuration; `src/lib/product-jsonld.ts`
  and the page composition now read the same catalogue in the same request,
  and `tests/product-jsonld.test.ts` imports both and compares them rather
  than repeating figures.

  **Every headline price presents the operator's two lines, and the wrap that
  once argued against it is a typography problem with a typography answer.**
  The operator supplied the price presentation on 2026-08-10 as two lines with
  the first emphasised — `{price} · VAT included where applicable`, then
  *"Shipping calculated at checkout. Non-EU taxes and duties, if any, are not
  included."* `/legal/shipping` rendered that boundary from the day the wording
  arrived; the purchase panel and the product hero did not. They rendered the
  figure large and the **whole** qualifier string small, so *"VAT included
  where applicable"* was small print on the two most prominent surfaces on the
  site and an emphasised line on the least prominent one. `src/lib/catalogue.ts`
  now resolves the operator's three parts separately (`priceHeadline`,
  `priceTaxQualifier`, `priceShippingNote`), because one concatenated string
  cannot express a line break that is also a change of emphasis, and a
  component handed one had no boundary to honour.

  The demotion existed to stop a wrap, and shortening the operator's words to
  restore the emphasis was not available, so the **type** moved instead: the
  emphasised paragraph is set at `--step--1` and only the figure is promoted to
  `--purchase-price-size`, in one inline flow rather than a flex row, so the
  browser breaks where the words fit instead of being forced to break between
  the figure and the separator. Measured in Chromium 151 against a real
  `next build` served on `127.0.0.1` — a trustworthy origin, so the stylesheets
  actually load; confirmed at 303 rules with `MADE Evolve Sans` computed on
  `body`, because a measurement taken on a page rendering in the UA serif is a
  measurement of a page that no longer exists. Purchase panel, whose column
  (384 / 276 / 206 CSS px) is the narrower of the two:

  | the emphasised line alone | 1280 | 390 | 320 |
  |---|---|---|---|
  | as one display-sized run — the wall the demotion avoided | 3 lines, 145px | 3 lines, 110px | 4 lines, 141px |
  | figure promoted, qualification at `--step--1` — as shipped | **1 line, 48px** | **2 lines, 52px** | **2 lines, 51px** |

  | the whole presentation, emphasised line **and** plain line | 1280 | 390 | 320 |
  |---|---|---|---|
  | before: figure, then the whole qualifier string demoted to the note | 4 lines, 115px | 5 lines, 121px | 6 lines, 136px |
  | after: the operator's two lines | 3 lines, 98px | 5 lines, 119px | 6 lines, 135px |

  So the emphasis is recovered at no vertical cost at all — shorter at 1280 and
  within 2px at 390 and 320, on both surfaces. Two things were tried and
  rejected on the measurements: `--step-0` for the qualification (2 / 2 / 3
  lines, one more than `--step--1` at both ends) and `text-wrap: balance`,
  which equalises line lengths and in a 206px column stranded the `·` alone at
  the end of the figure's line.

  **The property, and where it stops.** *Wherever the price is presented as a
  headline, the emphasised line carries the price and the VAT qualifier and the
  unemphasised line carries the shipping and duties sentence.* It reaches the
  purchase panel and the product hero. It does **not** reach the basket and
  checkout summaries: those present no headline price — the goods figure is a
  `<dd>` inside a `<dl>` of goods, shipping and total, `/cart`'s total is a
  pending statement rather than a figure at all, and the note beneath qualifies
  the summary rather than any one figure in it — so they keep rendering
  `priceQualifiers` as one string, and splitting it there would either restate
  the price to have something to attach the qualification to or emphasise a tax
  note above an order total. `tests/price-presentation.test.tsx` pins the
  boundary in the markup **and** the emphasis in the stylesheets, and
  `tests/legal-pages.test.tsx` pins the legal page's callout lead
  character-for-character against the string the product surfaces render.

  **`/legal/shipping` states the VAT qualification once.** Its callout and the
  second qualified read's Minor 2 replacement sentence sat one line apart and
  qualified VAT in different words; the operator answered "unify to my wording"
  on the same date, and the operator's phrasing governs. The *structure* that
  answer settled still holds — one conditional, stated once, in the callout,
  with the body glossing rather than restating it.

  **The words it settled were superseded on 2026-08-18, when the price became
  net.** The two sentences that used to carry it — *"Included means contained
  within that figure rather than added to it"* and *"It is the same figure for
  every visitor, in every country"* — describe a gross price and are false of
  this one, in opposite directions. Neither is on the rendered page any more:
  `backend/tests/commerce-configuration.test.ts` **refuses** them anywhere a
  reader would meet them, and `tests/legal-pages.test.tsx` names them
  superseded. What survives is what they were protecting, restated for the
  model that applies — VAT is **added** for a delivery address in the European
  Union and added nowhere else, and both claims are pinned against the rendered
  page. An earlier revision of this paragraph described the old sentences in
  the present tense and claimed a test failed if either left the page; both
  statements are now inverted, which is why the wording above says which date
  it belongs to.

  **No `{token}` reaches a visitor.** Two did:
  `{priceLine}` in the product page's "How much is shipping?" answer, inside
  a closed `<details>`, and `{merchantContactAddress}` in plain body type on
  `/support/lunar-base`. `tests/no-unresolved-placeholder.test.tsx` renders
  every real route's component and fails on any brace-delimited token
  surviving in text a browser will paint, with `<details>` content counted
  whether the disclosure is open or closed.

  **The merchant contact address is configuration, and is suppressed when it
  is absent.** `content/schema.ts` used to mark the merchant identity
  placeholders `unresolved`, because no deployment supplied them. All seven now
  arrive from `hannosirkel/deploys`, so the flag is gone and the ten legal
  pages are `operator-approved`. Suppression is unchanged and still matters,
  for the reason that made it right in the first place: an environment can
  always be misconfigured. `MERCHANT_CONTACT_ADDRESS` supplies it at runtime;
  `src/lib/configuration-placeholders.ts` resolves it and **drops the
  paragraph that quotes it** when no address is configured, per paragraph, so
  an unresolvable sentence never takes a resolvable one with it. The contact
  form beneath it is unaffected.

  **The age marking is rendered from the catalogue.** `content/`'s
  `specifications` list carries no age entry and is read-only to this unit, so
  `FeatureSpecStrip` renders `mock/catalogue.json`'s `ageRange` beneath the
  five-column strip, worded as a safety marking for the product rather than a
  play recommendation. The CE / EN71 certification copy that states why is
  `content/`'s and belongs to the unit that owns `content/`; it is
  deliberately absent here rather than paraphrased into a component.

  **The newsletter and contact forms mount `TurnstileWidget` and
  `HoneypotField`** (`src/components/forms/`), both built in an earlier unit
  and mounted nowhere until now. `HoneypotField` is fixed in the process: it
  used to hide itself with an inline `style` attribute, which this
  application's CSP (no `'unsafe-inline'` in `style-src`) does not permit, so
  it rendered as a visible input the moment it was actually mounted in a
  page. It now hides via a stylesheet class
  (`src/components/turnstile/HoneypotField.module.css`). The contact path now
  verifies Turnstile server-side and relays through the configured Medusa
  backend. Newsletter follows the same server-side validation boundary and
  writes only to the configured Brevo list, with no local subscriber store. A
  deployment-wide fixed-window counter in the environment's existing Redis
  rejects excess valid attempts before Turnstile or Brevo; its one static key
  contains no address, IP, token, or other subscriber-derived value.

  **Neither public form can put a field value in a URL, and neither fabricates
  success.** Both shipped as `<form onSubmit={…}>` with no
  `method` and no `action` — which is a GET, and a GET serialises **every**
  named control, not only the ones somebody typed into. Measured on a rebuilt
  base revision, an unhydrated press (or one with JavaScript off) put **2 of
  the newsletter's 2 controls** and **5 of the contact form's 5** into the
  query string, the browser's history, the next request's `Referer` and every
  access log on the way to Loki: the subscriber's address; the contact form's
  name, address, subject and whole message body; and, on both forms,
  `additional-notes` — which is the **honeypot**
  (`src/components/turnstile/HoneypotField.tsx`), so the hidden anti-spam
  field went into the URL alongside the visible ones, publishing whether it
  had caught anything to every log on the path. The checkout had the same
  defect and was fixed first, with a route and a `303`; these two carry a
  Server Function as the form's `action` instead
  (`src/components/forms/public-form-actions.ts`), which reaches the same
  guarantee from inside the form components. The values travel in a request
  body. Each action validates bounded fields, then posts them server-to-server
  to Medusa; Medusa revalidates them and verifies Turnstile before either
  upserting the configured Brevo list or relaying contact mail through strict
  STARTTLS. Neither path stores or logs the submitted content locally. Success
  is rendered only after a 204 response; every failure uses fixed error copy.
  The answer is rendered into the HTML of the POST response, so it is legible
  with no JavaScript at all.
  Proved on a running server with `javaScriptEnabled: false` at 1280, 390 and
  320, and asserted in `tests/build-and-serve.test.ts`.

  **The one value that travels back *in* is treated as untrusted.** React
  serialises the previous answer into the form as a plaintext hidden control
  and the browser reposts it, so on the unhydrated path it is whatever the
  client sent rather than something the server remembers — a forged count of
  `41` really does render `42`, and before the guard a forged *string* count
  was **concatenated** rather than added, straight into a rendered attribute.
  The actions therefore take the previous state as `unknown` and narrow it:
  anything that is not an integer is no previous state at all and is answered
  with 1, and nothing throws, because a form press must not be answered with a
  500. That is correctness rather than security — nothing in that value is
  stored, logged or read back, and the message is always the fixed `content/`
  sentence — but the next unit inherits the argument. What a press serialises
  back is now asserted verbatim on three consecutive presses on both forms
  (`tests/build-and-serve.test.ts`): the fixed sentence, an integer, and
  nothing else.

  **Every completed submission now changes the DOM inside the live region,
  including consecutive identical ones.** The answer is the same sentence
  every time, so while the action returned that bare string a second press
  handed `useActionState` a value React judged equal to the one it already
  had: the focus effect keyed on it did not re-run and the live region's
  contents did not change. Measured in a browser on the second consecutive
  hydrated press: **0 mutations** in the `role="status"` region on both forms.
  The answer was still on screen — so this was never a WCAG failure — but a
  polite live region whose contents do not change gives a screen-reader user
  silence for a press that had plainly done something. The action now returns
  a `PublicFormOutcome`, a fixed `content/` sentence plus a submission count,
  and the paragraph is keyed on that count so it remounts. Same measurement
  after: **2 mutations** (the old paragraph out, the new one in) and focus on
  the new answer, on both forms.

  **What was measured is the mutation count, not the announcement**, and the
  distinction is the point of the paragraph above rather than a caveat on it.
  No screen reader was run: there is none in this environment, and that is a
  standing gap on this work, not something these changes closed. That a
  childList change inside an `aria-atomic` `role="status"` region is spoken is
  read off the specification and off what the mutation observer recorded — it
  was not heard. `tests/forms.test.tsx` and `tests/build-and-serve.test.ts`
  say the same thing where they assert the mechanism, and the WCAG 2.2 AA
  ledger row this work feeds stays open for exactly this reason: it closes on
  a human assistive-technology pass and on nothing else.

  **The Turnstile widget renders at Cloudflare's `compact` size.** It
  defaulted to `flexible`, which Cloudflare documents as *100% wide with a
  300px minimum* — a floor, not a target. The `.turnstile` box measures 174px
  on the newsletter and 222px on the checkout at a 320px viewport, and 244px
  on the newsletter at 390px, so the widget was wider than its own container
  on five of nine measured viewport/form combinations. Both `.turnstile`
  rules also carried `overflow: hidden`, so it was **clipped rather than
  overflowing** and three page-level sweeps read clean over it. `compact`
  (150x140) fits every container this site produces, and the clipping
  declaration is gone from both stylesheets so a future oversize is
  measurable rather than silently cut off.

  **How much that buys is worth stating exactly, because it is less than "a
  sweep".** `src/styles/global.css` keeps `overflow-x: hidden` on `html` and
  `body` for the reason recorded further down this file, so
  `document.documentElement.scrollWidth <= clientWidth` can never fail on
  this site whatever overflows — removing the clip from `.turnstile` does not
  change that. Measured at a 320px viewport with a 300px stand-in (the
  `flexible` floor) in the real container:
  `documentElement.scrollWidth` 305 against a `clientWidth` of 305, still
  clean, while `body.scrollWidth` reads **365** and the stand-in's right edge
  sits 141px past its container's. So what the removal restores is
  detectability to a **box-level `getBoundingClientRect()` or a
  `body.scrollWidth`** measurement — which is exactly what
  `tests/mockup-layout.test.ts` already says a browser-driven harness must
  do, and not to a root-scroll-width sweep.

  **`--accent-fill` can no longer be used as a text colour.**
  `tests/mockup-layout.test.ts` now scans every `.module.css` under `src/` for
  it. That token is a background — `design/tokens.css` says so itself — and as
  text it measures 2.91:1 on the contact form's surface and 3.19:1 on the
  newsletter's, against WCAG 1.4.3's 4.5:1. It shipped in two stylesheets and
  survived a fix pass in one of them, because nothing in the repository could
  see it.

  **`ConsentManager` is styled.** It was inherited unstyled — a raw
  paragraph and two default `<button>`s below the footer of every page —
  which was invisible while every route was a placeholder and is not now that
  the homepage and the product page are real. The banner is fixed to the
  bottom of the viewport, because a consent request a visitor only reaches by
  scrolling past the footer is not one; the always-available control that
  reopens it deliberately is **not** fixed, and sits in normal flow carrying
  the footer's own surface rather than floating over page content forever.
  Both buttons wear `mockups/call-to-action.module.css`'s classes, so the
  focus ring and hit target are the site's, not the user agent's — that
  stylesheet also gained the `:focus-visible` rule every call to action was
  missing, including "Add to basket".

  **Video stays on YouTube.** `src/components/video/VideoEmbed.tsx` embeds a
  `youtube-nocookie.com` iframe sized from a real, measured aspect ratio
  (never assumed 16:9) when a video id is configured, and renders an honest
  pending state when it is not — every call site in this unit passes
  `youTubeId={null}`, because no real YouTube id exists yet for any of the
  three local masters. A future unit that supplies one must also add
  `youtube-nocookie.com` to `src/lib/csp.ts`'s `frame-src`/`script-src`; this
  unit's authority to touch that file is scoped to two carried redirect
  findings and catalogue-placeholder resolution, not video CSP.

  **The rulebook stops living in Google Drive.**
  `storefront/public/documents/lunar-base-rulebook.pdf` is a byte-identical
  copy of the operator's verified master (25 pages, tagged, not encrypted,
  real extractable text — `pdfinfo`/`pdftotext` verified), served from
  `/support/lunar-base/rulebook`.

  **That page links the PDF; it does not embed a viewer.** It shipped with an
  inline `<object type="application/pdf">` under this application's own
  `object-src 'none'` policy (`src/lib/csp.ts`). Chromium blocked it outright
  and the page painted an empty bordered box; the fallback link inside it
  carried no class, so it inherited the user agent's `rgb(0, 0, 238)` on the
  Lunar surface — 1.59:1, against WCAG 2.2 AA's 4.5:1. The `<object>` and its
  now-dead `.viewer`/`.fallback` rules are deleted rather than the policy
  widened: relaxing `object-src` on a public site is a security decision, and
  the link already works — browsers open the PDF natively, with their own
  reader honouring its tag structure and text selection. The page states the
  8.9 MB size so a visitor on a metered connection knows before tapping.

  `tests/no-live-hostname.test.ts` pins its
  sha256 rather than scanning it as text (a PDF's content streams are
  compressed binary) or holding it to the image byte ceiling (it is a
  document, not a web derivative). It is committed as-is rather than
  recompressed: Ghostscript's `pdfwrite` device cuts it from 8,898,253 bytes
  to 3,210,697 but strips the tag structure entirely (`pdfinfo`'s `Tagged:`
  flips from `yes` to `no`), which fails the "tagged and selectable rather
  than a scan" requirement outright.

  `storefront/public/` carries the committed web derivatives — the publisher
  and Lunar Base brand marks, favicons, product and component photography,
  and two Open Graph cards — derived from masters that live outside every
  repository and are never committed here
  (`storefront/tests/no-live-hostname.test.ts` holds every one of them to a
  byte ceiling, and to carrying no EXIF, XMP or PNG text metadata, for
  exactly that reason). The two OG cards are not the same kind of thing, and
  calling both "authored" would have been wrong: `og/publisher-og.png` is the
  Plepic brand pack's own 1200x630 card, committed byte-for-byte because it
  already existed and redrawing it would have been waste, while
  `og/lunar-base-og.png` is composed for this site from the Lunar Base
  wordmark and the components photograph, then quantised with
  `pngquant --quality 70-95` and stripped of an alpha channel it never used
  (322,200 → 73,203 bytes, RMSE 0.4%).

  Both cards are now attached to real page metadata: `OG_IMAGE_PATHS` in
  `storefront/src/lib/seo.ts` maps every route to one of them — the three
  Lunar Base routes to the product card, everything else to the publisher card
  — and `buildPageMetadata` emits it as an absolute `openGraph.images` entry
  built from the request's configured base URL. Until the unit that wrote
  those tests, they were referenced by nothing at all and every page shipped
  with no share card, which is why the served suite now reads `og:image` off
  each rendered route rather than trusting the metadata builder alone.

  **Some of what is in `public/` is referenced by no source file, on
  purpose.** Two groups, and the distinction matters because "nothing
  imports it" is otherwise a good argument for deleting a file:

  - **Referenced by the platform, not by code** — `favicon.ico`,
    `icons/favicon-32.png`, `icons/favicon-64.png`,
    `icons/apple-touch-icon.png`, `icons/web-app-icon-192.png` and
    `icons/web-app-icon-512.png`. Browsers and installers fetch these by
    convention and by web-app manifest; the manifest and the `<head>` links
    belong to `t2-pages`, which builds the real routes.
  - **Brand-pack deliverables, committed as deliverables.** The plan's
    fourth checkbox asks for publisher-level supporting assets in their own
    right, so `brand/plepic-icon-primary.svg`,
    `brand/plepic-wordmark-small-print.svg`, `brand/lunar-base-logo.svg` and
    `brand/lunar-base-icon.svg` are here whether or not a component happens
    to name them today. `plepic-wordmark-small-print.svg` (3,183 bytes) is
    the reduced-detail variant of the wordmark — four rules rather than six
    and a larger secondary GAMES line, so it survives reproduction at small
    sizes where the primary's hairlines close up. It is deliberately *not*
    what the footer uses: its letterforms are `#151B46`, which is
    `--surface-sunken` on the publisher layer, so on the footer it measured
    1.00:1 and rendered as three coloured bars and no name. The footer takes
    `plepic-wordmark-dark.svg`, and `tests/site-chrome.test.tsx` measures
    that pairing on both token layers so the swap cannot be undone by
    accident.

  `storefront/src/components/` carries three content-driven composites
  rebuilt from what used to be baked raster images (`FeatureSpecStrip`,
  `TeamPhotoSection`, `ReviewComposite`) and two full-page mockups under
  `components/mockups/` (`HomepageMockup`, `LunarBaseMockup`) built from
  `design/tokens.css` and `content/`, not from an image. Both mockups are now
  rendered directly by `src/app/page.tsx` and
  `src/app/games/lunar-base/page.tsx` — see "The real routes" above.
  `tests/mockup-layout.test.ts` and `tests/site-chrome.test.tsx` hold them to
  the properties rendered markup cannot show, each added after a review found
  a page visibly broken while the suite was green: that no two grid items are
  placed in one named grid area (four items in one named area occupy one cell
  and overlap; they do not stack); that every growable flex item bounds its
  own minimum size, rather than being floored at its content's min-content
  width and pushing its siblings off the screen; that the footer wordmark
  measurably contrasts with the footer surface on both token layers; and that
  nothing off-screen or inert is left in the keyboard tab order. All four are
  decided from the stylesheet, because this suite has no layout engine — the
  trade-off, and what a browser-driven harness would add on top, is argued at
  the head of `tests/mockup-layout.test.ts`.

  **The flex/grid check widened.** It used to scan `src/styles` only and only
  a rule that itself declared `flex`/`flex-grow`. It now walks all of `src/`
  (a stylesheet co-located beside its component, e.g.
  `src/components/video/video-embed.module.css`, is covered exactly like one
  under `src/styles`), also treats a rule as an at-risk flex item when a
  sibling rule makes its *parent* a flex container (catching
  `purchase-panel.module.css`'s `.metaRow dt`/`dd`, which are flex items
  purely by inheriting `display: flex` from `.metaRow` and declare no `flex`
  property of their own), and flags a bare `<number>fr` grid track sharing a
  row with another track — the grid equivalent of the same defect. Fixing
  what it found was not always `min-width: 0` on both sides: `.metaRow dt`
  (a short label) shrinking to fit its detail's long prose wrapped the label
  itself into illegibility, so the actual fix keeps the label at
  `flex-shrink: 0` and lets only the detail grow, shrink and wrap — recorded
  in the test as `hasZeroFlexShrink`, an exemption from the check that is
  correct by the CSS Flexbox spec rather than a hole in it (a `flex-shrink:
  0` item cannot exhibit the automatic-minimum-size defect at all, because
  that defect is specifically a floor on how far an item may shrink).

  **A percentage size plus padding or a border must say which box it means,
  and that is now checked rather than claimed.** There is no global
  `box-sizing` reset in this repository, on purpose
  (`site-header.module.css`'s own doc comment says so), which means
  `height: 100%` or `width: 100%` next to `padding`/`border` resolves against
  the *content* box and the padding and border are added on top of it. A
  rendering pass with a real, headless browser at 1280, 390 and 320 CSS
  pixels found this three times: `.stackedField` and the rulebook's since
  deleted `.viewer` measured wider than their containers, and every
  `ReviewComposite` card overflowed its grid cell by exactly 50px — two
  `--card-padding`s and two border widths — with card 1's attribution
  painting outside its own card and under card 5's top edge on
  `/games/lunar-base`.

  An earlier revision of this file claimed "every element like this now sets
  `box-sizing: border-box` explicitly". Nothing enforced that and it was not
  true when written. `tests/mockup-layout.test.ts` now makes it true: any rule
  under `src/` that combines a percentage `width`/`height`/`max-*` with a
  non-zero padding or border and does not set `box-sizing: border-box` fails
  the build, by selector and file. `border: 0` and `padding: 0` add no extent
  and are not flagged.

  That same rendering pass found a third defect, in `SiteHeader`'s own
  mobile navigation sheet (inherited, not introduced by this unit): at a
  320px viewport, the closed sheet — `position: fixed`, translated off-screen
  by its own width — measurably widened `document.documentElement.scrollWidth`
  past the viewport in a real Chromium build, even though it never paints and
  cannot be reached by keyboard while closed (`tests/site-chrome.test.tsx`
  already holds it to that). `src/styles/global.css` — the one global,
  non-module stylesheet in this repository, imported once from
  `src/app/layout.tsx` — sets `overflow-x: hidden` on `html`/`body` for
  exactly this: it does not move or resize the sheet, only stops the
  phantom width from being reachable, and this repository introduces nothing
  that is ever meant to be reached by horizontal scrolling.

  **One consequence of that rule is permanent and belongs written down.**
  With `overflow-x: hidden` on the root two boxes,
  `document.documentElement.scrollWidth <= clientWidth` can never fail again
  on this site, whatever overflows — it is no longer a horizontal-overflow
  detector. Any layout check, in this repository or in the browser-driven
  harness a later unit adds, must compare **per-element**
  `getBoundingClientRect()` against the viewport and against each element's
  own container instead. The 50px card overflow above is the concrete case:
  the root scroll width was clean at all three widths while five cards each
  hung 50px out of their cells.

  `sharp` is a direct dependency of the storefront for one documented
  reason. Next.js declares it an `optionalDependency` of its own, and its
  `sharp-missing-in-production` guidance is that installing it is "strongly
  recommended" for a production environment using `next start` — which is
  exactly how this workspace's `start` script serves the site. It is
  imported by no source file here and is not a build-time asset tool; the
  committed derivatives were produced outside the repository. If `next/image`
  is still unused when the storefront ships, returning it to Next's own
  optional resolution is a one-line change.
- `backend/` — pinned Medusa v2 backend with PostgreSQL/Redis runtime seams.
  `medusa-config.ts` registers the Redis event bus, the Redis workflow engine
  and the Redis locking provider, and `REDIS_HOST`, `REDIS_PORT` and
  `REDIS_PASSWORD` are read fail-closed at start. Without them Medusa installs
  its in-process defaults in every workload and `plepic-worker` shares no queue
  with the API that enqueues to it — with no failing probe and no failing
  checkout, because the API runs its own subscribers in the default `shared`
  worker mode.
  **The configuration checks that Redis is named; a preflight `PING` in front of
  every role checks that it answers** — the module loaders check neither, and
  two of the three log a connection they did not make. See "What the cluster
  runs" for the measured behaviour, and for why a wrong password is a
  credential-rotation event rather than a restart.
  It carries one maintained Stripe provider and a custom email notification
  provider.
  Order confirmations use Medusa's idempotent persisted notification lifecycle;
  each confirmation reproduces the approved withdrawal conditions and complete
  model withdrawal form in the durable email, with legal name, registered
  address, legal contact address, and return address supplied through the same
  `MERCHANT_*` deployment configuration used by the storefront. A root contract
  test keeps that email wording equal to `content/legal/returns.ts`.
  contact messages use the same strict STARTTLS sender directly, after
  Turnstile verification, so their contents are never stored by Medusa.
  Newsletter submissions follow the same bounded, Turnstile-first Store API
  boundary and upsert only the deployment-configured Brevo list. A fail-closed,
  cross-pod Redis counter limits the route before either external service and
  stores no subscriber-derived key or value; subscriber addresses and provider
  errors are neither persisted nor logged locally.
  SMTP submission is fixed to port 587 with certificate verification; sender
  and contact recipient are deployment configuration, and visitor addresses
  are Reply-To only. API/webhook secrets and the environment's Payment Method
  Configuration stay backend-only; only Stripe's publishable key
  is projected to the browser at request time.

Two directories are not workspaces but are consumed by the storefront:

- `design/` — `tokens.css` and the design system's record, including the
  measured contrast ratios and the webfont licence obligations.
  `design/tokens.test.ts` resolves the token file the way a browser does and
  holds every rendered colour pair to its WCAG minimum.
- `content/` — the site's copy as typed TypeScript, with the editorial content
  document beside it. See [`content/README.md`](./content/README.md) for why it
  is TypeScript rather than MDX, and what that makes impossible.

## Locales

The site is published in **one** locale, `en`, and the mechanism for
publishing it in more is complete. Both halves of that sentence are load
bearing: there is no Estonian here, and adding it is a content change and a
registration rather than a refactor.

A locale is an **edition** of this site, not a language. It is declared in
[`content/routes.ts`](./content/routes.ts) as an entry in `LOCALES` plus a
`LOCALE_DEFINITIONS` record carrying two facts that are deliberately
separate — the BCP 47 **language tag** the edition is written in, and the URL
**path prefix** it is served under.

| Fact | Where it is declared | Who reads it |
|---|---|---|
| Which editions exist | `LOCALES` | everything below |
| Language tag | `LOCALE_DEFINITIONS[locale].languageTag` | `<html lang>`, `hreflang`, `localeCompare` collation |
| URL prefix | `LOCALE_DEFINITIONS[locale].pathPrefix` | `localizedPath` / `parseLocalizedPath` in `storefront/src/lib/urls.ts` |
| Which pages an edition publishes | `pagesByLocale` in `content/index.ts` | canonical, sitemap, `hreflang`, the router |
| Which legal notices an edition carries | `legalPagesByLocale` in `content/legal/index.ts` | `LegalRoute` in `storefront/src/app/localized-routes.tsx` |
| Which routes can be *rendered* in an edition | `LOCALIZED_ROUTE_VIEWS` in the same file | the router, and the guard that refuses a page nothing can serve |

**Registration is a compile error, not a checklist.** Every registry above is
a total `Record<Locale, T>` (`LocalizedContent<T>` in `content/schema.ts`), so
adding a member to `LOCALES` fails the build at each registry that has not
been filled in. Nothing has to remember to enumerate the work.

### URLs

The default edition holds the unprefixed paths — `/legal/imprint` is what it
always was, and no existing link, backlink or redirect moves. Every other
edition is served under its prefix by one optional catch-all,
`storefront/src/app/[locale]/[[...segments]]/page.tsx`, which maps a path back
to a `RouteId` through the same `ROUTE_PATHS` table everything else uses;
there is no mirrored route tree per locale to drift.

`/en/…` is **not** a URL of this site. The default edition's prefix is empty,
so a page has exactly one canonical rather than two.

### The served document

There are two root layouts, `app/(site)/layout.tsx` and
`app/[locale]/layout.tsx`, because only a root layout may render `<html>` and
only one under a dynamic segment can know which edition the request resolved
to. Both are four lines around `app/site-document.tsx`, which is the document
itself — so `<html lang>` comes from the locale definition, in one place, and
the two layouts cannot drift.

### The cost of two root layouts: the 404

Two root layouts are what make `<html lang>` a property of the edition rather
than a literal, and they are paid for. In Next 16.3 a 404 renders the
framework's own `<html id="__next_error__">` document, with the
`not-found.tsx` body in the flight payload rather than in the server-rendered
HTML.

**At full price: a visitor with JavaScript disabled receives zero characters
of body.** Not a degraded page — nothing. What they do get is the correct
`404` status and a server-rendered `<title>`, so the browser tab reads
"Page not found" rather than the raw URL. With JavaScript the page is
complete: styled, brand navy, `MADE Evolve Sans`, the heading, the sentence
and the link, and `<main lang="en" data-layer="publisher">` — the document
element carries no `lang`, so the content root declares it instead, which is
valid HTML.

**There was no designed 404 to regress from.** Before this, an unmatched path
got Next's own `/_not-found` page — the framework's stock *"This page could
not be found"* — and on `main` its inline styling was blocked by **five CSP
`style-src` violations**, because this application serves a nonce-based policy
the framework's error page carries no nonce for. The replacement says more,
and says it in the site's own voice.

Two things about the trade were established by running it:

- **`notFound()` behaves this way on `main` too**, with its single root layout
  and a `not-found.tsx` present. `main` never met it because nothing there
  called `notFound()`; the localized catch-all does.
- **With multiple root layouts the unmatched-path 404 has no root layout to
  render into either.** A `not-found.tsx` beside each root layout, one nested
  under the catch-all, one rendering its own `<html>`, a root-level
  `app/not-found.tsx`, `app/global-not-found.tsx` (experimental in this
  version and inert without a `next.config.ts` flag), and
  `dynamicParams = false` were all tried; all six produce the same document.

**`dynamicParams = false` is rejected because it does not fix the 404
document, and for no other reason.** An earlier revision of this section also
claimed it would statically prerender the localized route and bake the
building environment's base URL into a second edition. That did not reproduce:
tested with a build-time canary in three configurations — as shipped, with
`force-dynamic` removed from the page, and removed from the page and the
layout — the route stayed dynamic and no canary appeared anywhere in `.next/`,
because `generateMetadata` reads `headers()` and that keeps the segment
dynamic regardless. The conclusion stood; the reason was an inference written
down as a measurement, and it is withdrawn.

**A 404 carries no canonical and no alternates, and that is guarded.**
`notFound()` does *not* discard this application's metadata: a canary
canonical placed in the 404 branch of the localized route reaches the
**hydrated DOM**, where a rendering crawler would read it as a claim that the
URL exists. `storefront/tests/build-and-serve.test.ts` asserts its absence
against the payload hydration reads, and proves its own needle by requiring a
real page to match the same patterns.

What would end the trade is a rewrite in `src/proxy.ts` mapping the unprefixed
paths onto a single dynamic root segment, so there is one root layout again
and it can still read the locale. That file was outside the authority of the
unit that added this.

### `hreflang` at one locale

Every page emits `rel="alternate"` links: one per edition that publishes it,
keyed by that edition's language tag, plus `x-default`. With one edition that
is a self-referential set of one and an `x-default` pointing at the same URL,
which is what a correct set of one looks like — the alternative, emitting
nothing, is indistinguishable from never having computed anything. The same
map is emitted in the document and in `sitemap.xml`, from one function
(`alternateLinksFor` in `storefront/src/lib/seo.ts`), so the two cannot
disagree.

### Redirects carry no locale

`storefront/src/config/redirect-map.ts` is unchanged and stays that way. A
redirect entry is a `path` and a `RouteId`; it resolves to the default
edition's bare path, because an inbound link from an alternate host says
nothing about what language its visitor reads. `storefront/tests/redirect-map.test.ts`
holds that line — adding a `locale` field to an entry is the "improvement"
that would give one target two sources of truth.

### What is *not* locale-aware yet, and why that is visible

The legal set is. The marketing pages are not: `AboutPageContent`,
`SupportPageContent`, `HomepageMockup` and `LunarBaseMockup` read
`content/publisher.ts`, `content/lunar-base.ts` and `content/support.ts`
directly, and those modules carry no locale key. That is why
`LOCALIZED_ROUTE_VIEWS` lists five routes and not twelve, and why an edition
that registered `/about` would fail
`storefront/tests/locale-routing.test.ts` rather than serve English words
under a translated URL.

## Development

```bash
npm ci
bash scripts/validate
```

Dependency installation is intentionally separate from validation so repeated
validation runs do not reinstall packages. `scripts/validate` runs lint
(`eslint`, over the whole repository), a type-check (`tsc --noEmit`), and the
unit test suite (`vitest run`).

`vitest.config.ts` at the repository root is a **projects** list, not a single
`include` array, and it is the one statement of what `npm run test:unit` runs:
the `repo` project covers `content/`, `design/` and `scripts/`, and the
`storefront` project is `storefront/vitest.config.ts`, which needs different
settings because `storefront/tests/build-and-serve.test.ts` runs a real
`next build` and `next start`. That build is why validation takes about a
minute rather than a second; it is also the only way to prove that no
per-environment value was baked into the image. Adding a workspace means
adding it to that list, or its tests run in no gate.

The root `npm run typecheck` is narrower than the test run: it covers
`content/**/*.ts`, `design/**/*.ts`, `scripts/**/*.ts` and `vitest.config.ts`
— `tsconfig.json`'s `include` is scoped there deliberately, and `storefront/`
is absent on purpose, because Next.js scaffolds its own `tsconfig.json` (see
`AGENTS.md`, next to the TypeScript version pin). `storefront/` is
nevertheless type-checked by the same validation run, because the `next build`
inside `storefront/tests/build-and-serve.test.ts` runs TypeScript over
`storefront/tsconfig.json` — `src/` and `tests/` both — and fails the build,
and therefore the test, and therefore `scripts/validate`, on a type error. For
a faster loop while working inside the storefront:

```bash
cd storefront
npm run typecheck
npm run test:unit
```

`scripts/validate` is pure: it runs on a bare checkout with Node and needs no
Docker daemon, no database and no network. Two checks therefore sit outside it
and are run on their own — the browser suite (`npm -w storefront exec --
playwright test`) and the store smoke check (`bash scripts/store-smoke`), which
asks a running Medusa what the storefront asks it. Both run in CI on every pull
request; see "Continuous integration".

## Running the stack locally

`compose.yaml` brings up PostgreSQL, Redis, an SMTP sink, the backend and the
storefront, so the commerce path can be exercised without a cluster:

```bash
docker compose up --build
docker compose down --volumes
```

The storefront is then on <http://localhost:3000>, the backend on
<http://localhost:9000>, and whatever the backend tried to send is readable in
Mailpit on <http://127.0.0.1:8025>. Every published port is bound to
`127.0.0.1`. Both application services build from the same Dockerfiles CI
publishes, so a local run exercises the image rather than a `next dev` server
that resembles it.

The data services are pinned to the **same digests** as the StatefulSets in
`hannosirkel/deploys` and as the service containers in
`.github/workflows/validate.yml` — `scripts/images.test.ts` asserts the files
in this repository agree, and `compose.yaml` records the agreement with the
fourth. A local run against a different PostgreSQL major version than the
cluster runs proves less than it appears to.

**There is no credential in `compose.yaml`.** The local PostgreSQL uses `trust`
authentication and has no password at all; the local Redis is given the
project's own name. Everything that is a real credential in a real environment
is an obvious placeholder, and a developer who needs a working one exports it
before `docker compose up`:

```bash
export STRIPE_SECRET_KEY=…            # a Stripe sandbox key
export MEDUSA_PUBLISHABLE_API_KEY=…   # created against the local database
```

Two things the local stack deliberately does not paper over. The backend needs
its database migrated before it will serve, and the migration is the predeploy
step the cluster runs as a Job rather than something `compose.yaml` does behind
your back — run it yourself, once, against the running stack:

```bash
docker compose run --rm \
  -e MEDUSA_ADMIN_EMAIL=admin@example.test \
  -e MEDUSA_ADMIN_PASSWORD="$(openssl rand -base64 24)" \
  backend npm run predeploy
```

And the SMTP sender does `requireTLS: true` with certificate
verification, which is not relaxed for local convenience — Mailpit accepts the
connection, and to complete a delivery give it a certificate
(`MP_SMTP_TLS_CERT`, `MP_SMTP_TLS_KEY`) and the backend a `NODE_EXTRA_CA_CERTS`
that trusts it.

## What the cluster runs

Four workloads in `hannosirkel/deploys` run this one backend image and choose
what it does with `args: [npm, run, <script>]`. Kubernetes `args` replaces the
image's `CMD` and leaves `ENTRYPOINT` prefixed, which is why `backend/Dockerfile`
clears the entrypoint the `node` base image ships: the manifests in the other
repository say what the container runs, and what they say should be the whole of
it.

| Script | Workload | What it does |
|---|---|---|
| `start` | `plepic-backend` Deployment | The API and the Admin, on the framework's default worker mode |
| `start:worker` | `plepic-worker` Deployment | The same image with `MEDUSA_WORKER_MODE=worker` |
| `predeploy` | `plepic-predeploy` Job, an Argo CD sync hook | `medusa db:migrate --execute-safe-links`, then seeds the initial administrator, then applies the declared commerce configuration |
| `catalogue:import` | `plepic-catalogue-import` Job, suspended | The one-shot WooCommerce catalogue import |

All four begin with `npm run redis:preflight &&`, which is the fifth script and
the only one no manifest names: it is a step inside the other four rather than a
workload of its own. See "Naming a Redis is fail-closed, and so is reaching one".

**The script name is the whole of the contract, and it has nothing behind it.**
A manifest naming a script this `package.json` does not declare is
`npm ERR! Missing script` and an immediate exit — a first-start failure that no
review of either repository on its own can see, because each side reads only as
a sensible list of its own. Both sides are now tested:
`backend/tests/deployment-contract.test.ts` holds the list against the source
manifest and `scripts/validate` holds it against the built
`.medusa/server/package.json`, so a script the cluster calls cannot be absent
from a published image without CI failing.

Neither `backend.yaml` nor `worker.yaml` sets `MEDUSA_WORKER_MODE`, so worker
mode is selected inside `start:worker` and nowhere else. Putting it in
`medusa-config.ts` would have moved the API off the default too; the two
Deployments differ by exactly the script they name.

`predeploy` is one command list rather than several Jobs because everything else
is gated on one sync hook: ping Redis, migrate, seed, configure, and only then
let an API, worker, or storefront pod start. It is also the only place a further
step can go — `deploys` names the workloads it runs, and an additional
`args: [npm, run, …]` would be a script this repository declares and no manifest
ever invokes. That is exactly how the Redis preflight got there.

### The predeploy Job cannot answer a prompt

`medusa db:migrate` syncs the link tables as an **internal stage**, not as a
separate entry in `predeploy`'s command list — `commands/db/migrate.js` calls
`syncLinks` itself unless `--skip-links`. So the flags that govern that stage
belong on `db:migrate` and nowhere else in the chain.

Given neither `--execute-all-links` nor `--execute-safe-links`, `sync-links.js`
hands every planned **delete** and **notify** action to an `@inquirer/checkbox`
and asks which tables to act on. The predeploy Job has nobody to ask: it
requests no `stdin`. It is also a `Sync` hook at `sync-wave: "-10"`, behind the
data services at `-20` and ahead of every Deployment and the import Job at `0`.

`predeploy` therefore passes `--execute-safe-links`.

**That flag does more than suppress the prompt, and the difference is a real
cost.** Per `sync-links.js`, "safe" means the unsafe actions are *discarded* —
not deferred, and not converted into anything milder:

| Planned action | Interactive `db:migrate` | With `--execute-safe-links` |
|---|---|---|
| `create` | executed | executed |
| `update` — generated SQL contains neither `alter column` nor `drop column` | executed | executed |
| `notify` — generated SQL contains one of those two fragments | offered in the prompt; whatever is ticked is applied as an update | **discarded, unexecuted** |
| `delete` — the link no longer exists in the code | offered in the prompt; whatever is ticked has its table dropped | **discarded; the table stays** |

Note what the `update` row does and does not promise. The classification is a
case-insensitive substring match on the generated SQL against exactly those two
fragments, so it is narrower than "changes nothing that already exists": a
column rename is emitted as
`alter table … rename column … to …` (`@mikro-orm/knex/schema/SchemaHelper.js`),
which contains neither fragment, classifies as `update`, and **does** execute
under `--execute-safe-links`.

Two consequences follow, and both are accepted deliberately:

- Removing a link stops removing its table. Orphaned link tables accumulate
  until somebody clears them by hand.
- A link change whose SQL alters or drops a column is never applied by
  `predeploy`, so the link table's schema silently lags the code that reads it.

And the Job does not say so. `syncLinks` logs only what it executed, so a
discarded action produces no line at all — a run whose plan was nothing but
deletes and notifies logs `Database already up-to-date`, which is exactly wrong.
The plan is recomputed from the live schema on every run, so nothing is lost
permanently; it is just never applied unattended. Applying it means going and
looking, on a terminal, against the environment concerned:

```bash
medusa db:sync-links
```

Bare, with no flag, is the reviewable form and the one to reach for: it puts the
deletes and the unsafe updates in front of you before either happens, one
checkbox per link table, nothing ticked by default.

Know what that prompt shows, because it is less than it sounds. Each row is
`buildLinkDescription` — the two modules and models the link joins, and the
table name — and nothing else. The `sql` the planner attached to the action is
never printed, not in the prompt and not in the completion log. So the prompt
tells you **which** link tables are subject to a delete or an unsafe update, and
you infer the DDL from the schema change you already know you made. That is
still the review; it is just a review of a table list, not of statements.

`--execute-all` on that same command is *not* a safer synonym — it skips the
same prompt `--execute-safe-links` skips and then executes every discarded
action unseen, which is the review you came to do, declined. It has a use only
once you have already read the plan and want it applied without re-reading it.

Note the spelling while you are here. The standalone `db:sync-links` command
takes `--execute-safe` / `--execute-all`; `db:migrate` and `db:setup` take
`--execute-safe-links` / `--execute-all-links`. They are not interchangeable,
and the wrong one is an unrecognised-option failure rather than a silent no-op —
`medusa db:migrate --execute-safe` exits 1 with
`Unknown arguments: execute-safe, executeSafe`.

`--execute-all-links` is the flag *not* to reach for here, however tempting it
looks as the one that leaves no work behind: on this Job it would execute
column drops and table deletions unattended, in a hook nobody is watching, with
the output going to a Job log read only after something has already gone wrong.
A skipped cleanup is recoverable at leisure. An unreviewed `drop column` against
the live database is not. `backend/tests/deployment-contract.test.ts` asserts
both halves — the safe flag present on the `db:migrate` invocation, and the
all-links flag absent from the whole `predeploy` chain.

### Naming a Redis is fail-closed, and so is reaching one

`src/config/runtime.ts` refuses to build a configuration whose `REDIS_HOST`,
`REDIS_PORT` or `REDIS_PASSWORD` is missing. That is a check on the *manifest*
and not on the server: nothing in the configuration dials anything, and **the
three module loaders report success when they have not connected.** Against a
closed port:

| Loader | What it does |
|---|---|
| `event-bus-redis` | logs `Connection to Redis in module 'event-bus-redis' established` |
| `workflow-engine-redis` | logs the equivalent **twice**, for the module and its PubSub pair |
| `locking-redis` | logs an error |

None of the three throws, and two of them state the opposite of what happened.
Only `locking-redis` complains, so a log read for *"established"* lines confirms
nothing at all — which is the trap this note exists to close.

So all four of this image's roles ping Redis before they start Medusa.
`npm run redis:preflight` runs `src/config/redis-preflight.js`, which
authenticates, sends one `PING`, and then either prints `Redis preflight: PING
answered.` or refuses in a single line with a non-zero exit status. `start`,
`start:worker`, `predeploy` and `catalogue:import` each chain from it with `&&`,
so a workload that cannot reach its Redis never loads a Medusa module at all.
The refusal names `REDIS_HOST` and `REDIS_PORT`, or `REDIS_PASSWORD`, according
to which of the two went wrong, and quotes neither — which is the next section's
subject.

Without it, what stops a misconfigured workload is the first Redis *command*
after boot, and one of the three does not stop at all. Measured from the built
server against a closed port, and against a real Redis started with
`--requirepass` and given the wrong password:

| Command | Workload | Unreachable | Wrong password |
|---|---|---|---|
| `medusa start` | `plepic-backend`, `plepic-worker` | **Refuses.** `Error starting server: Reached the max retries per request limit` | **Refuses.** `Error starting server: WRONGPASS invalid username-password pair or user is disabled.` |
| `medusa exec` | seeding, commerce configuration, catalogue import | **Exits 1** | **Exits 1** |
| `medusa db:migrate` | the first third of `predeploy` | **Exits 0**, logging `Migrations completed` | **Exits 0**, logging `Migrations completed` |

`medusa start` never answers `/health` in either column, in `shared`, `worker`
and `server` worker mode alike. **The two messages are different strings**, and
that is why the column is split rather than merged: the behaviour is identical
but the text is not, and an operator grepping a log for *"max retries"* during a
rotation incident finds nothing at all.

`db:migrate` is as much the reason the preflight exists as the log is. It exits 0
with no Redis whatsoever, so `predeploy` used to report a green migration as its
first act and fail one command later — a `db:migrate` that reports success was
never evidence that Redis is reachable. Reachability beyond that one `PING` still
belongs to `hannosirkel/deploys`: the NetworkPolicy, the Redis StatefulSet, and
the recovery ordering that brings Redis up before the worker.

### A wrong `REDIS_PASSWORD` is a credential-rotation event, not a restart

**If a Redis authentication failure reaches Medusa, the password is written into
the pod log in plaintext.** `ioredis` — the client every Medusa Redis module
uses — attaches the failing command to its `ReplyError`, and `@medusajs/cli`
installs `process.on("uncaughtException", (error) => console.log(error))`, which
is `util.inspect` and prints every enumerable property the error carries:

```text
ReplyError: WRONGPASS invalid username-password pair or user is disabled.
    at parseError (…/redis-parser/lib/parser.js:179:12) {
  command: { name: 'auth', args: [ '<the password, in plaintext>' ] }
}
```

Measured from the built server against a real Redis started with `--requirepass`
and given the wrong password: **29 plaintext copies in one failed `medusa
start`**, and 6 more in one `medusa db:migrate` — which exits **0**, so nothing
marks that log as a failure at all. The exact count moves with how many
reconnection attempts the client makes before giving up; the path does not. The
*unreachable* case produces **none**, because `ECONNREFUSED` carries no command
to attach.

The preflight above is what keeps this from happening at start-up: the same wrong
password now costs one line and no copies, measured the same way. It is **not** a
guarantee, because it is a check at one instant:

- A password rotated in Redis while a pod is already running reaches `ioredis` on
  the next reconnect, and that pod logs it.
- Anything that runs Medusa without going through `npm run <role>` — a debugging
  container, an operator `kubectl exec` — has no preflight in front of it.

So if a `WRONGPASS` crash-loop is observed, or `command: { name: 'auth'` appears
in any pod log, treat it as a **credential-rotation event**: rotate
`REDIS_PASSWORD` in OpenBao, let the projection reach the Redis StatefulSet and
its consumers together, and dispose of the log. Restarting the pod does not
undo a credential that has already been written down.

This is upstream `ioredis` behaviour attending *any* authenticated Redis under
Medusa, and it would be identical with the password in the URL rather than in
`redisOptions` — keeping it out of the URL prevents a connection *string* from
carrying it, which is a different leak and one that stays prevented. No Redis
password is in this repository, in an image, or on any public surface, and this
needs a misconfiguration to fire.

### One query to run before the first migration onto the Redis workflow engine

This applies **once**, to any database that has already been migrated by a build
of this backend from before `medusa-config.ts` registered
`@medusajs/medusa/workflow-engine-redis`. A database that has never run this
backend is unaffected, and so is every migration after the first.

`medusa db:migrate` records migrations by **name**, for every module, in one
shared `mikro_orm_migrations` table. Swapping `workflow-engine-inmemory` for
`workflow-engine-redis` therefore does not replay the lineage from the
beginning: the two packages ship eight and seven migrations, two of which are
named identically and have already run, which leaves **six pending**:

```text
Migration20241206123341  Migration20250120111059  Migration20250128174354
Migration20250505101505  Migration20250819110923  Migration20250908080326
```

Five are name-shifted duplicates of work the in-memory lineage already did and
re-apply harmlessly. **The sixth is not.** `Migration20250120111059` runs

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_workflow_execution_workflow_id_transaction_id_unique"
  ON "workflow_execution" (workflow_id, transaction_id) WHERE deleted_at IS NULL;
```

and the in-memory lineage's own `Migration20250505092459` **drops** that index
and moves the primary key to `(workflow_id, transaction_id, run_id)`, which makes
two live rows sharing `(workflow_id, transaction_id)` legal — a second run of one
transaction id writes a second row with a new `run_id`. `IF NOT EXISTS` does not
save it: the index genuinely is absent, so it is created rather than skipped, and
the creation fails on those rows. `Migration20250505101505`, later in the same
pending set, drops it again — so the index is created only to be dropped, and a
step that leaves no trace in the final schema is what blocks the rollout.

So run this against the environment's database **before** promoting an image
that carries this configuration:

```sql
select workflow_id, transaction_id, count(*) from workflow_execution
where deleted_at is null group by 1, 2 having count(*) > 1;
```

No rows means the transition is safe. Any rows means `medusa db:migrate` exits
non-zero, the predeploy Job fails, and no API, worker, or storefront pod starts.
Nothing is corrupted and nothing is half-applied — MikroORM runs the pending set
in one transaction and rolls the whole batch back — but a retry starts over and
fails in the same place until the duplicate rows are resolved, so the sync stays
red until someone runs this query anyway. It is written here so that happens
before the rollout rather than during a failed one.

The seeding step is idempotent, and the condition it tests is **whether the
administrator can sign in** — not whether a user row exists. A usable
administrator is three things at once: the user, an `emailpass` identity for the
same address, and that identity's `app_metadata.user_id` naming that user.
Seeding writes them in three steps and no transaction spans two Medusa modules,
so a run can die between any two of them:

| Outcome | Meaning |
|---|---|
| `created` | There was no administrator; there is one now |
| `repaired` | A user existed with no identity linked to it — an earlier run died mid-way — and the link was completed |
| `already-present` | The administrator exists and can sign in; nothing was written |

The repair matters because `backoffLimit` makes the second attempt the expected
path. A run that reported `already-present` on the bare user would exit 0, stop
the retries, turn the sync green, and leave an Admin nobody can sign in to —
found at cutover, and only fixable by hand.

It never re-registers over an identity that works, so a password rotated through
Medusa is not quietly reset from a Secret on the next sync; registration happens
only where no identity exists and there is therefore no password to keep.
`medusa user` is used for neither half: it creates unconditionally, and it exits
non-zero *after* having already created the user — which is how the half-built
state gets made in the first place.

### The commerce configuration

`predeploy`'s third command, `npm run configure:commerce`, applies the
commercial model the operator froze. It reads **no environment variable at all**:
everything it applies is declared in this repository and identical in both
environments, so nothing it configures can differ between test and live.

| Record | What, and why it has to exist before anything serves |
|---|---|
| EUR is tax **exclusive** | The store's supported currency, carrying the price preference that makes every EUR price in this deployment a **net** figure with VAT added on top rather than contained |
| Region `Worldwide` | EUR, automatic taxes, tax-exclusive prices, every country Medusa knows, and the one Stripe payment provider. Without it `POST /store/carts` has nothing to create a cart against, and the storefront refuses with "Medusa Store catalogue is not ready" |
| Tax regions, 27 of them | One per EU member state, each carrying Estonia's 24% standard rate as its default. A destination outside the EU has no tax region at all, so `automatic_taxes` finds nothing and no EU VAT is charged |
| Stock location, fulfillment set, shipping profile | The chain a service zone hangs off, and the profile the product and both shipping options share. The catalogue import refuses without the first and third |
| Stock location → `manual_manual` | The `location_fulfillment_provider` link. Both shipping-option workflows run `validateFulfillmentProvidersStep` first, and it refuses an option whose provider is not enabled at a location behind the zone |
| Default sales channel → stock location | `GET /store/shipping-options` walks sales channel → stock location → fulfillment set → service zone; an unlinked location breaks the chain at the first step and a completed address returns no delivery method |
| Service zones `European Union` and `Rest of world` | The 27 member states, and every other country. A country in neither is an address the checkout offers and Medusa cannot ship |
| Shipping options | One flat `Standard delivery` per zone: **EUR 7.00** inside the EU, **EUR 12.00** everywhere else |

**Exactly one region, deliberately.** `storefront/src/lib/cart-store.tsx` lists
regions with `limit: 2` and refuses unless it finds one, because a second region
is a second answer to "what does this cost?" and the storefront has no region
selector to resolve it with. One advertised price worldwide is the commercial
model; one region is its faithful expression.

**EUR 25.00 is the net price, and VAT is added.** That is the operator's
decision and it is what the legacy shop does: the old site advertises a figure
and adds tax at checkout, so the migration keeps both the buyer's experience and
the merchant's take rather than quietly converting one into the other. Shipping
is net on the same rule and grosses with the goods, so the EUR 7.00 EU rate is
what a buyer pays EUR 8.68 for.

| Delivery address | Goods | Shipping | Total |
|---|---|---|---|
| An EU member state | 25.00 + 6.00 | 7.00 + 1.68 | **EUR 39.68** |
| Anywhere else | 25.00 | 12.00 | **EUR 37.00** |

Those figures are not restated in a test.
`backend/tests/commerce-medusa-semantics.test.ts` computes them with Medusa's own
`decorateCartTotals`, over a rate it reads out of the declared configuration
rather than one written into the case — so a missing or mis-rated tax region
moves the numbers and turns the table red.

**Every EU destination pays Estonia's rate, not its own.** The shop is below the
EUR 10,000 intra-Community distance-selling threshold, so it charges its domestic
rate across the Union and would register for One Stop Shop only on crossing it.
The rate is 24%, and has been since 1 July 2025 — it was 22% from 1 January 2024
and 20% before that (Estonian Tax and Customs Board, *VAT rates and supply exempt
from tax*). The figure and its date live together in
`backend/src/commerce/tax-model.ts`, because a reader who remembers Estonian VAT
as 22% is remembering something that was correct within the last two years.

**Both inclusivity flags are `false`, and they move together.**
`@medusajs/pricing` resolves inclusivity per price: it consults the `region_id`
preference **ahead of** the `currency_code` one whenever the price carries a
`region_id` price rule (`services/pricing-module.js:1191`). No price this
deployment writes carries such a rule today — the product price is
`[{ amount, currency_code }]` and the shipping price is
`[{ currency_code, amount }]` — but that is the *whole* of the protection, and
one price list or one Admin edit removes it. A configuration that set the
currency to `false` and left the region at `true` would then charge the
advertised EUR 25.00 and book EUR 4.84 of VAT out of it: a 19% cut to the net
take, with every figure on every page still reading EUR 25.00 and nothing to
notice. `createRegionsWorkflow` and `updateRegionsWorkflow` are what write that
preference row, so `backend/tests/commerce-medusa-semantics.test.ts` asserts that
the configuration leaves **no** tax-inclusive price preference behind, for either
attribute, over the graph those workflows produce.

**`content/legal/shipping.ts` has caught up.** An earlier revision of this
paragraph said it had not — that it still claimed *"Included means contained
within that figure rather than added to it"*, and that rewording it, rendering
the VAT line and grossing the shipping-option display were blocked on the
operator. All three have since landed, in the change that added the destination
selector. The page now says the tax is **added** for a delivery address in the
European Union and added nowhere else, the checkout renders a seventh value
breaking the tax out of the two figures above it, and a delivery option is never
shown as a bare pre-tax rate.
`backend/tests/commerce-configuration.test.ts` no longer records a
disagreement: it asserts the new wording against the two price preferences that
make it true, and refuses the superseded claims anywhere a reader would meet
them.

**Two flat rates, and no free method.** The plan's checkbox said "flat and free
shipping"; the operator's later decision is worldwide delivery at two flat rates
with no free option and no excluded country, and the absence of a zero-priced
method is asserted rather than merely left out. There is no carrier interface,
quote cache or fallback contract — ADR `020` records why — so the options are
served by `manual_manual`, which quotes nothing and calls nothing.

**Shipping is configured here and nowhere else.** The catalogue import used to
seed the zones and methods from the archive's `shippingZones` section; it no
longer does, and an archive that still carries one is **refused** with a message
naming this command. Two writers of one price is a way for what a buyer is
charged to stop being what the operator froze, and the export is the *old*
shop's shipping configuration rather than the frozen model.

**The tax regions have moved here for the same reason, and the import has not yet
been told.** `src/catalogue-import/` still carries its own `taxRegions` section
and its own tax-region upsert, so an archive staged through the import Job would
write the *old* shop's rates over these. Retiring that half of the import is a
deliberately separate change; until it lands, `configure:commerce` is the writer
that runs on every promoted digest and the import is the one that runs only when
somebody stages an archive by hand.

Every record is a lookup by natural key followed by a create **or** an update, so
the Job — an Argo CD sync hook that runs again on every promoted digest —
converges after a run interrupted halfway and reaches the same end state however
often it runs. A service zone whose country set has drifted is rewritten; one
that already matches is left untouched.

It is not, however, silent the second time. Seven of the ten record kinds
compare before they write and so write nothing at all on a re-run; the
**region**, the twenty-seven **tax regions** and the **shipping options**
re-issue their update unconditionally whenever the row exists, so every promoted
digest rewrites the region's country list, all twenty-seven VAT rates and both
flat prices, and emits `region.updated` and `shipping_option.updated`. The
end state is unchanged either way. `backend/tests/commerce-medusa-semantics.test.ts`
asserts that exact set of second-run writes, so the claim cannot quietly drift.

**The natural keys are display names.** `Worldwide`, `Plepic Games`, `Plepic
Games delivery` and the two zone names are both what the Admin shows and the key
every upsert here addresses. Renaming one in the Admin does not rename the
record: the next predeploy finds no row under the old name and creates a
**second** one — and a second region is a storefront that answers every
add-to-cart with "Medusa Store catalogue is not ready", because
`storefront/src/lib/cart-store.tsx` lists regions with `limit: 2` and refuses
unless it finds exactly one. Renaming any of the five is a change to
`backend/src/commerce/configuration.ts`, not a cosmetic edit.

### The Stripe webhook is one endpoint reached two ways

The backend serves `POST /hooks/payment/stripe_stripe` — Medusa's own
`/hooks/payment/:provider` route, with the raw body preserved. The segment is
derived in `backend/src/config/payment.ts` from the provider this deployment
registers rather than written out, because `@medusajs/payment` keys a provider as
`pp_${identifier}_${id}` and resolves the URL segment back by prefixing `pp_`.

| Environment | How Stripe reaches it |
|---|---|
| live | Stripe posts to `https://<apex>/store-api/hooks/payment/stripe_stripe`. The tunnel carries the whole hostname to the storefront, whose `/store-api` prefix allowlist strips the prefix and forwards the request with its **raw body byte for byte** |
| test | The public hostname requires Cloudflare Access and Stripe cannot complete Google SSO, so an operator forwards events from Stripe CLI over WireGuard straight to the test backend's private `externalIP` port, at the same path |

```bash
# From an operator machine on WireGuard. Test only; live needs no forwarding.
stripe listen --forward-to http://<test-backend-wg-address>:<port>/hooks/payment/stripe_stripe
```

**The application never learns which of the two it is answering**, and nothing
is configured per environment except the secret. Signature verification against
`STRIPE_WEBHOOK_SECRET` is the only gate, and it is the same gate on both routes:
no middleware in `backend/src/api/middlewares.ts` matches the webhook path, which
matters because a Turnstile or origin check would pass behind Cloudflare and
refuse a Stripe CLI forward. `backend/tests/stripe-webhook-endpoint.test.ts`
holds all of that, and
`storefront/tests/build-and-serve.test.ts` drives a signed hook through the real
storefront and asserts the bytes that reach the backend.

The route only enqueues. Medusa emits the received event onto the event bus with
a delay and retries, so the signature is verified and the payment advanced by
whichever pod's subscriber picks the event up — **and that can be either of
them**. `backend.yaml` runs `npm run start`, which leaves `workerMode` at the
framework's default of `shared`, so the API pod runs subscribers too;
`worker.yaml` runs `npm run start:worker`, which sets `MEDUSA_WORKER_MODE=worker`.
Launch alerting on webhook failures therefore has to cover both workloads, not
the worker alone.

### The CORS origins are declared empty, on purpose

`STORE_CORS`, `ADMIN_CORS` and `AUTH_CORS` are required to be **declared** and
permitted to be **empty**, and they are the only three variables that are.
Every workload in `hannosirkel/deploys` sets all three to `value: ""`, because
cart and checkout require no CORS origin at all: the storefront proxies
`/store-api` on its own origin and the Admin is same-origin on the backend, so
a hostname here would be a second way in that the exposure boundary does not
allow.

An empty list is restrictive, not permissive, which is the only reason this is
safe to accept. `parseCorsOrigins("")` returns `[]`, and the `cors` middleware
given `origin: []` matches nothing and sends no `Access-Control-Allow-Origin`
header to any caller — it is also Medusa's own default for all three.

Three states, three outcomes:

| Manifest | Result |
|---|---|
| absent | Refuses: `Missing required backend environment variable: STORE_CORS` |
| `value: ""` | Accepted — no cross-origin caller is allowed |
| whitespace only | Refuses: `STORE_CORS may be declared empty, but must not be whitespace only` |

Whitespace is refused deliberately. `value: ""` is how a manifest *says* empty;
whitespace is never a deliberate way to say it, so refusing costs nothing
anyone meant. Accepting it would absorb a templating slip into a backend that
starts, looks healthy, and quietly denies an origin somebody meant to allow —
found at checkout, if ever. An empty **secret** is still an absent secret: a
`JWT_SECRET` of `""` refuses exactly as it did.

### The database connection

The backend accepts the connection in **two forms, and prefers the explicit
one**:

1. `DATABASE_URL`, used verbatim if it is set and non-empty.
2. Otherwise `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`
   and `DATABASE_PASSWORD`, assembled into a URL.

`compose.yaml` and `.github/workflows/validate.yml` both set an explicit
`DATABASE_URL` and neither sets a single part, so the precedence is what keeps
the local and CI paths working untouched; the URL is also the more expressive
form, and a socket, a `?sslmode=require`, or a managed instance's URL is not
reachable through five parts. Every `deploys` workload supplies the parts and no
URL, so the two forms never compete in a real deployment.

The assembly is on this side rather than in the manifests deliberately. A full
URL embeds the password, so supplying one would turn four non-secret values into
a secret needing its own ESO projection and put the password in a second place
it can leak from; the five-part form keeps it in its own Secret key, which is
what `deploys/plepic/tests/manifests.sh` asserts.

Both refusals are closed and quiet. A missing or empty part refuses by name and
says what the alternative is, rather than dialling a malformed URL and reporting
it as a connection failure against a host nobody configured. Every component is
percent-encoded, because the password is generated rather than chosen and an
unencoded `@` in it would move the host. And no refusal ever contains a value —
these messages are read from a crash-looping pod's log, which is the cluster's
log pipeline and thirty days of Loki.

#### `DATABASE_SSL_MODE`, which is deliberately not in the URL

**Optional. Unset means `disable`, which is the deployment that exists.** It
takes libpq's vocabulary, restricted to three modes:

| `DATABASE_SSL_MODE` | Connection | When |
|---|---|---|
| unset or `disable` | no TLS | today — the deployed PostgreSQL runs `ssl = off`, measured below |
| `require` | TLS, certificate not verified | a managed database that requires TLS |
| `verify-full` | TLS, chain and hostname verified | the in-cluster target, but see below — it is not a manifest-only change |

Anything else refuses by name and lists the three. An empty value is treated as
absent, exactly as `DATABASE_URL` is, because that is what an ESO-projected key
whose OpenBao field is absent looks like.

**`verify-full` verifies against Node's default trust store**, so it is the one
mode that may need more than a manifest edit. A certificate issued by a private
or cluster-internal CA fails verification unless that CA is trusted by the
process, through `NODE_EXTRA_CA_CERTS` — so if TLS is terminated with a
self-signed or cluster-issued certificate, budget for that alongside the mode
change. Installing the CA into the image's trust store is **not** sufficient on
its own: Node defaults to `--use-bundled-ca` and reads the system store only
under `--use-system-ca`, and nothing here sets `NODE_OPTIONS`. A certificate
chaining to a public CA needs none of this. `require` verifies nothing and so
needs nothing either way, which is what makes it the safe first step rather
than the desirable end state.

It exists because `medusa db:migrate` and the running backend used to choose
`ssl` by **two different routes**, and only one of them matched this
deployment:

| Path | How `ssl` was chosen | Result |
|---|---|---|
| the API and the worker | `pgConnectionLoader` spreads `databaseDriverOptions` — `undefined` — and `createPgConnection` falls through `?? false` | no TLS |
| `db:migrate` | `medusaAppLoader` forwards `driverOptions: undefined`, so `loadDatabaseConfig` substitutes `getDefaultDriverOptions(clientUrl)` | `{ rejectUnauthorized: false }` |

`getDefaultDriverOptions` calls a URL *remote* unless it matches `localhost`,
`127.0.0.1`, `ssl_mode=disable`, `ssl_mode=false`, or `sslmode=disable`. A
Kubernetes Service name matches none of those, so the predeploy Job opened with
an SSLRequest, PostgreSQL answered `'N'`, and `pg` ended the socket without
sending a startup packet — after which `propagateCreateError: false` left the
query pending until Medusa's ten-second migration timer fired.

**What that timer reports is the reason this took a while to find.** It says
*"Could not connect to the database while running migrations. The connection
timed out after 10 seconds, which usually indicates an incorrect database URL or
an SSL configuration issue."* So it does name SSL — but as one of two guesses,
with nothing to say which, and the server's actual answer never appears: `pg`
raised `The server does not support SSL connections` on the pool's connection,
where the operator never saw it. Measured from a pod holding the real
environment:

```text
PG_OK   plain      (ssl:false)                    1011ms rows=1
PG_FAIL ssl-object ({rejectUnauthorized:false})      2ms  server does not support SSL connections
```

##### Why a variable and not a URL parameter

**One URL spelling would in fact have worked**, and it is worth being exact
about which, because the tempting summary — "no URL parameter survives" — is
false. `pgConnectionLoader` and `loadDatabaseConfig` both strip only the
**underscored** `ssl_mode`, with `/(\?|&)ssl_mode=[^&]*(&|$)/gi`, and
`medusaAppLoader` then takes the migration `clientUrl` from that stripped
string in preference to `projectConfig.databaseUrl`. But `getDefaultDriverOptions`
matches *both* `ssl_mode=(disable|false)` and the unhyphenated
`sslmode=(disable)` — and nothing strips the second. Measured:

| URL suffix | Survives the strip | Migration `ssl` |
|---|---|---|
| none | — | `{ rejectUnauthorized: false }` |
| `?ssl_mode=disable` | no | `{ rejectUnauthorized: false }` |
| `?ssl_mode=false` | no | `{ rejectUnauthorized: false }` |
| `?sslmode=disable` | **yes** | `false` |

So `?sslmode=disable` would have stopped the outage. `databaseDriverOptions` is
still the right mechanism, for three narrower reasons that survive the
correction:

1. **`verify-full` is the one mode no URL can express — and the only one.**
   Being exact matters here, because the overstatement runs both ways.
   `getDefaultDriverOptions` returns one of exactly two objects, and its
   *non-matching* branch is the `require` mapping below, byte for byte. A URL
   can therefore produce no TLS, and can produce unverified TLS — the latter
   just by not matching, which is precisely what the outage was. What it can
   never produce is `ssl: true`. Verification is reachable through
   `driverOptions` and nowhere else.
2. **Leaving it to the URL is what made the two paths disagree in the first
   place.** The heuristic steers a *default* that applies only when
   `driverOptions` is absent — and when it is absent the runtime does not
   consult the heuristic at all; it falls through `?? false`. One connection
   string, two `ssl` values, chosen by which entry point read it. Stating the
   options is what removes the disagreement, whatever value is chosen.
3. **It steers that default by regex-matching a substring of the connection
   string**, one underscore away from the spelling that is silently deleted.
   `databaseDriverOptions` is read directly, by both paths, and is the only
   setting both honour deterministically.

##### A `DATABASE_URL` carrying `sslmode=` overrides this variable

`pg`'s `connection-parameters.js:60` does
`Object.assign({}, config, parse(config.connectionString))`, so a parsed URL is
applied **over** the explicit `ssl` — in both directions. Measured:
`?sslmode=require` with `DATABASE_SSL_MODE` unset leaves knex holding
`ssl = false` while pg resolves `ssl = {}` and attempts TLS; `?sslmode=disable`
against `verify-full` resolves to `ssl = false` and drops TLS entirely.

This is harmless today — every `deploys` workload supplies the five parts and no
`DATABASE_URL`, so the two never meet — but it means `DATABASE_SSL_MODE` is not
the last word when a URL is supplied. Do not put `sslmode` in a `DATABASE_URL`.
Note also that `pg` currently treats a URL's `sslmode=require` as `verify-full`
and warns that this will change in `pg` v9, which is a second reason to express
the intent here rather than there.

##### Why a variable rather than a hardcoded `false`

So that turning TLS on is a configuration change with no code to unpick — and
`require` is deliberately byte-identical to Medusa's own remote default, so
taking that step lands on exactly the options Medusa would have chosen
unprompted. It stays optional because no `deploys` manifest, `compose.yaml`
service, Dockerfile or workflow sets it, and requiring it would turn a
one-repository fix into a cross-repository contract change.

`backend/tests/database-ssl.test.ts` holds every claim above that can rot: that
the configuration states the options, that Medusa's own `loadDatabaseConfig` and
`createPgConnection` still resolve them this way, that the four URL spellings in
the table still behave as tabulated, and that `pg` still lets a URL's `sslmode`
override an explicit `ssl` in both directions. An upgrade that changes either
precedence, the strip regex, or that override turns it red — which is the
intended outcome, and the signal to re-verify this section rather than to
silence the test.

## Images

Two images, both built from the **repository root** because this is an npm
workspace and the tree they install is the one `package-lock.json` describes:

| Image | Dockerfile | Runs |
|---|---|---|
| `ghcr.io/hannosirkel/plepic-backend` | `backend/Dockerfile` | the API, the worker, the predeploy migration Job and the catalogue-import Job — one image, four argument lists |
| `ghcr.io/hannosirkel/plepic-storefront` | `storefront/Dockerfile` | the Next.js server, built with `output: "standalone"` |

Both pin their base image by digest, run as UID 10001 — the `runAsUser` every
`deploys` workload gives them — and clear the `node` base image's
`ENTRYPOINT`, because the manifests choose what a container runs with `args:`
and Kubernetes `args` replaces `CMD` while leaving an `ENTRYPOINT` prefixed.

**Both carry `org.opencontainers.image.source`, and both workflows that
publish them set it.** That label is how GitHub links a container package to a
repository, and a linked package inherits that repository's access rather than
being private with no repository to inherit it from — which is what a
cluster's first pull runs into. `deploy-test.yml` carries it as well as
`release.yml`, and the ordering is why: GHCR creates a package on its **first**
push, and the ordinary sequence is to label a pull request and only then merge,
so `Deploy Test` is usually the publisher that brings both packages into
existence. A label carried only by `Release` would arrive too late to link what
the first push created.

It is a `--label` on the single `docker buildx build` invocation that publishes
both images rather than a `LABEL` in either Dockerfile, because only one of the
two could carry it there: `storefront/tests/no-live-hostname.test.ts` scans
every tracked file under `storefront/`, `storefront/Dockerfile` included, and
this forge is not on its allowlist. Setting it in one place per workflow is
also what keeps the two images labelled identically.
`scripts/workflows.test.ts` asserts the flag, its value, and that the two
workflows name the same repository.

**Neither declares a build argument.** Next.js inlines every `NEXT_PUBLIC_*`
value at build time, so a build argument is exactly how a publishable key, a
base URL, a measurement ID or a site key would end up baked into an image that
has to serve both environments. Refusing the mechanism is what makes that a
property of the files rather than of a reviewer:
`storefront/tests/no-next-public-env.test.ts` holds the source to it,
`storefront/tests/build-and-serve.test.ts` builds the application with a unique
canary for every declared variable and greps the output for each one, and
`scripts/images.test.ts` holds the Dockerfiles to it.

**The backend image's working directory is `/app`, and a test says so.** The
catalogue import derives its media root from Medusa's own base directory —
`<base>/static` — rather than from a variable, so that the import writes
exactly where Medusa serves; the `deploys` manifests mount the assets PVC at
`/app/static` with `subPath: media`. Those two facts meet only at `/app`. A
base image that moved the working directory would leave imported media on the
container's own filesystem under a path no volume backs: it would upload, it
would render in the pod that wrote it, and it would vanish on the next restart
— with nothing in CI failing, because CI never mounts a PVC.

The ignore-files are named `backend/Dockerfile.dockerignore` and
`storefront/Dockerfile.dockerignore`, which is not a stylistic choice. With a
build context of `.` and `--file backend/Dockerfile`, BuildKit reads
`<dockerfile>.dockerignore` beside the Dockerfile and otherwise falls back to
`.dockerignore` at the **context root**; a `backend/.dockerignore` would be
read by nothing at all, while sitting in the tree looking authoritative. They
exclude dependency trees, build output, tests and the committed screenshot
baselines, and name the design-master file formats so that a master committed
by mistake cannot also reach a published image.

### What the runtime images deliberately do not contain

The Trivy gate in `release.yml` fails a promotion on any CRITICAL with a fix
available, and two of the things it found were not in `package-lock.json` at
all. Both fixes are in the Dockerfiles, and neither is a suppression: there is
no `.trivyignore`, no allowlist, and `--ignore-unfixed` is the only thing
narrowing the gate — it excludes the handful of `perl-base` CVEs Debian has
published no fix for.

**The storefront image has no package manager at all.** Its command is
`node server.js` and its `deploys` Deployment declares neither `command:` nor
`args:`, so npm, npx, corepack and yarn were in the image only because the
`node` base image ships them. npm is the one the scanner named: it vendors its
own dependency tree, which `package-lock.json` does not describe and no
`overrides` entry here can reach — the base image's npm 11.16.0 vendors `tar`
7.5.15, which the gate fails on. Deleting the package manager from a runtime
that never runs one retires that whole class of finding instead of chasing each
instance of it, which is why corepack and yarn go with npm rather than being
left behind with vendored trees this repository equally does not govern. `node`
stays, because `node` is what runs.

**The backend image keeps npm and nothing else**, because npm *is* its
entrypoint: all four `deploys` workloads run it as
`args: [npm, run, <script>]`, so it is the one package manager that could not
be removed and is upgraded instead. corepack and yarn are not the entrypoint
and nothing invokes them, so they go from this image too. The two images keep
different sets only where their commands differ; everything neither one runs is
gone from both. npm is pinned to exactly 11.19.0, the newest npm
11. 11.18.0 is where the vendored `tar` was first fixed to 7.5.19 and would
clear the finding too; the newest of the major is taken because it also carries
everything fixed between the two, and because the major stays what the base
image ships, so `npm run` behaves as it did. The pin is exact rather than a
range because a floating package manager would make two builds of one source
revision differ. No Node release on the 24 LTS line ships a fixed npm — 24.19.0,
the newest, is still on 11.17.0, whose vendored `tar` is 7.5.16 — so the
alternative was moving both images onto the Node current line to change a
package manager's vendored library.

**The backend image has no esbuild.** It arrives as a *production* transitive
dependency, so `--omit=dev` leaves it: `@medusajs/medusa` →
`@medusajs/admin-bundler` → `vite ^5.4.21` → `esbuild ^0.21.3`, whose platform
package ships a Go binary, and the Go standard library compiled into that
binary is what the scanner reports. Nothing in the runtime path calls it.
`@medusajs/admin-bundler` exports four entry points; `build`, `develop` and
`plugin` `await import("vite")` and are all build-time commands that run in the
build stage, while `serve` — the only one `medusa start` reaches, through the
framework's admin loader — is `compression`, `express`, `fs` and `path` serving
the pre-built bundle out of `public/admin`. Because those vite imports are
dynamic and inside those three functions, loading `@medusajs/admin-bundler`
loads neither vite nor esbuild.

Deleting it beats overriding its version. vite 5.4.21 accepts `esbuild@^0.21.3`
and the newest release in that range is the one already installed, so an
override that fixed anything would have to be forced past vite's range, and
that would change the compiler `medusa build` runs with in order to fix a binary
that never executes. The removal takes the whole package because the same binary
is present twice — esbuild's `install.js` copies the platform binary over its
own `bin/esbuild` shim — and Trivy reports one finding for the two identical
files, so removing one copy moves the finding rather than clearing it.

**Each removal comes with an assertion, and the assertion is the part that is
worth anything.** A removal by name can only delete what it was told to look
for, so neither Dockerfile is trusted to have been right about the name. Each
package-manager removal proves `! command -v <name>` and each image proves
`command -v` for what it does run, so a removal that reached too far fails the
build rather than a crash-looping Deployment. And the backend refuses to build
if any file in the tree it ships still carries `Go buildinf:` — the
build-information magic Go stamps into everything it links, and what Trivy's own
`gobinary` analyzer reads to decide a file is a Go binary. Keying on the same
marker as the scanner is deliberate: whatever the check misses, the gate misses
too, so it is as strong as the thing it stands in for rather than a second guess
at it. It greps with `-a`, because without it whether a binary file can match at
all is left to the grep implementation's heuristics, and an implementation that
declines to match binaries would let the check pass while the binary ships —
failing open, the one direction a guard must not fail.

So a dependency tree that *moves* a Go binary fails the build under whatever
name it arrives; a dependency tree that *drops* esbuild passes, because a clean
tree is not a failure.

`scripts/images.test.ts` holds both files to carrying both halves, and holds
every `npm` call in either of them to one of three things: `npm ci`, `npm run`,
or an exact package-manager pin. That is an allowlist rather than a search for
`npm install`, for the same reason the Go check does not search for a filename
— npm accepts 57 aliases, eleven of which mean `install`, so `npm i left-pad`
is a dependency install that no search for the string `npm install` would ever
see. Without these assertions, deleting any of the removals would leave the
whole suite green and the only thing left to notice would be the gate, which
runs *after* `Release` has already published both images.

## Catalogue import

`npm run catalogue:import`, in the `backend` workspace, seeds a Medusa
environment from a staged WooCommerce export. It is the command the
`plepic-catalogue-import` Job in `hannosirkel/deploys` runs.

**It runs in the cluster and nowhere else.** The NetworkPolicy admits
PostgreSQL connections only from in-namespace workloads, so an operator machine
cannot run it at all. The Job runs it from the backend image, in the target
namespace, once (`backoffLimit: 0`, `activeDeadlineSeconds: 1800`), with no
Kubernetes API access and a read-only root filesystem — the only writable paths
are the assets PVC and `/tmp`.

### What it seeds, and what it refuses

It seeds the active physical product, its current price and stock, its packaged
dimensions, the coupons that are still valid at the moment of the run, the tax
zones and rates, and the media.

It does **not** seed the shipping zones and methods. Those are the commercial
model the operator froze, declared in `backend/src/commerce/shipping-model.ts`
and applied by `npm run configure:commerce` — see [the commerce
configuration](#the-commerce-configuration). A manifest that still carries a
`shippingZones` section is refused with a message saying where it moved to,
rather than silently skipped: an operator who exported the section believes it
is being applied, and one price may have only one writer.

It is also **no longer the source of the product, its price or the tax rates on a
normal deployment.** `npm run seed:product` writes the one product from
`backend/src/commerce/product-model.ts` and `configure:commerce` writes the tax
regions from `backend/src/commerce/tax-model.ts`, both from the predeploy Job,
because nothing a promoted digest depends on may wait for somebody to stage an
archive by hand. The import's own copies of those upserts still exist and would
still run against a staged archive; retiring them is a separate change.

It **refuses** WordPress users, WooCommerce customer accounts, sessions and
order history — it does not filter them silently. Customer accounts and order
history are archive-only: a final export is preserved in encrypted backup
storage and never imported. The manifest's accepted section list is an
allowlist, so a section nobody has read is refused too. No refusal message ever
quotes the data that caused it.

### The staged archive

The archive is `catalogue.tar.gz` — a gzip-compressed tar carrying exactly
`manifest.json` and `media/<file>` members. It is staged onto the environment's
assets PVC by `kubectl cp` into a short-lived helper pod that mounts the PVC, at
the path the Job mounts as `/var/lib/plepic/import` (`subPath: import` of the
same PVC).

The import **refuses to start** unless the archive hashes to the expected value
and the environment it was prepared for is the environment it is running in.
Both expected values come from the backend's runtime configuration, never from a
file staged beside the archive — an archive that carries its own checksum proves
only that it is internally consistent. When either is unset, empty or malformed
the import refuses; an unconfigured import never proceeds.

The staged archive is deleted on **every** exit path: after a successful import,
after a failed one, and after a refusal raised before the import body runs at
all — an unset or malformed expected value included. That last case is why the
command resolves the archive path before it reads anything else.

A WooCommerce export left on the assets PVC is not a stray file. It carries
customer accounts, sessions and order history, and nothing ever comes back for
it: the Job runs with `backoffLimit: 0`, so there is no second attempt to tidy
up after the first. An archive that survives one run sits on a production volume
indefinitely. That is why disposal is unconditional rather than a tidy-up step.

The served media root and the staging directory are **disjoint sibling subtrees
of the same PVC**. The backend, the worker and the Job mount it at `/app/static`
with `subPath: media`; the Job alone mounts it at `/var/lib/plepic/import` with
`subPath: import`. A staged archive is therefore *not* a file under the
directory Medusa serves as `/static/*`, and the `deploys` manifests enforce that
every `CATALOGUE_IMPORT_ARCHIVE_PATH` resolves inside the staging mount, so an
override cannot put one back there.

The storefront refuses `import` as a segment under `/store-api/static/*` all the
same: `/store-api/static/import/...` is 404ed without a backend request, in the
same normalized way `/store-api/admin/*` is. While the two subtrees stay
disjoint that refusal has nothing to catch — and it stays, because the mount
layout is enforced in a different repository and this one does not depend on
that being true. It is what a mount-layout regression lands on.

| Variable | Required | Meaning |
|---|---|---|
| `CATALOGUE_IMPORT_ARCHIVE_SHA256` | yes | 64 lowercase hex digits; the expected archive digest |
| `CATALOGUE_IMPORT_ENVIRONMENT` | yes | exactly `live` or `test`; must equal the archive's recorded identity |
| `CATALOGUE_IMPORT_ARCHIVE_PATH` | no | defaults to `/var/lib/plepic/import/catalogue.tar.gz` |

There is no media-root variable. The import writes to `<base>/static`, where
`<base>` is the framework's own base directory — the same value
`@medusajs/framework`'s express loader mounts `/static/*` from, and the same
directory `@medusajs/file-local` defaults its `upload_dir` to. A variable there
would only be a way for the three to disagree.

### Rerunning it

The import is rerunnable, and that is a property of its shape rather than of a
lock. It emits key-addressed upserts — the product by handle, the price by SKU
and currency, the stock by SKU, a coupon by code, a tax region by country — so
applying the same record twice is applying it once. Media is written to a `.plepic-import-partial` sibling and moved into
place with one rename, and a file already present with identical bytes is left
untouched. Running it twice leaves one product, one price, one stock figure and
one copy of each media file, and a run interrupted halfway converges when it is
run again.

**Rerunning it means staging the archive again first.** The Job runs at
`backoffLimit: 0`, so a failed attempt is not retried, and the import deletes
the staged archive whether it succeeded or not. `kubectl cp` the archive back
onto the PVC and unsuspend the Job again; the import's idempotency is about the
state it converges to, not about the archive still being there.

### Media delivery

Imported media lands on the assets PVC, in `<base>/static` — the directory
`@medusajs/framework` serves at `/static/*`, derived from the framework's own
base directory rather than configured next to it. The import records that
relative `/static/<file>` path in every product image URL it seeds. The
storefront exposes the same bytes at `/store-api/static/*` through its prefix
allowlist, and `storefront/src/lib/store-media.ts` is the one place that
converts one form into the other — so every product image URL the browser
receives is that relative form. A URL that is not one is dropped rather than
forwarded, and product data whose **media-bearing fields** still carry an
absolute URL when it leaves the Store seam is refused outright, so a future page
cannot reintroduce one. Catalogue text is not inspected: a product retitled to
look like a media path is data, not a bug, and must not take the page down.

The File module itself is left at the framework's default. The import does not
use it — it writes with `fs` and computes its own URLs — and pinning it bought
nothing while breaking every Admin upload: `@medusajs/file-local` calls
`new URL(backend_url)`, which a relative value cannot satisfy.

A crafted filename cannot escape the assets root. The archive reader accepts
only regular files and directories, so a symlink, a hard link, a device node and
a GNU long-name extension are each refused; media filenames must match a strict
charset, which admits no separator, no `..`, no percent-encoding, no backslash
and no leading or trailing space; and every write resolves through one function
that re-checks containment.

## Enabling the pre-commit hook

This repository ships a `.githooks/pre-commit` hook that runs a `gitleaks`
scan over staged changes and rejects a commit that looks like it contains a
secret. Enable it once per checkout:

```bash
git config --local core.hooksPath .githooks
```

It requires `gitleaks` on `PATH` — install it from
<https://github.com/gitleaks/gitleaks/releases> or your package manager
before committing.

## Continuous integration

`.github/workflows/validate.yml` runs on every pull request and every push to
`main`: `npm ci`, `bash scripts/validate`, then a `gitleaks` scan of the full
history, using a pinned and checksum-verified `gitleaks` release. Every
GitHub Action is pinned by commit SHA, and the workflow is granted
`contents: read` only.

### Service containers

The validation job declares PostgreSQL, Redis and an SMTP sink as service
containers, digest-pinned to the same images `compose.yaml` uses, reachable at
`127.0.0.1` on 5432, 6379 and 587. **No suite consumes them yet** — the suites
this repository has today are pure, and
`storefront/tests/build-and-serve.test.ts` starts the servers it needs itself.
They are declared ahead of the first suite that needs one because those
addresses are the contract such a suite is written against, and because a
service introduced alongside the suite that first uses it cannot be told apart
from that suite when it fails.

The `store-smoke` job below does need a database and a Redis, and deliberately
does **not** use these: it brings up `compose.yaml`'s, for the reasons given
under "The store smoke check".

PostgreSQL uses `trust` authentication, so there is no password in the
workflow. Redis runs unauthenticated in CI and authenticated in `compose.yaml`:
GitHub Actions service containers cannot override a container's command, so
`--requirepass` is not expressible there. What the two are held to being
identical about is the image.

### The store smoke check

The `store-smoke` job runs `bash scripts/store-smoke`, which stands up a real
Medusa and asks the Store API the one question the storefront asks it. It
exists because the pure suites cannot answer it. The move from tax-inclusive
to net-plus-VAT pricing passed three review passes and every unit test in this
repository and merged with twenty-seven tax regions written with a null tax
provider — which made every catalogue request answer `HTTP 500` with *"Unable
to retrieve the tax provider with id: null"*. The unit tests assert that the
right workflow received the right input; the input was wrong in a way only
Medusa's runtime knows. `backend/src/commerce/tax-model.ts` has the mechanism
in full, including why Medusa's own backfill migration cannot repair it.

The script brings up PostgreSQL and Redis **from `compose.yaml`** rather than
declaring service containers, so the job adds no fourth place those two images
are pinned — and it gets an authenticated Redis, which a service container
cannot express and which `npm run predeploy` opens by checking. It then builds
the backend, runs the four predeploy commands against a database of its own
(`plepic_store_smoke`, dropped and recreated each run), starts the built server
on port 9010, and runs `backend/tests/smoke/store-api.test.ts`. Every expected
figure in that suite is read from `backend/src/commerce/product-model.ts`,
`backend/src/commerce/tax-model.ts` and `storefront/mock/catalogue.json`; none
is typed into the check, so a rate change moves them all or fails naming the
disagreement.

It runs the predeploy chain **twice**, with the tax regions put back to a null
provider in between. That second run is the only place this repository
exercises the convergence branch of `applyTaxRegion` — the half of the fix that
repairs rows which already exist, which is the half production needed — and the
only place `predeploy` is asserted to be idempotent at all, which it has to be:
it is an Argo CD sync hook that runs again on every promoted digest.

**It is deliberately not part of `bash scripts/validate`.** That command is the
one thing every developer runs before every commit and it must work on a bare
checkout with Node and nothing else; requiring a Docker daemon would make it
fail for anyone without one, and the reliable outcome of a pre-commit gate that
sometimes cannot run is that people stop running it. What is shared instead is
the *script*: CI runs `bash scripts/store-smoke` and so does a developer, so
the two can never be different checks. Run it before pushing anything that
touches `backend/src/commerce/`, `backend/src/scripts/` or a Medusa version:

```bash
bash scripts/store-smoke
```

It uses its own database and its own port, so a `docker compose up` stack
already running is left alone — but it does clear Redis, which is never a
restorable source of business data here.

### Promotion to the test environment

`.github/workflows/deploy-test.yml` publishes a pull request's head revision
into the test environment when the `deploy-test` label is applied. It builds
`ghcr.io/hannosirkel/plepic-backend` and
`ghcr.io/hannosirkel/plepic-storefront`, scans both published digests, and
writes them into `plepic/overlays/test/kustomization.yaml` in
`hannosirkel/deploys`. It shares the `plepic-gitops-promotion` concurrency
group with the release workflow, so only one promotion touches those overlays
at a time.

**It is a `pull_request_target` workflow, so it runs with this repository's
token and secrets against a pull request an outside contributor may have
authored.** Every structural property that makes that safe is asserted in
`scripts/workflows.test.ts` against the parsed document, not merely described
here:

- the `gate` job checks out nothing and runs no head code. It verifies through
  the API that the pull request is open, comes from this repository, and
  targets `main`, and that the head SHA's own `Validate` run concluded
  `success`;
- the guard it hands on is re-read from the pull request's **base** SHA — the
  reviewed script on `main`, never the version proposed by the head;
- the `build` job runs head code but holds no GitOps credential and never sees
  the deploys repository;
- the `promote` job holds the credential — a GitHub App token minted for
  `deploys` alone, in the `test` GitHub Environment — but runs no head code,
  and declares `permissions: {}`.

`scripts/update-gitops-digest.sh` is the guard those jobs pass around. It takes
the backend digest, the storefront digest, and one overlay directory, and its
job is to make anything other than "the digest lines changed, in exactly one
file" fail. It refuses a malformed digest, an overlay other than
`plepic/overlays/live` or `plepic/overlays/test`, an overlay that is not inside
a Git worktree, a symlinked or hard-linked `kustomization.yaml`, a checkout
that is not clean, an overlay that does not carry exactly one entry per image,
and any diff that is not exactly the digest lines it meant to write — restoring
the original file when it refuses after writing. Re-running it with digests the
overlay already records is a no-op. `scripts/update-gitops-digest.test.ts`
exercises each of those refusals against a real Git fixture; never hand-edit a
digest line in `deploys`. The checks that run *after* the write cannot be
reached from outside, because the guard's own rewriter only ever produces
well-formed digest lines, so those tests replace the rewriter with a stub that
writes chosen bytes and reports a chosen count. That leaves the post-write
checks as the only thing between the stub and the repository, which is what
they are for: delete any one of them and one of those tests goes red.

### Promotion to the live environment

`.github/workflows/release.yml` runs on every push to `main`. **Once it is on
`main`, every merge to `main` is a live deployment**: there is no label, no
second gate and no approval beyond the `live` GitHub Environment. It validates
the pushed revision, builds and publishes both images with
`--provenance=mode=min --sbom=true`, scans both published digests with a pinned
Trivy that exits non-zero on a CRITICAL finding, and writes them into
`plepic/overlays/live/kustomization.yaml` in `hannosirkel/deploys` with the
commit message `deploy(live): <source-sha> <backend-digest>
<storefront-digest>`. Before it pushes, it re-runs `plepic/tests/manifests.sh`
and both `kubectl kustomize` renders in the checkout it is about to commit.

**What is approved is a source revision, not a digest.** Live is rebuilt from
merged `main` rather than re-tagging the digest the test environment was
approved on, so the two digests differ. That is acceptable only because no
per-environment value is baked into an image: the same source produces an image
that serves either environment, and the locked dependency tree plus
digest-pinned base images keep the rebuild faithful.

It shares the `plepic-gitops-promotion` concurrency group with
`deploy-test.yml`, so a live promotion and a test promotion never write those
overlays at the same time, and it uses the same job split for the same reasons:
`gate` checks out nothing and reads the guard through the API, `build` runs
repository code but holds no GitOps credential, and `promote` holds the
credential — a GitHub App token minted for `deploys` alone — but brings no code
into the job that holds it.

That last property is enforced rather than described. `scripts/workflows.test.ts`
folds every `run:` body in a promoting job into logical commands, drops comment
lines, and holds what is left to an **allowlist** of the git subcommands the
job actually runs — `config`, `add`, `diff`, `commit`, `push`, with `-C <path>`
tolerated — plus a refusal of the `gh` CLI, a download piped into an
interpreter, any Node package manager and any container build. It also refuses
`${{ … }}` in *every* `run:` body in *every* workflow: an expression is
substituted into the script before a shell sees it, so text from a pull request
would become shell in a credentialed job. Values reach a script through `env:`,
where they arrive as variables and stay data.

### Browser screenshots

The browser suite covers real Chromium interaction and the 32 committed
screenshots: every route in the suite's own `visualRoutes` table at desktop and
mobile, plus the below-fold captures of the homepage story, the Lunar Base
table photograph and the Watch section. It was eight when this paragraph was
written -- home, Lunar Base, basket and checkout -- and the count is not worth
maintaining by hand a third time, so treat `storefront/tests/screenshots/` as
the list and this sentence as the reason it is that long.
CI runs it in this exact immutable image:

```text
mcr.microsoft.com/playwright:v1.57.0-noble@sha256:8fb7af3bb488c51364d6554876a8eddf377736608327dbdf4177b4901faf7bc9
```

Never create or refresh snapshot files from a bare workstation: browser fonts
and anti-aliasing are evidence, and must match CI. To create the first baseline
or deliberately refresh an approved change, run the same pinned image from the
repository root:

```bash
docker run --rm --init --ipc=host --network host --user "$(id -u):$(id -g)" \
  -v "$PWD:/w" -w /w \
  mcr.microsoft.com/playwright:v1.57.0-noble@sha256:8fb7af3bb488c51364d6554876a8eddf377736608327dbdf4177b4901faf7bc9 \
  sh -lc 'npm ci && npm -w storefront exec -- playwright test --update-snapshots'
```

The normal verification command is `npm -w storefront exec -- playwright test`.
Each visual test captures the default visible consent banner and proves that no
Google Tag Manager request has loaded before consent; the explicit
`maxDiffPixelRatio` belongs in `storefront/playwright.config.ts`.

## Repository boundaries

No application source, Dockerfile, image build, or Kubernetes manifest lives
outside this repository — this repository's CI builds and publishes images
and writes their digests to `hannosirkel/deploys`. This repository contains no
live hostname, address, or credential; those are configuration, delivered at
runtime, never committed here.

That last sentence is a test, not a promise. `content/content.test.ts` holds
`content/` to naming no hostname at all, and
`storefront/tests/no-live-hostname.test.ts` holds every file `storefront/`'s
own `.gitignore` would let into a commit — not a fixed list of
subdirectories, but a walk over everything git would track there — to an
allowlist of RFC 2606 reserved example domains plus the third-party endpoints
the application genuinely talks to. Text files scan source text as well as
exported values, because a hostname in a comment leaks exactly as completely
as one in a string — and a comment is where the last one was found; binary
web derivatives under `storefront/public/` are instead held to a byte
ceiling, so a master committed by mistake fails loudly instead of silently
bloating the repository.
