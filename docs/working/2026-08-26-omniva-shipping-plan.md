# Omniva Shipping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offer a free Omniva parcel machine delivery method to Estonia, Latvia
and Lithuania, and register every shipment with Omniva automatically when the
operator fulfils an order.

**Architecture:** A custom Medusa fulfillment provider module (`omniva_omniva`)
supplies both Omniva delivery methods, validates the buyer's parcel machine
choice against Omniva's live location list, and registers the shipment with the
OMX API from `createFulfillment` — so registration happens on fulfilment in the
Admin and never on the customer's path. The shipping model grows a third service
zone and learns that a zone can sell more than one method.

**Tech Stack:** Medusa v2.18.0, TypeScript 5.9, Vitest 4, Next.js App Router
(storefront), Ansible + OpenBao (orange), Kustomize (deploys).

**Spec:** [`docs/working/2026-08-26-omniva-shipping.md`](./2026-08-26-omniva-shipping.md)

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include
these.

- **No `Baltics` constant, type, zone name or variable, anywhere.** The set is
  three ISO codes: `EE`, `LV`, `LT`. The zone is named
  `Estonia, Latvia and Lithuania`.
- **`storefront/src/lib/cart.ts`'s `ShippingZone` union must remain exactly
  `"europeanUnion" | "restOfWorld"`.** It is a VAT classifier, not a service
  zone. Adding a third member strips VAT from every EE/LV/LT order silently.
- **`EU_MEMBER_STATE_CODES` stays at 27 and `VAT_COUNTRY_CODES` stays at 27.**
  EE, LV and LT remain EU member states for tax.
- **Every deliverable country appears in exactly one service zone**, and every
  country Medusa knows appears in one.
- **Omniva configuration is optional at boot.** No Omniva variable goes into
  `requiredEnvironmentVariables`. If that changes during implementation,
  `backend/Dockerfile` **and** `scripts/validate` change with it, in the same
  commit.
- **Live only.** No `plepic-test` Omniva secret, no `plepic-test-omniva` seed
  source, until Omniva issues a test key.
- **Prices are net.** `amountMinor` values are before tax. The parcel machine
  method is `0`, and zero is zero before and after tax.
- **Frozen commercial values:** parcel machine rate `0`; standard delivery `700`
  (EU and EE/LV/LT) and `1200` (rest of world); HS tariff number `9504400000`;
  origin country `CHN`; goods category `SALE_OF_GOODS`; international service
  package `ECONOMY`.
- **OMX endpoints:** live `https://omx.omniva.eu`, test
  `https://test-omx.omniva.eu`. Paths `/api/v01/omx/shipments/business-to-client`
  and `/api/v01/omx/shipments/package-labels`.
- **Never commit a credential.** `.githooks/pre-commit` runs gitleaks; do not
  bypass it. Fake credentials in tests are written as the bare vendor prefix.
- **Run `habit-hooks --file <path>` before declaring an edit done.** `jscpd`
  must be on `PATH` or the run does not complete and its result cannot be
  trusted.

## Working environment

All plepic work happens in the worktree already created for it:

```bash
cd ~/app/.worktrees/plepic/omniva-shipping   # branch feat/omniva-shipping
```

Orange and deploys work happens in their own worktrees, created when their tasks
are reached:

```bash
git -C ~/app/orange worktree add -b feat/omniva-secret ~/app/.worktrees/orange/omniva-secret origin/main
git -C ~/app/deploys worktree add -b feat/omniva-env ~/app/.worktrees/deploys/omniva-env origin/main
```

**Do not merge the plepic pull request without a separate, explicitly worded
deployment approval.** Merging to `main` fires `Release`, which publishes images
and writes `plepic/overlays/live`.

## File structure

### `backend/` — created

| Path | Responsibility |
| --- | --- |
| `src/modules/omniva/index.ts` | `ModuleProvider` registration. Nothing else. |
| `src/modules/omniva/config.ts` | Reads and validates the Omniva environment. Returns `null` when unconfigured. |
| `src/modules/omniva/locations.ts` | Fetches, parses, filters and caches `locations.json`. |
| `src/modules/omniva/shipment.ts` | **Pure.** Order + fulfilment + models → the OMX registration body. |
| `src/modules/omniva/client.ts` | HTTP against OMX. Basic auth, timeout, response refusals. |
| `src/modules/omniva/service.ts` | The provider. Composes the four above. |
| `src/api/store/omniva/parcel-machines/route.ts` | `GET` the machine list for one country. |
| `src/admin/widgets/omniva-label.tsx` | Admin download / re-request button for a fulfilment's label. |

### `backend/` — modified

| Path | Change |
| --- | --- |
| `src/commerce/shipping-model.ts` | A zone carries a list of methods; three zones. |
| `src/commerce/configuration.ts` | Emit one `shipping-option` record per zone method. |
| `src/commerce/product-model.ts` | Add the frozen `customs` block. |
| `medusa-config.ts` | Declare the fulfillment module with both providers. |

### `storefront/` — modified

| Path | Change |
| --- | --- |
| `src/lib/store-checkout.ts` | Zero-amount figure renders `Free`; pass `data` through. |
| `src/lib/omniva-locations.ts` | **Created.** Typed read of the backend route. |
| `src/components/shop/CheckoutPageContent.tsx` | Machine `<select>`, conditional phone field, order guard. |
| `content/legal/shipping.ts` | Describe the third method. |

---

## Phase 1 — the parcel machine option

Phase 1 is shippable on its own: buyers in Estonia, Latvia and Lithuania can
choose a free parcel machine and the operator ships it by hand, exactly as
today. Nothing calls the OMX API yet.

### Task 1: A zone sells more than one method

**Files:**

- Modify: `backend/src/commerce/shipping-model.ts`
- Modify: `backend/src/commerce/configuration.ts:commerceRecords`
- Test: `backend/tests/commerce-shipping-model.test.ts`
- Test: `backend/tests/commerce-configuration.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:

```ts
export interface ShippingMethodModel {
  readonly name: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly providerId: string;
  readonly omnivaChannel?: "PARCEL_MACHINE" | "COURIER";
}

export interface ShippingZoneModel {
  readonly name: string;
  readonly countryCodes: readonly string[];
  readonly methods: readonly ShippingMethodModel[];
}

export const PARCEL_MACHINE_ZONE_NAME = "Estonia, Latvia and Lithuania";
export const PARCEL_MACHINE_OPTION_NAME = "Omniva parcel machine";
export const PARCEL_MACHINE_COUNTRY_CODES: readonly string[];   // ["EE", "LT", "LV"]
export const PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR = 0;
export const OMNIVA_FULFILLMENT_PROVIDER_ID = "omniva_omniva";

export function shippingZoneForCountry(code: string): ShippingZoneModel | null;
export function shippingAmountMinorForCountry(code: string): number | null;
```

`shippingAmountMinorForCountry` keeps its meaning: **the standard delivery rate**
for a destination. It returns the zone's `Standard delivery` method's amount, not
the cheapest — a free parcel machine is a method a buyer chooses, not the price
of delivering to that country. Callers that want the standard rate keep working
unchanged.

- [ ] **Step 1: Write the failing test**

Replace the first three cases in `backend/tests/commerce-shipping-model.test.ts`.
The old `offers no free shipping method, in either zone` case asserted a frozen
decision the operator has now reversed; it is replaced by one that pins **where**
the free method may and may not appear, so the reversal cannot spread.

```ts
  it("declares three zones, and the flat rates the operator froze", () => {
    expect(SHIPPING_CURRENCY).toBe("EUR");
    expect(EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR).toBe(700);
    expect(REST_OF_WORLD_SHIPPING_AMOUNT_MINOR).toBe(1200);
    expect(PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR).toBe(0);
    expect(SHIPPING_ZONES.map((zone) => zone.name)).toEqual([
      "Estonia, Latvia and Lithuania",
      "European Union",
      "Rest of world",
    ]);
    for (const zone of SHIPPING_ZONES) {
      for (const method of zone.methods) {
        expect(method.currency, `${zone.name}/${method.name}`).toBe("EUR");
      }
    }
  });

  /**
   * The free method exists in exactly one zone, and the operator's decision to
   * introduce it does not leak into the other two. The old assertion here said
   * no zone had a free method at all; that decision was reversed on 2026-08-26
   * for EE, LV and LT only, and this is that reversal stated narrowly.
   */
  it("offers the free method only to Estonia, Latvia and Lithuania", () => {
    const free = SHIPPING_ZONES.filter((zone) =>
      zone.methods.some((method) => method.amountMinor === 0),
    );
    expect(free.map((zone) => zone.name)).toEqual(["Estonia, Latvia and Lithuania"]);

    for (const zone of SHIPPING_ZONES) {
      const standard = zone.methods.find((method) => method.name === "Standard delivery");
      expect(standard?.amountMinor, zone.name).toBeGreaterThan(0);
    }
  });

  it("sells one standard method everywhere, and a second method in one zone", () => {
    const keys = SHIPPING_ZONES.flatMap((zone) =>
      zone.methods.map((method) => `${zone.name}/${method.name}`),
    );
    expect(keys).toEqual([
      "Estonia, Latvia and Lithuania/Standard delivery",
      "Estonia, Latvia and Lithuania/Omniva parcel machine",
      "European Union/Standard delivery",
      "Rest of world/Standard delivery",
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("serves the parcel machine method through the Omniva provider and nothing else", () => {
    for (const zone of SHIPPING_ZONES) {
      for (const method of zone.methods) {
        const omniva = method.name === PARCEL_MACHINE_OPTION_NAME;
        expect(method.providerId, `${zone.name}/${method.name}`).toBe(
          omniva ? "omniva_omniva" : "manual_manual",
        );
        expect(method.omnivaChannel, `${zone.name}/${method.name}`).toBe(
          omniva ? "PARCEL_MACHINE" : undefined,
        );
      }
    }
  });
```

Update the two cases that read the old scalar fields. `puts every deliverable
country in exactly one zone` and `excludes no country from delivery` need no
change — they read `countryCodes`, which is unchanged. `agrees with the country
list the checkout offers` **does** change, because EE/LV/LT no longer land in the
zone named `European Union`:

```ts
  it("agrees with the country list the checkout offers, in both directions", () => {
    const offered = storefrontJson<StorefrontCountries>("mock/countries.json").countries;
    expect(offered.length).toBeGreaterThan(240);

    for (const country of offered) {
      const zone = shippingZoneForCountry(country.code);
      expect(zone?.name, `${country.name} (${country.code}) has no zone`).toBeTypeOf("string");
      const expected = PARCEL_MACHINE_COUNTRY_CODES.includes(country.code)
        ? "Estonia, Latvia and Lithuania"
        : country.euMember
          ? "European Union"
          : "Rest of world";
      expect(zone?.name, `${country.name} (${country.code}) is in the wrong zone`).toBe(expected);
    }

    // The VAT boundary has NOT moved. EE, LV and LT buy delivery from their own
    // service zone and are still EU member states for tax.
    const euMembers = offered.filter((country) => country.euMember).map((country) => country.code);
    expect([...euMembers].sort()).toEqual([...EU_MEMBER_STATE_CODES].sort());
    for (const code of PARCEL_MACHINE_COUNTRY_CODES) {
      expect(EU_MEMBER_STATE_CODES, code).toContain(code);
    }
  });

  it("still charges the standard rate the checkout's own rate file declares", () => {
    const { method } = storefrontJson<StorefrontShipping>("mock/shipping.json");
    expect(method.currency).toBe(SHIPPING_CURRENCY);
    expect(method.rates.europeanUnion).toBe(EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR);
    expect(method.rates.restOfWorld).toBe(REST_OF_WORLD_SHIPPING_AMOUNT_MINOR);
    // EE, LV and LT pay the same standard rate as the rest of the EU. The
    // basket's estimate quotes standard delivery, so `method` stays the one
    // the basket prices against.
    expect(shippingAmountMinorForCountry("EE")).toBe(EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR);
  });

  /**
   * **The one string that crosses the boundary, held to one writer.**
   *
   * The storefront cannot import this model — it reads Medusa's option list,
   * which carries the option's *display name* and not its provider id, so
   * `isParcelMachineOption` compares names. That is a second copy of a value
   * this file declares, and a second copy nothing compares is how a renamed
   * option silently stops being recognised as the parcel machine method: the
   * `<select>` would render it, the machine picker would never appear, and the
   * order would be placed against an option with no machine chosen.
   *
   * So the name is written once into `mock/shipping.json` — the file this suite
   * already reads for the rates — and both sides read it from there.
   */
  it("names the parcel machine method the same as the checkout does", () => {
    const { parcelMachine } = storefrontJson<StorefrontShipping>("mock/shipping.json");
    expect(parcelMachine.name).toBe(PARCEL_MACHINE_OPTION_NAME);
    expect(parcelMachine.rate).toBe(PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR);
    expect(parcelMachine.rate).toBe(0);
    expect(parcelMachine.countries).toEqual([...PARCEL_MACHINE_COUNTRY_CODES]);
  });
```

Extend the `StorefrontShipping` interface in the test file to match:

```ts
interface StorefrontShipping {
  readonly method: {
    readonly currency: string;
    readonly rates: { readonly europeanUnion: number; readonly restOfWorld: number };
    readonly ratesWithTax: { readonly europeanUnion: number; readonly restOfWorld: number };
  };
  readonly parcelMachine: {
    readonly name: string;
    readonly rate: number;
    readonly countries: readonly string[];
  };
}
```

Add the imports `PARCEL_MACHINE_COUNTRY_CODES`, `PARCEL_MACHINE_OPTION_NAME`,
`PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR` to the existing import block.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping/backend
npx vitest run tests/commerce-shipping-model.test.ts
```

Expected: FAIL. TypeScript cannot resolve `PARCEL_MACHINE_ZONE_NAME` and the
zone name array has two entries, not three.

- [ ] **Step 3: Rewrite the model**

In `backend/src/commerce/shipping-model.ts`, replace the `ShippingZoneModel`
interface and the `SHIPPING_ZONES` constant. Keep every existing export name
that other files import.

```ts
/** The one delivery method offered in every zone. */
export const SHIPPING_OPTION_NAME = "Standard delivery";

/** The second method, offered to three countries and priced at nothing. */
export const PARCEL_MACHINE_OPTION_NAME = "Omniva parcel machine";

export const PARCEL_MACHINE_ZONE_NAME = "Estonia, Latvia and Lithuania";
export const EUROPEAN_UNION_ZONE_NAME = "European Union";
export const REST_OF_WORLD_ZONE_NAME = "Rest of world";

/** Operator-frozen, 2026-08-26. Minor units. Free is free before tax and after. */
export const PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR = 0;

/**
 * The three countries Omniva serves with parcel machines, ISO 3166-1 alpha-2,
 * sorted.
 *
 * Deliberately **not** named after a region. It is three countries, it is the
 * set OMX makes `deliveryChannel` mandatory for, and it is the set
 * `locations.json` carries parcel machines in. A regional name would invite a
 * fourth member on grounds this list does not have.
 *
 * Every one of them is also an EU member state. That is asserted in
 * `tests/commerce-shipping-model.test.ts`, because the day it stops being true
 * is the day the VAT treatment and the delivery zone stop agreeing.
 */
export const PARCEL_MACHINE_COUNTRY_CODES: readonly string[] = ["EE", "LT", "LV"];

const PARCEL_MACHINE_COUNTRY_SET: ReadonlySet<string> = new Set(PARCEL_MACHINE_COUNTRY_CODES);

/** The fulfillment provider the two manual-rate methods are served by. */
export const MANUAL_FULFILLMENT_PROVIDER_ID = "manual_manual";

/**
 * The Omniva provider's Medusa id: the service's `identifier` and the id it is
 * registered under in `medusa-config.ts`, joined. Declared here because the
 * shipping model names it and `medusa-config.ts` must register it to match.
 */
export const OMNIVA_FULFILLMENT_PROVIDER_ID = "omniva_omniva";

/** One delivery method a zone sells. */
export interface ShippingMethodModel {
  /** What the Admin shows, and the natural key the upsert addresses it by. */
  readonly name: string;
  readonly currency: string;
  /** Minor units. A flat price; never a band, a table or a quote. */
  readonly amountMinor: number;
  readonly providerId: string;
  /**
   * The OMX `deliveryChannel` this method registers as, for methods the Omniva
   * provider serves. Absent on a method no carrier integration touches, which
   * is what makes "is this an Omniva method" a property of the model rather
   * than a string comparison on the name.
   */
  readonly omnivaChannel?: "PARCEL_MACHINE" | "COURIER";
}

export interface ShippingZoneModel {
  /** The service zone's name, and the natural key every upsert addresses it by. */
  readonly name: string;
  readonly countryCodes: readonly string[];
  /**
   * The methods this zone sells, in the order they are declared and applied.
   *
   * A list rather than a single method since 2026-08-26, when EE, LV and LT
   * gained a second one. A zone with two methods is two rows in
   * `shipping_option`, keyed by name within the zone.
   */
  readonly methods: readonly ShippingMethodModel[];
}

const STANDARD_EUROPEAN_UNION_METHOD: ShippingMethodModel = {
  name: SHIPPING_OPTION_NAME,
  currency: SHIPPING_CURRENCY,
  amountMinor: EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR,
  providerId: MANUAL_FULFILLMENT_PROVIDER_ID,
};

export const SHIPPING_ZONES: readonly ShippingZoneModel[] = [
  {
    name: PARCEL_MACHINE_ZONE_NAME,
    countryCodes: PARCEL_MACHINE_COUNTRY_CODES,
    methods: [
      STANDARD_EUROPEAN_UNION_METHOD,
      {
        name: PARCEL_MACHINE_OPTION_NAME,
        currency: SHIPPING_CURRENCY,
        amountMinor: PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR,
        providerId: OMNIVA_FULFILLMENT_PROVIDER_ID,
        omnivaChannel: "PARCEL_MACHINE",
      },
    ],
  },
  {
    name: EUROPEAN_UNION_ZONE_NAME,
    countryCodes: EU_MEMBER_STATE_CODES.filter(
      (code) => !PARCEL_MACHINE_COUNTRY_SET.has(code),
    ),
    methods: [STANDARD_EUROPEAN_UNION_METHOD],
  },
  {
    name: REST_OF_WORLD_ZONE_NAME,
    countryCodes: REST_OF_WORLD_COUNTRY_CODES,
    methods: [
      {
        name: SHIPPING_OPTION_NAME,
        currency: SHIPPING_CURRENCY,
        amountMinor: REST_OF_WORLD_SHIPPING_AMOUNT_MINOR,
        providerId: MANUAL_FULFILLMENT_PROVIDER_ID,
      },
    ],
  },
];
```

Replace `shippingAmountMinorForCountry`'s body, and say in the docstring why it
is the standard rate rather than the cheapest:

```ts
/**
 * The flat charge for **standard delivery** to a destination, in minor units,
 * or `null` for no zone.
 *
 * Deliberately not "the cheapest method". EE, LV and LT can be delivered to for
 * nothing via a parcel machine, but that is a method the buyer chooses, not the
 * price of delivering to Estonia — and every caller of this function wants the
 * figure the basket quotes before any method is picked.
 */
export function shippingAmountMinorForCountry(countryCode: string): number | null {
  const zone = shippingZoneForCountry(countryCode);
  if (zone === null) return null;
  const standard = zone.methods.find((method) => method.name === SHIPPING_OPTION_NAME);
  return standard?.amountMinor ?? null;
}
```

Update the file header docstring: it currently opens *"Worldwide delivery, two
flat rates, no free method, no excluded country"* and states at length that
there is no free method. Rewrite that paragraph to say there are three zones,
two flat rates and one free method offered to exactly three countries by
operator decision of 2026-08-26 — and keep the surrounding reasoning about
carrier interfaces, weight bands and where the country list comes from, which is
all still true.

- [ ] **Step 4: Declare the method in the file both sides read**

Add to `storefront/mock/shipping.json`, beside the existing `method` object:

```json
  "parcelMachine": {
    "id": "omniva-parcel-machine",
    "name": "Omniva parcel machine",
    "rate": 0,
    "countries": ["EE", "LT", "LV"]
  }
```

Extend the file's `$comment` to say what this entry is and why it exists: the
storefront recognises the parcel machine method by the display name Medusa
returns, this is the one place that name is written, and
`backend/tests/commerce-shipping-model.test.ts` holds the model to it — so the
name cannot be changed on one side alone. Note also that `rate` is `0` and needs
no `rateWithTax` twin, because there is no VAT on nothing; that absence is
asserted rather than left to be noticed.

- [ ] **Step 5: Emit one record per method**

In `backend/src/commerce/configuration.ts`, replace the two trailing `.map`
blocks in `commerceRecords()`:

```ts
    ...SHIPPING_ZONES.map<CommerceRecord>((zone) => ({
      kind: "service-zone",
      key: zone.name,
      name: zone.name,
      countryCodes: zone.countryCodes,
    })),
    ...SHIPPING_ZONES.flatMap<CommerceRecord>((zone) =>
      zone.methods.map<CommerceRecord>((method) => ({
        kind: "shipping-option",
        key: `${zone.name}/${method.name}`,
        zoneName: zone.name,
        optionName: method.name,
        currency: method.currency,
        amountMinor: method.amountMinor,
        providerId: method.providerId,
      })),
    ),
```

Add `OMNIVA_FULFILLMENT_PROVIDER_ID` to the import from `./shipping-model.js`
and add the `stock-location-fulfillment-provider` record for it, immediately
after the existing `manual_manual` one — without it,
`createShippingOptionsWorkflow` refuses the parcel machine option with
*"Providers (omniva_omniva) are not enabled for the service location"* and the
predeploy Job dies on every environment:

```ts
    {
      kind: "stock-location-fulfillment-provider",
      key: `${STOCK_LOCATION_NAME}/${OMNIVA_FULFILLMENT_PROVIDER_ID}`,
      stockLocationName: STOCK_LOCATION_NAME,
      providerId: OMNIVA_FULFILLMENT_PROVIDER_ID,
    },
```

`FULFILLMENT_PROVIDER_ID` in this file is now only the manual one. Rename it to
`MANUAL_FULFILLMENT_PROVIDER_ID` re-exported from the shipping model, and update
its docstring: it currently says `manual_manual` is *"the correct provider for a
flat rate"*, which is still true of the two flat rates and is not true of the
parcel machine method.

- [ ] **Step 6: Run both suites to verify they pass**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping/backend
npx vitest run tests/commerce-shipping-model.test.ts tests/commerce-configuration.test.ts
```

Expected: PASS. `commerce-configuration.test.ts` compares two runs of
`commerceRecords()` for determinism; the `flatMap` is pure, so it holds. If it
asserts a record **count**, update the number and nothing else.

- [ ] **Step 7: Type-check and run habit-hooks**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping/backend && npm run typecheck
cd ~/app/.worktrees/plepic/omniva-shipping && habit-hooks --file backend/src/commerce/shipping-model.ts
```

Expected: clean typecheck. `habit-hooks` must reach a verdict; if it reports
`incomplete-run`, put `jscpd` on `PATH` and re-run before continuing.

- [ ] **Step 8: Commit**

```bash
git add backend/src/commerce/shipping-model.ts backend/src/commerce/configuration.ts \
        backend/tests/commerce-shipping-model.test.ts backend/tests/commerce-configuration.test.ts
git commit -m "feat: let a shipping zone sell more than one method

Estonia, Latvia and Lithuania move into their own service zone carrying both
Standard delivery at the unchanged EUR 7.00 and a free Omniva parcel machine
method. Every country still falls in exactly one zone, and the VAT boundary
does not move: all three remain EU member states and EU_MEMBER_STATE_CODES
stays at 27.

The 'no free shipping method' assertion is reversed by operator decision of
2026-08-26 and replaced with one that pins where the free method may appear, so
the reversal cannot spread to the other two zones."
```

---

### Task 2: The provider module exists and Medusa accepts it

This task's deliverable is the riskiest assumption in the whole plan proven by a
run: that declaring a `providers` array does not unregister `manual_manual`.

**Files:**

- Create: `backend/src/modules/omniva/service.ts`
- Create: `backend/src/modules/omniva/index.ts`
- Modify: `backend/medusa-config.ts`
- Test: `backend/tests/commerce-medusa-semantics.test.ts`

**Interfaces:**

- Consumes: `OMNIVA_FULFILLMENT_PROVIDER_ID`, `PARCEL_MACHINE_OPTION_NAME` (Task 1).
- Produces:

```ts
export const OMNIVA_PARCEL_MACHINE_OPTION_ID = "omniva-parcel-machine";
export const OMNIVA_COURIER_OPTION_ID = "omniva-courier";
export default class OmnivaFulfillmentProviderService
  extends AbstractFulfillmentProviderService {
  static identifier: "omniva";
}
```

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/commerce-medusa-semantics.test.ts`, inside the block
that already stands up real Medusa against real Postgres and runs the real
`configureCommerce`. Follow the file's existing helper names for resolving the
container and running a cart.

```ts
  it("offers an Estonian cart both methods, and a German cart only one", async () => {
    const estonian = await cartWithShippingAddress({ country_code: "ee" });
    const estonianOptions = await listShippingOptionsForCart(estonian.id);
    expect(
      estonianOptions.map((option) => option.name).sort(),
    ).toEqual(["Omniva parcel machine", "Standard delivery"]);

    const parcelMachine = estonianOptions.find(
      (option) => option.name === "Omniva parcel machine",
    );
    expect(parcelMachine?.amount).toBe(0);
    expect(parcelMachine?.provider_id).toBe("omniva_omniva");

    const standard = estonianOptions.find((option) => option.name === "Standard delivery");
    expect(standard?.amount).toBe(7);
    // manual_manual still serves the flat rates. A declared providers array
    // that replaced Medusa's default would have failed configureCommerce long
    // before this line; this asserts the survivor rather than assuming it.
    expect(standard?.provider_id).toBe("manual_manual");

    const german = await cartWithShippingAddress({ country_code: "de" });
    const germanOptions = await listShippingOptionsForCart(german.id);
    expect(germanOptions.map((option) => option.name)).toEqual(["Standard delivery"]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping
bash scripts/store-smoke   # or the file's documented harness — it needs real Postgres and Redis
```

Expected: FAIL. `configureCommerce` throws
*"Providers (omniva_omniva) are not enabled for the service location"*, because
no such provider is registered yet.

- [ ] **Step 3: Write the provider service**

`backend/src/modules/omniva/service.ts`:

```ts
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils";
import type { FulfillmentOption } from "@medusajs/framework/types";

/** The parcel machine method's option id, as `getFulfillmentOptions` returns it. */
export const OMNIVA_PARCEL_MACHINE_OPTION_ID = "omniva-parcel-machine";
/** The courier method's option id. Not sold yet; Task 9 registers against it. */
export const OMNIVA_COURIER_OPTION_ID = "omniva-courier";

/**
 * Omniva, as a Medusa fulfillment provider.
 *
 * Registration with the carrier happens in `createFulfillment` and **nowhere
 * else**, so the customer's path — cart completion, `order.placed`, the
 * confirmation email — never calls Omniva. A refusal here fails the fulfilment
 * in front of the operator, which is the containment the design asks for, and
 * it is structural rather than a `try`/`catch` a later edit could remove.
 */
export default class OmnivaFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "omniva";

  /**
   * The two delivery channels OMX serves. `optionData` carries the channel so
   * that the registration body reads it from the option rather than comparing
   * the option's display name, which an operator can rename in the Admin.
   */
  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      { id: OMNIVA_PARCEL_MACHINE_OPTION_ID, name: "Omniva parcel machine", deliveryChannel: "PARCEL_MACHINE" },
      { id: OMNIVA_COURIER_OPTION_ID, name: "Omniva courier", deliveryChannel: "COURIER" },
    ];
  }

  /**
   * `false`, and it stays false. Both rates are stored flat prices; nothing is
   * quoted from the carrier, so there is no quote to time out and no second
   * figure a fallback could disagree with. ADR 020 records the reasoning.
   */
  async canCalculate(): Promise<boolean> {
    return false;
  }
}
```

`backend/src/modules/omniva/index.ts`:

```ts
import { ModuleProvider, Modules } from "@medusajs/framework/utils";

import OmnivaFulfillmentProviderService from "./service.js";

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [OmnivaFulfillmentProviderService],
});
```

- [ ] **Step 4: Register both providers**

In `backend/medusa-config.ts`, add to the `modules` array. **Both entries are
required**: declaring a `providers` array is what puts `manual_manual`'s
continued existence in question, and the three `Standard delivery` options are
created against it.

```ts
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          // Explicit, not decorative. `defineConfig` supplies this provider by
          // default only while no fulfillment module is declared; declaring one
          // to add Omniva is what makes listing the manual provider necessary.
          // Without it the three `Standard delivery` options cannot be created
          // and the predeploy Job dies on every environment.
          { resolve: "@medusajs/medusa/fulfillment-manual", id: "manual" },
          { resolve: "./src/modules/omniva", id: "omniva" },
        ],
      },
    },
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping
bash scripts/store-smoke
```

Expected: PASS. If `manual_manual` has in fact been displaced, this fails at
`configureCommerce` — in which case add
`{ resolve: "@medusajs/medusa/fulfillment-manual", id: "manual", options: {} }`
and re-run before changing anything else.

- [ ] **Step 6: Build the image**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping
podman build -f backend/Dockerfile -t plepic-backend-check backend/
```

Expected: success. A new module directory that `medusa build` does not copy into
the image is a failure that only appears in the cluster; the local build is the
cheapest place to see it.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/omniva backend/medusa-config.ts backend/tests/commerce-medusa-semantics.test.ts
git commit -m "feat: register Omniva as a fulfillment provider

Declaring a fulfillment module to add Omniva puts Medusa's default manual
provider in question, so both are listed explicitly and the semantics test
asserts an Estonian cart is still offered Standard delivery at EUR 7.00 through
manual_manual alongside the free Omniva method."
```

---

### Task 3: The parcel machine list

**Files:**

- Create: `backend/src/modules/omniva/locations.ts`
- Create: `backend/src/api/store/omniva/parcel-machines/route.ts`
- Test: `backend/tests/omniva-locations.test.ts`

**Interfaces:**

- Consumes: `PARCEL_MACHINE_COUNTRY_CODES` (Task 1).
- Produces:

```ts
export interface OmnivaParcelMachine {
  readonly zip: string;
  readonly name: string;
  readonly group: string;      // "<county> — <town>", the <optgroup> label
  readonly countryCode: string;
}

export interface OmnivaLocationSource {
  readonly url: string;
  readonly cacheTtlSeconds: number;
}

export function parseParcelMachines(raw: unknown): readonly OmnivaParcelMachine[];
export function parcelMachinesForCountry(
  all: readonly OmnivaParcelMachine[], countryCode: string,
): readonly OmnivaParcelMachine[];
export class OmnivaLocations {
  list(countryCode: string): Promise<readonly OmnivaParcelMachine[]>;
  find(zip: string): Promise<OmnivaParcelMachine | null>;
}
```

- [ ] **Step 1: Write the failing test**

`backend/tests/omniva-locations.test.ts`. The first case runs against the **real**
`locations.json`, because the shape this module depends on is Omniva's to change
and a fixture would only prove our own understanding.

```ts
import { describe, expect, it } from "vitest";

import {
  parcelMachinesForCountry,
  parseParcelMachines,
} from "../src/modules/omniva/locations.js";

const LOCATIONS_URL = "https://www.omniva.ee/locations.json";

describe("the Omniva location list", () => {
  it("parses the real published list, and finds machines in all three countries", async () => {
    const response = await fetch(LOCATIONS_URL);
    expect(response.ok).toBe(true);
    const machines = parseParcelMachines(await response.json());

    // Measured 2026-08-26: 437 EE, 412 LV, 561 LT parcel machines. Asserted as
    // floors rather than equalities -- Omniva adds and removes machines, and an
    // equality here would go red for a reason that is not a defect.
    expect(parcelMachinesForCountry(machines, "EE").length).toBeGreaterThan(300);
    expect(parcelMachinesForCountry(machines, "LV").length).toBeGreaterThan(300);
    expect(parcelMachinesForCountry(machines, "LT").length).toBeGreaterThan(400);

    for (const machine of machines) {
      expect(machine.zip, machine.name).toMatch(/^[0-9A-Za-z-]+$/);
      expect(machine.name.length, machine.zip).toBeGreaterThan(0);
      expect(["EE", "LV", "LT"]).toContain(machine.countryCode);
    }

    // ZIPs are the offloadPostcode a shipment registers against, so two
    // machines sharing one would make the buyer's choice unrepresentable.
    const zips = machines.map((machine) => machine.zip);
    expect(new Set(zips).size).toBe(zips.length);
  }, 30_000);

  it("keeps parcel machines and discards post offices", () => {
    const machines = parseParcelMachines([
      { ZIP: "10145", NAME: "Kristiine Keskus", TYPE: "0", A0_NAME: "EE", A1_NAME: "Harjumaa", A2_NAME: "Tallinn" },
      { ZIP: "10101", NAME: "Tallinn post office", TYPE: "1", A0_NAME: "EE", A1_NAME: "Harjumaa", A2_NAME: "Tallinn" },
      { ZIP: "99999", NAME: "Helsinki", TYPE: "0", A0_NAME: "FI", A1_NAME: "", A2_NAME: "Helsinki" },
    ]);
    expect(machines.map((machine) => machine.zip)).toEqual(["10145"]);
    expect(machines[0]?.group).toBe("Harjumaa — Tallinn");
  });

  it("refuses an entry missing the fields a shipment registration needs", () => {
    expect(parseParcelMachines([{ NAME: "No zip", TYPE: "0", A0_NAME: "EE" }])).toEqual([]);
    expect(() => parseParcelMachines("not a list")).toThrow(/list/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping/backend
npx vitest run tests/omniva-locations.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `locations.ts`**

```ts
import { PARCEL_MACHINE_COUNTRY_CODES } from "../../commerce/shipping-model.js";

/** Omniva's published location list. Public, and deliberately unauthenticated. */
export const OMNIVA_LOCATIONS_URL = "https://www.omniva.ee/locations.json";

/** `TYPE` in the published list. `"1"` is a post office, which is not offered. */
const PARCEL_MACHINE_TYPE = "0";

const COUNTRIES: ReadonlySet<string> = new Set(PARCEL_MACHINE_COUNTRY_CODES);

export interface OmnivaParcelMachine {
  /** The `offloadPostcode` a shipment registers against. Unique across the list. */
  readonly zip: string;
  readonly name: string;
  /** `"<county> — <town>"`, rendered as the `<optgroup>` label. */
  readonly group: string;
  readonly countryCode: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The published list, narrowed to what a buyer may choose and a shipment may
 * name.
 *
 * An entry missing a ZIP or a name is **dropped rather than repaired**: it is a
 * machine no shipment could be addressed to, and inventing a label for it would
 * put an unselectable option on the checkout. A payload that is not a list at
 * all throws, because that is Omniva changing the contract rather than one bad
 * row.
 */
export function parseParcelMachines(raw: unknown): readonly OmnivaParcelMachine[] {
  if (!Array.isArray(raw)) {
    throw new Error("The Omniva location list must be a list");
  }
  const machines: OmnivaParcelMachine[] = [];
  for (const entry of raw as readonly Record<string, unknown>[]) {
    if (text(entry.TYPE) !== PARCEL_MACHINE_TYPE) continue;
    const countryCode = text(entry.A0_NAME).toUpperCase();
    if (!COUNTRIES.has(countryCode)) continue;
    const zip = text(entry.ZIP);
    const name = text(entry.NAME);
    if (zip.length === 0 || name.length === 0) continue;
    const county = text(entry.A1_NAME);
    const town = text(entry.A2_NAME);
    const group = [county, town].filter((part) => part.length > 0).join(" — ");
    machines.push({ zip, name, group: group.length > 0 ? group : name, countryCode });
  }
  return machines;
}

export function parcelMachinesForCountry(
  all: readonly OmnivaParcelMachine[],
  countryCode: string,
): readonly OmnivaParcelMachine[] {
  const code = countryCode.trim().toUpperCase();
  return all
    .filter((machine) => machine.countryCode === code)
    .sort((left, right) =>
      left.group.localeCompare(right.group) || left.name.localeCompare(right.name),
    );
}
```

- [ ] **Step 4: Add the cache and the route**

Append the caching reader to `locations.ts`. It takes its Redis from the Medusa
container so there is no second opinion about where Redis is:

```ts
const CACHE_KEY = "omniva:parcel-machines:v1";

/**
 * The location list, fetched once and cached.
 *
 * **One reader.** `validateFulfillmentData` resolves a chosen ZIP through this
 * same object, so the list the buyer picked from and the list the ZIP is checked
 * against cannot disagree — which they could if the storefront fetched its own
 * copy.
 *
 * A fetch failure serves the cached copy and logs. With no cached copy at all it
 * **throws**: an empty `<select>` is a checkout that looks broken for a reason
 * nobody can see, and a refusal at least names itself.
 */
export class OmnivaLocations {
  constructor(
    private readonly cache: { get(key: string): Promise<unknown>; set(key: string, value: unknown, ttl: number): Promise<void> },
    private readonly ttlSeconds: number = 6 * 60 * 60,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async all(): Promise<readonly OmnivaParcelMachine[]> {
    const cached = await this.cache.get(CACHE_KEY);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached as readonly OmnivaParcelMachine[];
    }
    const response = await this.fetcher(OMNIVA_LOCATIONS_URL);
    if (!response.ok) {
      throw new Error(`The Omniva location list answered ${String(response.status)}`);
    }
    const machines = parseParcelMachines(await response.json());
    if (machines.length === 0) {
      throw new Error("The Omniva location list carried no parcel machines");
    }
    await this.cache.set(CACHE_KEY, machines, this.ttlSeconds);
    return machines;
  }

  async list(countryCode: string): Promise<readonly OmnivaParcelMachine[]> {
    return parcelMachinesForCountry(await this.all(), countryCode);
  }

  async find(zip: string): Promise<OmnivaParcelMachine | null> {
    const wanted = zip.trim();
    return (await this.all()).find((machine) => machine.zip === wanted) ?? null;
  }
}
```

`backend/src/api/store/omniva/parcel-machines/route.ts`:

```ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

import { PARCEL_MACHINE_COUNTRY_CODES } from "../../../../commerce/shipping-model.js";
import { OmnivaLocations } from "../../../../modules/omniva/locations.js";

/**
 * The machines a buyer in one country may choose from.
 *
 * Served by the backend rather than fetched from the browser so that no
 * third-party origin enters the checkout's CSP and no request goes from a
 * buyer's browser to Omniva.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const country = String(req.query.country ?? "").trim().toUpperCase();
  if (!PARCEL_MACHINE_COUNTRY_CODES.includes(country)) {
    res.status(400).json({ message: "Parcel machines are offered in EE, LV and LT only" });
    return;
  }
  const locations = new OmnivaLocations(req.scope.resolve(Modules.CACHE));
  try {
    res.json({ parcel_machines: await locations.list(country) });
  } catch {
    res.status(503).json({ message: "The parcel machine list is unavailable" });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping/backend
npx vitest run tests/omniva-locations.test.ts
```

Expected: PASS, including the case that hits the real published list.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/omniva/locations.ts \
        backend/src/api/store/omniva/parcel-machines backend/tests/omniva-locations.test.ts
git commit -m "feat: serve Omniva parcel machines from the backend

The published list is fetched by the backend and cached, so the checkout reaches
it same-origin through /store-api and no third-party origin enters the CSP. The
same object resolves a chosen ZIP during validation, so the list the buyer chose
from and the list it is checked against cannot disagree.

The parse is exercised against the real published list rather than a fixture:
the shape is Omniva's to change, and a fixture would only prove our own reading
of it."
```

---

### Task 4: The buyer's choice is validated where it is stored

**Files:**

- Modify: `backend/src/modules/omniva/service.ts`
- Test: `backend/tests/omniva-validate-fulfillment-data.test.ts`

**Interfaces:**

- Consumes: `OmnivaLocations`, `OMNIVA_PARCEL_MACHINE_OPTION_ID` (Tasks 2–3).
- Produces: the shipping method `data` shape every later task reads —
  `{ parcel_machine_zip: string; parcel_machine_name: string }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import OmnivaFulfillmentProviderService, {
  OMNIVA_COURIER_OPTION_ID,
  OMNIVA_PARCEL_MACHINE_OPTION_ID,
} from "../src/modules/omniva/service.js";
import type { OmnivaParcelMachine } from "../src/modules/omniva/locations.js";

const KRISTIINE: OmnivaParcelMachine = {
  zip: "10145", name: "Kristiine Keskus", group: "Harjumaa — Tallinn", countryCode: "EE",
};

function providerFinding(machines: readonly OmnivaParcelMachine[]) {
  const service = new OmnivaFulfillmentProviderService();
  service.locations = {
    find: async (zip: string) => machines.find((machine) => machine.zip === zip) ?? null,
    list: async () => machines,
  } as never;
  return service;
}

const ESTONIAN_CART = { shipping_address: { country_code: "ee" } };

describe("validating a parcel machine choice", () => {
  it("stores the ZIP and the name the buyer actually chose", async () => {
    const data = await providerFinding([KRISTIINE]).validateFulfillmentData(
      { id: OMNIVA_PARCEL_MACHINE_OPTION_ID },
      { parcel_machine_zip: "10145" },
      ESTONIAN_CART,
    );
    expect(data).toEqual({
      parcel_machine_zip: "10145",
      parcel_machine_name: "Kristiine Keskus",
    });
  });

  it("refuses a parcel machine method with no machine chosen", async () => {
    await expect(
      providerFinding([KRISTIINE]).validateFulfillmentData(
        { id: OMNIVA_PARCEL_MACHINE_OPTION_ID }, {}, ESTONIAN_CART,
      ),
    ).rejects.toThrow(/parcel machine/i);
  });

  it("refuses a ZIP that is not a machine", async () => {
    await expect(
      providerFinding([KRISTIINE]).validateFulfillmentData(
        { id: OMNIVA_PARCEL_MACHINE_OPTION_ID },
        { parcel_machine_zip: "00000" },
        ESTONIAN_CART,
      ),
    ).rejects.toThrow(/not an Omniva parcel machine/i);
  });

  /**
   * A Latvian machine with an Estonian delivery address is a parcel the buyer
   * cannot collect. It is refused here rather than at the carrier, because here
   * the buyer is still on the page and can choose again.
   */
  it("refuses a machine in a different country from the delivery address", async () => {
    await expect(
      providerFinding([{ ...KRISTIINE, countryCode: "LV" }]).validateFulfillmentData(
        { id: OMNIVA_PARCEL_MACHINE_OPTION_ID },
        { parcel_machine_zip: "10145" },
        ESTONIAN_CART,
      ),
    ).rejects.toThrow(/delivery address/i);
  });

  it("passes courier data through untouched", async () => {
    const data = await providerFinding([]).validateFulfillmentData(
      { id: OMNIVA_COURIER_OPTION_ID }, { anything: "kept" }, ESTONIAN_CART,
    );
    expect(data).toEqual({ anything: "kept" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/omniva-validate-fulfillment-data.test.ts
```

Expected: FAIL — `validateFulfillmentData` is not implemented, so the base
class's pass-through returns the input and the refusal cases do not throw.

- [ ] **Step 3: Implement it**

Add to `OmnivaFulfillmentProviderService`:

```ts
  /**
   * The buyer's parcel machine choice, checked in the only place it is checked.
   *
   * The machine's **name is stored beside its ZIP on purpose.** It is what the
   * buyer chose; Omniva renames and relocates machines, and a label that
   * re-derived the name at print time would show a different machine from the
   * one on the order, with nothing to notice.
   */
  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (optionData.id !== OMNIVA_PARCEL_MACHINE_OPTION_ID) return data;

    const zip = typeof data.parcel_machine_zip === "string" ? data.parcel_machine_zip.trim() : "";
    if (zip.length === 0) {
      throw new Error("Choose an Omniva parcel machine before continuing");
    }

    const machine = await this.locations.find(zip);
    if (machine === null) {
      throw new Error(`${zip} is not an Omniva parcel machine`);
    }

    const address = (context as { shipping_address?: { country_code?: unknown } }).shipping_address;
    const country = typeof address?.country_code === "string"
      ? address.country_code.trim().toUpperCase()
      : "";
    if (country !== machine.countryCode) {
      throw new Error(
        `${machine.name} is in ${machine.countryCode}, which is not the delivery address's country`,
      );
    }

    return { parcel_machine_zip: machine.zip, parcel_machine_name: machine.name };
  }
```

Give the class a `locations` member resolved from the container in its
constructor, so the test above can substitute one.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/omniva-validate-fulfillment-data.test.ts
```

Expected: PASS, five cases.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/omniva/service.ts backend/tests/omniva-validate-fulfillment-data.test.ts
git commit -m "feat: validate the buyer's parcel machine choice

A ZIP that is not a machine, or a machine in a different country from the
delivery address, is refused while the buyer is still on the page and can choose
again -- rather than at the carrier, days later. The machine's name is stored
beside its ZIP so the order keeps what the buyer chose even after Omniva renames
it."
```

---

### Task 5: The checkout offers the machine, and free reads as free

**Files:**

- Modify: `storefront/src/lib/store-checkout.ts`
- Create: `storefront/src/lib/omniva-locations.ts`
- Modify: `storefront/src/components/shop/CheckoutPageContent.tsx`
- Test: `storefront/tests/store-checkout.test.ts`

**Interfaces:**

- Consumes: `GET /store-api/store/omniva/parcel-machines?country=EE` (Task 3),
  the `data` shape from Task 4.
- Produces:

```ts
export interface StorefrontParcelMachine {
  readonly zip: string;
  readonly name: string;
  readonly group: string;
}
export function fetchParcelMachines(countryCode: string): Promise<readonly StorefrontParcelMachine[]>;
export function isParcelMachineOption(option: GuestShippingOption): boolean;
```

`isParcelMachineOption` compares `option.name` to the literal
`"Omniva parcel machine"`, exported as a constant from `store-checkout.ts`. That
is the only string the storefront has: Medusa's option list carries the display
name, not the provider id.

- [ ] **Step 1: Write the failing test**

Add to `storefront/tests/store-checkout.test.ts`:

```ts
  it("renders a free method as Free, never as a net rate awaiting VAT", () => {
    const free = {
      id: "so_free", name: "Omniva parcel machine",
      amount: 0, amountWithTax: null, taxInclusive: false,
    } as const;

    // Inside the EU, where every other net figure gains a "+ VAT" marker.
    const shown = shippingOptionFigure(free, true);
    expect(shown.label).toBe("Free");
    expect(shown.amount).toBe(0);
    expect(shown.final).toBe(true);
    expect(shown.label).not.toContain(NET_SHIPPING_SUFFIX);

    // And outside it, where the marker never applied anyway.
    expect(shippingOptionFigure(free, false).label).toBe("Free");
  });

  /**
   * The VAT hazard this design exists beside: EE, LV and LT buy delivery from
   * their own service zone and are still EU member states for tax. If
   * `ShippingZone` ever gained a third member, this goes red.
   */
  it("still treats an Estonian address as EU for VAT", () => {
    expect(zoneForCountryName("Estonia")).toBe("europeanUnion");
    expect(zoneForCountryName("Latvia")).toBe("europeanUnion");
    expect(zoneForCountryName("Lithuania")).toBe("europeanUnion");
    expect(SHIPPING_ZONES).toEqual(["europeanUnion", "restOfWorld"]);
  });

  it("charges nothing for the free method, and still refuses a mismatch", async () => {
    const client = clientAddingShippingMethod({
      cart: {
        currency_code: "eur", item_total: 30.5, item_tax_total: 5.9,
        shipping_total: 0, shipping_tax_total: 0, tax_total: 5.9, total: 30.5,
      },
    });
    const totals = await addGuestShippingMethod(
      client, "cart_1",
      { id: "so_free", name: "Omniva parcel machine", amount: 0, amountWithTax: null, taxInclusive: false },
      true,
    );
    expect(totals.shippingAmount).toBe(0);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping/storefront
npx vitest run tests/store-checkout.test.ts
```

Expected: FAIL — `shippingOptionFigure` returns `"€0.00 + VAT"`.

- [ ] **Step 3: Add the zero case**

In `storefront/src/lib/store-checkout.ts`, insert **before** the tax-inclusive
branch of `shippingOptionFigure`:

```ts
  /*
   * Zero is final, in both zones, and it is the first branch on purpose.
   *
   * A free method is not a net rate awaiting VAT: there is no tax on nothing, so
   * the "+ VAT" marker below would promise a charge that never arrives. Reached
   * only by a method the operator priced at zero, which today is the Omniva
   * parcel machine and is asserted to be the only one in
   * `backend/tests/commerce-shipping-model.test.ts`.
   */
  if (option.amount === 0) {
    return { amount: 0, label: FREE_SHIPPING_LABEL, final: true };
  }
```

and add the exports:

```ts
/** What a zero-priced delivery method is written as. */
export const FREE_SHIPPING_LABEL = "Free";

/**
 * The parcel machine method's display name, as Medusa returns it — read from
 * `mock/shipping.json` rather than written here.
 *
 * Medusa's option list carries a display name and not a provider id, so the
 * name is the only thing the storefront can recognise the method by. A literal
 * here would be a second copy of a value
 * `backend/src/commerce/shipping-model.ts` declares, and a rename would then
 * stop the method being recognised **silently**: it would still render in the
 * `<select>`, the machine picker would never appear, and the order would go
 * through with no machine chosen.
 * `backend/tests/commerce-shipping-model.test.ts` holds the model to this file,
 * so the two cannot drift apart.
 */
export const PARCEL_MACHINE_OPTION_NAME = shippingMock.parcelMachine.name;

export function isParcelMachineOption(option: GuestShippingOption): boolean {
  return option.name === PARCEL_MACHINE_OPTION_NAME;
}
```

Import the mock the way the storefront already imports `mock/shipping.json` for
its rates — follow the existing read in `src/lib/cart.ts` rather than
introducing a second style.

Extend `addGuestShippingMethod` to forward the machine:

```ts
export async function addGuestShippingMethod(
  client: StoreClient,
  cartId: string,
  option: GuestShippingOption,
  vatApplies: boolean,
  parcelMachineZip?: string,
): Promise<CartTotals> {
  if (option.id.length === 0) throw new ConfigError("Choose a shipping option");
  if (isParcelMachineOption(option) && !parcelMachineZip) {
    throw new ConfigError("Choose an Omniva parcel machine");
  }
  const totals = cartTotals(
    await client.store.cart.addShippingMethod(cartId, {
      option_id: option.id,
      ...(parcelMachineZip === undefined ? {} : { data: { parcel_machine_zip: parcelMachineZip } }),
    }),
  );
  // ... the existing shown-versus-charged guard, unchanged
```

- [ ] **Step 4: Write the storefront reader**

`storefront/src/lib/omniva-locations.ts`:

```ts
import { ConfigError } from "../config/env.js";

export interface StorefrontParcelMachine {
  readonly zip: string;
  readonly name: string;
  readonly group: string;
}

/**
 * The machines for one country, through the same-origin `/store-api` proxy.
 *
 * Nothing here talks to Omniva. The backend holds the list and the cache, so
 * the checkout's CSP gains no origin and the buyer's browser makes no
 * third-party request.
 */
export async function fetchParcelMachines(
  countryCode: string,
): Promise<readonly StorefrontParcelMachine[]> {
  const response = await fetch(
    `/store-api/store/omniva/parcel-machines?country=${encodeURIComponent(countryCode)}`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) {
    throw new ConfigError("The parcel machine list is unavailable");
  }
  const body = (await response.json()) as { parcel_machines?: unknown };
  if (!Array.isArray(body.parcel_machines) || body.parcel_machines.length === 0) {
    throw new ConfigError("The parcel machine list is unavailable");
  }
  return body.parcel_machines as readonly StorefrontParcelMachine[];
}
```

- [ ] **Step 5: Add the second `<select>`**

In `CheckoutPageContent.tsx`, add state and a loader keyed on the address's
country, then render the machine picker directly beneath the method `<select>`,
inside the same `summaryRow`:

```tsx
{selectedIsParcelMachine && (
  <select
    className={`${styles.field} ${styles.select}`}
    aria-label={checkout.delivery.parcelMachineLabel}
    value={parcelMachineZip}
    disabled={shippingState === "loading" || placing || parcelMachines.length === 0}
    onChange={(event) => selectParcelMachine(event.currentTarget.value)}
  >
    <option value="">{checkout.delivery.parcelMachinePrompt}</option>
    {parcelMachineGroups.map(({ group, machines }) => (
      <optgroup key={group} label={group}>
        {machines.map((machine) => (
          <option key={machine.zip} value={machine.zip}>{machine.name}</option>
        ))}
      </optgroup>
    ))}
  </select>
)}
```

`selectShippingOption` gains the machine argument. Selecting the parcel machine
method with no machine yet chosen must **not** call the Store API — it sets the
selection and waits — so the guard goes at the top of the existing body:

```ts
    const chosen = shippingOptions.find((option) => option.id === optionId);
    if (chosen !== undefined && isParcelMachineOption(chosen) && parcelMachineZip === "") {
      setSelectedShippingOption(optionId);
      setStoreTotals(null);
      return;
    }
```

and `selectParcelMachine(zip)` sets the ZIP and re-runs the add with it.

Add `parcelMachineLabel` and `parcelMachinePrompt` to the checkout copy in
`content/`, following the existing `checkout.delivery` shape — the type checker
enumerates the work for every locale.

Finally, `orderMayBePlaced` gains: a selected parcel machine method with no ZIP
is not placeable.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping/storefront
npx vitest run tests/store-checkout.test.ts && npm run typecheck
```

Expected: PASS, clean typecheck.

- [ ] **Step 7: Commit**

```bash
git add storefront/src content/ storefront/tests/store-checkout.test.ts
git commit -m "feat: let an Estonian, Latvian or Lithuanian buyer choose a parcel machine

A second grouped select appears beneath the delivery method when the parcel
machine option is chosen, populated same-origin through /store-api. A zero rate
renders as Free rather than 'EUR 0.00 + VAT', which would promise a tax on
nothing.

The VAT classifier is deliberately untouched and now has a test saying so: EE,
LV and LT buy delivery from their own service zone and remain EU member states
for tax."
```

---

### Task 6: The legal page describes what is actually sold

**Files:**

- Modify: `content/legal/shipping.ts`
- Test: whichever suite already asserts the shipping page's figures.

- [ ] **Step 1: Write the failing test**

Assert the page names three methods, and that the parcel machine paragraph says
free, names Estonia, Latvia and Lithuania by name, and does not say `Baltics`.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping && npx vitest run --dir . -t "shipping"
```

Expected: FAIL — the page describes two flat rates.

- [ ] **Step 3: Write the copy**

Add a delivery-method section describing standard delivery at the two existing
rates and the free Omniva parcel machine to Estonia, Latvia and Lithuania.
Preserve the file's existing structure and its long header docstring, which
records why prices on this page are placeholders resolved from Medusa's own
figures rather than literals — the new rate is zero, which is the one figure
that cannot go stale, and say so.

- [ ] **Step 4: Run it to verify it passes, then commit**

```bash
git add content/legal/shipping.ts
git commit -m "docs: describe the parcel machine method on the shipping page"
```

**Phase 1 is complete and shippable here.** Open the pull request, get it
reviewed, and **do not merge without a separate deployment approval** — merging
fires `Release`.

---

## Phase 2 — automatic registration with Omniva

### Task 7: The frozen customs declaration

**Files:**

- Modify: `backend/src/commerce/product-model.ts`
- Test: `backend/tests/commerce-product-seed.test.ts`

**Interfaces:**

- Produces:

```ts
export interface ProductCustoms {
  readonly tariffNumber: string;     // "9504400000"
  readonly originCountry: string;    // "CHN", ISO 3166-1 alpha-3
  readonly goodsCategoryCode: "SALE_OF_GOODS";
}
export interface ProductModel { /* … */ readonly customs: ProductCustoms }
```

- [ ] **Step 1: Write the failing test**

```ts
  it("declares the customs facts a shipment outside the EU cannot be registered without", () => {
    expect(PRODUCT.customs.tariffNumber).toBe("9504400000");
    expect(PRODUCT.customs.originCountry).toBe("CHN");
    expect(PRODUCT.customs.goodsCategoryCode).toBe("SALE_OF_GOODS");
    // OMX takes an alpha-3 origin and a numeric HS code. Both are operator
    // declarations, and both are refused by the carrier if malformed -- at
    // fulfilment, per order, which is the expensive place to find out.
    expect(PRODUCT.customs.originCountry).toMatch(/^[A-Z]{3}$/);
    expect(PRODUCT.customs.tariffNumber).toMatch(/^[0-9]{6,10}$/);
  });
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping/backend
npx vitest run tests/commerce-product-seed.test.ts
```

Expected: FAIL — `customs` does not exist.

- [ ] **Step 3: Add the block**

```ts
/**
 * What a customs declaration says about this product.
 *
 * Operator-frozen, 2026-08-26, and declared here beside the weight and the box
 * because it is the same kind of fact: a property of the thing in the parcel
 * rather than of any order. OMX requires all three whenever the destination is
 * outside the EU, and refuses the registration if they are absent or malformed.
 *
 * `9504400000` is HS 9504.40 — playing cards. `CHN` is where the game is
 * manufactured, and OMX makes it mandatory for United States destinations
 * because the landed cost cannot be calculated without it.
 */
export interface ProductCustoms {
  /** HS code, digits only. */
  readonly tariffNumber: string;
  /** Country of manufacture, ISO 3166-1 alpha-3 — OMX's format, not alpha-2. */
  readonly originCountry: string;
  readonly goodsCategoryCode: "SALE_OF_GOODS";
}
```

and on `PRODUCT`:

```ts
  customs: {
    tariffNumber: "9504400000",
    originCountry: "CHN",
    goodsCategoryCode: "SALE_OF_GOODS",
  },
```

- [ ] **Step 4: Run it, then commit**

```bash
npx vitest run tests/commerce-product-seed.test.ts
git add backend/src/commerce/product-model.ts backend/tests/commerce-product-seed.test.ts
git commit -m "feat: freeze the customs facts a non-EU shipment declares"
```

---

### Task 8: A phone number, where OMX requires one

**Files:**

- Modify: `storefront/src/components/shop/CheckoutPageContent.tsx`
- Modify: `storefront/src/lib/store-checkout.ts` (`GuestCheckoutAddress`, `addressPayload`)
- Test: `storefront/tests/store-checkout.test.ts`

**Interfaces:**

- Produces: `GuestCheckoutAddress` gains `readonly phone: string`, written to
  the Medusa address's `phone` field. `phoneRequiredForCountry(code): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
  /**
   * OMX makes a receiver phone mandatory whenever the destination is not
   * Estonia, Latvia, Lithuania or Finland. Inside those four the buyer's email
   * satisfies it, so the field is not asked for -- a required field nobody's
   * carrier needs is friction that costs orders.
   */
  it("requires a phone number only where Omniva requires one", () => {
    for (const code of ["EE", "LV", "LT", "FI"]) {
      expect(phoneRequiredForCountry(code), code).toBe(false);
    }
    for (const code of ["DE", "US", "AU", "GB"]) {
      expect(phoneRequiredForCountry(code), code).toBe(true);
    }
  });

  it("sends the phone number to Medusa when one is given", async () => {
    const client = recordingClient();
    await prepareGuestShipping(client, "cart_1", {
      ...GERMAN_ADDRESS, phone: "+49 30 1234567",
    });
    expect(client.updated?.shipping_address.phone).toBe("+49 30 1234567");
    expect(client.updated?.billing_address.phone).toBe("+49 30 1234567");
  });
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run tests/store-checkout.test.ts
```

Expected: FAIL — `phoneRequiredForCountry` is not exported.

- [ ] **Step 3: Implement**

In `store-checkout.ts`:

```ts
/**
 * The four countries OMX does not demand a receiver phone number for.
 *
 * Not a region and not the parcel machine set — Finland is in this list and has
 * no parcel machines offered. It is exactly the set OMX names, and it is
 * written out rather than derived so that a change to the delivery countries
 * cannot silently change who is asked for a phone number.
 */
const PHONE_OPTIONAL_COUNTRY_CODES: readonly string[] = ["EE", "FI", "LT", "LV"];

export function phoneRequiredForCountry(countryCode: string): boolean {
  return !PHONE_OPTIONAL_COUNTRY_CODES.includes(countryCode.trim().toUpperCase());
}
```

Add `phone` to `GuestCheckoutAddress` and to `addressPayload`'s output. In the
checkout component, render the field only when
`phoneRequiredForCountry(selectedCountryCode)`, mark it required, and validate
presence and a leading `+` — nothing more. OMX validates with libphonenumber,
refuses special-tariff ranges and refuses Baltic fixed lines; those are the
carrier's to refuse, at fulfilment, in front of the operator who can act on them.

- [ ] **Step 4: Run the tests, then commit**

```bash
npx vitest run tests/store-checkout.test.ts && npm run typecheck
git add storefront/src storefront/tests/store-checkout.test.ts content/
git commit -m "feat: collect a phone number where Omniva requires one

Conditional on the destination: OMX demands a receiver phone outside EE, LV, LT
and FI, and inside them the buyer's email satisfies it. The storefront checks
presence and a country prefix; the carrier's own libphonenumber rules are left
to the carrier, at fulfilment, where the operator can act on a refusal."
```

---

### Task 9: The registration body

The largest pure function in this plan, and the one with the most cases. It
touches no network.

**Files:**

- Create: `backend/src/modules/omniva/shipment.ts`
- Test: `backend/tests/omniva-shipment.test.ts`

**Interfaces:**

- Consumes: `PRODUCT.customs` (Task 7), `EU_MEMBER_STATE_CODES` and
  `PARCEL_MACHINE_COUNTRY_CODES` (Task 1).
- Produces:

```ts
export interface OmnivaSenderConfig {
  readonly personName: string;
  readonly street?: string;
  readonly deliverypoint: string;   // city
  readonly postcode: string;
  readonly country: string;         // alpha-2
  readonly phone: string;
  readonly email: string;
}

export interface ShipmentRegistrationInput {
  readonly customerCode: string;
  readonly fulfillmentId: string;
  readonly deliveryChannel: "PARCEL_MACHINE" | "COURIER";
  readonly parcelMachineZip?: string;
  readonly sender: OmnivaSenderConfig;
  readonly order: {
    readonly email: string;
    readonly shippingAddress: {
      readonly firstName: string; readonly lastName: string;
      readonly address1: string; readonly postalCode: string;
      readonly city: string; readonly countryCode: string;
      readonly phone: string | null;
    };
    readonly items: readonly {
      readonly title: string; readonly quantity: number;
      readonly weightGrams: number | null; readonly unitPriceNet: number;
    }[];
  };
}

export function buildShipmentRegistration(input: ShipmentRegistrationInput): unknown;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { buildShipmentRegistration } from "../src/modules/omniva/shipment.js";

const SENDER = {
  personName: "Plepic Games OÜ", street: "Pihlaka tn 2", deliverypoint: "Jüri alevik",
  postcode: "75301", country: "EE", phone: "+37255550100", email: "info@example.com",
} as const;

function input(overrides: Record<string, unknown> = {}) {
  return {
    customerCode: "CUSTOMER", fulfillmentId: "ful_01JABCDEFGHJKMNPQRSTVWXYZ",
    deliveryChannel: "PARCEL_MACHINE" as const, parcelMachineZip: "10145", sender: SENDER,
    order: {
      email: "buyer@example.com",
      shippingAddress: {
        firstName: "Mari", lastName: "Tamm", address1: "Tee 1",
        postalCode: "10111", city: "Tallinn", countryCode: "EE", phone: null,
      },
      items: [{ title: "Lunar Base", quantity: 1, weightGrams: 300, unitPriceNet: 25 }],
    },
    ...overrides,
  };
}

function shipment(body: unknown) {
  return (body as { shipments: Record<string, never>[] }).shipments[0] as Record<string, never>;
}

describe("the OMX registration body", () => {
  it("registers an Estonian parcel machine against its offloadPostcode", () => {
    const one = shipment(buildShipmentRegistration(input())) as never as Record<string, never>;
    expect(one.mainService).toBe("PARCEL");
    expect(one.deliveryChannel).toBe("PARCEL_MACHINE");
    expect(one.receiverAddressee.address.offloadPostcode).toBe("10145");
    expect(one.receiverAddressee.contactEmail).toBe("buyer@example.com");
    expect(one.measurement.weight).toBe(0.3);
    // The buyer collects from the machine; a street address alongside an
    // offloadPostcode is two destinations for one parcel.
    expect(one.receiverAddressee.address.street).toBeUndefined();
    // servicePackage is mandatory only outside EE, LV and LT, and OMX refuses
    // an attribute that exists with no value.
    expect(one.servicePackage).toBeUndefined();
    expect(one.customs).toBeUndefined();
  });

  it("sends a service package and no delivery channel for a German courier order", () => {
    const one = shipment(buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order, shippingAddress: {
        firstName: "Anna", lastName: "Klein", address1: "Weg 3", postalCode: "10115",
        city: "Berlin", countryCode: "DE", phone: "+4930123456",
      } },
    })));
    expect(one.servicePackage).toEqual({ code: "ECONOMY" });
    expect(one.deliveryChannel).toBeUndefined();
    expect(one.contentDescription).toBe("Lunar Base");
    expect(one.receiverAddressee.contactPhone).toBe("+4930123456");
    expect(one.receiverAddressee.address.postcode).toBe("10115");
    expect(one.customs).toBeUndefined();   // Germany is in the EU
  });

  it("declares customs for a destination outside the EU", () => {
    const one = shipment(buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order, shippingAddress: {
        firstName: "Ann", lastName: "Lee", address1: "5th Ave", postalCode: "10001",
        city: "New York", countryCode: "US", phone: "+12125550100",
      } },
    })));
    expect(one.customs.goodsCategoryCode).toBe("SALE_OF_GOODS");
    expect(one.customs.shipmentItems).toEqual([{
      description: "Lunar Base", numberOfPieces: 1, weight: 0.3,
      financialValue: 25, tariffNumber: "9504400000", originCountry: "CHN",
    }]);
  });

  it("refuses more customs items than OMX accepts", () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      title: `Game ${String(index)}`, quantity: 1, weightGrams: 300, unitPriceNet: 25,
    }));
    expect(() => buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order, items, shippingAddress: {
        firstName: "Ann", lastName: "Lee", address1: "5th Ave", postalCode: "10001",
        city: "New York", countryCode: "US", phone: "+12125550100",
      } },
    }))).toThrow(/at most 8/i);
  });

  it("refuses an item with no weight rather than inventing one", () => {
    expect(() => buildShipmentRegistration(input({
      order: { ...input().order, items: [
        { title: "Lunar Base", quantity: 1, weightGrams: null, unitPriceNet: 25 },
      ] },
    }))).toThrow(/weight/i);
  });

  it("refuses a partner shipment id OMX would truncate", () => {
    expect(() => buildShipmentRegistration(input({
      fulfillmentId: "ful_0123456789012345678901234567890",
    }))).toThrow(/30 characters/i);
  });

  it("refuses a destination outside EE, LV, LT and FI with no phone number", () => {
    expect(() => buildShipmentRegistration(input({
      deliveryChannel: "COURIER", parcelMachineZip: undefined,
      order: { ...input().order, shippingAddress: {
        firstName: "Anna", lastName: "Klein", address1: "Weg 3", postalCode: "10115",
        city: "Berlin", countryCode: "DE", phone: null,
      } },
    }))).toThrow(/phone/i);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run tests/omniva-shipment.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the builder**

`backend/src/modules/omniva/shipment.ts`. Every refusal below is a message the
operator reads at fulfilment; write them to name the field and the order.

Rules to implement, each with the citation from the OMX manual v1.7 in a
comment:

- `mainService: "PARCEL"` always.
- `deliveryChannel` **only** when the destination is EE, LV or LT — mandatory
  there, and OMX requires that an attribute with no value not exist at all.
- `servicePackage: { code: "ECONOMY" }` **only** when the destination is not EE,
  LV or LT — mandatory there.
- `contentDescription`: the order's distinct item titles joined with `", "`.
- `measurement.weight`: sum of `weightGrams * quantity`, divided by 1000,
  rounded to three decimals. Refuse a `null` weight.
- `receiverAddressee`: `personName` from first + last; `contactEmail` always;
  `contactPhone` when present, and **required** when the destination is not EE,
  LV, LT or FI.
- The receiver address carries `offloadPostcode` **or** street/postcode/city,
  never both.
- `senderAddressee` from the config, with `address.deliverypoint`, `postcode`
  and `country` — all three mandatory per the manual.
- `customs` only when the destination is not an EU member state, capped at 8
  items.
- `partnerShipmentId` refused above 30 characters.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/omniva-shipment.test.ts
```

Expected: PASS, seven cases.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/omniva/shipment.ts backend/tests/omniva-shipment.test.ts
git commit -m "feat: build the OMX registration body

Pure, so every case is reachable without a network: an Estonian parcel machine,
a German courier order with its mandatory service package and phone, a United
States order with its customs declaration, and the four refusals -- nine customs
items, a weightless item, an oversized partner shipment id, and a missing phone
number where OMX requires one.

Each refusal names the field, because the operator reads it at fulfilment."
```

---

### Task 10: Registering, and the asymmetry between the two calls

**Files:**

- Create: `backend/src/modules/omniva/client.ts`
- Create: `backend/src/modules/omniva/config.ts`
- Modify: `backend/src/modules/omniva/service.ts`
- Test: `backend/tests/omniva-create-fulfillment.test.ts`

**Interfaces:**

- Produces:

```ts
export interface OmnivaConfig {
  readonly baseUrl: string; readonly apiUser: string;
  readonly apiPassword: string; readonly customerCode: string;
  readonly sender: OmnivaSenderConfig;
}
/** `null` when the environment does not configure Omniva. Never throws on absence. */
export function readOmnivaConfig(env: Record<string, string | undefined>): OmnivaConfig | null;

export class OmnivaClient {
  registerShipment(body: unknown): Promise<{ barcode: string }>;
  requestLabel(barcode: string): Promise<string>;   // base64 PDF
}
```

- [ ] **Step 1: Write the failing test**

Serve a stub OMX over a **real** `http.createServer` on a loopback port, not a
mocked `fetch` — the client's timeout, status handling and basic-auth header
must be on the path.

```ts
  it("registers, labels, and returns the barcode as the tracking number", async () => {
    const omx = await stubOmx({ register: { resultCode: "OK", savedShipments: [{ barcode: "CE123456789EE" }] },
                                label: { successAddressCards: [{ barcode: "CE123456789EE", filedata: "JVBERi0=" }] } });
    const result = await providerAgainst(omx).createFulfillment(
      { parcel_machine_zip: "10145" }, ITEMS, ORDER, { id: "ful_01JABCDEFGHJKMNPQRSTVWXYZ" },
    );
    expect(result.labels).toEqual([{
      tracking_number: "CE123456789EE",
      tracking_url: "https://www.omniva.ee/private/track-and-trace?barcode=CE123456789EE",
      label_url: "",
    }]);
    expect(result.data.barcode).toBe("CE123456789EE");
    expect(result.data.label_pdf_base64).toBe("JVBERi0=");
    expect(omx.authorizationHeaders).toEqual(["Basic " + Buffer.from("user:pass").toString("base64")]);
  });

  it("refuses the fulfilment when OMX refuses the registration", async () => {
    const omx = await stubOmx({ register: { resultCode: "ERROR", failedShipments: [
      { messageCode: "com.omniva.phoenix.omx.address.resolve.error", message: "Address not resolved: 'Tee 1'" },
    ] } });
    await expect(
      providerAgainst(omx).createFulfillment({}, ITEMS, ORDER, { id: "ful_1" }),
    ).rejects.toThrow(/Address not resolved/);
  });

  /**
   * The asymmetry, asserted rather than described.
   *
   * Registration creates a parcel and cannot be taken back; a label is a read
   * against a barcode that now exists. If a label failure failed the fulfilment,
   * the rollback would leave the parcel registered and the operator's retry
   * would register a SECOND one -- a transient timeout turned into a duplicate
   * shipment and a duplicate carrier charge.
   */
  it("keeps the fulfilment when the label fails after the shipment is registered", async () => {
    const omx = await stubOmx({
      register: { resultCode: "OK", savedShipments: [{ barcode: "CE123456789EE" }] },
      labelStatus: 500,
    });
    const result = await providerAgainst(omx).createFulfillment({}, ITEMS, ORDER, { id: "ful_1" });
    expect(result.data.barcode).toBe("CE123456789EE");
    expect(result.data.label_pdf_base64).toBeUndefined();
    expect(result.labels[0].tracking_number).toBe("CE123456789EE");
  });

  it("refuses to register at all when Omniva is not configured", async () => {
    await expect(
      unconfiguredProvider().createFulfillment({}, ITEMS, ORDER, { id: "ful_1" }),
    ).rejects.toThrow(/OMNIVA_API_USER|not configured/i);
  });
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run tests/omniva-create-fulfillment.test.ts
```

Expected: FAIL — `client.ts` and `config.ts` do not exist.

- [ ] **Step 3: Write `config.ts`**

```ts
/**
 * Omniva's configuration, or `null`.
 *
 * **Optional on purpose, and this function must never throw on absence.** The
 * test environment holds no Omniva credentials — Omniva has not issued a test
 * key — and a required variable would crash-loop its backend, its worker and
 * its predeploy Job, which is an Argo CD sync hook: the Application would stop
 * syncing entirely over a carrier integration nobody is testing yet.
 *
 * A **partially** configured environment is a different thing and does throw: it
 * is a manifest that meant to supply Omniva and got one variable wrong, and
 * failing at boot puts that in front of an operator who is already watching.
 */
export function readOmnivaConfig(
  env: Record<string, string | undefined>,
): OmnivaConfig | null {
  const names = ["OMNIVA_API_USER", "OMNIVA_API_PASSWORD", "OMNIVA_CUSTOMER_CODE", "OMNIVA_BASE_URL"];
  const present = names.filter((name) => (env[name] ?? "").trim().length > 0);
  if (present.length === 0) return null;
  if (present.length !== names.length) {
    const missing = names.filter((name) => !present.includes(name));
    throw new Error(`Omniva is partly configured; missing: ${missing.join(", ")}`);
  }
  // … read the sender block the same way, then return the config
}
```

- [ ] **Step 4: Write `client.ts` and `createFulfillment`**

The client sets `Authorization: Basic …`, `Content-Type: application/json`, an
`AbortSignal.timeout`, and refuses a non-OK status with the body's
`developerMessage` or `errors` intact. `registerShipment` refuses unless
`resultCode === "OK"` with exactly one `savedShipments` entry carrying a
barcode, and raises a `failedShipments` entry's `messageCode` and `message`
verbatim.

`createFulfillment` reads the config (throwing if `null`), builds the body,
registers, then requests the label **inside its own `try`** whose `catch` logs
and continues — the one place in this module where a failure does not propagate,
with the reasoning above written beside it.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run tests/omniva-create-fulfillment.test.ts
```

Expected: PASS, four cases.

- [ ] **Step 6: Assert the containment directly**

Add to `backend/tests/omniva-create-fulfillment.test.ts`, against real Medusa:

```ts
  it("leaves the order unfulfilled and silent when registration fails", async () => {
    const order = await placedOrder({ country_code: "ee" });
    await expect(fulfilOrder(order.id)).rejects.toThrow();

    const after = await readOrder(order.id);
    expect(after.fulfillments).toEqual([]);
    expect(await notificationsFor(order.id)).toEqual([
      // the confirmation only; no shipment notification exists to send
      expect.objectContaining({ trigger_type: "order.placed" }),
    ]);
  });
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/omniva backend/tests/omniva-create-fulfillment.test.ts
git commit -m "feat: register the shipment with Omniva on fulfilment

Registration lives in createFulfillment and nowhere else, so cart completion,
order.placed and the confirmation email never call Omniva. A refusal fails the
fulfilment in front of the operator; the order stays unfulfilled, can never be
marked shipped, and the customer is told nothing.

Labelling deliberately does not fail the fulfilment. Registration creates a
parcel and cannot be undone, so a rollback on a label timeout would leave the
parcel registered and turn the operator's retry into a second shipment."
```

---

### Task 11: Reaching the label from the Admin

**Files:**

- Create: `backend/src/admin/widgets/omniva-label.tsx`
- Create: `backend/src/api/admin/omniva/labels/[barcode]/route.ts`

- [ ] **Step 1: Write the widget**

An order-details widget listing each fulfilment's Omniva barcode with a
**Download label** button when `label_pdf_base64` is present, and a **Request
label** button when it is not — which is the step-3 failure path from Task 10,
and the retry that repairs it.

- [ ] **Step 2: Verify by hand**

```bash
cd ~/app/.worktrees/plepic/omniva-shipping && podman compose up -d
```

Fulfil a test order, confirm the button downloads a PDF, then delete the stored
PDF and confirm **Request label** restores it.

- [ ] **Step 3: Commit**

```bash
git add backend/src/admin backend/src/api/admin
git commit -m "feat: download an Omniva label from the order page

A stored label with no way to reach it is worse than no stored label. The
request button covers the case where registration succeeded and labelling did
not."
```

---

### Task 12: The credential reaches OpenBao

**Files (repo `hannosirkel/orange`):**

- Modify: `.keys/plepic-omniva` (local, never committed)
- Modify: `scripts/openbao-admin`
- Modify: `roles/openbao/defaults/main.yml`
- Modify: `roles/argocd/defaults/main.yml`
- Test: `tests/openbao_templates.yml`, `tests/external_secrets_templates.yml`

- [ ] **Step 1: Add the customer code to the key file**

The operator adds a third line, `customerCode=…`. Verify the shape without
reading the values:

```bash
cd ~/app/orange
sed -E 's/=.*/=<redacted>/' .keys/plepic-omniva
stat -c '%a' .keys/plepic-omniva
```

Expected: three lines `apiUser=`, `apiPassword=`, `customerCode=`, and mode
`600`. `read_regular_file` refuses any file carrying group or other bits.

- [ ] **Step 2: Write the failing contract test**

In `tests/openbao_templates.yml`, assert `plepic-omniva` is an approved seed
source. In `tests/external_secrets_templates.yml`, assert the `plepic` namespace
projects a `plepic-omniva` ExternalSecret with exactly the three keys, and
assert **`plepic-test` projects none** — the deferral stated as a test, so
adding the test import later is a deliberate edit rather than a drift.

- [ ] **Step 3: Run it to verify it fails**

```bash
cd ~/app/orange && bash scripts/validate
```

Expected: FAIL on the new assertions.

- [ ] **Step 4: Implement**

In `scripts/openbao-admin`, add the parser branch beside the existing
`plepic_database_admin` one:

```python
    if item.parser == "omniva":
        return parse_structured(source, ("apiUser", "apiPassword", "customerCode"))
```

and the generation:

```python
OMNIVA_SECRET_IMPORTS = (
    _secret(
        "plepic",
        "omniva/credentials",
        "plepic-omniva",
        "omniva",
    ),
)
```

registered as `13: OMNIVA_SECRET_IMPORTS` in `ADDITIVE_SECRET_IMPORTS`. **One
entry, `plepic` only.** The test namespace is deferred; `openbao-admin` refuses
`plepic` and `plepic-test` sources in one seed action anyway, so the test import
will always be its own run.

Add `plepic-omniva` to `openbao_seed_allowed_sources` in
`roles/openbao/defaults/main.yml`, sorted into the existing `plepic-*` block. Do
**not** add it to the `difference([...])` list in
`openbao_update_allowed_sources` — an Omniva credential is rotatable.

In `roles/argocd/defaults/main.yml`, add to the `plepic` namespace's
`projections`:

```yaml
      - external_secret: plepic-omniva
        optional_source: plepic-omniva
        store: openbao-plepic
        secret: plepic-omniva
        keys:
          - OMNIVA_API_PASSWORD
          - OMNIVA_API_USER
          - OMNIVA_CUSTOMER_CODE
        data:
          - target_key: OMNIVA_API_USER
            remote_key: omniva/credentials
            property: apiUser
          - target_key: OMNIVA_API_PASSWORD
            remote_key: omniva/credentials
            property: apiPassword
          - target_key: OMNIVA_CUSTOMER_CODE
            remote_key: omniva/credentials
            property: customerCode
```

Add the four sender-address fields and `OMNIVA_BASE_URL` to both environments in
`argocd_plepic_environments` — live `https://omx.omniva.eu`, test
`https://test-omx.omniva.eu`. The test environment gets the URL and no
credentials, which is the state the optional configuration is built for.

- [ ] **Step 5: Run the tests, then seed**

```bash
cd ~/app/orange && bash scripts/validate
ansible-playbook playbooks/openbao-seed.yml -e '{"openbao_seed_sources":["plepic-omniva"]}'
```

Expected: `scripts/validate` passes; the seed reports `changed`. Re-run it and
confirm `changed=0` — the import is idempotent or it is not finished.

- [ ] **Step 6: Commit**

```bash
git add scripts/openbao-admin roles/openbao/defaults/main.yml roles/argocd/defaults/main.yml tests/
git commit -m "feat: import the Omniva credential for the live shop

Live only. Omniva's test environment refuses the live key with 401 -- verified
against test-omx.omniva.eu on 2026-08-26 -- so the test import waits for a key
Omniva has not issued. That deferral is asserted rather than merely omitted: the
contract test says plepic-test projects no Omniva secret, so adding one later is
a deliberate edit."
```

---

### Task 13: The manifests project it

**Files (repo `hannosirkel/deploys`):**

- Modify: `plepic/base/backend.yaml`, `plepic/base/worker.yaml`
- Modify: `plepic/base/networkpolicy.yaml`
- Test: `plepic/tests/manifests.sh`

- [ ] **Step 1: Write the failing assertions**

In `plepic/tests/manifests.sh`, assert both workloads carry the three Omniva
variables **with `optional: true`**, that `OMNIVA_BASE_URL` is present, and that
the NetworkPolicy permits egress to Omniva on 443.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd ~/app/deploys && bash plepic/tests/manifests.sh
```

Expected: FAIL.

- [ ] **Step 3: Add the environment**

To `backend.yaml` and `worker.yaml`, beside the existing
`plepic-runtime-credentials` entries:

```yaml
            - name: OMNIVA_API_USER
              valueFrom: {secretKeyRef: {name: plepic-omniva, key: OMNIVA_API_USER, optional: true}}
            - name: OMNIVA_API_PASSWORD
              valueFrom: {secretKeyRef: {name: plepic-omniva, key: OMNIVA_API_PASSWORD, optional: true}}
            - name: OMNIVA_CUSTOMER_CODE
              valueFrom: {secretKeyRef: {name: plepic-omniva, key: OMNIVA_CUSTOMER_CODE, optional: true}}
```

`optional: true` on all three: without it a namespace holding no `plepic-omniva`
Secret cannot start its pods at all, which is exactly the test environment until
Omniva issues a key.

`OMNIVA_BASE_URL` and the four `MERCHANT_SENDER_*` values are ordinary
environment variables patched per environment by Orange, alongside the existing
`SITE_*` and `MERCHANT_*` values. Placeholders here stay placeholders — the
overlays use reserved example values by design.

Add the egress rule to `networkpolicy.yaml` for the backend and worker to reach
`omx.omniva.eu`, `test-omx.omniva.eu` and `www.omniva.ee` on TCP 443.

- [ ] **Step 4: Run the tests and both renders**

```bash
cd ~/app/deploys
bash plepic/tests/manifests.sh
kubectl kustomize plepic/overlays/live >/dev/null && kubectl kustomize plepic/overlays/test >/dev/null
```

Expected: PASS, both renders clean. **Do not hand-edit the digest lines** in
`plepic/overlays/*/kustomization.yaml` — they belong to
`scripts/update-gitops-digest.sh`.

- [ ] **Step 5: Commit**

```bash
git add plepic/
git commit -m "feat: project the Omniva credentials into the shop workloads

All three are optional. The test namespace holds no Omniva Secret until Omniva
issues a test key, and a required secretKeyRef there would stop its pods
starting at all."
```

---

## Self-review

**Spec coverage.** §1 → Task 1. §2 → Tasks 2, 4, 10, 11. §3 → Tasks 7, 8, 9.
§4 → Task 3. §5 → Tasks 5, 6. §6 → Tasks 10, 12, 13. §7 → Task 12. §8 → Task 13.
§9 → Task 10 step 6. §10 → distributed across every task's tests. §11 is
operator-owed and blocks Task 12 step 1 and Task 9's sender fields. §12 is
excluded scope and has no task, correctly.

**Two spec items with no task, deliberately.** The spec's suggestion that
`commerce-medusa-semantics.test.ts` assert the exact event set after
configuration is covered by that file's existing assertion, which will need its
count updated in Task 1 step 5 — called out there. The spec's note about
retiring the catalogue import's copies of the shipping upserts stays out of
scope, as the spec says.

**One risk this plan cannot retire in advance.** Task 2 step 5 is where a
declared `providers` array either does or does not displace `manual_manual`. If
it displaces it, `configureCommerce` fails on the first `Standard delivery`
option and every later task is blocked until the registration is corrected. It
is Task 2 rather than Task 9 for exactly that reason: it fails early and cheaply.
