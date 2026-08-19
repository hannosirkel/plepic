import { createRequire } from "node:module";

import { ModulesSdkUtils } from "@medusajs/framework/utils";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * **The migrator and the running backend must open the same connection.**
 *
 * They did not. `medusa db:migrate` and the API resolved their PostgreSQL `ssl`
 * setting by two different routes, and only one of them matched this
 * deployment:
 *
 * | path | how `ssl` was chosen | result |
 * |---|---|---|
 * | runtime (`backend`, `worker`) | `pg-connection-loader` spreads `databaseDriverOptions` — `undefined` — and `create-pg-connection` falls through `?? false` | `ssl: false` |
 * | migration (`db:migrate`) | `medusa-app-loader` forwards `driverOptions: undefined`, so `loadDatabaseConfig` substitutes `getDefaultDriverOptions(clientUrl)` | `ssl: { rejectUnauthorized: false }` |
 *
 * `getDefaultDriverOptions` calls a URL *remote* unless it matches
 * `/localhost|127\.0\.0\.1|ssl_mode=(disable|false)|sslmode=(disable)/i`. A
 * Kubernetes Service name matches none of those, so the migrator opened with an
 * SSLRequest; the PostgreSQL it reached runs `ssl = off`, answered `'N'`, and
 * `pg` ended the socket without sending a startup packet
 * (`pg/lib/connection.js:84-86`). Measured from a pod with the real
 * environment:
 *
 * ```
 * PG_OK   plain      (ssl:false)                    1011ms rows=1
 * PG_FAIL ssl-object ({rejectUnauthorized:false})      2ms  server does not support SSL connections
 * ```
 *
 * **One URL spelling would also have worked, and it is worth being exact about
 * which.** `pgConnectionLoader` and `loadDatabaseConfig` strip only the
 * *underscored* `ssl_mode` (`/(\?|&)ssl_mode=[^&]*(&|$)/gi`), while
 * `getDefaultDriverOptions` matches both that and the unhyphenated
 * `sslmode=(disable)` — which nothing strips. So `?ssl_mode=disable` is deleted
 * before it is read and changes nothing, but `?sslmode=disable` survives and
 * yields `ssl: false`.
 *
 * `databaseDriverOptions` is used regardless, for the reasons that survive that
 * correction. `getDefaultDriverOptions` returns one of exactly two objects, and
 * its non-matching branch is this repository's `require` mapping byte for byte
 * — so a URL can produce `ssl: false` or `ssl: { rejectUnauthorized: false }`,
 * and the only mode beyond its reach is `verify-full`. More to the point, the
 * heuristic steers a *default* that applies only when `driverOptions` is
 * absent, and when it is absent the runtime never consults it at all: one
 * connection string, two `ssl` values, decided by which entry point read it.
 * `resolveDatabaseDriverOptions` carries the measured table.
 */

/**
 * The environment a `deploys/plepic/base` workload projects: the five
 * `DATABASE_*` parts and no `DATABASE_URL`, so the composed host is a
 * Kubernetes Service name exactly as it is in the cluster. That is the input
 * that made `getDefaultDriverOptions` choose its remote branch.
 */
const clusterEnvironment: Record<string, string> = {
  DATABASE_HOST: "plepic-postgresql",
  DATABASE_PORT: "5432",
  DATABASE_NAME: "plepic",
  DATABASE_USER: "medusa",
  DATABASE_PASSWORD: "projected-from-the-secret",
  REDIS_HOST: "plepic-redis",
  REDIS_PORT: "6379",
  REDIS_PASSWORD: "projected-from-the-secret",
  JWT_SECRET: "validation-jwt-secret",
  COOKIE_SECRET: "validation-cookie-secret",
  STORE_CORS: "",
  ADMIN_CORS: "",
  AUTH_CORS: "",
  STRIPE_SECRET_KEY: "synthetic_validation",
  STRIPE_WEBHOOK_SECRET: "whsec_validation",
  STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_validation",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_USERNAME: "validation-smtp-user",
  SMTP_PASSWORD: "validation-smtp-password",
  SMTP_ENVELOPE_FROM: "orders@example.test",
  CONTACT_MAIL_RECIPIENT: "contact@example.test",
  TURNSTILE_SECRET_KEY: "validation-turnstile-secret",
  MERCHANT_LEGAL_NAME: "Example Games OU",
  MERCHANT_REGISTERED_ADDRESS: "Example Street 1, Tallinn",
  MERCHANT_CONTACT_ADDRESS: "legal@example.test",
  MERCHANT_RETURN_ADDRESS: "Return Street 2, Tallinn",
};

/** What `DATABASE_SSL_MODE` unset must resolve to: today's deployment. */
const SSL_DISABLED = { connection: { ssl: false } };

interface ResolvedConfig {
  readonly projectConfig: Record<string, unknown>;
}

let config: ResolvedConfig;

beforeAll(async () => {
  // Deleted rather than left alone: a `DATABASE_URL` inherited from the shell —
  // or from another suite that ran first in this worker — would take precedence
  // over the five parts and this file would stop describing the cluster.
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_SSL_MODE;
  Object.assign(process.env, clusterEnvironment);

  const loaded = (await import("../medusa-config.js")) as unknown as Record<string, unknown>;
  config = (loaded.default ?? loaded) as unknown as ResolvedConfig;
});

describe("the SSL mode the backend configures for PostgreSQL", () => {
  /**
   * The wiring. `projectConfig.databaseDriverOptions` is the single value both
   * the runtime and the migration path read, so it is what has to be present
   * and explicit — an absent one is what let the two paths disagree.
   */
  it("states the driver options explicitly rather than leaving them undefined", () => {
    expect(config.projectConfig.databaseDriverOptions).toEqual(SSL_DISABLED);
  });

  /**
   * **The defect, reproduced at the exact seam that failed.**
   *
   * `prepareSharedResourcesAndDeps` builds precisely this argument from
   * `projectConfig` and hands it to `loadDatabaseConfig`, which is where the
   * migration path substituted its remote default. Against the inputs this
   * repository produced before the fix it returns
   * `{"connection":{"ssl":{"rejectUnauthorized":false}}}` — the failure diff is
   * the bug itself.
   *
   * **Do not delete this as redundant with the assertion above.** It is not
   * asserting our own config twice: it runs Medusa's own resolver, so a Medusa
   * upgrade that changes the precedence in `loadDatabaseConfig` — one that
   * preferred an environment variable, or reinstated the URL heuristic over a
   * supplied value — turns this red while the wiring assertion stays green, and
   * that is the failure mode that took the cluster down.
   */
  it("survives Medusa's own migration-path resolver unchanged", () => {
    const dbData = ModulesSdkUtils.loadDatabaseConfig(
      "medusa",
      {
        database: {
          clientUrl: config.projectConfig.databaseUrl as string,
          driverOptions: config.projectConfig.databaseDriverOptions as Record<string, unknown>,
        },
      },
      true,
    );

    expect(dbData.driverOptions).toEqual(SSL_DISABLED);
  });

  /**
   * **And the other path, which was already correct and must stay that way.**
   *
   * The runtime resolved `ssl` to `false` by falling through
   * `createPgConnection`'s `?? false` on an `undefined`. Now it reads a stated
   * `{ connection: { ssl: false } }`. The value has to come out **identical**,
   * or this fix would have repaired the migration Job by breaking the API and
   * the worker — the two workloads that were working. The argument is built
   * the way `pgConnectionLoader` builds it, by shallow-spreading
   * `projectConfig.databaseDriverOptions`.
   *
   * `knex()` is lazy and opens nothing; the pool is destroyed regardless.
   */
  it("leaves the runtime connection's ssl value exactly as it was", async () => {
    const driverOptions: Record<string, unknown> = {
      ...((config.projectConfig.databaseDriverOptions as Record<string, unknown> | undefined) ??
        {}),
    };
    delete driverOptions.pool;

    const connection = ModulesSdkUtils.createPgConnection({
      clientUrl: config.projectConfig.databaseUrl as string,
      schema: "public",
      driverOptions,
      pool: { min: 2 },
    }) as unknown as {
      client: { config: { connection: { ssl: unknown } } };
      destroy: () => Promise<void>;
    };

    try {
      expect(connection.client.config.connection.ssl).toBe(false);
    } finally {
      await connection.destroy();
    }
  });

  /**
   * **The URL heuristic, pinned — because the docs got this wrong once.**
   *
   * Three files used to claim no URL spelling could reach the migration path.
   * That was false: only the underscored `ssl_mode` is stripped, so
   * `?sslmode=disable` survives and does work. The claim is now stated
   * correctly in those files, and this holds it to the measurement rather than
   * to anybody's reading of two regexes that differ by one character.
   *
   * It also pins the second half of the argument for `databaseDriverOptions`:
   * the heuristic returns one of two objects, and any non-matching URL yields
   * the `require` mapping — the fourth row below, and the outage itself. The
   * only mode beyond its reach is `verify-full`.
   */
  it.each([
    ["?ssl_mode=disable", false, { connection: { ssl: { rejectUnauthorized: false } } }],
    ["?ssl_mode=false", false, { connection: { ssl: { rejectUnauthorized: false } } }],
    ["?sslmode=disable", true, { connection: { ssl: false } }],
    ["?sslmode=require", true, { connection: { ssl: { rejectUnauthorized: false } } }],
  ])(
    "resolves a URL carrying %s the way the documentation says",
    (suffix, survivesStrip, expected) => {
      const raw = `postgres://medusa:pw@plepic-postgresql:5432/plepic${suffix}`;

      // The strip both `pgConnectionLoader` and `loadDatabaseConfig` apply —
      // though at different points, and only the first one's ordering is what
      // this models. `pgConnectionLoader` strips before the URL is read, and
      // `medusaAppLoader` passes that stripped string on, which is the real
      // flow. `loadDatabaseConfig` is the other way round: it strips at
      // `load-module-database-config.js:83`, *after* consulting
      // `getDefaultDriverOptions` at lines 58 and 70, so given an unstripped
      // `?ssl_mode=disable` it would read the marker first and strip it only
      // from the URL it returns. Copied from Medusa rather than imported — it
      // is not exported — and asserted against, so a change to it is visible
      // here rather than only in production.
      const stripped = raw.replace(/(\?|&)ssl_mode=[^&]*(&|$)/gi, (_match, prefix, suffixChar) => {
        if (prefix === "?" && suffixChar === "&") return "?";
        if (prefix === "?" && suffixChar === "") return "";
        if (prefix === "&") return suffixChar as string;
        return "";
      });

      expect(stripped === raw).toBe(survivesStrip);

      const resolved = ModulesSdkUtils.loadDatabaseConfig(
        "medusa",
        { database: { clientUrl: stripped } },
        true,
      );

      expect(resolved.driverOptions).toEqual(expected);
    },
  );

  /**
   * The premise, held so the test above cannot quietly stop testing anything.
   * If Medusa ever stopped calling a Service name remote, the assertion would
   * pass for a reason unrelated to the fix.
   */
  it("is resolving a URL Medusa would otherwise have called remote", () => {
    const withoutDriverOptions = ModulesSdkUtils.loadDatabaseConfig(
      "medusa",
      { database: { clientUrl: config.projectConfig.databaseUrl as string } },
      true,
    );

    expect(withoutDriverOptions.driverOptions).toEqual({
      connection: { ssl: { rejectUnauthorized: false } },
    });
  });
});

/*
 * `__filename` rather than `import.meta.url`: this workspace's tsconfig is
 * `module: Node16` over a package with no `"type": "module"`, so TypeScript
 * types these files as CommonJS. `redis-modules.test.ts` does the same.
 */
const require_ = createRequire(__filename);

/**
 * **A `DATABASE_URL` carrying `sslmode=` overrides `DATABASE_SSL_MODE`.**
 *
 * `pg` merges a parsed connection string *over* the explicit configuration —
 * `connection-parameters.js` does
 * `Object.assign({}, config, parse(config.connectionString))` — so the URL
 * wins, in **both** directions. That is documented in `README.md`, and this is
 * what keeps the documentation honest.
 *
 * **This pins behaviour of a third-party package we do not control, and that is
 * deliberate.** If a future `pg` changes it, this suite failing is the
 * *intended* outcome: it is the signal to re-verify the README's
 * "A `DATABASE_URL` carrying `sslmode=` overrides this variable" section
 * against the new behaviour and rewrite it. It is not a nuisance to silence,
 * and it must not be deleted to make an upgrade green.
 *
 * **Such a failure is already foreseeable.** `pg` currently warns at runtime
 * that it treats a URL's `sslmode=require` as `verify-full`, and that this
 * adopts standard libpq semantics — which are weaker — in
 * `pg-connection-string` v3 / `pg` v9. When that lands, the `require` case
 * below is the one to look at first. The warning *text* is deliberately not
 * asserted: it is cosmetic and will churn. The warning itself is muted for the
 * constructor calls that provoke it — see `resolvedSsl` for why a signal that
 * fires on every run is not a signal.
 *
 * `pg/lib/*` is a declared entry point in `pg`'s own `exports` map, so this
 * reaches for a supported path rather than past the package's surface.
 */
describe("what a URL's own sslmode does to the configured driver options", () => {
  const ConnectionParameters = require_(
    "pg/lib/connection-parameters.js",
  ) as new (config: Record<string, unknown>) => { ssl: unknown };

  /**
   * Construct a `ConnectionParameters` with Node's warning channel muted for
   * exactly the duration of the construction.
   *
   * **Why mute it at all**, when the warning is genuine and its subject is the
   * very change this suite exists to catch: because it fires on *every* run.
   * `pg-connection-string` guards it with a once-per-process flag and emits a
   * nine-line `SECURITY WARNING` block, so it would print on every
   * `npm run test:unit` and every `scripts/validate` forever. A signal that
   * never varies carries no information: after a week nobody reads it, and the
   * cost is not the wasted lines but that it trains readers to skip the exact
   * place where the *next* warning — a real one, about something else — will
   * appear.
   *
   * The signal is not lost: it is these assertions failing, which is what
   * actually detects the `pg` v9 change, and which the block comment above
   * explains.
   *
   * **The muting is deliberately narrow.** It swaps `process.emitWarning` for
   * the duration of one constructor call and restores it in `finally`, so a
   * throwing case cannot leak it, and no other test — in this file or any
   * other — runs with warnings suppressed. It is not a process-wide flag, not
   * `--no-warnings`, and not a filter on the message text: nothing here reads
   * what the warning says, so a reworded or renumbered warning changes nothing.
   *
   * It wraps **every** construction rather than only the `sslmode=require`
   * case, because the emitting flag is once-per-process: whichever case runs
   * first is the one that would print, so muting only today's culprit would
   * make the noise reappear the moment the cases are reordered, filtered, or a
   * future `pg` warns about a different mode.
   */
  const resolvedSsl = (suffix: string, ssl: unknown): unknown => {
    const emitWarning = process.emitWarning;
    process.emitWarning = (() => undefined) as typeof process.emitWarning;

    try {
      return new ConnectionParameters({
        connectionString: `postgres://medusa:pw@plepic-postgresql:5432/plepic${suffix}`,
        ssl,
      }).ssl;
    } finally {
      process.emitWarning = emitWarning;
    }
  };

  /**
   * The case that matters for this deployment, and the reason the override is
   * harmless today: with no `sslmode` in the URL — and no cluster workload
   * supplies a `DATABASE_URL` at all — every mode this repository can resolve
   * reaches `pg` exactly as configured.
   */
  it.each([
    ["disable", false, false],
    ["require", { rejectUnauthorized: false }, { rejectUnauthorized: false }],
    ["verify-full", true, true],
  ])("passes %s through untouched when the URL carries no sslmode", (_mode, ssl, expected) => {
    expect(resolvedSsl("", ssl)).toEqual(expected);
  });

  /**
   * A URL asking for TLS defeats a configured `disable`. `{}` is truthy, so pg
   * attempts TLS and verifies — against a server running `ssl = off` that is a
   * refused connection rather than a silent downgrade, which is why this
   * direction is the less dangerous of the two.
   */
  it("lets a URL's sslmode=require override a configured disable", () => {
    expect(resolvedSsl("?sslmode=require", false)).toEqual({});
  });

  /**
   * **The direction with teeth.** A URL saying `disable` silently strips TLS
   * from a deployment that asked for `verify-full` — no error, no warning about
   * the downgrade, just an unencrypted connection to a database that was
   * configured to require a verified one. It is why `README.md` says not to put
   * `sslmode` in a `DATABASE_URL` rather than merely noting the precedence.
   */
  it("lets a URL's sslmode=disable silently downgrade a configured verify-full", () => {
    expect(resolvedSsl("?sslmode=disable", true)).toBe(false);
  });
});
