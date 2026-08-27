import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils";
import type { FulfillmentOption, Logger } from "@medusajs/framework/types";

// Extensionless: see the comment on `index.ts`'s import of `./service`. This
// file is reached through the same MikroORM type-generation path, one hop
// further in, and hits the same resolution gap.
import { PARCEL_MACHINE_OPTION_NAME } from "../../commerce/shipping-model";
import { omnivaRedisCache } from "./redis-cache";
import { OmnivaLocations } from "./locations";
import type { OmnivaParcelMachine } from "./locations";

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
}
