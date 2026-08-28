# Omniva shipping — handover

Written 2026-08-27, at the end of the implementation run; updated 2026-08-28
after Omniva issued test credentials and the branch's own code was run
against the real carrier for the first time. The branch is complete and
unmerged by the operator's decision.

Read this first, then
[the spec](./2026-08-26-omniva-shipping.md). The spec is the binding
authority, with one correction dated 2026-08-28 at its top — read that before
anything about `originCountry`.
[The plan](./2026-08-26-omniva-shipping-plan.md) is its argument and is now
**history** — several of its instructions were overruled during execution
and are wrong if followed literally, and it carries the same kind of dated
correction. Where either disagrees with the code, the code and this document
win.

## State

| Repository | Branch | Commits | Worktree |
| --- | --- | --- | --- |
| `plepic` | `feat/omniva-shipping` | 24 (`440d8af..d61ca12`) | `~/app/.worktrees/plepic/omniva-shipping` |
| `orange` | `feat/omniva-secret` | 2 (`63ef3a7`, `6c490e1`) | `~/app/.worktrees/orange/omniva-secret` |
| `deploys` | `feat/omniva-env` | 2 (`ca3ef8f`, `294e5ce`) | `~/app/.worktrees/deploys/omniva-env` |

All three working trees are clean. Nothing is pushed. No pull request exists.
`deploys` needed no new commit: `plepic/base/{backend,worker}.yaml` already
read a Secret named `plepic-omniva` with `optional: true` regardless of which
namespace the base renders into, so orange's `feat/omniva-secret` test-side
projection (below) targets that same name in `plepic-test` and nothing here
had to change.

`bash scripts/validate` exits 0 in the plepic worktree: shellcheck, eslint,
three typechecks, a real `medusa build` (backend **and** Admin frontend), and
105 test files / 3213 tests. `bash scripts/validate` also exits 0 in orange,
and `bash plepic/tests/manifests.sh` passes in deploys with both overlays
rendering.

**Do not treat a green suite as proof the branch is finished** — see
[What nothing tests](#what-nothing-tests). It did not, in fact, catch four
real defects; see the next section.

## What was resolved on 2026-08-28

The two hard blockers the first handover named are both closed.

- **`customerCode` is resolved.** Omniva issued it. `~/app/orange/.keys/plepic-omniva`
  and `~/app/orange/.keys/plepic-omniva-test` each now hold all three lines
  (`apiUser`, `apiPassword`, `customerCode`), mode `600`. Probed with an empty
  `shipments` array against both live and test hosts: `customerCode: CustomerIsValid`
  with no complaint, so the value is accepted server-side. **`customerCode`
  equals `apiUser` on both accounts** — confirmed by probe, not assumed.
- **Test credentials are resolved and bound.** Omniva issued a separate test
  key; it is refused by live with 401 and the live key is refused by test
  with 401 the same way, so the two environments are cleanly separated.
  `orange`'s `feat/omniva-secret` (`6c490e1`) mirrors the live import for
  `plepic-test`: a second `OMNIVA_SECRET_IMPORTS` entry (source
  `plepic-test-omniva`), `plepic-test-omniva` added to
  `openbao_seed_allowed_sources`, and a `plepic-test` projection targeting a
  Secret named `plepic-omniva` (not `plepic-test-omniva` — see the comment in
  `roles/argocd/defaults/main.yml` for why the name doesn't get a test-
  prefix). Seeding either one is still its own operator action — `seed()`
  refuses mixing `plepic` and `plepic-test` sources in one run, unchanged from
  before — and so is adding `plepic-omniva` / `plepic-test-omniva` to
  `argocd_openbao_enabled_optional_sources` in the **private inventory**. No
  agent took either action, deliberately.

**All four delivery paths were registered end to end against the real
carrier** (`test-omx.omniva.eu`), using the branch's own compiled
`buildShipmentRegistration` and `OmnivaClient`, not a stand-in for either:

| Path | Result |
| --- | --- |
| Estonian parcel machine (`offloadPostcode`, no receiver street) | `200 OK`, barcode `CC405869298EE`/`LL000058703EE` |
| Latvian courier (street address, no `servicePackage`) | `200 OK` |
| German courier (`servicePackage`, receiver phone) | `200 OK` |
| US courier (customs, `originCountry`) | `200 OK`, after the fixes below |

Registering a real label and downloading it also succeeded; the returned
`fileData` decodes to a genuine PDF (`%PDF-1…`).

## The OMX manual is wrong in four places

Every one of these survived thirteen task reviews, a whole-branch review and
3213 passing tests, because every test on the branch drove a stub built from
reading the manual — faithfully, in three of these four cases. All four are
now fixed (`94003e2`, `d61ca12`) and covered by tests that assert the
*correct* wire shape and were each verified killable by reverting the fix.

1. **The receiver's city field is `deliverypoint`, not `city`.** The manual
   itself agrees — `deliverypoint` is documented at §1.6 — this was a plain
   implementation slip that the branch's own stub never caught because the
   stub never validated field names. Sending `city` answered `500`
   (`Unrecognized field "city" ... not marked as ignorable`); the identical
   request with `deliverypoint` answered `200`. Broke every courier order
   worldwide; parcel-machine orders were unaffected because that branch sends
   `offloadPostcode` and never emits a city field.
2. **`barcodes` is an array of objects, not strings.** The manual's own
   §1.7 says `array, string(5-30)` — the manual is wrong here.
   `["CC405869298EE"]` answered `500` (`no String-argument constructor ...
   BarcodeValueDto`); `[{"barcode": "CC405869298EE"}]` answered `200`.
3. **The label response field is `fileData`, not `filedata`.** The manual
   spells it `filedata`; the live API returns `fileData` (capital D). Because
   label failure is swallowed by `createFulfillment` by design, this defect
   was silent — every fulfilment would have succeeded with no label ever
   stored, and the Admin's Request Label button would have failed forever.
   `client.ts` now reads `fileData` first and tolerates `filedata` as a
   fallback, a deliberate, documented exception to "refuse rather than
   guess."
4. **`customs.shipmentItems[].originCountry` is ISO 3166-1 alpha-2, not the
   alpha-3 the manual's `string(3)` implies.** `originCountry: "CHN"`
   answered a `jakarta.validation.constraints.Size` violation on
   `shipment.customs.shipmentItems[0].originCountry`; `"CN"` answered `200`.
   `product-model.ts` now carries `"CN"`. See the correction sections atop
   the spec and the plan — both stated `"CHN"` as fact.

## Verify this integration against test-omx, not the manual

**Standing instruction.** Three of the four defects above are places where
this codebase read the OMX manual v1.7 faithfully and the manual itself is
wrong. A future change to anything in `backend/src/modules/omniva/` —
including one that looks like it only touches a stub — must be re-verified
by calling `https://test-omx.omniva.eu` with real test credentials before it
is trusted, not by re-reading the manual more carefully. A stub built purely
from the manual will happily agree with a wrong assumption forever; that is
exactly what let all four of these survive review.

The harness used for the 2026-08-28 verification run,
`/tmp/claude-1000/-home-hanno-app-plepic/54455d27-b775-4109-adc6-3942f1e3fd6a/scratchpad/verify-omniva.cjs`,
is session scratchpad and will not survive this conversation. It called
`buildShipmentRegistration` and `OmnivaClient` directly against all four
paths in the table above, reading real test credentials from the
environment. If a durable version of this is worth keeping — and given how
this class of defect survived 3213 tests once already, it probably is — it
should live at `scripts/verify-omniva-contract.mjs`: read
`OMNIVA_API_USER`/`OMNIVA_API_PASSWORD`/`OMNIVA_CUSTOMER_CODE` from the
environment (never hardcode them, and never commit a fixture carrying a real
one), and stay **out of** `bash scripts/validate` and any CI job — it needs
live third-party network access and real test credentials neither has, and
running it automatically would either fail every sandboxed run or, worse,
train reviewers to ignore its failures.

## What remains owed by the operator

1. **The merchant sender address is still a placeholder, on both sides.**
   The 2026-08-28 verification run above used `Pihlaka tn 2, Jüri alevik,
   75301, EE` — an Omniva-manual-style example address, not the merchant's
   real registered one. That is a *different* placeholder from the one
   already committed in `orange`'s public
   `roles/argocd/defaults/main.yml`/`inventory-example/group_vars/orange.yml`
   (`Example Street 1, Tallinn, 10111, EE`) — the two do not match each
   other, and neither is real. Both prove only that `MERCHANT_SENDER_STREET`,
   `MERCHANT_SENDER_CITY`, `MERCHANT_SENDER_POSTCODE`,
   `MERCHANT_SENDER_COUNTRY` and `MERCHANT_PHONE_NUMBER` reach OMX correctly
   shaped and that OMX accepts a well-formed sender. The operator still owes
   the real registered business address in the **private** inventory before
   a live shipment can succeed; nothing here should be read as that address
   being settled.
2. **The Estonian legal paragraph.** `content/legal/et/shipping.ts` carries a
   machine-translated sentence about the parcel machine method. Its own header
   records that it lacks the qualified-reader confirmation the rest of that
   `operator-approved` page has. A reviewer who reads Estonian judged the
   grammar and register sound but explicitly did not certify it.
3. **The seeds themselves, and enabling the projections.** Running
   `playbooks/openbao-seed.yml` for both `plepic-omniva` and
   `plepic-test-omniva` (two separate operator runs — see above) and adding
   both to `argocd_openbao_enabled_optional_sources` in the **private
   inventory** are operator actions. No agent took them, deliberately.
4. **A key-file name mismatch, found while writing this handover, not yet
   fixed.** `orange/scripts/openbao-admin` looks a source's key up by its
   exact `source` name (`keys_directory / item.source`), and every other
   `plepic-test` source in that file — `plepic-test-runtime-credentials`,
   `plepic-test-publishable-key`, and so on — puts `test` right after
   `plepic`. `feat/omniva-secret` followed that convention:
   `plepic-test-omniva`. The file that actually exists on disk is
   `~/app/orange/.keys/plepic-omniva-test` — `test` at the *end*. Neither
   this agent nor the one before it touched that directory (out of scope by
   the standing constraint), so the mismatch was not created here and was
   not fixed here either. As written, `playbooks/openbao-seed.yml` will not
   find the test key under the name it looks for. Before the first seed
   attempt: either rename the key file to `plepic-test-omniva` (matching
   every other test source in `openbao-admin`), or rename the source in
   `OMNIVA_SECRET_IMPORTS` to `plepic-omniva-test` (breaking that
   convention). This handover does not choose between them — that is an
   operator call, not an agent one.

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
