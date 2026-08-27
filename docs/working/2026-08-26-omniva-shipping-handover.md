# Omniva shipping — handover

Written 2026-08-27, at the end of the implementation run. The branch is
complete and unmerged by the operator's decision.

Read this first, then
[the spec](./2026-08-26-omniva-shipping.md). The spec is the binding
authority; [the plan](./2026-08-26-omniva-shipping-plan.md) is its argument and
is now **history** — several of its instructions were overruled during
execution and are wrong if followed literally. Where they disagree, the code
and this document win.

## State

| Repository | Branch | Commits | Worktree |
| --- | --- | --- | --- |
| `plepic` | `feat/omniva-shipping` | 21 (`440d8af..b4f9002`) | `~/app/.worktrees/plepic/omniva-shipping` |
| `orange` | `feat/omniva-secret` | 1 (`63ef3a7`) | `~/app/.worktrees/orange/omniva-secret` |
| `deploys` | `feat/omniva-env` | 2 (`ca3ef8f`, `294e5ce`) | `~/app/.worktrees/deploys/omniva-env` |

All three working trees are clean. Nothing is pushed. No pull request exists.

`bash scripts/validate` exits 0 in the plepic worktree: shellcheck, eslint,
three typechecks, a real `medusa build` (backend **and** Admin frontend), and
105 test files / 3213 tests. `bash scripts/validate` also exits 0 in orange,
and `bash plepic/tests/manifests.sh` passes in deploys with both overlays
rendering.

**Do not treat a green suite as proof the branch is finished** — see
[What nothing tests](#what-nothing-tests).

## What is owed before a live shipment can succeed

These are the operator's, not an agent's. The first is hard-blocking.

1. **`customerCode`.** `~/app/orange/.keys/plepic-omniva` holds `apiUser` and
   `apiPassword`. The parser expects a third line, `customerCode=…`. Without
   it the OpenBao seed cannot run, and OMX refuses every registration —
   verified: a live probe answered
   `customerCode: CustomerIsValid — "User is not allowed to represent"`.
2. **Merchant sender address.** OMX requires sender *city*, *postcode* and
   *country* as separate fields. `MERCHANT_REGISTERED_ADDRESS` is one line
   with no postcode and cannot be split reliably. The variables exist and are
   read: `MERCHANT_SENDER_STREET`, `MERCHANT_SENDER_CITY`,
   `MERCHANT_SENDER_POSTCODE`, `MERCHANT_SENDER_COUNTRY`, `MERCHANT_PHONE_NUMBER`.
3. **The Estonian legal paragraph.** `content/legal/et/shipping.ts` carries a
   machine-translated sentence about the parcel machine method. Its own header
   records that it lacks the qualified-reader confirmation the rest of that
   `operator-approved` page has. A reviewer who reads Estonian judged the
   grammar and register sound but explicitly did not certify it.
4. **The seed itself, and enabling the projection.** Running
   `playbooks/openbao-seed.yml` and adding `plepic-omniva` to
   `argocd_openbao_enabled_optional_sources` in the **private inventory** are
   operator actions. No agent took them, deliberately.

Not blocking: **Omniva test credentials.** Their test host rejects the live
key with 401 (verified). Until they issue one, the test environment holds no
Omniva secret — which is *why* the configuration is optional at boot. When
they arrive it is one more seed source and one more ExternalSecret; no code
changes.

## Effect gates — read before merging anything

**Merging `plepic` to `main` is a deployment.** `Release` fires on push,
builds and publishes both images to GHCR, and writes `plepic/overlays/live`.
Labelling a PR `deploy-test` publishes images and writes
`plepic/overlays/test`. Merging `orange` or `deploys` fires nothing.

A deploy without `customerCode` is safe but partial: the shop works, the
parcel machine option appears and validates, and only *fulfilment* refuses,
naming the missing configuration. That is deliberate — a required variable
would crash-loop the predeploy Job, which is an Argo CD sync hook, and stop
the Application syncing entirely.

## How it works

Registration happens in **one place**: the fulfillment provider's
`createFulfillment`. The customer's path — cart completion, `order.placed`,
the confirmation email — never calls Omniva. A registration failure fails the
fulfilment, so the order stays unfulfilled and can never be marked shipped;
no `shipment.created` fires and no customer email is sent. That containment is
structural, and Medusa's own behaviour backs it:
`FulfillmentModuleService.createFulfillment` wraps the provider call in a
`try` whose `catch` deletes the fulfilment row and rethrows
(`@medusajs/fulfillment/dist/services/fulfillment-module-service.js:184-201`),
and `createFulfillmentStep` neither catches nor swallows.

| Concern | File |
| --- | --- |
| The provider (options, validation, `createFulfillment`, `cancelFulfillment`) | `backend/src/modules/omniva/service.ts` |
| Order → OMX request body, **pure** | `backend/src/modules/omniva/shipment.ts` |
| OMX HTTP client | `backend/src/modules/omniva/client.ts` |
| Configuration, optional by design | `backend/src/modules/omniva/config.ts` |
| Machine list, fetch + Redis cache + stale fallback | `backend/src/modules/omniva/locations.ts` |
| Redis-backed cache adapter | `backend/src/modules/omniva/redis-cache.ts` |
| Machine list for the checkout | `backend/src/api/store/omniva/parcel-machines/route.ts` |
| Label download / re-request | `backend/src/api/admin/omniva/labels/[barcode]/route.ts` |
| Admin order-page widget | `backend/src/admin/widgets/omniva-label.tsx` |
| Zones, methods, country sets | `backend/src/commerce/shipping-model.ts` |
| Checkout picker | `storefront/src/components/shop/ParcelMachinePicker.tsx`, `useParcelMachineSelection.ts` |

### Two failure modes that are deliberately different

Registration **cannot be undone**, so its failure throws. Labelling is a read
against a barcode that now exists, so its failure is **caught, logged, and
does not fail the fulfilment** — a rollback there would leave the parcel
registered while the operator's retry registered a second one. The reasoning
sits beside the `catch` in `service.ts`. Do not "tidy" it into symmetry.

### Values that have exactly one writer

Several constants cross the backend/storefront boundary through
`storefront/mock/shipping.json`, held together by
`backend/tests/commerce-shipping-model.test.ts`. Do not add a second copy:
the parcel machine's **display name** (Medusa's option list identifies the
method only by name), `phoneOptionalCountries`, and the parcel-machine
country set. One deliberate mirror exists at `omniva-label.tsx` across the
Admin bundle boundary, guarded by `omniva-provider.test.ts`.

### Two country sets, and confusing them is the trap

- `PARCEL_MACHINE_COUNTRY_CODES` = `EE, LT, LV` — where `deliveryChannel` is
  mandatory and `servicePackage` is not.
- `PHONE_OPTIONAL_COUNTRY_CODES` = `EE, FI, LT, LV` — where OMX needs no
  receiver phone. **Finland is in this one and not the other.**

There is no `Baltics` constant, type, variable or user-visible word anywhere,
and `legal-pages.test.tsx` asserts its absence in rendered copy *and* raw
source. Keep it that way.

### `ShippingZone` in `storefront/src/lib/cart.ts` is not a service zone

It is `"europeanUnion" | "restOfWorld"` and it is a **VAT classifier** that
happens to share a word with the backend's service zones. Adding a third
member silently strips VAT from every Estonian, Latvian and Lithuanian order.
`store-checkout.test.ts` asserts it stays at two.

### Imports inside `backend/src/modules/omniva/` must be extensionless

Medusa's config loader walks that module through ts-node, which cannot map a
`.js` specifier onto the `.ts` file beside it. This broke `medusa build` once
already — via a *transitive* import two hops away in `commerce/`, not the
module's own files. `backend/tests/omniva-extensionless-imports.test.ts`
walks the real graph and fails naming the file and specifier.
`commerce/tax-model.ts` still carries a `.js` import and is one import away
from tripping it; that is intentional and documented.

## What nothing tests

Be honest about these rather than assuming the suite covers them.

- **The storefront checkout's own behaviour.** `storefront/` has no jsdom for
  `CheckoutPageContent.tsx` or `useParcelMachineSelection.ts`, so the picker,
  the address-change reset, the request-invalidation counters and the phone
  field's appearance are exercised only by static render and reading. This is
  the widest untested surface on the branch. Worst case is a confusing
  checkout rather than a misaddressed parcel: `addGuestShippingMethod` refuses
  independently, and `validateFulfillmentData` re-checks server-side.
- **An ambiguous registration outcome.** A timeout or a 5xx *after* OMX
  committed leaves a real parcel with a failed fulfilment; a retry registers a
  second one, because `partnerShipmentId` is the fulfilment id and a retry is
  a new fulfilment. This was chosen deliberately over treating a timeout as
  success. The error message names the fulfilment, says a shipment may exist,
  and tells the operator to check OMX first — but detection is entirely human.
  **Nothing reconciles `partnerShipmentId` against OMX.** If you build one
  thing next, build that.
- **The Admin widget in a browser.** Reaching a fulfilment needs a paid order
  through Stripe, which tests do not reach. Its presence in the built Admin
  bundle was confirmed; its rendering was not.

## Traps for the next agent

- **The plan is stale in specific places.** It says
  `commerce-medusa-semantics.test.ts` runs "real Medusa against real Postgres"
  — it does not, and says so in its own header. The only real-Medusa harness
  is `bash scripts/store-smoke` (real Postgres, Redis, `medusa build`, the
  four predeploy commands), which CI runs as its own job. It cannot place a
  *paid* order.
- **Never `--force` past the gitleaks pre-commit hook.** Fake credentials in
  tests are written as a bare vendor prefix with nothing after it.
- **Do not add an npm dependency** without asking — it is a standing
  stop-and-ask in this universe. The Redis cache was built from the existing
  `redis` dependency for exactly this reason rather than adding
  `@medusajs/cache-redis`.
- **Do not hand-edit digest lines** in `deploys`' `plepic/overlays/*/kustomization.yaml`.
- **`orange` and `deploys` are public.** No real hostname, IP, account
  identifier or credential. `deploys`' `example.com` placeholders are
  deliberate; Orange injects real values as rendered patches.
- **Build the image after touching anything the module imports.** `medusa build`
  is the only thing that catches the ts-node resolution class of defect, and
  the reason it broke before was that eight reviews passed without one.

## Open questions for the operator

- **`cancelFulfillment` policy.** It currently refuses by name — OMX v1.7 has
  no unregister call — telling the operator to cancel the parcel in Omniva's
  e-service. The spec never covered this method. The alternative is letting
  Medusa mark the fulfilment cancelled while the parcel stays live. The
  operator has not chosen.
- **Whether the newsletter rate-limit refactor stays.** Wiring the cache onto
  Redis reused the limiter's connection helper, which meant editing
  `backend/src/newsletter/rate-limit.ts` and its route — a live abuse-prevention
  control. It was reviewed line by line and found a byte-identical move with
  fail-closed semantics unchanged and no shared client. Reverting to
  duplication costs nothing if preferred.

## Carried minor findings

Twenty-nine Minor findings were triaged at the whole-branch review and judged
carryable; three were closed in the final fix wave. None blocks merge. The
ones most worth a future pass: `CheckoutPageContent.tsx` is 1360 lines and the
next addition should extract; `parcelMachine.id` in `mock/shipping.json` is
read by nothing and looks authoritative; and `STANDARD_EUROPEAN_UNION_METHOD`
now serves two zones, one of which is not the European Union (docstring added,
name unchanged).
