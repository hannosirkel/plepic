# Omniva parcel machines, and registering every shipment with Omniva

Design, 2026-08-26. Supersedes nothing; extends the shipping model ADR `020`
froze.

## What this changes

Two things the operator asked for, and they are separable:

- **A.** A buyer with a delivery address in Estonia, Latvia or Lithuania is
  offered a second delivery method — **Omniva parcel machine, free** — and
  picks the machine at checkout.
- **B.** When a shipment is created for an order, it is **registered with
  Omniva automatically**, worldwide, for both delivery methods.

And one constraint that governs both: **a failed Omniva registration must never
reach the customer once payment has succeeded.**

## The decisions this rests on, and who made them

| Decision | Value | Decided by |
| --- | --- | --- |
| When registration happens | On fulfilment in the Admin | Operator, 2026-08-26 |
| Scope of automatic registration | Worldwide | Operator, 2026-08-26 |
| Parcel machine picker | Grouped `<select>`, list served by the backend | Operator, 2026-08-26 |
| Baltic rates | Both methods offered; €7.00 courier unchanged | Operator, 2026-08-26 |
| Customs attributes | Frozen in `product-model.ts` | Operator, 2026-08-26 |
| International service package | `ECONOMY` | Operator, 2026-08-26 |
| Label delivery | Stored on the fulfilment | Operator, 2026-08-26 |
| Test environment | Deferred until Omniva issues a test key | Operator, 2026-08-26 |
| HS tariff number | `9504400000`, playing cards | Operator, 2026-08-26 |
| Country of origin | `CHN` | Operator, 2026-08-26 |

"Estonia, Latvia and Lithuania" is written out wherever it appears. There is no
`Baltics` constant, type or zone name in this design: the set is three ISO
codes, and naming it as a region would invent a geography the shipping model
does not have.

## What was verified rather than assumed

Everything below was measured on 2026-08-26 against the live services, not read
off a document.

- **The supplied credentials authenticate against LIVE and not against TEST.**
  `POST https://omx.omniva.eu/api/v01/omx/shipments/business-to-client` with the
  key in `~/app/orange/.keys/plepic-omniva` answers **400 Validation Failed** —
  auth accepted, body rejected. The same request to
  `https://test-omx.omniva.eu/...` answers **401 Unauthorized**, byte-identical
  to the unauthenticated request. The assumption that one key serves both
  environments is **false**; Omniva issues test credentials separately.
- **`customerCode` is a third credential and we do not have it.** The live 400
  carried `customerCode: CustomerIsValid — "User is not allowed to represent"`
  against a placeholder, so it is validated server-side and cannot be derived
  from the API user.
- **`https://www.omniva.ee/locations.json` needs no credentials** and returned
  1444 locations: 437 EE, 412 LV and 561 LT parcel machines (`TYPE: "0"`), plus
  34 Estonian post offices (`TYPE: "1"`). `ZIP` is the `offloadPostcode` the
  shipment registration wants; `A0_NAME` is the country.
- **`.keys/plepic-omniva` was mode `0664`.** `read_regular_file`
  (`orange/scripts/openbao_client.py:160-165`) refuses any file carrying group
  or other bits, so the import would have failed. Corrected by the operator.
- **`openbao-admin` refuses `plepic` and `plepic-test` sources in one seed
  action** (`orange/scripts/openbao-admin:1783-1791`). Live and test imports are
  always two runs.

## 1. The commerce model

`backend/src/commerce/shipping-model.ts` gives each zone exactly one option
today — `optionName` and `amountMinor` are scalars on `ShippingZoneModel`. They
become a list, because a zone now sells two things.

```text
ShippingZoneModel {
  name
  countryCodes
  options: readonly ShippingOptionModel[]   // was: optionName + amountMinor
}

ShippingOptionModel {
  name
  currency
  amountMinor
  providerId        // manual_manual, or omniva_omniva
  omnivaChannel?    // PARCEL_MACHINE | COURIER, absent for manual options
}
```

Three zones, and every country still falls in exactly **one** of them:

| Zone | Countries | Options |
| --- | --- | --- |
| `Estonia, Latvia and Lithuania` | EE, LV, LT | Standard delivery €7.00 · Omniva parcel machine €0.00 |
| `European Union` | the other 24 member states | Standard delivery €7.00 |
| `Rest of world` | everything else | Standard delivery €12.00 |

The existing invariant survives untouched: a country appears in exactly one
zone, and every country Medusa knows appears in one.
`tests/commerce-shipping-model.test.ts` already asserts that in both directions
and gains the third zone rather than a new kind of assertion.

**A country in two service zones was considered and rejected.** Leaving EE/LV/LT
in the `European Union` zone and hanging a fourth zone beside it holding only
the free option would avoid touching the model — at the cost of making
`shippingZoneForCountry` ambiguous, since it answers with `.find()` and there
would be two right answers. `shippingAmountMinorForCountry` would then return
whichever zone was declared first. A zone that carries a list of options is the
honest shape now that a zone genuinely sells more than one.

### VAT does not move, and that is load-bearing

`tax-model.ts`'s `VAT_COUNTRY_CODES` stays at 27 members. `EU_MEMBER_STATE_CODES`
stays at 27. Estonia, Latvia and Lithuania are still EU member states for tax;
only the *service zone* they buy delivery from has changed.

The storefront's `ShippingZone` union in `src/lib/cart.ts:163` **must not gain a
third member.** It reads `europeanUnion | restOfWorld`, it is derived from the
`euMember` flag (`cart.ts:257-260`), and `CheckoutPageContent.tsx:566` and
`:898` pass `deliveryZone === "europeanUnion"` as `vatApplies`. It is a VAT
classifier that shares a word with the backend's service zones and is not one.
Mirroring the backend's third zone into it would strip the VAT marker and the
grossed goods price from every Estonian, Latvian and Lithuanian order, silently.
This design changes nothing in that file, deliberately, and
`tests/store-checkout.test.ts` gains a case that holds an EE address to
`vatApplies === true` so a future edit cannot make the change quietly.

## 2. The Omniva fulfillment provider module

New: `backend/src/modules/omniva/`, registered as provider id `omniva_omniva`
(identifier `omniva`, configured id `omniva`).

`medusa-config.ts` currently registers no fulfillment module, so Medusa's
default supplies `manual_manual`. It gains an explicit declaration listing
**both** providers:

```ts
{
  resolve: "@medusajs/medusa/fulfillment",
  options: {
    providers: [
      { resolve: "@medusajs/medusa/fulfillment-manual", id: "manual" },
      { resolve: "./src/modules/omniva", id: "omniva", options: omnivaOptions },
    ],
  },
}
```

Listing `fulfillment-manual` explicitly is not optional: the three
`Standard delivery` options are created against `manual_manual`
(`commerce/configuration.ts`'s `FULFILLMENT_PROVIDER_ID`), and
`createShippingOptionsWorkflow` refuses an option whose provider is not enabled
for the service location. **This must be proven by a run rather than by
reading**: a declared `providers` array replacing the default is exactly the
kind of framework behaviour this repository has been wrong about before.

### Files

Each does one thing and is testable without the others.

| File | Holds |
| --- | --- |
| `config.ts` | Reads and validates the Omniva environment. Optional; see §6. |
| `locations.ts` | Fetches, parses and caches `locations.json`. |
| `shipment.ts` | **Pure.** Order + fulfilment → the OMX registration body. |
| `client.ts` | HTTP against OMX. Basic auth, timeouts, response refusals. |
| `service.ts` | The provider. Composes the four above. |
| `index.ts` | `ModuleProvider(Modules.FULFILLMENT, …)`. |

### The provider's four methods

**`getFulfillmentOptions()`** returns two options, `omniva-parcel-machine` and
`omniva-courier`, each carrying its `deliveryChannel` in `optionData`.

**`validateFulfillmentData(optionData, data, context)`** is where the buyer's
parcel machine choice is checked, and it is the only place it is checked.
For the parcel machine option it requires `data.parcel_machine_zip`, resolves it
against the cached location list, and refuses unless the ZIP exists, is a parcel
machine (`TYPE: "0"`), and sits in the same country as the cart's shipping
address. It returns:

```ts
{ parcel_machine_zip: "10145", parcel_machine_name: "Tallinn, Kristiine Keskus" }
```

The **name is stored alongside the ZIP on purpose.** It is what the buyer chose;
Omniva renames and relocates machines, and a label or an order record that
re-derives the name at print time would show a different machine from the one
the buyer picked, with nothing to notice.

For the courier option it returns `data` unchanged.

**`canCalculate()`** returns `false`. Both rates are stored flat prices and
nothing is quoted from the carrier — ADR `020`'s position, unchanged. There is
no quote to time out and no fallback figure to disagree with the stored one.

**`createFulfillment(data, items, order, fulfillment)`** does four things in
order and stops at the first refusal:

1. builds the registration body with `shipment.ts` — pure, so it is tested
   without a network;
2. `POST /api/v01/omx/shipments/business-to-client`, and refuses unless
   `resultCode === "OK"` with exactly one entry in `savedShipments` carrying a
   barcode. A `failedShipments` entry is raised with its `messageCode` and
   `message` intact, because that string is what tells the operator what to fix;
3. `POST /api/v01/omx/shipments/package-labels` with
   `sendAddressCardTo: "RESPONSE"`, and **does not refuse on failure** — see
   below;
4. returns

```ts
{
  data: { barcode, label_pdf_base64, parcel_machine_zip?, parcel_machine_name? },
  labels: [{
    tracking_number: barcode,
    tracking_url: `https://www.omniva.ee/private/track-and-trace?barcode=${barcode}`,
    label_url: "",
  }],
}
```

That `labels` array is read by `src/fulfillment/send-status-notification.ts:71-77`
and rendered into the customer's shipment email by
`src/notifications/fulfillment-status.ts` — **neither file changes.**

### Step 2 is irreversible and step 3 is not, so they fail differently

Registering the shipment creates a parcel in Omniva's system and is the only
step that cannot be taken back from here. Requesting a label is a read against a
barcode that now exists, and can be repeated any time.

So a **step 3 failure must not fail the fulfilment.** If it did, the fulfilment
would roll back while the parcel stayed registered, and the operator's retry
would register a *second* parcel for the same order — turning a transient label
timeout into a duplicate shipment and a duplicate carrier charge. Instead the
fulfilment succeeds with the barcode and no `label_pdf_base64`, and the operator
re-requests the label from the stored barcode.

**The one case this design cannot make safe** is a network failure at step 2
*after* Omniva has accepted the registration but before the response arrives.
The fulfilment fails, the parcel exists, and a retry registers a second one.
That is accepted deliberately: the alternative — treating a timeout as success —
marks an order shipped with no parcel behind it, which the customer finds out
about and the operator does not. A duplicate is visible in Omniva's e-service
and cancellable there. `partnerShipmentId` is the fulfilment id, and a retry is
a new fulfilment with a new id, so OMX will not deduplicate it for us.

### Reaching the label

The PDF sits on the fulfilment's `data` and needs a way out. An Admin widget on
the order page renders a download button for a fulfilment carrying
`label_pdf_base64`, and a **request label** button for one carrying a barcode
and no PDF — which is the step 3 failure path, and the retry that repairs it.
It is the smallest surface that makes a stored label reachable; without it the
label is stored and unprintable, which is worse than not storing it.

## 3. What goes in the registration body

Assembled by `shipment.ts` from the order, the fulfilment and the frozen models.
Every field below is either mandatory or conditionally mandatory per the OMX API
manual v1.7; nothing optional is sent, because the manual is explicit that an
attribute without a value must not exist in the message.

| Field | Value |
| --- | --- |
| `customerCode` | From configuration. |
| `shipments[].partnerShipmentId` | The Medusa fulfilment id. |
| `shipments[].mainService` | `PARCEL`. |
| `shipments[].deliveryChannel` | `PARCEL_MACHINE` or `COURIER` — **sent only for EE/LV/LT**, where OMX makes it mandatory. |
| `shipments[].servicePackage.code` | `ECONOMY` — **sent only when the destination is not EE, LV or LT**, where OMX makes it mandatory. |
| `shipments[].contentDescription` | The order's distinct line-item titles, joined. |
| `shipments[].measurement.weight` | Sum of line weights, kilograms. |
| `receiverAddressee.personName` | Shipping address first + last name. |
| `receiverAddressee.contactEmail` | The order email. |
| `receiverAddressee.contactPhone` | The order's phone — see below. |
| `receiverAddressee.address.offloadPostcode` | The chosen machine's ZIP, parcel machine option only. |
| `receiverAddressee.address.*` | Street, city, postcode, country from the shipping address — omitted when `offloadPostcode` is set. |
| `senderAddressee.*` | The merchant, from configuration. |
| `customs` | Present only when the destination is outside the EU. |

`partnerShipmentId` is bounded at OMX's `string(30)`. A Medusa fulfilment id is
`ful_` plus a 26-character ULID — exactly 30 — so the builder asserts the length
rather than trusting the arithmetic to stay true across a Medusa upgrade.

Weight comes from the Medusa variant, which `commerce/seed-product.ts:233` writes
from `product-model.ts`. The builder **refuses** an item whose variant carries no
weight rather than substituting a default: a parcel registered at the wrong
weight is a carrier billing dispute, not a rendering bug.

### Customs, outside the EU

`goodsCategoryCode: "SALE_OF_GOODS"`, and one `shipmentItems` entry per line
item: `description` (the title), `numberOfPieces` (the quantity), `weight`,
`financialValue` (net unit price), `tariffNumber: "9504400000"` and
`originCountry: "CHN"`. The last two are frozen in `product-model.ts` beside
`weightGrams`:

```ts
export const PRODUCT: ProductModel = {
  // …
  packaging: { weightGrams: 300, /* … */ },
  customs: {
    tariffNumber: "9504400000",   // HS 9504.40 — playing cards
    originCountry: "CHN",
    goodsCategoryCode: "SALE_OF_GOODS",
  },
};
```

OMX accepts at most **8** customs items. An order with more is refused by the
builder, at fulfilment, naming the limit — not truncated.

### Two consequences of worldwide scope

**The checkout gains a phone field, conditionally.** OMX makes receiver
`contactPhone` or `contactMobile` mandatory whenever the destination is not
Estonia, Latvia, Lithuania or Finland. Choosing `ECONOMY` avoids the *other*
phone requirement — `STANDARD` and `PREMIUM` demand a mobile for every
destination — and for a Baltic parcel machine the buyer's email already
satisfies OMX. So the field is required only when the destination is outside
those four countries, and hidden otherwise. It is stored on the order's shipping
address `phone`, which Medusa already carries.

OMX validates it with libphonenumber, requires a country prefix, refuses
special-tariff ranges (800/900), and refuses fixed-line numbers for Baltic
destinations. The storefront validates only presence and the prefix; the rest is
OMX's to refuse, at fulfilment, where the operator can act on it.

**The sender address must become structured.** OMX requires sender
`deliverypoint` (city), `postcode` and `country`; street is optional. Orange's
merchant block carries `registered_address` as one line — `Example Street 1,
Tallinn` — with no postcode, so it cannot be split reliably. The merchant block
gains `sender_street`, `sender_city`, `sender_postcode` and `sender_country`.
`phone_number` already exists and becomes the sender phone, mandatory for the
same destinations as the receiver's.

## 4. The parcel machine list

A new Store API route on the backend:

```text
GET /store/omniva/parcel-machines?country=EE
→ [{ zip, name, group }]
```

`group` is the county and town from `A1_NAME`/`A2_NAME`, and is what the
`<optgroup>` renders. The route refuses a country outside EE, LV and LT.

`locations.ts` fetches `https://www.omniva.ee/locations.json` and caches the
parsed, filtered result in the Redis this deployment already runs, with a TTL.
On a fetch failure it serves the cached copy and logs; with no cached copy at
all it refuses, because an empty machine list rendered as an empty `<select>` is
a checkout that looks broken for a reason nobody can see.

**One reader.** `validateFulfillmentData` resolves the chosen ZIP against this
same cache. The list the buyer picked from and the list the ZIP is validated
against cannot disagree, which they could if the storefront fetched its own copy.

The storefront reaches the route through the existing same-origin `/store-api`
proxy, so **no third-party origin enters the checkout's CSP** and no request goes
from the buyer's browser to Omniva.

## 5. Checkout

`storefront/src/components/shop/CheckoutPageContent.tsx`:

- a second `<select>`, revealed only when the parcel machine option is the
  selected delivery method, populated from the route above for the address's
  country and grouped by county and town;
- `addGuestShippingMethod` passes `data: { parcel_machine_zip }` — the Store API
  accepts `data` on `POST /store/carts/:id/shipping-methods` and forwards it to
  the provider;
- `orderMayBePlaced` refuses when the parcel machine option is selected and no
  machine is chosen;
- the conditional phone field described in §3.

`storefront/src/lib/store-checkout.ts`:

- `shippingOptionFigure` gains a **zero case**: an amount of zero is final and
  renders `Free`. Without it a free option renders `€0.00 + VAT` for an EU
  address, which promises a tax on nothing. The existing charged-versus-shown
  guard in `addGuestShippingMethod` already handles zero correctly — `0 - 0 === 0`
  — and is not relaxed.

`content/legal/shipping.ts` gains the parcel machine method and its price.
The page currently describes two flat rates; it will describe three methods.

## 6. Configuration, and why it is optional

The backend reads four values:

| Variable | Source |
| --- | --- |
| `OMNIVA_API_USER` | Secret |
| `OMNIVA_API_PASSWORD` | Secret |
| `OMNIVA_CUSTOMER_CODE` | Secret |
| `OMNIVA_BASE_URL` | Not secret; per environment |

**The block is optional at boot.** `readBackendRuntimeConfig` does not add these
to `requiredEnvironmentVariables`, and the backend starts without them. This is
forced by the decision to defer the test import: `plepic-test` will hold no
Omniva secret until Omniva issues a test key, and a required variable would
crash-loop the test environment's backend, its worker and its predeploy Job —
which, being an Argo CD sync hook, would stop the Application syncing at all.

What that buys, and what it costs:

- the test storefront still **offers and validates** the parcel machine option,
  because the location list needs no credentials;
- only **fulfilment** refuses, naming the missing configuration;
- so the test site is honestly unfulfillable rather than quietly pretending.

Because nothing here becomes required, `backend/Dockerfile` and
`scripts/validate` need no new variables. That is stated explicitly because the
opposite case has broken `main` before: a required variable added to
`medusa-config.ts` and to `scripts/validate` but not to the Dockerfile, missed
by three review passes because none of them builds the image. **If any Omniva
variable becomes required during implementation, both files change with it.**

## 7. Secrets — `hannosirkel/orange`

Live only. The test import is deferred until Omniva issues a test key, at which
point it is a second seed source and nothing else in this design moves.

- `.keys/plepic-omniva` gains a third line, `customerCode=…`. It is already
  `apiUser=`/`apiPassword=` in `=`-separated form, which is what
  `parse_structured` reads.
- `scripts/openbao-admin`: a new `omniva` parser expecting exactly
  `("apiUser", "apiPassword", "customerCode")`, and a generation 13 holding a
  single import — namespace `plepic`, path `omniva/credentials`, source
  `plepic-omniva`.
- `roles/openbao/defaults/main.yml`: `plepic-omniva` joins
  `openbao_seed_allowed_sources`. It stays in `openbao_update_allowed_sources`,
  since an Omniva credential is rotatable.
- `roles/argocd/defaults/main.yml`: a `plepic-omniva` ExternalSecret in the
  `plepic` namespace projecting `OMNIVA_API_USER`, `OMNIVA_API_PASSWORD` and
  `OMNIVA_CUSTOMER_CODE` from `omniva/credentials`, marked `optional_source:
  plepic-omniva` — the mechanism `plepic-publishable-key` already uses, so a
  cluster without the key still renders.
- Orange's `argocd_plepic_environments` merchant block gains the four sender
  address fields, and each environment gains its `OMNIVA_BASE_URL`:
  `https://omx.omniva.eu` live, `https://test-omx.omniva.eu` test.

Orange's contract tests move with it: `tests/openbao_templates.yml`,
`tests/external_secrets_templates.yml`, `tests/plepic_argocd_templates.yml`.

## 8. Deployment — `hannosirkel/deploys`

`plepic/base/backend.yaml` and `plepic/base/worker.yaml` project the three
secret values with `optional: true`, so a namespace without the Secret still
starts. `OMNIVA_BASE_URL` is not a secret and not a live hostname of ours; it is
Omniva's published endpoint, so it is an ordinary environment variable patched
per environment by Orange alongside the `SITE_*` and `MERCHANT_*` values.

`plepic/base/networkpolicy.yaml` gains egress for the backend and worker to
`omx.omniva.eu`, `test-omx.omniva.eu` and `www.omniva.ee` on 443.

`plepic/tests/manifests.sh` gains the assertions for all of it.

## 9. Why a failed registration cannot reach the customer

Registration lives in exactly one place: `createFulfillment`. The customer's
path — `POST /store/carts/:id/complete`, `order.placed`, the confirmation
email — **never calls Omniva**.

A throw inside `createFulfillment` fails `createFulfillmentWorkflow`, so:

- no fulfilment row is created;
- the order stays unfulfilled and the operator retries;
- nothing downstream of a fulfilment can happen, which is what actually protects
  the customer: the order can never be marked shipped, so `shipment.created`
  never fires, `src/subscribers/shipment-created.ts` never runs, and no shipment
  email is sent. (`createFulfillment` is called when the fulfilment is created,
  which is strictly before the shipment the customer is emailed about.)
- the customer's order, payment and confirmation email are untouched.

The containment is **structural**. There is no `try`/`catch` holding it up and
no log-and-continue branch a later edit could add without the test in §10
noticing.

## 10. Testing

This repository's recurring defect is a contract that passes because it is only
ever exercised against a stand-in. The tests that matter here run the real
thing.

**Against the real world:**

- `locations.ts` parsed against the **real** `locations.json`, asserting the
  shape this design depends on: `ZIP`, `TYPE`, `A0_NAME`, and that EE, LV and LT
  each yield a non-empty machine list.
- `commerce-medusa-semantics.test.ts` extended: run the real
  `configure-commerce` against real Medusa and Postgres, then assert that a cart
  with an **Estonian** address is offered **both** options at €7.00 and €0.00,
  and that a German cart is offered exactly one. This is the test that catches
  the three-zone assumption, the explicit-providers assumption, and the
  `manual_manual`-still-works assumption — none of which can be verified by
  reading.
- The fulfilment path exercised end to end against a stub OMX served over real
  HTTP, not a mocked `fetch`, so the client's timeouts, status handling and
  basic-auth header are on the path.

**Pure, and therefore exhaustive:**

- `shipment.ts` — the registration body for: an Estonian parcel machine, a
  Latvian courier, a German courier (`ECONOMY`, `contentDescription`, phone
  required, no customs), a US courier (customs with `originCountry`), a
  nine-item order (refused), an item with no variant weight (refused), a
  fulfilment id over 30 characters (refused).

**Containment, asserted directly:**

- a fulfilment attempt against an OMX that refuses **registration** leaves the
  order unfulfilled and sends no customer notification;
- a fulfilment attempt against an OMX that registers and then refuses the
  **label** succeeds, stores the barcode, stores no PDF, and leaves the order
  fulfilled — the asymmetry in §2 asserted rather than described, because the
  whole point of it is that one retry must not double-register.

**Regression, on the VAT hazard:**

- an EE address still yields `vatApplies === true` and a grossed goods price.

Each failing test is written and committed **before** its fix, so the record
shows it failed. Existing suites that move: `commerce-shipping-model.test.ts`,
`commerce-configuration.test.ts`, `store-checkout.test.ts`.

## 11. What the operator still owes

Blocking the first live shipment:

1. **`customerCode`** — added to `.keys/plepic-omniva` as a third line.
2. **Merchant sender address** — city, postcode, country, and the street if it
   is to appear on labels.

Not blocking, unblocks the test environment when it arrives:

3. **Test credentials from Omniva** — account manager, or
   `integrations@omniva.ee`. They arrive as a `plepic-test-omniva` seed source
   and a second ExternalSecret; no code changes.

## 12. Deliberately not in scope

- **Courier pickup ordering** (`/courierorders/create-pickup-order`). Parcels
  are handed over; nothing here schedules a collection.
- **Omniva return shipments** (`/shipments/omniva-return`). Returns are handled
  as they are today.
- **Event polling** (`/events`). Tracking is a barcode and a link; nothing here
  polls Omniva for status, and the customer's shipment email already carries
  what it needs.
- **`X-Integration-Agent-Id`.** It identifies platforms that resell an
  integration to other merchants. This is one merchant integrating for itself.
- **Post offices.** `locations.json` carries 34 Estonian post offices
  (`TYPE: "1"`); only parcel machines are offered.
- **Retiring the catalogue import's copies of the shipping upserts.** Named in
  `commerce/configuration.ts` as a separate change, and it stays separate.
