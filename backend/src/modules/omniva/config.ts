/**
 * Omniva's configuration, or `null` -- read from the environment once, by
 * `service.ts`'s `createFulfillment`, and nowhere else.
 *
 * **Optional on purpose, and this function must never throw on total
 * absence.** Omniva has not issued this project a test credential, so the
 * `plepic-test` environment holds none of the four `OMNIVA_*` variables
 * below, and none of the `MERCHANT_SENDER_*`/`MERCHANT_PHONE_NUMBER` ones
 * either. Every other required variable in `../../config/runtime.ts` is
 * listed in `requiredEnvironmentVariables`, and a missing one there crashes
 * the backend, the worker *and* the predeploy Job before any of the three
 * ever binds a socket. That Job is an Argo CD sync hook -- see
 * `../../config/runtime.ts`'s own docstring on `requiredEnvironmentVariables`
 * -- so a required-but-unset Omniva variable would not just fail one carrier
 * integration; it would stop the whole Application from syncing, over a
 * feature nobody in that environment is testing yet. That is why none of
 * these names are added to `requiredEnvironmentVariables`, and why this
 * function, not that list, is where the requirement lives.
 *
 * **A partially configured environment is a different thing, and it throws.**
 * Once *any* of {@link OMNIVA_PRESENCE_NAMES} is set, every name in
 * {@link REQUIRED_OMNIVA_NAMES} must be too, or this throws naming what is
 * missing. That is not "Omniva is off" -- it is a manifest that meant to turn
 * Omniva on and typoed or omitted one variable, and the failure belongs at
 * boot, in front of the operator who is already editing that manifest, not
 * three requests later as a `createFulfillment` throw an operator has to
 * trace back to a missing variable by hand.
 *
 * ## Ruling R17 -- presence is keyed on the four `OMNIVA_*` names only
 *
 * {@link OMNIVA_PRESENCE_NAMES} -- the names whose presence *alone* is read
 * as "someone means to configure Omniva" -- is deliberately narrower than
 * {@link REQUIRED_OMNIVA_NAMES} -- the names a *complete* configuration must
 * set. The four `OMNIVA_*` names are unambiguously Omniva's own: nothing
 * else in this codebase has a reason to set `OMNIVA_BASE_URL`. The merchant
 * sender facts (`MERCHANT_SENDER_CITY`, `MERCHANT_SENDER_POSTCODE`,
 * `MERCHANT_SENDER_COUNTRY`, `MERCHANT_PHONE_NUMBER`) are not: they describe
 * the merchant, not this carrier integration, and `MERCHANT_PHONE_NUMBER`
 * specifically is *already* a storefront-required variable
 * (`storefront/src/config/runtime-env.ts`, mandatory under CRD Art. 6(1)(c))
 * for a reason that has nothing to do with Omniva. Today the backend process
 * never receives it unless an operator sets it for Omniva, so this
 * distinction changes no behaviour yet -- but if a `deploys` overlay ever
 * hands the backend and the storefront a shared merchant `ConfigMap` (both
 * already read `MERCHANT_LEGAL_NAME`/`MERCHANT_CONTACT_ADDRESS`, so this is
 * not a remote scenario), keying presence on all nine names would make
 * `readOmnivaConfig` throw "partly configured" on an environment that never
 * meant to configure Omniva at all -- for the single reason that a phone
 * number the storefront needs for an unrelated purpose happened to also be
 * visible to the backend. Once Omniva *is* known to be configured (by an
 * `OMNIVA_*` name being present), the merchant sender variables go back to
 * being required, same as before -- R17 only narrows what counts as
 * evidence, not what a complete configuration needs.
 *
 * `MERCHANT_LEGAL_NAME` and `MERCHANT_CONTACT_ADDRESS` are, for the same
 * reason as ever, not counted in either list. Both are already
 * unconditionally required by `../../config/runtime.ts`'s
 * `requiredEnvironmentVariables`, so they are always set by the time any
 * request reaches this function -- and counting an always-present variable
 * in an "is anything set" check would make that check always true, defeating
 * the one guarantee this file exists to give. They are read directly, at the
 * bottom, once Omniva is known to be (fully) configured, and reused rather
 * than re-declared because the merchant has exactly one legal name and one
 * contact address, and `../../config/runtime.ts` is already the one place
 * that reads either.
 */

import type { OmnivaSenderConfig } from "./shipment";

export interface OmnivaConfig {
  readonly baseUrl: string;
  readonly apiUser: string;
  readonly apiPassword: string;
  readonly customerCode: string;
  readonly sender: OmnivaSenderConfig;
}

type Environment = Record<string, string | undefined>;

/**
 * The names whose presence *alone* is evidence someone meant to configure
 * Omniva. See ruling R17 in this file's header for why this is narrower than
 * {@link REQUIRED_OMNIVA_NAMES} -- these four are unambiguously Omniva's;
 * the merchant sender facts are not.
 */
const OMNIVA_PRESENCE_NAMES = [
  "OMNIVA_API_USER",
  "OMNIVA_API_PASSWORD",
  "OMNIVA_CUSTOMER_CODE",
  "OMNIVA_BASE_URL",
] as const;

/**
 * Every name a *complete* Omniva configuration must set, once
 * {@link OMNIVA_PRESENCE_NAMES} says one is being configured at all.
 *
 * `MERCHANT_SENDER_STREET` is the one sender name absent here: OMX documents
 * it as optional, mandating only the city, postcode and country, so its own
 * absence is not a misconfiguration -- it is `OmnivaSenderConfig.street`
 * staying `undefined`, exactly as `../shipment.ts`'s
 * `buildShipmentRegistration` already expects.
 */
const REQUIRED_OMNIVA_NAMES = [
  ...OMNIVA_PRESENCE_NAMES,
  "MERCHANT_SENDER_CITY",
  "MERCHANT_SENDER_POSTCODE",
  "MERCHANT_SENDER_COUNTRY",
  "MERCHANT_PHONE_NUMBER",
] as const;

function isSet(env: Environment, name: string): boolean {
  return (env[name] ?? "").trim().length > 0;
}

function trimmed(env: Environment, name: string): string {
  return (env[name] ?? "").trim();
}

/**
 * See this file's header for the optionality rule, ruling R17, and why
 * neither is negotiable.
 */
export function readOmnivaConfig(env: Environment): OmnivaConfig | null {
  if (!OMNIVA_PRESENCE_NAMES.some((name) => isSet(env, name))) {
    return null;
  }

  const missing = REQUIRED_OMNIVA_NAMES.filter((name) => !isSet(env, name));
  if (missing.length > 0) {
    throw new Error(
      `Omniva is partly configured; set every one of ${REQUIRED_OMNIVA_NAMES.join(", ")} or none of them. Missing: ${missing.join(", ")}`,
    );
  }

  return {
    baseUrl: trimmed(env, "OMNIVA_BASE_URL"),
    apiUser: trimmed(env, "OMNIVA_API_USER"),
    apiPassword: trimmed(env, "OMNIVA_API_PASSWORD"),
    customerCode: trimmed(env, "OMNIVA_CUSTOMER_CODE"),
    sender: {
      personName: trimmed(env, "MERCHANT_LEGAL_NAME"),
      ...(isSet(env, "MERCHANT_SENDER_STREET")
        ? { street: trimmed(env, "MERCHANT_SENDER_STREET") }
        : {}),
      deliverypoint: trimmed(env, "MERCHANT_SENDER_CITY"),
      postcode: trimmed(env, "MERCHANT_SENDER_POSTCODE"),
      country: trimmed(env, "MERCHANT_SENDER_COUNTRY"),
      phone: trimmed(env, "MERCHANT_PHONE_NUMBER"),
      email: trimmed(env, "MERCHANT_CONTACT_ADDRESS"),
    },
  };
}
