/**
 * The destination a visitor is being quoted for, and the country list it is
 * chosen from.
 *
 * ## Why a destination exists at all
 *
 * The advertised figure is the **net** price. Estonian VAT is added for a
 * delivery address in the EU and is not added anywhere else — see
 * `backend/src/commerce/tax-model.ts`, which is where that rule is declared and
 * the only place a rate is written down. So there is no single figure that is
 * "the price": there is a figure per destination, and a page that prints one
 * without saying which destination it belongs to has told a visitor something
 * that is true of somebody else.
 *
 * The destination is therefore a first-class input to everything that renders
 * a price. {@link Destination} is a country out of `mock/countries.json` — the
 * same list the checkout's delivery-address field offers, and the same
 * `euMember` flag the shipping zone is priced from, so the destination a
 * visitor sets and the address they later confirm are answered by one list
 * rather than two.
 *
 * ## The default is the United States, and that is an operator decision
 *
 * {@link DEFAULT_DESTINATION_CODE} is `US`, so a visitor who never touches the
 * selector is quoted the net figure with no VAT. The operator chose this
 * knowing the consequence: an EU visitor who does not touch it sees the net
 * figure and is charged the gross one at checkout, once their delivery address
 * is known.
 *
 * **That choice is only honest because the figure never renders alone.**
 * `src/lib/catalogue.ts` composes the destination and the tax state into the
 * qualification that sits beside every price it resolves, so the net figure
 * reads as *"No VAT added, delivering to United States"* rather than as *"the
 * price"*. Removing that qualification, or rendering `price` without it, is
 * what turns the default into a misstatement — it is a requirement of the
 * decision, not a decoration on it.
 *
 * ## Where the control lives, and where it does not
 *
 * `src/components/shop/DestinationSelector.tsx` is rendered **once**, in the
 * product hero, directly under the figure it governs. Not twice: two selects
 * on one page saying the same thing is two controls a reader has to reconcile,
 * and every other surface that shows a price carries the destination in
 * *words* through `priceTaxQualifier` regardless.
 *
 * It is deliberately **absent from `/checkout`**. That screen has a delivery
 * address, and a delivery address is a better answer to the same question — a
 * second control there could disagree with the address a buyer is being
 * charged on, which is the one thing this whole change is trying to make
 * impossible. `/cart` has no selector for a narrower reason: its figures come
 * from the Medusa cart rather than from a server render, so a change there
 * would need the cart re-priced as well as the page re-rendered, and a control
 * that appeared to work while half the screen lagged is worse than no control.
 * The basket states its destination in words and the product page is one link
 * away.
 *
 * ## The territories this gets wrong, on purpose and on the record
 *
 * `euMember` is EU **membership**, and EU membership is not the EU VAT
 * territory. Eight places are inside a member state and outside the VAT
 * territory — the Canary Islands, Ceuta and Melilla (Spain), Büsingen and
 * Heligoland (Germany), Livigno and Campione d'Italia (Italy), and Mount Athos
 * (Greece) — and a delivery address in any of them is quoted, and charged, the
 * EU figure. Nothing in `mock/countries.json` can express them: they are not
 * ISO 3166-1 entries, so they arrive as `ES`, `DE`, `IT` and `GR` and are
 * indistinguishable from the mainland at the granularity this site works at.
 *
 * **This is an accepted documented limitation, not an oversight.** Resolving it
 * needs postcode-level tax rules in `backend/src/commerce/tax-model.ts` and a
 * checkout that asks for a region as well as a country, which is a larger
 * commercial and administrative decision than a storefront can make. It is
 * recorded here because the alternative is that somebody rediscovers it as a
 * defect.
 *
 * ## It never guesses
 *
 * {@link destinationForCode} is total and falls back to the default for a code
 * it does not recognise, because the value reaches it from a cookie a browser
 * may have truncated, an extension may have rewritten, or a visitor may have
 * typed. The honest answer to an unrecognised destination is the declared
 * default — which is stated on the page beside the figure — rather than a
 * guess at what was meant. This is the mirror image of
 * `zoneForCountryName`'s refusal in `src/lib/cart.ts`: there, an unrecognised
 * country must not be *charged* a rate, so it produces none; here, an
 * unrecognised destination must still produce a page, so it produces the one
 * the operator declared.
 */

import countriesSource from "../../mock/countries.json";
import { DEFAULT_LOCALE, type Locale } from "../../../content/routes.js";

/**
 * One country a parcel can be sent to, as `storefront/mock/countries.json`
 * holds it.
 *
 * `name` is what the delivery-address form submits and what the Article 8(2)
 * delivery-address disclosure shows; `code` is ISO 3166-1 alpha-2 and is what
 * the destination cookie carries and what Medusa is told. **`euMember` means
 * "one of the 27 EU member states"**, and nothing wider — not the VAT
 * territory and not the customs territory. See `zoneForCountryName` in
 * `src/lib/cart.ts`.
 */
export interface DeliveryCountry {
  readonly code: string;
  readonly name: string;
  readonly euMember: boolean;
}

interface CountriesFile {
  readonly countries: readonly DeliveryCountry[];
}

/**
 * Every country the delivery-address field offers and the destination
 * selector lists, in the order it offers them — see
 * `storefront/mock/countries.json`.
 *
 * All of them, because `content/legal/shipping.ts` says "We ship to every
 * country" and narrowing that is a commercial decision the operator has not
 * made.
 */
export const deliveryCountries: readonly DeliveryCountry[] = (countriesSource as CountriesFile)
  .countries;

/** A destination is a country off that list. The alias names the role. */
export type Destination = DeliveryCountry;

/**
 * The destination a visitor is quoted for until they choose another.
 *
 * The operator's decision, and deliberately **not** an EU country: see this
 * module's doc comment for the consequence and for the mitigation that makes
 * it honest.
 */
export const DEFAULT_DESTINATION_CODE = "US";

/**
 * The cookie the chosen destination is kept in.
 *
 * A **cookie**, not `sessionStorage`, for two reasons that are both about
 * where the price is composed. The price is server-rendered, so the server has
 * to be able to read the destination before the first byte — session storage
 * is invisible to it and would mean painting one figure and replacing it after
 * hydration. And a destination is a statement about where somebody lives, not
 * about one tab, so it has to survive a second tab and a return visit.
 *
 * It is a **first-party cookie this site sets itself**, which is a disclosure
 * event before it is a technical one: `/legal/privacy` carries a table
 * captioned "Cookies this site can set", and
 * `tests/browser-storage-disclosure.test.ts` refuses a cookie write that has
 * no row in it. Both editions of that table carry this cookie.
 */
export const DESTINATION_COOKIE_NAME = "plepic_destination";

/** One year. Long enough to survive a return visit; short enough to lapse. */
export const DESTINATION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const COUNTRIES_BY_CODE: ReadonlyMap<string, Destination> = new Map(
  deliveryCountries.map((country) => [country.code.toUpperCase(), country]),
);

function requireDefault(): Destination {
  const fallback = COUNTRIES_BY_CODE.get(DEFAULT_DESTINATION_CODE);
  if (fallback === undefined) {
    throw new Error(
      `storefront/mock/countries.json no longer lists ${DEFAULT_DESTINATION_CODE}, which is the ` +
        "destination every price on this site falls back to. A visitor who has chosen nothing " +
        "would have no destination and therefore no figure at all.",
    );
  }
  return fallback;
}

/** The destination a visitor is quoted for before they choose one. */
export const defaultDestination: Destination = requireDefault();

/**
 * The country the **catalogue** is priced in when the Store API is asked for
 * both amounts. Estonia, where the shop is established.
 *
 * This is not the visitor's destination and is deliberately not derived from
 * it. `GET /store/products` computes `calculated_amount_with_tax` only for the
 * tax context the request names, so asking in the visitor's own country would
 * return `with_tax === without_tax` for every non-EU visitor — and this site
 * needs **both** figures for every visitor, not one. `/legal/shipping` states
 * the EU gross figure to a reader in Tokyo ("For delivery to an address in the
 * European Union … the price of the goods is then {priceGross}"), and
 * `src/lib/product-jsonld.ts` publishes it to a crawler that has no
 * destination at all. A pair that collapsed outside the EU would make both of
 * those say the net figure instead of the gross one.
 *
 * So the request is destination-**independent**: one context, one pair of
 * amounts, and `src/lib/catalogue.ts` selects between them per destination.
 * That also means every visitor and every crawler is served the same two
 * figures, which is what stops the price varying by requester IP.
 *
 * **It is sound because there is one EU rate.** `backend/src/commerce/tax-model.ts`
 * charges Estonia's domestic rate on every EU destination — below the
 * intra-Community distance-selling threshold a supplier charges its own
 * country's VAT — so "the EU gross figure" is a single figure rather than
 * twenty-seven. Crossing that threshold is a commercial event with an
 * administrative answer, and it is a change to that file **and to this
 * constant**, which is why the two say so about each other.
 */
export const VAT_PRICING_COUNTRY_CODE = "EE";

/**
 * Refuses a reference country the shipping data does not consider European, at
 * import.
 *
 * The two facts are held in different files by different owners —
 * `mock/countries.json` says which countries are EU member states, this module
 * says which one the catalogue is priced in — and a reference country that had
 * fallen out of the first would ask Medusa for a tax context that produces no
 * tax, which surfaces as `store-product.ts` refusing every catalogue load with
 * a message about configuration. This says the real reason instead.
 */
if (COUNTRIES_BY_CODE.get(VAT_PRICING_COUNTRY_CODE)?.euMember !== true) {
  throw new Error(
    `storefront/mock/countries.json does not flag ${VAT_PRICING_COUNTRY_CODE} as an EU member state, ` +
      "so the catalogue would be priced in a country that is charged no VAT and the gross figure " +
      "every page states would silently become the net one.",
  );
}

/**
 * The destination an ISO 3166-1 alpha-2 code names, or the default.
 *
 * Total, case-insensitive on the code, and never `null`: see this module's doc
 * comment for why an unrecognised value resolves to the declared default here
 * while an unrecognised *delivery country* resolves to no shipping zone at
 * all.
 */
export function destinationForCode(code: string | null | undefined): Destination {
  if (typeof code !== "string") return defaultDestination;
  return COUNTRIES_BY_CODE.get(code.trim().toUpperCase()) ?? defaultDestination;
}

/**
 * A destination's name in the edition being served.
 *
 * `mock/countries.json` holds English names, because that is what the delivery
 * form submits and what the Article 8(2) delivery-address disclosure shows. But
 * the name also ends up **inside a sentence on a legal page**, through the price
 * qualification — and `/et/legal/shipping` may not render an English one, since
 * that qualification is the emphasised first line under the heading of an
 * approved page.
 *
 * ICU does the translating. `Intl.DisplayNames` is where the English names in
 * `countries.json` came from in the first place (see that file's `$comment`),
 * so asking it for another edition's names is using the same source rather than
 * introducing a second one — and it covers all 249 entries rather than the
 * subset anybody would hand-translate.
 *
 * **What ICU gives is pinned rather than trusted, and the failure mode is not
 * the obvious one.** A runtime built against small-icu does not answer with the
 * code — `Intl.DisplayNames` falls back to the *default* locale and answers in
 * **English**, so `destinationNameIn(estonia, "et")` would quietly return
 * "Estonia" and the Estonian legal page would read "…sihtkohta Estonia". A
 * guard comparing the answer to the code cannot see that, and an earlier
 * revision of this comment claimed it could.
 *
 * So the check is on the **locale**, not the answer:
 * `supportedLocalesOf` reports whether ICU has data for the edition at all, and
 * an unsupported edition falls back to the English name deliberately rather
 * than by accident.
 *
 * `tests/destination.test.ts` pins **four** names against expected values — the
 * default destination, the VAT country, and two large member states — asserts
 * that most of the list is translated rather than a curated subset, and asserts
 * no edition ever yields a bare code. Four rather than twenty-eight, and this
 * sentence says four: an earlier revision claimed the 27 member states were
 * pinned when they were not, which is the same shape of overstatement as the
 * guard it was written to correct.
 */
const displayNamesByLocale = new Map<Locale, Intl.DisplayNames | null>();

function displayNamesFor(locale: Locale): Intl.DisplayNames | null {
  if (!displayNamesByLocale.has(locale)) {
    try {
      displayNamesByLocale.set(locale, new Intl.DisplayNames([locale], { type: "region" }));
    } catch {
      displayNamesByLocale.set(locale, null);
    }
  }
  return displayNamesByLocale.get(locale) ?? null;
}

export function destinationNameIn(destination: Destination, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return destination.name;
  // The locale, not the answer — see this function's doc comment. A runtime
  // with no data for this edition answers in English, which is exactly what
  // `destination.name` already is, so there is nothing to gain by asking.
  if (Intl.DisplayNames.supportedLocalesOf([locale]).length === 0) return destination.name;
  let translated: string | undefined;
  try {
    translated = displayNamesFor(locale)?.of(destination.code.toUpperCase());
  } catch {
    translated = undefined;
  }
  return translated ?? destination.name;
}

/**
 * The destination an ISO 3166-1 alpha-2 code names, or `null` when this site
 * does not list it.
 *
 * The strict counterpart of {@link destinationForCode}, and the difference is
 * about **where the code came from**. A cookie is a value a browser or an
 * extension may have mangled, and the honest answer to a mangled one is the
 * declared default, which the page states beside the figure. A country code off
 * a **confirmed order** is not that: it is what a buyer is being charged
 * against, and defaulting an unrecognised one to the United States would put
 * "No VAT added" over a taxed order. That gets no destination at all, and the
 * screen says so — the same choice `CheckoutPageContent` makes for a delivery
 * address whose country it does not know.
 */
export function knownDestinationForCode(code: string | null | undefined): Destination | null {
  if (typeof code !== "string") return null;
  return COUNTRIES_BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

/**
 * The destination a country **name** names, or `null`.
 *
 * Exact, for the reason `zoneForCountryName` is exact: the name arrives from a
 * `<select>` over {@link deliveryCountries}, so anything else is a value the
 * form could not have produced, and a lookup that repairs its input can repair
 * it wrongly.
 */
export function destinationForCountryName(name: string): Destination | null {
  return deliveryCountries.find((country) => country.name === name) ?? null;
}
