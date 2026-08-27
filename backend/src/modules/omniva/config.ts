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
 * Nine variables answer to Omniva: the four below, plus
 * `MERCHANT_SENDER_CITY`, `MERCHANT_SENDER_POSTCODE`,
 * `MERCHANT_SENDER_COUNTRY`, `MERCHANT_PHONE_NUMBER`, and the genuinely
 * optional `MERCHANT_SENDER_STREET` (optional for the same reason it is
 * optional on {@link OmnivaSenderConfig} itself -- OMX documents the sender's
 * street as optional and mandates only the city, postcode and country). If
 * *any* of the eight mandatory names is set while another is not, that is not
 * "Omniva is off" -- it is a manifest that meant to turn Omniva on and typoed
 * or omitted one variable, and the failure belongs at boot, in front of the
 * operator who is already editing that manifest, not three requests later as
 * a `createFulfillment` throw an operator has to trace back to a missing
 * variable by hand.
 *
 * `MERCHANT_LEGAL_NAME` and `MERCHANT_CONTACT_ADDRESS` are deliberately
 * **not** counted among the nine. Both are already unconditionally required
 * by `../../config/runtime.ts`'s `requiredEnvironmentVariables`, so they are
 * always set by the time any request reaches this function -- and counting
 * an always-present variable in an "is anything set" check would make that
 * check always true, which would make this function throw a "partly
 * configured" error in *every* environment that has never configured Omniva
 * at all, defeating the one guarantee this file exists to give. They are read
 * directly, at the bottom, once Omniva is known to be (fully) configured, and
 * reused rather than re-declared because the merchant has exactly one legal
 * name and one contact address, and `../../config/runtime.ts` is already the
 * one place that reads either.
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

/** Every name that, alone, is evidence someone meant to configure Omniva. */
const ALL_OMNIVA_NAMES = [
  "OMNIVA_API_USER",
  "OMNIVA_API_PASSWORD",
  "OMNIVA_CUSTOMER_CODE",
  "OMNIVA_BASE_URL",
  "MERCHANT_SENDER_STREET",
  "MERCHANT_SENDER_CITY",
  "MERCHANT_SENDER_POSTCODE",
  "MERCHANT_SENDER_COUNTRY",
  "MERCHANT_PHONE_NUMBER",
] as const;

/**
 * Every name a *complete* Omniva configuration must set.
 *
 * `MERCHANT_SENDER_STREET` is the one name in {@link ALL_OMNIVA_NAMES} absent
 * here: it is evidence Omniva is being configured when it is the only thing
 * set, but its own absence once everything else is set is not a
 * misconfiguration -- it is `OmnivaSenderConfig.street` staying `undefined`,
 * exactly as `../shipment.ts`'s `buildShipmentRegistration` already expects.
 */
const REQUIRED_OMNIVA_NAMES = ALL_OMNIVA_NAMES.filter(
  (name) => name !== "MERCHANT_SENDER_STREET",
);

function isSet(env: Environment, name: string): boolean {
  return (env[name] ?? "").trim().length > 0;
}

function trimmed(env: Environment, name: string): string {
  return (env[name] ?? "").trim();
}

/**
 * See this file's header for the optionality rule and why it is not
 * negotiable.
 */
export function readOmnivaConfig(env: Environment): OmnivaConfig | null {
  if (!ALL_OMNIVA_NAMES.some((name) => isSet(env, name))) {
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
