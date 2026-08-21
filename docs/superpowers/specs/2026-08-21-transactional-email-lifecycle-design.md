# Transactional email lifecycle design

## Objective

Replace the current prose-heavy order confirmation with a concise,
invoice-like message and add the missing shipment and delivery emails. All
three messages use one responsive, email-client-compatible visual system and
plain-text equivalents. The visible sender identifies Plepic Games and makes
the test environment unmistakable.

## Confirmed root cause

Medusa 2.18 emits `shipment.created` after an administrator creates a shipment
and `delivery.created` after an administrator marks a fulfillment delivered.
Both events include the fulfillment ID and the administrator's
`no_notification` choice. The application currently registers only an
`order.placed` subscriber, so selecting **Send notification** has no consumer
for either fulfillment lifecycle event. Test worker logs confirm that only
`order.placed` is processed.

## Template foundation

Use the MIT-licensed Postmark transactional receipt template as the foundation
for a small, shared TypeScript renderer. Postmark's receipt is already a
responsive, table-based transactional layout tested across common desktop,
mobile, and webmail clients. Adapt only the structural patterns needed here:

- a hidden preheader;
- a centered, single-column container;
- a compact header and status heading;
- an invoice-compatible data table;
- inline, conservative email CSS.

The Plepic version uses the publisher palette: navy `#151b46`, off-white
`#f7f4ec`, white `#ffffff`, and sand `#d9d4c6`. It uses system fonts rather
than webfonts or externally hosted images. Dynamic values are HTML-escaped,
and every template has an independently useful plain-text representation.

Keep the upstream copyright and MIT license notice in the repository beside
the adapted renderer. No Postmark service, remote template store, template
engine, or new runtime dependency is introduced.

Source: https://github.com/activecampaign/postmark-templates

## Templates

### Order confirmation

Subject: `Order #<display ID> confirmed`

The HTML and plain-text messages contain:

1. order number and **Confirmed** status;
2. an item table with product, quantity, unit price excluding VAT, and line
   amount excluding VAT;
3. products subtotal excluding VAT;
4. shipping cost excluding VAT;
5. a VAT row only when the order tax total is greater than zero;
6. the final total including any VAT;
7. the shipping address.

The item line amount comes from Medusa's post-discount item subtotal, not from
recomputing quantity times unit price. The products, shipping, VAT, and final
total use Medusa's authoritative order totals. The unit price is the stored
tax-exclusive unit price. All numeric values must convert to finite numbers.
The renderer refuses incomplete or inconsistent required data rather than
guessing. The existing withdrawal, model-form, and returns prose is removed
entirely.

Shipping addresses are formatted from non-empty values in this order:

- first and last name;
- company;
- address lines 1 and 2;
- postal code and city;
- province;
- upper-case country code.

### Shipment notification

Subject: `Order #<display ID> has shipped`

The message contains the order number and **Shipped** status. When Medusa has
shipment labels, it lists each tracking number and its tracking link. A link
is rendered only when its URL uses `http:` or `https:`. An invalid or absent
URL is never interpolated into `href`; a valid tracking number remains visible
as text. If no tracking data was entered, the tracking section is omitted.

### Delivery notification

Subject: `Order #<display ID> delivered`

The message contains only the order number and **Delivered** status within the
shared branded shell. It adds no marketing or explanatory prose.

## Event and notification flow

Create one subscriber for `shipment.created` and one for `delivery.created`.
Each subscriber follows this sequence:

1. Return immediately when `event.data.no_notification === true`.
2. Validate that the event contains a non-empty fulfillment ID.
3. Query the canonical Medusa fulfillment through Query Graph, following its
   order link for order ID, display ID, and customer email. The shipment query
   also requests fulfillment labels and tracking fields.
4. Validate the recipient and template data.
5. Render HTML and plain-text content.
6. Create the Medusa notification with an event-specific template name,
   trigger type, resource metadata, and idempotency key.

The idempotency keys are scoped to both event and fulfillment:

- `shipment-notification:<fulfillment ID>`;
- `delivery-notification:<fulfillment ID>`.

This permits safe event replay without sending duplicates. Missing order
linkage, recipient, display ID, or malformed required data throws a sanitized
error that remains visible in worker logs. Notification payloads and customer
data are not logged.

## Sender identity and environment configuration

Add required runtime configuration `SMTP_FROM_NAME`. Nodemailer receives a
structured visible sender and an explicit SMTP envelope:

- visible header: `{ name: SMTP_FROM_NAME, address: SMTP_ENVELOPE_FROM }`;
- envelope sender: `SMTP_ENVELOPE_FROM`;
- envelope recipient: the notification recipient.

The values remain runtime configuration and are never baked into the public
application image:

| Environment | `SMTP_FROM_NAME` | Envelope address | Visible sender |
| --- | --- | --- | --- |
| Live | `Plepic Games` | Runtime `SMTP_ENVELOPE_FROM` | Structured name/address pair |
| Test | `Plepic Games Test` | Runtime `SMTP_ENVELOPE_FROM` | Structured name/address pair |

The application validates the display name as a non-empty, single-line value
to prevent header injection. The separate `hannosirkel/deploys` repository
must supply it to every backend-image role that loads runtime configuration:
backend, worker, predeploy job, and catalogue import job.

## Repository and rollout order

This change spans two repositories:

1. `hannosirkel/deploys`: add `SMTP_FROM_NAME` to base manifests, set the live
   and test values in their overlays, and update manifest contract tests.
2. `hannosirkel/plepic`: add the required runtime field, sender behavior,
   renderers, subscribers, tests, and upstream license notice.

The `deploys` pull request must be merged and Argo must apply the environment
variable before deploying the new application image from Plepic PR #36. The
new image deliberately refuses to start without `SMTP_FROM_NAME`; reversing
the order would crash-loop the backend-image roles. Neither pull request is
merged by the coding agent without explicit operator authorization.

## Verification

### Renderer tests

- exact order-confirmation subject and essential text/HTML structure;
- multiple items and authoritative line subtotals;
- tax-exclusive item and shipping amounts;
- VAT row present for positive VAT and absent for zero VAT;
- final total and currency formatting;
- complete and partial shipping addresses;
- HTML escaping for every dynamic string;
- shipment tracking with multiple labels;
- valid HTTP/HTTPS links, invalid-link omission, and absent tracking;
- minimal delivery output;
- representative desktop and narrow viewport rendering.

### Subscriber tests

- exact `shipment.created` and `delivery.created` configurations;
- immediate skip for `no_notification: true`;
- canonical fulfillment-to-order graph queries;
- tracking propagation into the shipment renderer;
- missing event ID, order link, display ID, email, and required fields fail
  before notification creation;
- event-specific template IDs, trigger types, resource metadata, and
  idempotency keys.

### SMTP and configuration tests

- strict STARTTLS and authentication remain unchanged;
- visible `From` uses the structured name/address;
- explicit SMTP envelope retains the authorized address;
- `SMTP_FROM_NAME` rejects missing, empty, or multiline values;
- application deployment contracts require the variable;
- GitOps manifest tests assert `Plepic Games` for live and
  `Plepic Games Test` for test across every backend-image role.

### Final validation and deployment

- run focused red/green tests before implementation changes;
- run `npm ci && bash scripts/validate` in `plepic`;
- run the canonical validation command in `deploys`;
- review complete diffs and outgoing commits in both repositories;
- push the GitOps PR and report that it must merge first;
- after the GitOps change is applied, push/update Plepic PR #36 and trigger its
  `deploy-test` label;
- verify GitHub checks, image scans, GitOps promotion, Argo sync/health, and
  backend/worker/storefront rollouts;
- verify the worker loads all three subscribers;
- create or explicitly replay controlled test lifecycle events with
  notifications enabled, then confirm successful Medusa notification records
  and mail-host acceptance without printing customer data.
