import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils";
import type {
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
} from "@medusajs/framework/types";

// Extensionless: see the comment on `index.ts`'s import of `./service`. This
// file is reached through the same MikroORM type-generation path, one hop
// further in, and hits the same resolution gap.
import { PARCEL_MACHINE_OPTION_NAME } from "../../commerce/shipping-model";
import { PRODUCT } from "../../commerce/product-model";
import { omnivaRedisCache } from "./redis-cache";
import { OmnivaLocations } from "./locations";
import type { OmnivaParcelMachine } from "./locations";
import { OmnivaClient } from "./client";
import { readOmnivaConfig } from "./config";
import { buildShipmentRegistration } from "./shipment";

/** The parcel machine method's option id, as `getFulfillmentOptions` returns it. */
export const OMNIVA_PARCEL_MACHINE_OPTION_ID = "omniva-parcel-machine";
/** The courier method's option id. Not sold yet; Task 9 registers against it. */
export const OMNIVA_COURIER_OPTION_ID = "omniva-courier";

/**
 * The two `OmnivaLocations` methods `validateFulfillmentData` actually calls.
 *
 * Narrower than `OmnivaLocations` itself so that
 * `tests/omniva-validate-fulfillment-data.test.ts` can substitute a stub built
 * from a fixed, in-memory list of {@link OmnivaParcelMachine} values — no
 * Redis, no fetch, no `OMNIVA_LOCATIONS_URL` — while still exercising exactly
 * the lookup logic under test. A real `OmnivaLocations` satisfies this
 * structurally without change, so nothing about the production path is
 * shaped differently to accommodate a test double.
 */
interface OmnivaLocationsReader {
  list(countryCode: string): Promise<readonly OmnivaParcelMachine[]>;
  find(zip: string): Promise<OmnivaParcelMachine | null>;
}

/**
 * What this provider takes from the module's own container —
 * `AbstractFulfillmentProviderService`'s constructor's first parameter, per
 * its own docstring. Everything else it needs (`OmnivaLocations`,
 * `omnivaRedisCache()`) it builds for itself, the same way
 * `/store/omniva/parcel-machines` does, rather than resolving a shared
 * instance from the container — there is no module-level registration of
 * either, on purpose: see `redis-cache.ts`'s docstring for why
 * `omnivaRedisCache()` is a process-wide singleton function rather than a
 * container entry.
 */
interface InjectedDependencies {
  readonly logger?: Logger;
}

/**
 * Omniva, as a Medusa fulfillment provider.
 *
 * Registration with the carrier happens in `createFulfillment` and **nowhere
 * else**, so the customer's path — cart completion, `order.placed`, the
 * confirmation email — never calls Omniva. A refusal here fails the fulfilment
 * in front of the operator, which is the containment the design asks for, and
 * it is structural rather than a `try`/`catch` a later edit could remove.
 *
 * ## What this containment claim rests on, and what proves it
 *
 * `tests/omniva-create-fulfillment.test.ts` proves three things at this
 * provider's boundary, against a real `http.createServer` stub rather than a
 * mocked `fetch` (see that file's own header for why): `createFulfillment`
 * throws when OMX refuses a registration; it does **not** throw when only
 * the label call fails; and it refuses outright when Omniva is unconfigured.
 *
 * What no test in this repository walks is the far side of that first
 * throw: payment → order → fulfilment attempt → the fulfilment staying
 * absent → no shipment-notification email going out. This repository's only
 * real-Medusa harness, `scripts/store-smoke`, cannot place a *paid* order
 * without Stripe, which its tests deliberately do not reach — so that walk
 * cannot be built honestly here.
 *
 * **What follows is a citation, not a hedge — both files were read to
 * confirm it, not assumed.** `FulfillmentModuleService.createFulfillment`
 * (`node_modules/@medusajs/fulfillment/dist/services/
 * fulfillment-module-service.js:184-201`) wraps the call into *this* class's
 * `createFulfillment` in a `try` whose `catch` runs
 * `this.fulfillmentService_.delete(fulfillment.id, sharedContext)` and
 * rethrows — so a throw from this method leaves no fulfilment row behind,
 * not a half-written one. One level up, `createFulfillmentStep`
 * (`@medusajs/core-flows`, `dist/fulfillment/steps/create-fulfillment.js`)
 * calls `service.createFulfillment(data)` with nothing around it — no `try`,
 * no `catch` — so that rethrown error fails the step itself, before its
 * `StepResponse` exists and therefore before the step has anything for its
 * own compensation function to act on. (That compensation function, for what
 * it is worth, is `container.resolve(Modules.FULFILLMENT).cancelFulfillment(id)`,
 * which — per the same `fulfillment-module-service.js`, `cancelFulfillment`,
 * line 711 onward — calls this class's own `cancelFulfillment`, the one this
 * file now implements; see its own docstring for why it refuses rather than
 * calls Omniva.)
 *
 * A Medusa upgrade that changed either of those two facts — the `try`/`catch`
 * around the provider call, or the absence of one around the step — would not
 * fail any test in this backend; it would only be found by a customer
 * receiving a shipment email for a parcel Omniva never actually registered,
 * unless whoever upgrades Medusa reads this paragraph, and the two files it
 * cites, first.
 */
export default class OmnivaFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "omniva";

  private readonly logger: Logger | undefined;
  private locationsReader: OmnivaLocationsReader | undefined;

  /**
   * Takes only the module container's `logger`. `AbstractFulfillmentProviderService`
   * documents a second constructor parameter for a module's own configuration
   * options; this provider is configured entirely by `shipping-model.ts` and
   * the environment `omnivaRedisCache()` reads, so there is no `options`
   * parameter to accept.
   *
   * The dependencies object defaults to `{}`, which is what lets this class be
   * constructed with **no arguments at all** —
   * `tests/omniva-validate-fulfillment-data.test.ts` does exactly that, then
   * overwrites {@link locations} with a stub before calling
   * `validateFulfillmentData`. Medusa itself never omits the argument; it
   * always resolves the module container and passes it. But a constructor
   * that *required* one to avoid throwing would force every test of this
   * provider to first build a container, for a provider that needs nothing
   * from one except somewhere to log a cache fallback.
   */
  constructor({ logger }: InjectedDependencies = {}) {
    super();
    this.logger = logger;
  }

  /**
   * The one reader every buyer's parcel machine choice is resolved through —
   * see `OmnivaLocations`'s own docstring for why there being exactly one of
   * these, shared with `/store/omniva/parcel-machines`, is the point of this
   * property existing at all, rather than `validateFulfillmentData` fetching
   * or caching its own copy.
   *
   * **Built lazily, on first read, not in the constructor.** Medusa
   * constructs every registered provider while it boots the framework, before
   * any request has asked this one to do anything, and `omnivaRedisCache()`
   * reads `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` from the environment the
   * moment it is called, throwing if any of the three is unset — see its own
   * docstring for why that read is deliberately not done at module load
   * either. Building the real `OmnivaLocations` here, in the constructor,
   * would turn "Omniva is registered as a fulfillment provider" into "the
   * backend cannot boot without Redis configured", for every process that
   * loads this module — including a unit test that imports the service only
   * to check that a courier method's data passes through untouched, and never
   * looks up a machine at all. Deferring the build to first read ties the
   * requirement to actual use, the same way `omnivaRedisCache()` itself
   * defers reading the environment to first call rather than to import.
   *
   * The setter is what lets a test substitute a stub built from a fixed list
   * of machines (see {@link OmnivaLocationsReader}) without ever constructing
   * the real `OmnivaLocations`, its Redis cache, or a client that would try to
   * dial Redis the moment this file is imported.
   */
  get locations(): OmnivaLocationsReader {
    this.locationsReader ??= new OmnivaLocations({
      cache: omnivaRedisCache(),
      logger: this.logger,
    });
    return this.locationsReader;
  }

  set locations(reader: OmnivaLocationsReader) {
    this.locationsReader = reader;
  }

  /**
   * The two delivery channels OMX serves. `optionData` carries the channel so
   * that the registration body reads it from the option rather than comparing
   * the option's display name, which an operator can rename in the Admin.
   */
  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      { id: OMNIVA_PARCEL_MACHINE_OPTION_ID, name: PARCEL_MACHINE_OPTION_NAME, deliveryChannel: "PARCEL_MACHINE" },
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

  /**
   * The buyer's parcel machine choice, checked in the only place it is
   * checked.
   *
   * A courier or manual delivery method's `data` is returned **untouched**:
   * `optionData.id` is the discriminator `commerce/configuration.ts`'s
   * `omnivaOptionData()` writes onto the shipping option row precisely so
   * this comparison can be made on it rather than on the option's
   * admin-editable display name, and every method but the parcel machine one
   * carries no `deliveryChannel` at all, let alone this one's id.
   *
   * For the parcel machine method, four things are checked in order, each one
   * only reachable once the one before it has passed:
   *
   * 1. A ZIP was actually submitted — an empty checkout `<select>`, or a
   *    request built by hand, is refused before anything is looked up.
   * 2. The ZIP resolves to a real machine on {@link locations} — a stale or
   *    fabricated ZIP is refused rather than silently stored, which is what
   *    would happen if this method trusted the buyer's `data` outright.
   * 3. That machine's country matches the cart's delivery address — a Latvian
   *    machine on an Estonian order is a parcel with nowhere for the courier
   *    to route it, and the buyer is still on the checkout page here, so a
   *    refusal now is one they can act on immediately, rather than a failed
   *    fulfilment discovered by an operator days later.
   * 4. Only then is the shipping method's `data` produced — and it stores the
   *    machine's **name beside its ZIP on purpose.** The name is what the
   *    buyer chose; Omniva renames and relocates machines over time, and a
   *    shipping label that re-derived the name from the ZIP at print time
   *    would show a different machine from the one on the order, with
   *    nothing anywhere to notice the drift.
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

  /**
   * Registers a real parcel with Omniva. See this class's own docstring for
   * why this is the *only* place that happens, and `client.ts`'s header for
   * why the two OMX calls inside this method are allowed to fail so
   * differently.
   *
   * ## Reading the four Medusa-supplied parameters
   *
   * `data` is the shipping method's own `data` — what `validateFulfillmentData`
   * wrote at checkout. It carries `parcel_machine_zip` only when the buyer
   * chose the Omniva parcel-machine method; a Standard-delivery order's
   * `data` never carries it, whatever the destination. That single field
   * doubles as this method's `deliveryChannel` signal: a parcel machine only
   * exists in Estonia, Latvia or Lithuania (`PARCEL_MACHINE_COUNTRY_CODES` in
   * `../../commerce/shipping-model`), so "the buyer chose a machine" and
   * "this shipment registers as `PARCEL_MACHINE`" are the same fact — a
   * Latvian *courier* order still correctly registers as `COURIER` even
   * though Latvia has machines, because that order's `data` never gained a
   * `parcel_machine_zip` in the first place.
   *
   * This is also, deliberately, *not* read from the shipping option's own
   * `data` (`{id, deliveryChannel}`, written by
   * `../../commerce/configuration.ts`'s `omnivaOptionData()`), even though
   * that field exists and names the same thing: the real
   * `createOrderFulfillmentWorkflow` (`@medusajs/core-flows`,
   * `order/workflows/create-fulfillment.js`, read to confirm this rather than
   * assumed) never populates `fulfillment.shipping_option` on the object it
   * hands this method — the fulfilment record's own `{ items, data,
   * provider_id, ...fulfillmentRest }` destructure keeps everything else
   * *but* that relation. A design that read `fulfillment.shipping_option.data`
   * here would work against every stub in this file's own tests and fail
   * silently in production the first time a real order reached it.
   *
   * `items` and `order` are the fulfilment's line items and the order graph
   * query, respectively, confirmed against that same workflow's source:
   * `items` carries a title and a quantity and nothing about weight or
   * price, and `order` carries the shipping address and the buyer's email.
   * Because this shop sells exactly one physical product — `PRODUCT` in
   * `../../commerce/product-model`, frozen: one SKU, one net price, one box —
   * this method reads the weight and the net unit price from `PRODUCT`
   * rather than from anything carried on a line item. `../shipment.ts`
   * already made this same choice for the customs block's
   * `tariffNumber`/`originCountry`/`goodsCategoryCode`, and for the same
   * reason: there is exactly one true answer, declared once, and reading it
   * from the order would only be a second, independently-driftable copy of a
   * fact that cannot vary.
   */
  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>,
  ): Promise<CreateFulfillmentResult> {
    const config = readOmnivaConfig(process.env);
    if (config === null) {
      throw new Error(
        "Omniva is not configured: set OMNIVA_API_USER, OMNIVA_API_PASSWORD, " +
          "OMNIVA_CUSTOMER_CODE, OMNIVA_BASE_URL and the merchant sender variables " +
          "before an Omniva shipment can be registered",
      );
    }
    const client = new OmnivaClient(config);

    // Ruling R18: refused, not coerced to `""`. `partnerShipmentId` (built
    // from `fulfillmentId` below) is the only key that links an OMX parcel
    // back to this fulfilment -- exactly what an operator needs to check
    // "did this fulfilment already register a parcel?" after the ambiguous
    // failure `client.ts`'s `registerShipment` names above. Registering with
    // no reference would defeat the reconciliation that message exists to
    // enable, and Medusa always supplies a fulfilment id here, so this is a
    // defensive check against a shape Medusa is not expected to send, not a
    // real-world branch this method has to accommodate.
    if (typeof fulfillment.id !== "string" || fulfillment.id.trim().length === 0) {
      throw new Error(
        "Cannot register an Omniva shipment for a fulfilment with no id; " +
          "partnerShipmentId would have nothing to link the parcel back to",
      );
    }
    const fulfillmentId = fulfillment.id;
    const parcelMachineZip =
      typeof data.parcel_machine_zip === "string" && data.parcel_machine_zip.trim().length > 0
        ? data.parcel_machine_zip
        : undefined;
    const parcelMachineName =
      typeof data.parcel_machine_name === "string" ? data.parcel_machine_name : undefined;
    const shippingAddress = order?.shipping_address;

    const registrationBody = buildShipmentRegistration({
      customerCode: config.customerCode,
      fulfillmentId,
      deliveryChannel: parcelMachineZip !== undefined ? "PARCEL_MACHINE" : "COURIER",
      parcelMachineZip,
      sender: config.sender,
      order: {
        email: order?.email ?? "",
        shippingAddress: {
          firstName: shippingAddress?.first_name ?? "",
          lastName: shippingAddress?.last_name ?? "",
          address1: shippingAddress?.address_1 ?? "",
          postalCode: shippingAddress?.postal_code ?? "",
          city: shippingAddress?.city ?? "",
          countryCode: shippingAddress?.country_code ?? "",
          phone: shippingAddress?.phone ?? null,
        },
        items: items.map((item) => ({
          title: typeof item.title === "string" ? item.title : PRODUCT.title,
          quantity: typeof item.quantity === "number" ? item.quantity : 1,
          weightGrams: PRODUCT.packaging.weightGrams,
          unitPriceNet: PRODUCT.amountMinor / 100,
        })),
      },
    });

    // Registration: creates a real parcel. Cannot be undone from here, so a
    // refusal propagates unchanged -- see this class's own docstring and
    // `client.ts`'s header for the full reasoning. `fulfillmentId` is passed
    // through so an ambiguous failure (see `registerShipment`'s own
    // docstring) names this fulfilment rather than leaving an operator to
    // work out which one from context.
    const { barcode } = await client.registerShipment(registrationBody, fulfillmentId);

    // Labelling: deliberately isolated in its own try/catch, and this is the
    // one place in this module where a failure does not propagate.
    //
    // Registration, above, just created a parcel that cannot be taken back.
    // A label, by contrast, is only a *read* against a barcode that now
    // exists -- asking for it again changes nothing at Omniva. If this
    // `catch` re-threw, `createFulfillment` throwing here would make
    // Medusa's `createFulfillmentWorkflow` roll the fulfilment back (its
    // compensation deletes the fulfilment row this step just created), and
    // the operator's retry would call this method again from the top --
    // registering a SECOND parcel and incurring a second carrier charge for
    // what may have been nothing more than a transient timeout on OMX's
    // side. So: catch it, log it so an operator can see the barcode exists
    // and re-request its label by hand, and return the fulfilment anyway.
    let labelPdfBase64: string | undefined;
    try {
      labelPdfBase64 = await client.requestLabel(barcode);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger?.error(
        `Omniva shipment ${barcode} registered, but its label could not be fetched: ${reason}`,
      );
    }

    return {
      data: {
        barcode,
        ...(labelPdfBase64 !== undefined ? { label_pdf_base64: labelPdfBase64 } : {}),
        ...(parcelMachineZip !== undefined ? { parcel_machine_zip: parcelMachineZip } : {}),
        ...(parcelMachineName !== undefined ? { parcel_machine_name: parcelMachineName } : {}),
      },
      labels: [{
        tracking_number: barcode,
        tracking_url: `https://www.omniva.ee/private/track-and-trace?barcode=${barcode}`,
        label_url: "",
      }],
    };
  }

  /**
   * Refuses, naming the barcode. Not an omission: `client.ts:8-15` states it
   * plainly — OMX API manual v1.7 has **no unregister call**, only a
   * courier-pickup cancellation and a return-shipment registration, neither
   * of which erases the original parcel. `AbstractFulfillmentProviderService`
   * (`@medusajs/utils`) throws `"cancelFulfillment must be overridden by the
   * child class"` when a provider does not supply one, and
   * `@medusajs/fulfillment-manual` overrides it (returning `{}`, since a
   * manual rate cancels nothing at a carrier). Leaving this provider's
   * inherited from the base class would mean an operator using the Admin's
   * **Cancel fulfilment** action, or a later workflow step failing and
   * triggering `createFulfillmentStep`'s compensation (see this class's own
   * docstring above for the exact call chain, cited rather than assumed),
   * sees a message naming `AbstractFulfillmentProviderService` — true, but
   * useless to someone who did not write this module.
   *
   * **This is a refusal, not a policy decision, and the two are not the
   * same thing.** The design's §2 enumerates exactly four provider methods —
   * `getFulfillmentOptions`, `validateFulfillmentData`, `canCalculate`,
   * `createFulfillment` — and does not mention this one, because OMX simply
   * has nothing behind it. An operator might reasonably prefer a different
   * behaviour here: for instance, letting Medusa mark the fulfilment
   * cancelled locally while the parcel stays live at Omniva, with the
   * mismatch reconciled by hand. That is a real, debatable choice this file
   * does not make. What it does instead is refuse honestly, so the gap is
   * visible at the point someone hits it rather than quietly papered over by
   * a `return {}` that would make Medusa believe a live parcel had been
   * cancelled when nothing happened at the carrier at all — the same "log
   * and continue" shape §9 of the design spends a whole section refusing for
   * `createFulfillment`, for the same reason.
   *
   * `data` is the fulfilment's own `data` — this class's `createFulfillment`
   * return value, so it carries `barcode` whenever one was ever assigned.
   * Named in the message when present; when absent (a fulfilment that never
   * reached a successful registration — see `createFulfillment`'s refusal
   * paths above) the message says so rather than printing `undefined`.
   */
  async cancelFulfillment(data: Record<string, unknown>): Promise<unknown> {
    const barcode = typeof data.barcode === "string" && data.barcode.trim().length > 0
      ? data.barcode.trim()
      : null;
    throw new Error(
      barcode !== null
        ? `Omniva (OMX v1.7) has no shipment-cancellation endpoint. Parcel ${barcode} ` +
          "cannot be cancelled from Medusa -- cancel it in Omniva's e-service instead."
        : "Omniva (OMX v1.7) has no shipment-cancellation endpoint, and this fulfilment " +
          "carries no barcode to look it up by in Omniva's e-service either.",
    );
  }
}
