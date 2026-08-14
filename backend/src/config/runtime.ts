import { join } from "node:path";

// Extensionless on purpose, unlike the rest of `src/`. `medusa-config.ts`
// imports this module, and the Medusa config loader evaluates that file through
// ts-node before anything is compiled — which resolves a relative specifier
// literally and cannot map a `.js` suffix back onto the `.ts` file beside it.
// A `.js` here fails `medusa build` with "Cannot find module", and the Job that
// runs from the built image never starts.
import {
  assertExpectedArchiveDigest,
  assertExpectedEnvironmentIdentity,
  type ImportEnvironmentIdentity,
} from "../catalogue-import/refusal";

export interface BackendRuntimeConfig {
  readonly databaseUrl: string;
  readonly http: {
    readonly storeCors: string;
    readonly adminCors: string;
    readonly authCors: string;
    readonly jwtSecret: string;
    readonly cookieSecret: string;
  };
  readonly stripe: {
    readonly apiKey: string;
    readonly webhookSecret: string;
    readonly paymentMethodConfiguration: string;
  };
  readonly smtp: {
    readonly host: string;
    readonly port: 587;
    readonly username: string;
    readonly password: string;
    readonly envelopeFrom: string;
  };
  readonly contactMailRecipient: string;
  readonly turnstileSecretKey: string;
  readonly orderConfirmationLegal: OrderConfirmationLegalConfig;
}

export interface NewsletterRuntimeConfig {
  readonly apiKey: string;
  readonly listId: number;
  readonly turnstileSecretKey: string;
}

export interface CheckoutTurnstileRuntimeConfig {
  readonly secretKey: string;
}

export interface NewsletterRateLimitRuntimeConfig {
  readonly redisHost: string;
  readonly redisPort: number;
  readonly redisPassword: string;
  readonly maximum: number;
  readonly windowSeconds: number;
}

export interface CatalogueImportRuntimeConfig {
  readonly archivePath: string;
  readonly mediaRoot: string;
  readonly expectedArchiveSha256: string;
  readonly environmentIdentity: ImportEnvironmentIdentity;
}

export interface OrderConfirmationLegalConfig {
  readonly merchantLegalName: string;
  readonly merchantRegisteredAddress: string;
  readonly merchantContactAddress: string;
  readonly returnAddress: string;
}

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

const requiredEnvironmentVariables = [
  "DATABASE_URL",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "STORE_CORS",
  "ADMIN_CORS",
  "AUTH_CORS",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PAYMENT_METHOD_CONFIGURATION_ID",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USERNAME",
  "SMTP_PASSWORD",
  "SMTP_ENVELOPE_FROM",
  "CONTACT_MAIL_RECIPIENT",
  "TURNSTILE_SECRET_KEY",
  "MERCHANT_LEGAL_NAME",
  "MERCHANT_REGISTERED_ADDRESS",
  "MERCHANT_CONTACT_ADDRESS",
  "MERCHANT_RETURN_ADDRESS",
] as const;

function requireEnvironmentValue(environment: RuntimeEnvironment, name: string): string {
  const value = environment[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required backend environment variable: ${name}`);
  }

  return value;
}

function requireEmailAddress(environment: RuntimeEnvironment, name: string): string {
  const value = requireEnvironmentValue(environment, name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /[\r\n]/.test(value)) {
    throw new Error(`${name} must be a single email address`);
  }
  return value;
}

function requireSingleLineValue(environment: RuntimeEnvironment, name: string): string {
  const value = requireEnvironmentValue(environment, name);
  if (/[\r\n]/.test(value)) {
    throw new Error(`${name} must be a single line`);
  }
  return value;
}

function requirePositiveInteger(environment: RuntimeEnvironment, name: string): number {
  const value = requireEnvironmentValue(environment, name);

  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`${name} must be a positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

export function readOrderConfirmationLegalConfig(
  environment: RuntimeEnvironment,
): OrderConfirmationLegalConfig {
  return {
    merchantLegalName: requireSingleLineValue(environment, "MERCHANT_LEGAL_NAME"),
    merchantRegisteredAddress: requireSingleLineValue(
      environment,
      "MERCHANT_REGISTERED_ADDRESS",
    ),
    merchantContactAddress: requireEmailAddress(environment, "MERCHANT_CONTACT_ADDRESS"),
    returnAddress: requireSingleLineValue(environment, "MERCHANT_RETURN_ADDRESS"),
  };
}

export function readNewsletterRuntimeConfig(
  environment: RuntimeEnvironment,
): NewsletterRuntimeConfig {
  return {
    apiKey: requireEnvironmentValue(environment, "NEWSLETTER_API_KEY"),
    listId: requirePositiveInteger(environment, "NEWSLETTER_LIST_ID"),
    turnstileSecretKey: requireEnvironmentValue(environment, "TURNSTILE_SECRET_KEY"),
  };
}

/** Reads only the secret required by the standard checkout completion route. */
export function readCheckoutTurnstileRuntimeConfig(
  environment: RuntimeEnvironment,
): CheckoutTurnstileRuntimeConfig {
  return { secretKey: requireEnvironmentValue(environment, "TURNSTILE_SECRET_KEY") };
}

/** The manifest's second mount of the assets PVC, `subPath: import`. */
const DEFAULT_ARCHIVE_PATH = "/var/lib/plepic/import/catalogue.tar.gz";

/**
 * Where the staged archive is, without judging anything else.
 *
 * This cannot throw, and that is its job. The command has to know which file to
 * dispose of *before* it knows whether it is configured well enough to run, or
 * a configuration refusal leaves a WooCommerce export staged on a volume that
 * is also the served assets root.
 */
export function catalogueImportArchivePath(environment: RuntimeEnvironment): string {
  const configured = environment.CATALOGUE_IMPORT_ARCHIVE_PATH?.trim();
  return configured === undefined || configured.length === 0 ? DEFAULT_ARCHIVE_PATH : configured;
}

/**
 * The directory Medusa serves under `/static/*`, derived from the framework's
 * own base directory.
 *
 * `@medusajs/framework`'s express loader mounts
 * `express.static(path.join(baseDir, "static"))` unconditionally, and
 * `@medusajs/file-local` defaults its `upload_dir` to the same
 * `<cwd>/static` — and under `medusa exec` the base directory *is* the working
 * directory. Deriving the import's media root from the same value is what keeps
 * "the import writes where Medusa serves" a mechanical fact rather than a
 * comment: there is no `MEDIA_ROOT` to set to a fourth directory. The Job
 * mounts the assets PVC at the app root's `static`, so the same derivation is
 * what puts the files on the volume.
 *
 * `configManager.baseDir` is typed `string` but is `undefined` until a config
 * is loaded, so the parameter is widened to say so. Guarding only `""` left an
 * unloaded config manager raising `TypeError: Cannot read properties of
 * undefined (reading 'trim')` — the archive was still disposed of, but the
 * operator was told about a dereference rather than about the base directory.
 */
export function mediaRootForBaseDir(baseDir: string | undefined): string {
  if (typeof baseDir !== "string" || baseDir.trim().length === 0) {
    throw new Error("The Medusa base directory is not known; the media root cannot be derived");
  }
  return join(baseDir, "static");
}

/**
 * The catalogue import's configuration.
 *
 * The expected checksum and the environment identity are read here — from the
 * deployment's own environment — and never from a file staged next to the
 * archive, because an archive that carries its own checksum proves only that it
 * is internally consistent. Both are required, and an unset or malformed one
 * raises the same `expected-value-unset` refusal every other refusal path
 * raises: an import that cannot tell which archive it expects, or which
 * environment it is, refuses rather than proceeding.
 */
export function readCatalogueImportRuntimeConfig(
  environment: RuntimeEnvironment,
  baseDir: string | undefined,
): CatalogueImportRuntimeConfig {
  const expectedArchiveSha256 = assertExpectedArchiveDigest(
    environment.CATALOGUE_IMPORT_ARCHIVE_SHA256,
  );
  const environmentIdentity = assertExpectedEnvironmentIdentity(
    environment.CATALOGUE_IMPORT_ENVIRONMENT,
  );

  return {
    archivePath: catalogueImportArchivePath(environment),
    mediaRoot: mediaRootForBaseDir(baseDir),
    expectedArchiveSha256,
    environmentIdentity,
  };
}

export function readNewsletterRateLimitRuntimeConfig(
  environment: RuntimeEnvironment,
): NewsletterRateLimitRuntimeConfig {
  return {
    redisHost: requireEnvironmentValue(environment, "REDIS_HOST"),
    redisPort: requirePositiveInteger(environment, "REDIS_PORT"),
    redisPassword: requireEnvironmentValue(environment, "REDIS_PASSWORD"),
    maximum: requirePositiveInteger(environment, "NEWSLETTER_RATE_LIMIT_MAX"),
    windowSeconds: requirePositiveInteger(
      environment,
      "NEWSLETTER_RATE_LIMIT_WINDOW_SECONDS",
    ),
  };
}

/**
 * Read the backend's deployment-supplied configuration without adding
 * environment-specific defaults to the application image.
 */
export function readBackendRuntimeConfig(environment: RuntimeEnvironment): BackendRuntimeConfig {
  for (const name of requiredEnvironmentVariables) {
    requireEnvironmentValue(environment, name);
  }

  const smtpPort = requireEnvironmentValue(environment, "SMTP_PORT");

  if (smtpPort !== "587") {
    throw new Error("SMTP_PORT must be exactly 587 for STARTTLS submission");
  }

  return {
    databaseUrl: requireEnvironmentValue(environment, "DATABASE_URL"),
    http: {
      storeCors: requireEnvironmentValue(environment, "STORE_CORS"),
      adminCors: requireEnvironmentValue(environment, "ADMIN_CORS"),
      authCors: requireEnvironmentValue(environment, "AUTH_CORS"),
      jwtSecret: requireEnvironmentValue(environment, "JWT_SECRET"),
      cookieSecret: requireEnvironmentValue(environment, "COOKIE_SECRET"),
    },
    stripe: {
      apiKey: requireEnvironmentValue(environment, "STRIPE_SECRET_KEY"),
      webhookSecret: requireEnvironmentValue(environment, "STRIPE_WEBHOOK_SECRET"),
      paymentMethodConfiguration: requireEnvironmentValue(
        environment,
        "STRIPE_PAYMENT_METHOD_CONFIGURATION_ID",
      ),
    },
    smtp: {
      host: requireEnvironmentValue(environment, "SMTP_HOST"),
      port: 587,
      username: requireEnvironmentValue(environment, "SMTP_USERNAME"),
      password: requireEnvironmentValue(environment, "SMTP_PASSWORD"),
      envelopeFrom: requireEmailAddress(environment, "SMTP_ENVELOPE_FROM"),
    },
    contactMailRecipient: requireEmailAddress(environment, "CONTACT_MAIL_RECIPIENT"),
    turnstileSecretKey: requireEnvironmentValue(environment, "TURNSTILE_SECRET_KEY"),
    orderConfirmationLegal: readOrderConfirmationLegalConfig(environment),
  };
}
