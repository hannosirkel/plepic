# Transactional Email Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver concise, responsive order-confirmation, shipment, and delivery emails with canonical Medusa data and environment-specific Plepic sender names.

**Architecture:** Adapt Postmark's MIT-licensed receipt structure into a dependency-free shared TypeScript email shell. Typed renderers produce HTML and plain text, Medusa subscribers resolve canonical order data from lifecycle event IDs, and the SMTP provider applies a runtime-supplied display name while preserving the authenticated envelope sender. A dependent GitOps change supplies `SMTP_FROM_NAME` before the application image begins requiring it.

**Tech Stack:** TypeScript 5.9, Medusa 2.18 Query Graph/subscribers/notification module, Nodemailer 9, Vitest 4, table-based responsive HTML email, Kubernetes/Kustomize, Ruby manifest-contract tests.

**Spec:** `docs/superpowers/specs/2026-08-21-transactional-email-lifecycle-design.md`

## Global Constraints

- Keep the existing Medusa notification module and authenticated STARTTLS SMTP flow; do not add an email service, template engine, or runtime dependency.
- Base the shared HTML structure on ActiveCampaign/Postmark's MIT-licensed receipt template and retain its copyright/license notice.
- Use only `#151b46`, `#f7f4ec`, `#ffffff`, and `#d9d4c6` from the Plepic publisher palette, system fonts, inline email CSS, and no remote images.
- Render all dynamic strings through HTML escaping and all money only after finite-number validation.
- Item and shipping amounts are excluding VAT; show VAT only when positive; show final total including VAT.
- Honor Medusa `no_notification: true` before querying or sending.
- No credential, private hostname, customer address, or other environment value may enter the Plepic repository.
- `SMTP_FROM_NAME` is required runtime configuration: `Plepic Games` live and `Plepic Games Test` test.
- The `hannosirkel/deploys` PR must merge and Argo must apply it before deploying the Plepic application commit that requires `SMTP_FROM_NAME`.
- Use `apply_patch` for edits, keep `.githooks/pre-commit` enabled, and never bypass gitleaks.
- Run `npm ci && bash scripts/validate` in Plepic and the documented Plepic manifest validation in Deploys before handoff.

---

### Task 1: Supply the sender display name through GitOps

**Files:**
- Modify: `/home/hanno/app/deploys/plepic/tests/manifests.sh`
- Modify: `/home/hanno/app/deploys/plepic/base/backend.yaml`
- Modify: `/home/hanno/app/deploys/plepic/base/worker.yaml`
- Modify: `/home/hanno/app/deploys/plepic/base/predeploy-job.yaml`
- Modify: `/home/hanno/app/deploys/plepic/base/import-job.yaml`
- Modify: `/home/hanno/app/deploys/plepic/overlays/test/kustomization.yaml`

**Interfaces:**
- Consumes: the existing backend-image workload census and `env_value` helper in `plepic/tests/manifests.sh`.
- Produces: every live backend-image role receives `SMTP_FROM_NAME=Plepic Games`; every test role receives `SMTP_FROM_NAME=Plepic Games Test`.

- [ ] **Step 1: Start a clean Deploys feature branch from current `origin/main`**

Run:

```bash
git -C /home/hanno/app/deploys status --short --branch
git -C /home/hanno/app/deploys fetch origin
git -C /home/hanno/app/deploys switch -c feat/plepic-smtp-from-name origin/main
```

Expected: the original worktree is clean and the new branch starts at current `origin/main`, including any automated test-digest promotions.

- [ ] **Step 2: Write the failing manifest contract**

Add `SMTP_FROM_NAME` to `BACKEND_IMAGE_REQUIRED_ENVIRONMENT`. In the existing `database_workloads.each` loop, add:

```ruby
expected_from_name = environment == 'test' ? 'Plepic Games Test' : 'Plepic Games'
raise 'backend-family SMTP sender name mismatch' unless
  env_value(container, 'SMTP_FROM_NAME') == expected_from_name
```

This assertion must run for backend, worker, predeploy, and catalogue-import in both overlays.

- [ ] **Step 3: Run the contract and observe the intended failure**

Run:

```bash
bash /home/hanno/app/deploys/plepic/tests/manifests.sh
```

Expected: FAIL because `SMTP_FROM_NAME` is absent or does not equal the environment's required name.

- [ ] **Step 4: Add the live/base value to every backend-image role**

Add this adjacent to `SMTP_ENVELOPE_FROM` in all four base manifests:

```yaml
- {name: SMTP_FROM_NAME, value: Plepic Games}
```

Do not put the value in a Secret: it is a public display label, not a credential.

- [ ] **Step 5: Override the value for every test backend-image role**

In each test-overlay env replacement for backend, worker, predeploy, and catalogue-import, add:

```yaml
- {name: SMTP_FROM_NAME, value: Plepic Games Test}
```

The test patches replace env arrays, so verify all four rendered resources rather than assuming the base value survives.

- [ ] **Step 6: Run Deploys validation**

Run:

```bash
bash /home/hanno/app/deploys/plepic/tests/manifests.sh
kubectl kustomize /home/hanno/app/deploys/plepic/overlays/live >/dev/null
kubectl kustomize /home/hanno/app/deploys/plepic/overlays/test >/dev/null
```

Expected: all commands exit 0.

- [ ] **Step 7: Review and commit the GitOps change**

Run:

```bash
git -C /home/hanno/app/deploys diff --check
git -C /home/hanno/app/deploys diff -- plepic
git -C /home/hanno/app/deploys status --short
git -C /home/hanno/app/deploys add plepic
git -C /home/hanno/app/deploys commit -m "feat(plepic): configure SMTP sender names"
```

Expected: only the six listed Deploys files are committed.

- [ ] **Step 8: Push and open the blocking GitOps PR**

Run:

```bash
git -C /home/hanno/app/deploys push -u origin feat/plepic-smtp-from-name
gh pr create --repo hannosirkel/deploys --base main --head feat/plepic-smtp-from-name --title "feat(plepic): configure SMTP sender names" --body "Adds the runtime SMTP display name required by the Plepic transactional-email image. This PR must merge and sync before Plepic PR #36 is redeployed."
```

Expected: a new Deploys PR URL. Record it as the first PR the operator must merge; do not merge it without explicit authorization.

---

### Task 2: Apply a validated visible sender name without changing SMTP authorization

**Files:**
- Modify: `backend/src/config/runtime.ts`
- Modify: `backend/src/notifications/smtp.ts`
- Modify: `backend/tests/runtime-config.test.ts`
- Modify: `backend/tests/order-confirmation.test.ts`
- Modify: test environment fixtures containing `SMTP_ENVELOPE_FROM`, found with `rg -l 'SMTP_ENVELOPE_FROM' backend/tests`

**Interfaces:**
- Consumes: deployment-provided `SMTP_FROM_NAME` and existing `SMTP_ENVELOPE_FROM`.
- Produces: `SmtpOptions.fromName: string`; visible Nodemailer `from: { name, address }`; explicit `envelope: { from, to }`.

- [ ] **Step 1: Add failing runtime configuration tests**

Extend the canonical valid environment with:

```ts
SMTP_FROM_NAME: "Plepic Games Test",
```

Assert:

```ts
expect(config.smtp).toMatchObject({
  fromName: "Plepic Games Test",
  envelopeFrom: "orders@example.test",
});
```

Add table cases proving missing, empty, whitespace-only, and `"Plepic Games\nBcc"` values throw an error naming `SMTP_FROM_NAME`.

- [ ] **Step 2: Add the failing SMTP envelope/header assertion**

Extend `smtpOptions` with `fromName: "Plepic Games Test"` and require:

```ts
expect(sendMail).toHaveBeenCalledWith({
  from: { name: "Plepic Games Test", address: "orders@example.test" },
  envelope: { from: "orders@example.test", to: "customer@example.test" },
  to: "customer@example.test",
  subject: "Order #1042 confirmed",
  text: "Plain",
  html: "<p>HTML</p>",
});
```

- [ ] **Step 3: Run focused tests and observe the intended failures**

Run:

```bash
npx vitest run backend/tests/runtime-config.test.ts backend/tests/order-confirmation.test.ts
```

Expected: FAIL because `SMTP_FROM_NAME` is not parsed and Nodemailer receives a bare address without an explicit envelope.

- [ ] **Step 4: Implement runtime parsing**

Add `fromName` to `BackendRuntimeConfig["smtp"]` and `SmtpOptions`, add `SMTP_FROM_NAME` to required variables, and parse it with the existing single-line validator:

```ts
fromName: requireSingleLineValue(environment, "SMTP_FROM_NAME"),
```

Because the variable is also in the required list, empty values fail through `requireEnvironmentValue`; multiline values fail through `requireSingleLineValue`.

- [ ] **Step 5: Implement the structured header and explicit envelope**

Store both values in `SmtpSender` and send:

```ts
await this.#transport.sendMail({
  from: { name: this.#fromName, address: this.#envelopeFrom },
  envelope: { from: this.#envelopeFrom, to: message.to },
  ...message,
});
```

Keep transport host, port 587, STARTTLS, authentication, TLS server name, certificate verification, and error redaction unchanged.

- [ ] **Step 6: Update every backend test environment fixture**

For each file returned by `rg -l 'SMTP_ENVELOPE_FROM' backend/tests`, add a synthetic `SMTP_FROM_NAME`, normally `Plepic Games Test`. Do not weaken tests by making the new variable optional.

- [ ] **Step 7: Run focused tests and type-check**

Run:

```bash
npx vitest run backend/tests/runtime-config.test.ts backend/tests/order-confirmation.test.ts backend/tests/mail-submission-target.test.ts
npm run typecheck --workspace @plepic/backend
```

Expected: PASS.

- [ ] **Step 8: Commit the sender identity change**

Run:

```bash
git add backend/src/config/runtime.ts backend/src/notifications/smtp.ts backend/tests
git commit -m "feat: name transactional email senders"
```

---

### Task 3: Build the shared email shell and invoice-like order template

**Files:**
- Create: `backend/src/notifications/transactional-email.ts`
- Modify: `backend/src/notifications/order-confirmation.ts`
- Modify: `backend/tests/order-confirmation.test.ts`
- Create: `backend/src/notifications/LICENSE.postmark-templates`

**Interfaces:**
- Produces: `EmailContent`, `formatMoney`, `escapeHtml`, `renderTransactionalEmail`; `renderOrderConfirmation(order: OrderConfirmationOrder): EmailContent`.
- Consumes later: shipment and delivery renderers use the same shell and escaping functions.

- [ ] **Step 1: Replace the old prose expectations with failing invoice expectations**

Define a fixture with two items, positive VAT, shipping, and a full address. Assert:

```ts
expect(rendered.subject).toBe("Order #1042 confirmed");
expect(rendered.text).toContain("Product\tQty\tUnit price\tAmount");
expect(rendered.text).toContain("Moonrock & <Ore>\t2\t€10.00 EUR\t€20.00 EUR");
expect(rendered.text).toContain("Products\t€20.00 EUR");
expect(rendered.text).toContain("Shipping\t€5.00 EUR");
expect(rendered.text).toContain("VAT\t€5.50 EUR");
expect(rendered.text).toContain("Total\t€30.50 EUR");
expect(rendered.text).toContain("Ada Lovelace\nPlepic Games OÜ\nPihlaka tn 2\n75301 Jüri\nEE");
expect(rendered.text).not.toContain("withdraw");
expect(rendered.html).toContain("Order #1042");
expect(rendered.html).toContain("Moonrock &amp; &lt;Ore&gt;");
```

Add a zero-VAT fixture and assert neither HTML nor plain text contains a VAT row. Assert hostile item/address strings are escaped and do not create tags.

- [ ] **Step 2: Run the renderer test and observe the intended failure**

Run:

```bash
npx vitest run backend/tests/order-confirmation.test.ts -t "order confirmation templates"
```

Expected: FAIL because the renderer still emits the withdrawal prose and lacks invoice/address rows.

- [ ] **Step 3: Implement the shared primitives**

Create these interfaces/functions in `transactional-email.ts`:

```ts
export interface EmailContent {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export function escapeHtml(value: string): string;
export function formatMoney(value: number, currencyCode: string): string;
export function renderTransactionalEmail(input: {
  readonly subject: string;
  readonly preheader: string;
  readonly status: string;
  readonly orderNumber: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
}): EmailContent;
```

`formatMoney` must reject non-finite values and preserve the current `en-IE`/upper-case currency behavior. `renderTransactionalEmail` must escape subject/status/order number itself; it accepts `bodyHtml` only from the typed renderers, never from event input.

- [ ] **Step 4: Implement the typed invoice renderer**

Use this data boundary:

```ts
export interface OrderConfirmationOrder {
  readonly displayId: number | string;
  readonly currencyCode: string;
  readonly itemSubtotal: number;
  readonly shippingSubtotal: number;
  readonly taxTotal: number;
  readonly total: number;
  readonly items: readonly {
    readonly title: string;
    readonly quantity: number;
    readonly unitPrice: number;
    readonly subtotal: number;
  }[];
  readonly shippingAddress: readonly string[];
}

export function renderOrderConfirmation(order: OrderConfirmationOrder): EmailContent;
```

Build conservative nested tables with inline styles. Omit the VAT `<tr>` and text line when `taxTotal === 0`; reject negative/non-finite totals, empty items, empty address, blank titles, and non-positive quantities. Remove `ORDER_CONFIRMATION_LEGAL_SECTIONS` and all legal interpolation from this file.

- [ ] **Step 5: Retain the upstream license**

Copy the full MIT license from `https://github.com/activecampaign/postmark-templates/blob/main/LICENSE` into `backend/src/notifications/LICENSE.postmark-templates`, preserving the upstream copyright. Add a short source comment at the shared renderer header naming the adapted Postmark receipt template and local license file.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx vitest run backend/tests/order-confirmation.test.ts -t "order confirmation templates"
npm run typecheck --workspace @plepic/backend
```

Expected: PASS, with no withdrawal prose remaining in rendered content.

- [ ] **Step 7: Commit the renderer**

Run:

```bash
git add backend/src/notifications/transactional-email.ts backend/src/notifications/order-confirmation.ts backend/src/notifications/LICENSE.postmark-templates backend/tests/order-confirmation.test.ts
git commit -m "feat: render concise order invoice emails"
```

---

### Task 4: Feed authoritative order totals and address data into the invoice

**Files:**
- Modify: `backend/src/subscribers/order-placed.ts`
- Modify: `backend/tests/order-confirmation.test.ts`

**Interfaces:**
- Consumes: `renderOrderConfirmation(OrderConfirmationOrder)` from Task 3.
- Produces: canonical validated order DTO derived only from Medusa Query Graph.

- [ ] **Step 1: Write the failing subscriber query/normalization test**

Require the Query Graph field list to include:

```ts
[
  "id", "display_id", "email", "currency_code",
  "item_subtotal", "shipping_subtotal", "tax_total", "total",
  "items.id", "items.title", "items.unit_price", "items.subtotal",
  "items.detail.quantity",
  "shipping_address.first_name", "shipping_address.last_name",
  "shipping_address.company", "shipping_address.address_1",
  "shipping_address.address_2", "shipping_address.postal_code",
  "shipping_address.city", "shipping_address.province",
  "shipping_address.country_code",
]
```

Provide Query Graph `BigNumber` values for every monetary field and quantity. Assert `createNotifications` receives content from the new normalized renderer and retains:

```ts
{
  trigger_type: "order.placed",
  resource_id: "order_123",
  resource_type: "order",
  idempotency_key: "order-confirmation:order_123",
}
```

- [ ] **Step 2: Add failing malformed-data cases**

Use table tests for null/non-finite totals, null item subtotal/unit price/quantity, absent shipping address, and an address containing no printable line. Assert notification creation is not called.

- [ ] **Step 3: Run subscriber tests and observe the intended failures**

Run:

```bash
npx vitest run backend/tests/order-confirmation.test.ts -t "order.placed subscriber"
```

Expected: FAIL because the old subscriber queries only total/title/quantity and passes the old renderer shape.

- [ ] **Step 4: Implement canonical normalization**

Keep `finiteNumber` based on Medusa `tryConvertToNumber`. Add a helper which trims non-empty address values and combines postal code/city without emitting blank lines. Validate all required fields before rendering; do not recompute Medusa's line or order totals.

Call:

```ts
const content = renderOrderConfirmation({
  displayId: order.display_id,
  currencyCode: order.currency_code,
  itemSubtotal,
  shippingSubtotal,
  taxTotal,
  total,
  items,
  shippingAddress,
});
```

Remove the import and call to `readOrderConfirmationLegalConfig`; leave the broader runtime legal configuration unchanged because removing that deployment contract is outside this task.

- [ ] **Step 5: Run focused tests and type-check**

Run:

```bash
npx vitest run backend/tests/order-confirmation.test.ts
npm run typecheck --workspace @plepic/backend
```

Expected: PASS.

- [ ] **Step 6: Commit the canonical order data change**

Run:

```bash
git add backend/src/subscribers/order-placed.ts backend/tests/order-confirmation.test.ts
git commit -m "fix: populate order invoice details"
```

---

### Task 5: Add shipment and delivery templates and subscribers

**Files:**
- Create: `backend/src/notifications/fulfillment-status.ts`
- Create: `backend/src/fulfillment/send-status-notification.ts`
- Create: `backend/src/subscribers/shipment-created.ts`
- Create: `backend/src/subscribers/delivery-created.ts`
- Create: `backend/tests/fulfillment-notifications.test.ts`

**Interfaces:**
- Consumes: `EmailContent`, `escapeHtml`, and `renderTransactionalEmail` from Task 3; Medusa event data `{ id: string; no_notification?: boolean }`.
- Produces: `renderShipmentNotification`, `renderDeliveryNotification`, `FulfillmentEvent`, and `sendFulfillmentStatusNotification` used by the two auto-loaded subscriber entry points.

- [ ] **Step 1: Write failing renderer tests**

Require these public interfaces:

```ts
export const SHIPMENT_NOTIFICATION_TEMPLATE = "shipment-notification";
export const DELIVERY_NOTIFICATION_TEMPLATE = "delivery-notification";

export function renderShipmentNotification(input: {
  readonly displayId: number | string;
  readonly tracking: readonly { number?: string; url?: string }[];
}): EmailContent;

export function renderDeliveryNotification(input: {
  readonly displayId: number | string;
}): EmailContent;
```

Assert the shipment subject/status, multiple tracking numbers, linked HTTPS/HTTP URLs, number-only output for `javascript:`/malformed URLs, and complete omission of the tracking section when empty. Assert delivery contains the exact subject/status and no shipment prose.

- [ ] **Step 2: Write failing subscriber tests**

Import both default subscribers and configs. Assert:

```ts
expect(shipmentConfig).toEqual({ event: "shipment.created" });
expect(deliveryConfig).toEqual({ event: "delivery.created" });
```

For `no_notification: true`, assert `container.resolve` is never called. For enabled events, mock Query Graph to return a fulfillment with `order.id`, `order.display_id`, `order.email`, and labels. Assert the notification payloads contain:

```ts
// Shipment
{
  template: "shipment-notification",
  trigger_type: "shipment.created",
  resource_id: "ful_123",
  resource_type: "fulfillment",
  idempotency_key: "shipment-notification:ful_123",
}

// Delivery
{
  template: "delivery-notification",
  trigger_type: "delivery.created",
  resource_id: "ful_123",
  resource_type: "fulfillment",
  idempotency_key: "delivery-notification:ful_123",
}
```

Add refusal cases for blank event ID, no graph result, absent linked order, blank email, and absent display ID; notification creation must remain uncalled.

- [ ] **Step 3: Run the new test and observe the intended failure**

Run:

```bash
npx vitest run backend/tests/fulfillment-notifications.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement the two lifecycle renderers**

Use the shared shell. Trim tracking values. Parse URLs with `new URL`; render an anchor only for `http:` or `https:`. Escape link text and attribute values. Invalid URLs are omitted as links without suppressing a valid tracking number. Do not add prose beyond order number, status, and tracking labels.

- [ ] **Step 5: Implement the shared event handler**

Define:

```ts
export interface FulfillmentEvent {
  readonly id: string;
  readonly no_notification?: boolean;
}

export async function sendFulfillmentStatusNotification(
  args: SubscriberArgs<FulfillmentEvent>,
  kind: "shipment" | "delivery",
): Promise<void>;
```

Return before container access when opted out. Query entity `fulfillment`, filter by the event ID, and request `id`, `order.id`, `order.display_id`, `order.email`; request `labels.tracking_number` and `labels.tracking_url` for shipment. Validate before calling the renderer and notification module. Throw fixed, non-PII error messages.

- [ ] **Step 6: Implement the auto-loaded subscriber entry points**

Each file should contain only its default adapter and config, for example:

```ts
export default async function shipmentCreated(args: SubscriberArgs<FulfillmentEvent>) {
  await sendFulfillmentStatusNotification(args, "shipment");
}

export const config: SubscriberConfig = { event: "shipment.created" };
```

Use the corresponding delivery event in the second file.

- [ ] **Step 7: Run focused tests and type-check**

Run:

```bash
npx vitest run backend/tests/fulfillment-notifications.test.ts backend/tests/order-confirmation.test.ts
npm run typecheck --workspace @plepic/backend
```

Expected: PASS.

- [ ] **Step 8: Commit lifecycle notifications**

Run:

```bash
git add backend/src/notifications/fulfillment-status.ts backend/src/fulfillment/send-status-notification.ts backend/src/subscribers/shipment-created.ts backend/src/subscribers/delivery-created.ts backend/tests/fulfillment-notifications.test.ts
git commit -m "feat: send shipment and delivery emails"
```

---

### Task 6: Verify rendering, validate both repositories, and publish safely

**Files:**
- Modify if evidence requires: tests/files listed in Tasks 1–5 only
- Modify: PR #36 description

**Interfaces:**
- Consumes: validated Deploys PR and all Plepic commits.
- Produces: review-ready PRs, explicit merge order, and a verified test rollout after the GitOps prerequisite is merged.

- [ ] **Step 1: Render representative HTML for visual inspection**

Build the backend, then use `apply_patch` to create `/tmp/render-plepic-email-previews.mjs` with this content:

```js
import { writeFile } from "node:fs/promises";
import { renderOrderConfirmation } from "/home/hanno/app/plepic/backend/.medusa/server/src/notifications/order-confirmation.js";
import { renderShipmentNotification, renderDeliveryNotification } from "/home/hanno/app/plepic/backend/.medusa/server/src/notifications/fulfillment-status.js";

const order = renderOrderConfirmation({
  displayId: 1042,
  currencyCode: "eur",
  itemSubtotal: 35,
  shippingSubtotal: 5,
  taxTotal: 8.8,
  total: 48.8,
  items: [
    { title: "Lunar Base", quantity: 2, unitPrice: 15, subtotal: 30 },
    { title: "Moonrock & <Ore>", quantity: 1, unitPrice: 5, subtotal: 5 },
  ],
  shippingAddress: ["Ada Lovelace", "Plepic Games OÜ", "Pihlaka tn 2", "75301 Jüri", "EE"],
});
const shipment = renderShipmentNotification({
  displayId: 1042,
  tracking: [
    { number: "TRACK-ONE", url: "https://carrier.example/track/TRACK-ONE" },
    { number: "TRACK-TWO", url: "http://carrier.example/track/TRACK-TWO" },
  ],
});
const delivery = renderDeliveryNotification({ displayId: 1042 });

await Promise.all([
  writeFile("/tmp/plepic-order-confirmation.html", order.html),
  writeFile("/tmp/plepic-shipment.html", shipment.html),
  writeFile("/tmp/plepic-delivery.html", delivery.html),
]);
```

Run:

```bash
npm run build --workspace @plepic/backend
node /tmp/render-plepic-email-previews.mjs
npx playwright screenshot --viewport-size=600,900 file:///tmp/plepic-order-confirmation.html /tmp/plepic-order-600.png
npx playwright screenshot --viewport-size=360,800 file:///tmp/plepic-order-confirmation.html /tmp/plepic-order-360.png
npx playwright screenshot --viewport-size=360,800 file:///tmp/plepic-shipment.html /tmp/plepic-shipment-360.png
npx playwright screenshot --viewport-size=360,800 file:///tmp/plepic-delivery.html /tmp/plepic-delivery-360.png
```

Inspect all four PNGs with the image-viewing tool and verify:

```text
no horizontal overflow
readable item columns at 360px
VAT row present only in the VAT fixture
tracking links visibly distinct
no withdrawal prose
no unescaped fixture markup
```

If a visual defect is found, first add a focused structural regression assertion, watch it fail, then make the smallest renderer correction.

- [ ] **Step 2: Run the canonical Plepic validation from a fresh install**

Run:

```bash
npm ci
bash scripts/validate
```

Expected: lint, root/storefront/backend type-checks, builds, and all tests pass.

- [ ] **Step 3: Re-run the canonical Deploys validation on its feature branch**

Run:

```bash
bash /home/hanno/app/deploys/plepic/tests/manifests.sh
kubectl kustomize /home/hanno/app/deploys/plepic/overlays/live >/dev/null
kubectl kustomize /home/hanno/app/deploys/plepic/overlays/test >/dev/null
```

Expected: PASS.

- [ ] **Step 4: Perform final diff/history and secret review**

Run:

```bash
git diff --check origin/feat/stripe-payment-methods...HEAD
git diff --stat origin/feat/stripe-payment-methods...HEAD
git log --oneline origin/feat/stripe-payment-methods..HEAD
git status --short
git -C /home/hanno/app/deploys diff --check origin/main...HEAD
git -C /home/hanno/app/deploys diff --stat origin/main...HEAD
git -C /home/hanno/app/deploys log --oneline origin/main..HEAD
git -C /home/hanno/app/deploys status --short
```

Expected: only approved email/application files, the design/plan, and approved GitOps files; no secrets or unrelated user changes.

- [ ] **Step 5: Run the required code-review gate**

Use `superpowers:requesting-code-review`. Fix every Critical or Important finding test-first, then repeat focused and canonical validation affected by the fix.

- [ ] **Step 6: Push/update Plepic PR #36 without deploying yet**

Run:

```bash
git push origin feat/stripe-payment-methods
```

Update PR #36's description with the three templates, sender contract, test evidence, Postmark attribution, and the blocking Deploys PR URL. Keep it draft and keep `deploy-test` present, but do not cycle the label until the Deploys PR is merged and synced.

- [ ] **Step 7: Stop at the merge gate and notify the operator**

Report exactly:

```text
Merge first: <Deploys PR URL>
Then tell me it is merged; I will verify Argo applied SMTP_FROM_NAME before redeploying Plepic PR #36.
```

Do not merge either PR and do not deploy the new required-config image before this gate clears.

- [ ] **Step 8: After operator confirms the Deploys PR merged, verify configuration landed**

Check Argo reports `Synced Healthy Succeeded`, then inspect only presence and exact non-secret display-name values in backend, worker, predeploy, and catalogue-import rendered pod/job specs. Do not print SMTP credentials.

- [ ] **Step 9: Trigger and watch Plepic test deployment**

After all PR checks pass, remove and re-add `deploy-test` through GitHub's REST label endpoint, watch the exact-head Deploy Test workflow, then verify Argo sync/health and backend, worker, and storefront rollouts.

- [ ] **Step 10: Verify subscriber loading and controlled delivery**

Confirm worker startup loads `order.placed`, `shipment.created`, and `delivery.created`. Use a fresh test order/fulfillment or obtain explicit approval to replay events. For each enabled event, confirm one successful notification record and mail-host acceptance while outputting only order/fulfillment IDs, event names, statuses, and counts—never recipient addresses or message content.

- [ ] **Step 11: Final handoff**

Report both PR URLs, commit IDs, merge/deployment order, validation totals, deployed Argo/workload status, which controlled emails were accepted, and any remaining mail-host restriction required for real recipients.
