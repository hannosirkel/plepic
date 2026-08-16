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
import { resolveDatabaseUrl } from "./database-url";

export interface BackendRuntimeConfig {
  readonly databaseUrl: string;
  readonly redis: RedisRuntimeConfig;
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

/**
 * The one Redis this deployment has, as three parts rather than a URL.
 *
 * The `deploys` manifests project `REDIS_HOST`, `REDIS_PORT` and
 * `REDIS_PASSWORD` into every workload that needs Redis, and no manifest on
 * either side of that seam declares a `REDIS_URL`. Composing the URL here is
 * what keeps that true: there is one place that decides what a Redis address
 * looks like, and it is this file.
 */
export interface RedisRuntimeConfig {
  readonly host: string;
  readonly port: number;
  readonly password: string;
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

/**
 * `DATABASE_URL` is deliberately absent from this list. The database connection
 * has two accepted forms — an explicit URL, or the five `DATABASE_*` parts the
 * `deploys` manifests project — and only {@link resolveDatabaseUrl} can say
 * whether the environment supplies either. Demanding the URL here is what made
 * the backend Deployment crash-loop against manifests that supply the parts.
 */
const requiredEnvironmentVariables = [
  "JWT_SECRET",
  "COOKIE_SECRET",
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

/**
 * Required to be **declared**, permitted to be empty — and nothing else is.
 *
 * Every `deploys` workload running this image sets all three to `value: ""`, on
 * purpose. Cart and checkout require no CORS origin at all: the storefront
 * proxies `/store-api` on its own origin and the Admin is same-origin on the
 * backend, so a hostname here would be a second way in that the exposure
 * boundary does not allow.
 *
 * An empty list is genuinely restrictive rather than permissive, which is the
 * only reason this is safe. `parseCorsOrigins("")` returns `[]`, and the `cors`
 * middleware given `origin: []` matches nothing and sends no
 * `Access-Control-Allow-Origin` header at all — every cross-origin caller is
 * denied. It is Medusa's own default for all three, not a value it treats
 * specially.
 */
const requiredPossiblyEmptyEnvironmentVariables = [
  "STORE_CORS",
  "ADMIN_CORS",
  "AUTH_CORS",
] as const;

function requireEnvironmentValue(environment: RuntimeEnvironment, name: string): string {
  const value = environment[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required backend environment variable: ${name}`);
  }

  return value;
}

/**
 * Require the variable to be declared, and permit it to be declared empty.
 *
 * The distinction the plain requirement could not draw: an **absent** variable
 * is a workload that forgot it and must not start, while `value: ""` is a
 * deliberate statement that there are no origins. Both used to raise the same
 * refusal, so a manifest that said exactly what the plan mandates could not
 * start either.
 *
 * **Whitespace is refused**, which is a choice between two ways of being wrong.
 * `value: ""` is how a manifest says empty; whitespace is never a deliberate
 * way to say it, so refusing it costs nothing anyone meant. Accepting it would
 * absorb a templating slip into a backend that starts, looks healthy, and
 * quietly denies an origin somebody meant to allow — found at checkout, if
 * ever. Refusing surfaces it at start, before any traffic, which is the one
 * moment an operator is already watching. It is the same direction every other
 * refusal in this file goes.
 */
function requireDeclaredEnvironmentValue(environment: RuntimeEnvironment, name: string): string {
  const declared = environment[name];

  if (declared === undefined) {
    throw new Error(`Missing required backend environment variable: ${name}`);
  }

  const value = declared.trim();

  if (declared.length > 0 && value.length === 0) {
    throw new Error(`${name} may be declared empty, but must not be whitespace only`);
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

/**
 * A host the composed URL cannot be talked out of.
 *
 * `REDIS_HOST` becomes the authority of a `redis://` URL, so a value carrying
 * `/`, `@`, `:` or whitespace would not be a host at all — it would be a second
 * chance to name a different server, a different port, or a set of credentials,
 * from a variable whose only job is to say which Service to dial. Restricting
 * it to a DNS label set is what makes {@link redisConnectionUrl} a composition
 * rather than a concatenation.
 *
 * IPv6 literals are refused with everything else. In-cluster Redis is reached
 * by Service name and CI and `compose.yaml` reach it at `127.0.0.1` or `redis`;
 * nothing this image runs against needs bracket notation, and accepting it
 * would mean accepting the `:` that makes the rest of the rule pointless.
 */
const REDIS_HOST_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*$/;

export function readRedisRuntimeConfig(environment: RuntimeEnvironment): RedisRuntimeConfig {
  const host = requireEnvironmentValue(environment, "REDIS_HOST");

  if (!REDIS_HOST_PATTERN.test(host)) {
    throw new Error(
      "REDIS_HOST must be a hostname or IPv4 address, with no scheme, port or credentials",
    );
  }

  const port = requirePositiveInteger(environment, "REDIS_PORT");

  if (port > 65535) {
    throw new Error("REDIS_PORT must be a TCP port, between 1 and 65535");
  }

  return { host, port, password: requireEnvironmentValue(environment, "REDIS_PASSWORD") };
}

/**
 * `redis://host:port`, and deliberately **no credentials in it**.
 *
 * Every Redis consumer in this image — the session store, the event bus, the
 * workflow engine and the locking provider — is handed this URL alongside
 * {@link redisConnectionOptions}, and ioredis authenticates from the options.
 * Putting the password in the userinfo would mean percent-encoding a secret
 * correctly in one place and hoping every log line, error message and
 * connection-string dump downstream redacts it; a password that was never in
 * the URL cannot leak out of one. The ACL user is `default`, so there is
 * nothing else the userinfo would have carried.
 */
export function redisConnectionUrl(redis: RedisRuntimeConfig): string {
  return `redis://${redis.host}:${String(redis.port)}`;
}

/** The ioredis options every Redis consumer in this image is given. */
export function redisConnectionOptions(redis: RedisRuntimeConfig): { readonly password: string } {
  return { password: redis.password };
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
 * a configuration refusal leaves a WooCommerce export — customer accounts,
 * sessions and order history — sitting in the staging directory of a production
 * volume with nothing left that will ever remove it.
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
  // The same three names the modules read, read the same way. The limiter
  // predates them and kept its own copy; two readers of one Redis that could
  // disagree about what a valid address is are two chances to reach a different
  // server than the event bus reached.
  const redis = readRedisRuntimeConfig(environment);

  return {
    redisHost: redis.host,
    redisPort: redis.port,
    redisPassword: redis.password,
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
  // First, because it is the one a workload is most likely to be missing and
  // the one whose refusal has to be the first thing in the log.
  const databaseUrl = resolveDatabaseUrl(environment);

  for (const name of requiredEnvironmentVariables) {
    requireEnvironmentValue(environment, name);
  }

  for (const name of requiredPossiblyEmptyEnvironmentVariables) {
    requireDeclaredEnvironmentValue(environment, name);
  }

  const smtpPort = requireEnvironmentValue(environment, "SMTP_PORT");

  if (smtpPort !== "587") {
    throw new Error("SMTP_PORT must be exactly 587 for STARTTLS submission");
  }

  // **Required, not optional**, and that is the point of this section. Without a
  // Redis, `defineConfig` installs an in-process event bus and workflow engine
  // in *every* workload, so `plepic-worker` shares no queue with the API that
  // enqueues to it — and nothing observable fails, which is why this went
  // unnoticed. The backend runs in Medusa's default `shared` worker mode and so
  // fires its own subscribers, the worker's manifest declares no probe, and
  // both report healthy while the worker has never processed anything. A
  // workload that cannot name its Redis must refuse at start, in front of an
  // operator who is watching, rather than run as two processes that ignore each
  // other until a Stripe capture retry is lost.
  //
  // **What this refuses is an unnamed Redis, not an unreachable one.** Nothing
  // here dials the server, and the module loaders cannot be relied on to notice
  // either: against a closed port `event-bus-redis` logs *"Connection to Redis …
  // established"*, `workflow-engine-redis` logs it twice, `locking-redis` logs
  // an error, and none of the three throws.
  //
  // The workloads fail anyway, a step later. `medusa start` ends in *"Error
  // starting server: Reached the max retries per request limit"* and never
  // serves `/health`, in every worker mode, and `medusa exec` exits 1 — against
  // a closed port and against a `WRONGPASS` alike. The single exception is
  // `medusa db:migrate`, which exits 0 with no Redis at all; `predeploy` runs it
  // first and `medusa exec` second, so the Job still fails, but a green
  // migration on its own is not evidence that Redis is reachable. `README.md`
  // ("What the cluster runs") is where that belongs for an operator.
  const redis = readRedisRuntimeConfig(environment);

  return {
    databaseUrl,
    redis,
    http: {
      storeCors: requireDeclaredEnvironmentValue(environment, "STORE_CORS"),
      adminCors: requireDeclaredEnvironmentValue(environment, "ADMIN_CORS"),
      authCors: requireDeclaredEnvironmentValue(environment, "AUTH_CORS"),
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
