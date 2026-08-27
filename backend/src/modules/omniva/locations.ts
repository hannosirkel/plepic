/**
 * The parcel machines a buyer may choose at checkout, and the one object that
 * reads them.
 *
 * Omniva publishes every location it operates -- parcel machines and post
 * offices, across every country it serves -- at
 * {@link OMNIVA_LOCATIONS_URL}, unauthenticated. This file narrows that feed
 * to what Task 3 actually needs: the parcel machines (not the post offices)
 * in Estonia, Latvia and Lithuania (not everywhere else Omniva operates),
 * keyed by the `ZIP` a shipment later registers a chosen machine against.
 *
 * The parse (`parseParcelMachines`, `parcelMachinesForCountry`) is pure and
 * synchronous, and is exercised in `tests/omniva-locations.test.ts` against
 * the *real* published list -- not a fixture. The shape of `locations.json`
 * is Omniva's to change without notice, and a fixture built from one day's
 * download would only ever prove this file's own reading of that day's
 * response; it would go green forever even if Omniva renamed `A0_NAME`
 * tomorrow, which is exactly the day this module would start silently
 * mis-sorting every machine into the wrong country.
 *
 * `OmnivaLocations` is the caching reader everything else in the backend goes
 * through -- see its own docstring for why there being exactly one of these
 * matters more than the caching does.
 */

import type { ICacheService } from "@medusajs/framework/types";

// Extensionless: see the comment on `index.ts`'s import of `./service`. This
// file lives in the same directory MikroORM's type-generation pass loads
// through a bare path rather than an npm package, and hits the same
// resolution gap `service.ts`'s import of this same module already works
// around.
import { PARCEL_MACHINE_COUNTRY_CODES } from "../../commerce/shipping-model";

/** Omniva's published location list. Public, and deliberately unauthenticated. */
export const OMNIVA_LOCATIONS_URL = "https://www.omniva.ee/locations.json";

/** `TYPE` in the published list. `"1"` is a post office, which is not offered. */
const PARCEL_MACHINE_TYPE = "0";

const COUNTRIES: ReadonlySet<string> = new Set(PARCEL_MACHINE_COUNTRY_CODES);

/** One machine a buyer may choose, narrowed from Omniva's published record. */
export interface OmnivaParcelMachine {
  /** The `ZIP` -- the `offloadPostcode` a shipment registers against. Unique across the list. */
  readonly zip: string;
  readonly name: string;
  /** `"<county> — <town>"`, rendered as the `<optgroup>` label. */
  readonly group: string;
  readonly countryCode: string;
}

/**
 * Where the list is fetched from, and how long a fetched copy is trusted for.
 *
 * Exported, rather than folded into two constructor parameters, so that a
 * caller can hand `OmnivaLocations` one value instead of two positionally
 * ordered ones that are easy to swap by mistake (a URL is a string and a TTL
 * is a number; nothing about two bare constructor arguments stops one being
 * passed for the other). {@link DEFAULT_OMNIVA_LOCATION_SOURCE} is what
 * every real caller uses; a test substitutes its own to point the fetch at a
 * stub without touching the cache TTL, or vice versa.
 */
export interface OmnivaLocationSource {
  readonly url: string;
  readonly cacheTtlSeconds: number;
}

/**
 * Six hours: long enough that a buyer's checkout, and the next hundred
 * buyers' checkouts, never wait on Omniva at all, short enough that a machine
 * Omniva adds or removes shows up the same business day. Omniva's own
 * network changes on the order of weeks, not hours -- this number is chosen
 * for load, not for freshness.
 */
const DEFAULT_CACHE_TTL_SECONDS = 6 * 60 * 60;

export const DEFAULT_OMNIVA_LOCATION_SOURCE: OmnivaLocationSource = {
  url: OMNIVA_LOCATIONS_URL,
  cacheTtlSeconds: DEFAULT_CACHE_TTL_SECONDS,
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The published list, narrowed to what a buyer may choose and a shipment may
 * name.
 *
 * An entry missing a ZIP or a name is **dropped rather than repaired**: it is
 * a machine no shipment could be addressed to, and inventing a label for it
 * would put an unselectable option on the checkout. A payload that is not a
 * list at all **throws**, because that is Omniva changing the contract
 * rather than one bad row -- the difference between "this one machine is
 * unusable" and "this file no longer knows how to read the feed at all", and
 * the two deserve different responses: drop the row, refuse the file.
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

/**
 * The subset of `all` in one country, grouped and alphabetised the way a
 * checkout `<select>` presents them: by `<optgroup>` (county — town) first,
 * then by machine name within it. Order is not asserted against Omniva's own
 * feed order because Omniva does not promise one.
 */
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

/** Where the parsed list is cached. Versioned so a shape change can be rolled out by bumping the suffix rather than by racing an old cached shape. */
const CACHE_KEY = "omniva:parcel-machines:v1";

/**
 * The location list, fetched once and cached.
 *
 * **One reader.** A later task's fulfillment-data validation resolves a
 * buyer's chosen ZIP through this same object, so the list a buyer picked
 * their machine from and the list their ZIP is checked against cannot
 * disagree -- which they could if, say, the storefront fetched its own copy
 * of `locations.json` to render the `<select>` and the backend fetched a
 * second, independently-timed copy to validate the choice.
 *
 * It is also **the only thing in this backend that talks to Omniva's
 * location feed at all**: the checkout reaches this data through
 * `/store/omniva/parcel-machines`, same-origin, rather than the buyer's
 * browser fetching `omniva.ee` directly -- see that route's docstring for why
 * that specifically is a CSP requirement rather than a style preference.
 *
 * Caching is keyed on {@link CACHE_KEY} through `Modules.CACHE`'s
 * `ICacheService`, whose `get` cannot distinguish "nothing was ever written
 * here" from "the entry aged past its TTL and the module discarded it" --
 * both answer `null`. That means this class cannot tell "no fresh copy yet"
 * apart from "no copy at all", so it does not attempt to serve a stale
 * answer on a failed refetch: doing that well would mean keeping a second,
 * separately-aged copy and deciding how long a stale list stays trustworthy
 * and whether a prolonged Omniva outage should keep quietly serving last
 * week's machines rather than surfacing as a fault -- a real design decision
 * nobody has made yet. Until it is, a fetch that fails (a non-2xx response,
 * or a payload {@link parseParcelMachines} rejects) throws, exactly as an
 * empty parse does: an empty `<select>` at checkout is a broken-looking page
 * with no visible cause, and a thrown error at least names itself to
 * whoever is reading the logs.
 */
export class OmnivaLocations {
  constructor(
    private readonly cache: ICacheService,
    private readonly source: OmnivaLocationSource = DEFAULT_OMNIVA_LOCATION_SOURCE,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async all(): Promise<readonly OmnivaParcelMachine[]> {
    const cached = await this.cache.get<readonly OmnivaParcelMachine[]>(CACHE_KEY);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
    const response = await this.fetcher(this.source.url);
    if (!response.ok) {
      throw new Error(`The Omniva location list answered ${String(response.status)}`);
    }
    const machines = parseParcelMachines(await response.json());
    if (machines.length === 0) {
      throw new Error("The Omniva location list carried no parcel machines");
    }
    await this.cache.set(CACHE_KEY, machines, this.source.cacheTtlSeconds);
    return machines;
  }

  /** The machines a buyer in `countryCode` may choose from, grouped and alphabetised. */
  async list(countryCode: string): Promise<readonly OmnivaParcelMachine[]> {
    return parcelMachinesForCountry(await this.all(), countryCode);
  }

  /** The machine registered under `zip`, or `null` if no machine on the list carries it. */
  async find(zip: string): Promise<OmnivaParcelMachine | null> {
    const wanted = zip.trim();
    return (await this.all()).find((machine) => machine.zip === wanted) ?? null;
  }
}
