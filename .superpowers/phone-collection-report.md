# Phone collection for Omniva deliveries — report

Branch `feat/omniva-shipping`, worktree
`/home/hanno/app/.worktrees/plepic/omniva-shipping`, starting head `19fb687`.

## What the operator actually wants (final state, after two mid-task reversals)

The task arrived in three layers, in order:

1. **Original brief:** collect a phone for every destination, require one on
   every `PARCEL_MACHINE` registration, send it as `contactMobile` for a
   locker and `contactPhone` for a courier.
2. **First correction** (evidence: `contactEmail`-only locker → `200 OK`;
   `contactMobile` type-validates and refuses a Baltic fixed line;
   `contactPhone` does not): added detail to (1) but kept the shape of it.
3. **Second correction, the operator overruling both of the above directly**
   — *"Make the phone field optional. Shipments work without phone and
   email only, Omniva sends parcel codes there too."* — with live evidence
   that a `PARCEL_MACHINE` registration with **no phone at all** succeeds
   (`contactEmail` alone), and that a courier order outside EE/LV/LT/FI with
   no phone genuinely fails (`contact.number.must.exist` on both
   `contactPhone` and `contactMobile`).

The implementation below is layer 3. Layers 1 and 2 were implemented, then
fully reverted (code and tests) rather than left as dead branches or
commented-out history — the working tree and the commit below reflect only
the final policy.

## Final policy implemented

1. **The phone field is shown for every destination**, not only outside
   Estonia, Finland, Lithuania and Latvia. This is the actual fix for the
   operator's original complaint: a buyer choosing an Omniva parcel machine
   (offered only in EE/LV/LT) was never even shown the field, so they had no
   way to volunteer a number for Omniva's notice.
2. **The phone stays optional exactly where it already was** — Estonia,
   Finland, Lithuania, Latvia — and mandatory everywhere else, unchanged from
   before this task. `PHONE_OPTIONAL_COUNTRY_CODES` and its cross-boundary
   pin (`storefront/mock/shipping.json`'s `phoneOptionalCountries` ↔
   `backend/src/commerce/shipping-model.ts`) are untouched.
3. **Format is validated whenever anything is typed, required or not.** A
   buyer in a phone-optional country who volunteers a number still gets the
   `+`-prefix check, so a malformed voluntary value is caught at the form
   rather than reaching OMX unchecked at fulfilment.
4. **The wire field stays `contactPhone`, in both delivery channels.** No
   `contactMobile` split. `contactEmail` is always sent and is what OMX reads
   as the fallback for a phoneless locker registration.
5. **No new refusal for a phoneless `PARCEL_MACHINE` registration.** OMX
   itself accepts one; this file does not add a policy refusal on top of
   OMX's own rule.
6. **Copy updated** (`content/shop.ts`) to state both halves honestly:
   required outside the four, optional inside them, and what it is for.

## Commit

Single commit on top of `19fb687`:

```
fix: collect a phone for every destination, not just where OMX requires one
```

Files changed:
- `backend/src/modules/omniva/shipment.ts` — docstring only; the wire
  behaviour (`contactPhone`, no channel split, no new refusal) is
  byte-identical to what the branch already did. The header now documents
  *why*, citing the operator's override and the three live probes it rests
  on, so a future reader does not re-add the `contactMobile` split or the
  refusal from the manual's `contactMobile` conditions alone.
- `backend/tests/omniva-shipment.test.ts` — one test renamed/clarified
  ("registers an Estonian parcel machine … with no phone at all"), one new
  test added ("sends a volunteered parcel-machine phone as contactPhone,
  never contactMobile"), one new test added ("does not refuse a parcel
  machine registration with no phone at all").
- `storefront/src/components/shop/checkout-address.ts` — `validate()` now
  checks phone shape unconditionally and presence only where required;
  `isPhoneComplete`'s docstring corrected to match. Field header expanded
  with the "always shown, not always required" reasoning.
- `storefront/src/components/shop/CheckoutPageContent.tsx` — the phone field
  is rendered unconditionally; `required` follows `phoneRequiredNow`
  (renamed from `phoneNeeded`, which used to mean "shown" and now would be
  misleading); removed the effect that used to clear the phone value when a
  country stopped requiring it (no longer meaningful — the field is never
  hidden, so nothing needs discarding out from under a buyer).
- `content/shop.ts` — phone field's hint rewritten to state both halves
  ("Required outside Estonia, Finland, Lithuania and Latvia; optional
  there. Omniva uses it, or your email, to send delivery and pickup
  notices."); docstrings on `PhoneFieldCopy` and the `phone` entry updated.
- `storefront/tests/checkout-address.test.ts` — two new tests for the
  unconditional shape check (`still flags a malformed phone in a country OMX
  does not require one for`, `accepts a +-prefixed voluntary phone in a
  phone-optional country`); `isPhoneComplete` describe block split into
  three cases (empty/required-not-given, malformed-but-optional,
  well-formed-and-optional) since the old single test's premise (garbage is
  always fine where not required) is no longer true.
- `storefront/tests/shop-pages.test.tsx` — "does not appear at all for any
  of the four countries OMX exempts" renamed to "appears, but is not
  required, …" and rewritten to assert presence without `required`; the
  loading-state disabled-input count updated 6 → 7 (the phone field now
  always renders, including with no country chosen).

`backend/tests/omniva-create-fulfillment.test.ts` and
`storefront/mock/shipping.json` are **untouched** — `git diff --stat` shows
no changes to either. The former's `ORDER.phone` briefly changed to a
mobile during the reverted layer-1 implementation and was restored to its
original `undefined`, confirmed by `git diff` showing zero lines. The
`PHONE_OPTIONAL_COUNTRY_CODES` cross-boundary pin was never touched in any
layer, per the operator's explicit instruction in the second correction that
point 4 of the original brief ("does it become dead weight?") no longer
applies once the phone stays genuinely conditional.

## Killability evidence

Each new/changed assertion was verified by reverting the production change
it pins, confirming the *right* test fails (and no others unexpectedly), then
restoring from a backup copy and re-running to confirm green again.

1. **`checkout-address.ts` unconditional shape check.** Reverted `validate()`
   to the old "only check shape where required" form. Result:
   `still flags a malformed phone in a country OMX does not require one for`
   and `is false where OMX does not require a phone but a malformed one was
   typed anyway` failed (2 failed, 22 passed) — exactly the two tests this
   pins. Restored; 24/24 pass.
2. **`CheckoutPageContent.tsx` unconditional rendering.** Reintroduced the
   `phoneRequiredNow ? (...) : null` wrapper. Result: `appears, but is not
   required, for any of the four countries OMX exempts` and `makes the order
   button busy and renames it while an order is being placed` (disabled-count
   6 vs 7) both failed (2 failed, 121 passed). Restored; 123/123 pass.
3. **`shipment.ts` "no refusal for a phoneless locker" and "always
   contactPhone".** Reintroduced the retracted refusal and the
   `contactMobile`/`contactPhone` channel split. Result: with both
   reintroduced, `does not refuse a parcel machine registration with no
   phone at all` failed along with three other default-input tests that now
   tripped the refusal (8 failed, 9 passed); with only the split
   reintroduced (refusal removed again), `sends a volunteered parcel-machine
   phone as contactPhone, never contactMobile` failed alone (1 failed, 16
   passed). Restored from backup; 17/17 pass, and the paired
   `omniva-create-fulfillment.test.ts` still passes at 14/14.

## Verification

- `bash scripts/validate` — green. shellcheck, eslint, three typechecks,
  real `medusa build` (backend and Admin frontend), 107 test files / 3257
  tests. Run twice more after later edits (a comment-only fix and the
  killability probes' restoration); green both times.
- `bash scripts/store-smoke` — ran with
  `DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`. Green: 1 test
  file, 6 tests, "store smoke: the catalogue answers correctly on a live
  Medusa". Real Postgres, Redis, `medusa build`, the four predeploy
  commands.

## Concerns for the operator to weigh

- **The live evidence behind this final policy was relayed by the
  coordinator, not fetched by this session.** As with the prior fix report
  on this branch, I did not call `test-omx.omniva.eu` myself; I trusted the
  four response summaries given (EE locker + email only → `200 OK`
  `CC405869806EE`; DE courier + no phone → `200 ERROR`
  `contact.number.must.exist`; US courier + no phone → same). The operator's
  own note says they will verify against the real API afterward — this is
  exactly the case that check exists for.
- **No new automated coverage for the OMX-side courier refusal
  (`contact.number.must.exist` outside the four countries).** That refusal
  already existed and is already covered by
  `refuses a destination outside EE, LV, LT and FI with no phone number` in
  `omniva-shipment.test.ts`; the new evidence corroborates it but nothing
  new was added because nothing changed there.
- **`docs/working/2026-08-26-omniva-shipping-handover.md` is not updated.**
  It predates this task and describes the branch as "complete and unmerged
  by the operator's decision" as of 2026-08-28. This report is a supplement,
  not a rewrite of that handover; if this branch is revisited again, the
  handover's own two-country-set section should be read alongside this
  report rather than instead of it.
