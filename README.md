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
  carrier rates, and Task 5 must seed the live Medusa shipping options to match
  both figures. "Member state" rather than "in the EU" is the rule the code
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
  on the same date. The operator's phrasing governs, and unify was not delete:
  the body now glosses their word — *"Included means contained within that
  figure rather than added to it"* — instead of restating their conditional,
  and the sentence that follows carries the export case explicitly (*"…
  including where no VAT is due at all"*). Both halves of what the qualified
  reader put there survive, and `tests/legal-pages.test.tsx` fails if either
  leaves the page or if the conditional comes back.

  **No `{token}` reaches a visitor.** Two did:
  `{priceLine}` in the product page's "How much is shipping?" answer, inside
  a closed `<details>`, and `{merchantContactAddress}` in plain body type on
  `/support/lunar-base`. `tests/no-unresolved-placeholder.test.tsx` renders
  every real route's component and fails on any brace-delimited token
  surviving in text a browser will paint, with `<details>` content counted
  whether the disclosure is open or closed.

  **The merchant contact address is configuration, and is suppressed when it
  is absent.** `content/schema.ts` marks the merchant identity placeholders
  `unresolved` — the values do not exist yet, and inventing one is not an
  option. `MERCHANT_CONTACT_ADDRESS` supplies it at runtime;
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

  **Some of what is in `public/` is referenced by no source file, on
  purpose.** Three groups, and the distinction matters because "nothing
  imports it" is otherwise a good argument for deleting a file:

  - **Referenced by the platform, not by code** — `favicon.ico`,
    `icons/favicon-32.png`, `icons/favicon-64.png`,
    `icons/apple-touch-icon.png`, `icons/web-app-icon-192.png` and
    `icons/web-app-icon-512.png`. Browsers and installers fetch these by
    convention and by web-app manifest; the manifest and the `<head>` links
    belong to `t2-pages`, which builds the real routes.
  - **Referenced by page metadata a later unit writes** — `og/publisher-og.png`
    and `og/lunar-base-og.png`, which become `openGraph.images` entries.
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
- `backend/` — pinned Medusa v2 backend with PostgreSQL/Redis runtime seams,
  one maintained Stripe provider, and a custom email notification provider.
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

### Browser screenshots

The browser suite covers real Chromium interaction and the eight committed
screenshots (home, Lunar Base, basket, and checkout at desktop and mobile).
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
