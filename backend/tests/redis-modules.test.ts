import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  MODULE_PACKAGE_NAMES,
  Modules,
  REVERSED_MODULE_PACKAGE_NAMES,
  TEMPORARY_REDIS_MODULE_PACKAGE_NAMES,
  createMedusaContainer,
} from "@medusajs/framework/utils";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * **That the Redis wiring is real, not that this file mentions Redis.**
 *
 * A suite asserting `medusa-config.ts` contains the string `event-bus-redis`
 * would pass against every way of getting this wrong that actually happened:
 * a flat option object where the workflow engine wants a nested one, a
 * `locking-redis` module where Medusa wants the `locking` module with a
 * provider, a `redisUrl` in `projectConfig` and nowhere else. Each of those
 * type checks, builds, boots, and leaves `plepic-worker` consuming a queue
 * nothing publishes to — with no failing probe, because `worker.yaml` has none,
 * and no failing checkout, because the API runs its own subscribers in Medusa's
 * default `shared` worker mode.
 *
 * So this file does three things instead:
 *
 * 1. Takes the configuration **as `defineConfig` resolved it** — the object the
 *    framework hands to the module loader, not the literal in the source.
 * 2. Checks each declaration lands on the module key Medusa's own
 *    `REVERSED_MODULE_PACKAGE_NAMES` maps it to, which is what makes it
 *    *replace* the in-memory default rather than sit beside it.
 * 3. **Runs each module's own shipped loaders** against those options, with
 *    `ioredis` swapped for a recorder, and reads back the connection each
 *    loader built. If a Medusa upgrade renames an option, moves it, or changes
 *    which key it nests under, the recorder sees a connection to nowhere and
 *    this suite goes red.
 *
 * Nothing here needs a Redis server, and nothing here connects to one.
 */

/*
 * `__filename` rather than `import.meta.url`: this workspace's tsconfig is
 * `module: Node16` over a package with no `"type": "module"`, so TypeScript
 * types these files as CommonJS. `commerce-medusa-semantics.test.ts` does the
 * same for the same reason.
 */
const require_ = createRequire(__filename);

/** The environment a `deploys` workload projects, as far as this suite needs. */
const requiredEnvironment: Record<string, string> = {
  DATABASE_URL: "postgres://app:password@database:5432/medusa",
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
  SMTP_FROM_NAME: "Plepic Games Test",
  SMTP_ENVELOPE_FROM: "orders@example.test",
  CONTACT_MAIL_RECIPIENT: "contact@example.test",
  TURNSTILE_SECRET_KEY: "validation-turnstile-secret",
  MERCHANT_LEGAL_NAME: "Example Games OU",
  MERCHANT_REGISTERED_ADDRESS: "Example Street 1, Tallinn",
  MERCHANT_CONTACT_ADDRESS: "legal@example.test",
  MERCHANT_RETURN_ADDRESS: "Return Street 2, Tallinn",
};

const EXPECTED_URL = "redis://plepic-redis:6379";
const EXPECTED_PASSWORD = "projected-from-the-secret";

interface ModuleDeclaration {
  readonly resolve?: unknown;
  readonly options?: Record<string, unknown>;
}

interface ResolvedConfig {
  readonly projectConfig: Record<string, unknown>;
  readonly modules: Record<string, ModuleDeclaration>;
}

let config: ResolvedConfig;

beforeAll(async () => {
  Object.assign(process.env, requiredEnvironment);
  const loaded = (await import("../medusa-config.js")) as unknown as Record<string, unknown>;
  config = (loaded.default ?? loaded) as unknown as ResolvedConfig;
});

/* ------------------------------------------------------------------ *
 * Running a module's shipped loaders with ioredis under observation
 * ------------------------------------------------------------------ */

interface RedisConstruction {
  readonly url: unknown;
  readonly options: Record<string, unknown>;
}

/**
 * Every `new Redis(...)` a loader performs, in order.
 *
 * The loaders take their connection from `require("ioredis")` at module load
 * time, so the substitution has to be in the CommonJS cache *before* the module
 * is first required — which is why the whole package subtree is evicted and
 * re-required rather than mocked at the import site.
 *
 * `redisPackage` is the subtree to evict and re-require under the recorder. It
 * is the module being loaded in every case but one: the `locking` module reaches
 * `ioredis` through its **provider**, so loading it means substituting inside
 * `locking-redis` while running `locking`'s own loader.
 *
 * The cache is left as it was found, in both directions. Restoring the evicted
 * keys is the obvious half; deleting keys under `redisPackage` that this call
 * loaded *fresh* is the half that is easy to miss, and without it the process
 * could hold two copies of one class from one package. Today it removes nothing
 * — the `require` at the top of this function warms the whole subtree before
 * anything is evicted, so every key that comes back was evicted first — and it
 * is written anyway, because that is a property of these three packages rather
 * than of the helper.
 */
async function runModuleLoaders(
  specifier: string,
  loaderArgument: Record<string, unknown>,
  moduleDeclaration: Record<string, unknown> = { worker_mode: "shared" },
  redisPackage: string = specifier,
): Promise<RedisConstruction[]> {
  const constructions: RedisConstruction[] = [];

  class RecordingRedis {
    readonly options: Record<string, unknown>;

    constructor(url: unknown, options: Record<string, unknown>) {
      constructions.push({ url, options });
      this.options = options;
    }

    connect(callback?: () => void): Promise<void> {
      callback?.();
      return Promise.resolve();
    }

    disconnect(): void {}
  }

  const shimPath = require_.resolve(redisPackage);
  const { discoveryPath } = require_(redisPackage) as { discoveryPath: string };
  const packageRoot = discoveryPath.slice(0, discoveryPath.indexOf("/dist/") + 1);
  const ioredisPath = createRequire(discoveryPath).resolve("ioredis");

  const substituted = (key: string): boolean =>
    key === shimPath || key === ioredisPath || key.startsWith(packageRoot);

  const cache = require_.cache as Record<string, unknown>;
  const evicted = new Map<string, unknown>();
  for (const key of Object.keys(cache)) {
    if (substituted(key)) {
      evicted.set(key, cache[key]);
      delete cache[key];
    }
  }

  cache[ioredisPath] = {
    id: ioredisPath,
    filename: ioredisPath,
    loaded: true,
    exports: Object.assign(RecordingRedis, { __esModule: true, default: RecordingRedis }),
  };

  try {
    const required = require_(specifier) as { default?: unknown };
    const definition = (required.default ?? required) as {
      loaders?: ((argument: unknown, declaration: unknown) => Promise<void>)[];
    };

    expect(definition.loaders ?? [], `${specifier} declares no loaders`).not.toHaveLength(0);

    for (const loader of definition.loaders ?? []) {
      await loader(loaderArgument, moduleDeclaration);
    }
  } finally {
    for (const key of Object.keys(cache)) {
      if (substituted(key) && !evicted.has(key)) {
        delete cache[key];
      }
    }
    delete cache[ioredisPath];
    for (const [key, value] of evicted) {
      cache[key] = value;
    }
  }

  return constructions;
}

/**
 * Run `body` with the module resolution the **image** has, not the one vitest has.
 *
 * `npm ci` resolves this workspace to two levels: most of `@medusajs/*` hoists to
 * the repository root, while `@medusajs/medusa` nests under `backend/`. Medusa
 * loads a provider by giving its `resolve` string to `dynamicImport`, which does
 * a plain `require` from inside `@medusajs/utils` — hoisted to the root, where
 * `@medusajs/medusa` is not. `backend/Dockerfile` closes that with
 * `ENV NODE_PATH=/app/node_modules` and calls it load-bearing; `medusa build`
 * sets the same thing. Under vitest neither applies, so a provider declared the
 * way the running image declares it does not resolve at all.
 *
 * Reproduced here rather than worked around, because a test that resolved the
 * provider some other way would stop testing the declaration in
 * `medusa-config.ts`. Node reads `NODE_PATH` once at startup, so the private
 * `_initPaths` is the only way to re-read it; both it and the variable are put
 * back before returning.
 */
async function withImageModulePaths<T>(body: () => Promise<T>): Promise<T> {
  const nodeModule = require_("node:module") as { _initPaths: () => void };
  const previous = process.env.NODE_PATH;

  const manifest = require_.resolve("@medusajs/medusa/package.json");
  process.env.NODE_PATH = manifest.slice(0, manifest.indexOf("/@medusajs/medusa/"));
  nodeModule._initPaths();

  try {
    return await body();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_PATH;
    } else {
      process.env.NODE_PATH = previous;
    }
    nodeModule._initPaths();
  }
}

/** A container with the registrations a module loader may resolve. */
function loaderContainer(): ReturnType<typeof createMedusaContainer> {
  const container = createMedusaContainer();
  container.register("logger", {
    resolve: () => ({
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      log: () => undefined,
    }),
  } as never);
  return container;
}

/* ------------------------------------------------------------------ *
 * 1. The three module keys, and that they displace the in-memory four
 * ------------------------------------------------------------------ */

describe("the modules the backend registers for Redis", () => {
  /**
   * The premise. Outside Medusa Cloud `resolveModules` unconditionally installs
   * these three, so "we set `projectConfig.redisUrl`" is not a fix for any of
   * them — it silences one log line and leaves every module in memory.
   */
  it("is displacing Medusa's in-memory defaults, which are these", () => {
    expect(MODULE_PACKAGE_NAMES[Modules.EVENT_BUS]).toBe("@medusajs/medusa/event-bus-local");
    expect(MODULE_PACKAGE_NAMES[Modules.WORKFLOW_ENGINE]).toBe(
      "@medusajs/medusa/workflow-engine-inmemory",
    );
    expect(MODULE_PACKAGE_NAMES[Modules.LOCKING]).toBe("@medusajs/medusa/locking");
  });

  /**
   * Why declaring the Redis package replaces the default instead of adding a
   * second module: `transformModules` keys every declaration by the service
   * name `REVERSED_MODULE_PACKAGE_NAMES` gives it, and Medusa maps the Redis
   * package names onto the same keys as the in-memory ones. Held here because
   * the whole change rests on it.
   */
  it("resolves each Redis package name back onto the module key it overrides", () => {
    // Medusa builds this map at run time by inverting `MODULE_PACKAGE_NAMES`
    // and then adding the Redis names, so it is typed `{}` and has to be read
    // as the lookup table it is.
    const reversed = REVERSED_MODULE_PACKAGE_NAMES as Record<string, string>;

    expect(reversed["@medusajs/medusa/event-bus-redis"]).toBe(Modules.EVENT_BUS);
    expect(reversed["@medusajs/medusa/workflow-engine-redis"]).toBe(Modules.WORKFLOW_ENGINE);
    expect(TEMPORARY_REDIS_MODULE_PACKAGE_NAMES[Modules.LOCKING]).toBe(
      "@medusajs/medusa/locking-redis",
    );
  });

  it("registers the Redis event bus under the event bus key", () => {
    expect(config.modules[Modules.EVENT_BUS]?.resolve).toBe("@medusajs/medusa/event-bus-redis");
  });

  it("registers the Redis workflow engine under the workflow engine key", () => {
    expect(config.modules[Modules.WORKFLOW_ENGINE]?.resolve).toBe(
      "@medusajs/medusa/workflow-engine-redis",
    );
  });

  /**
   * Locking is the odd one out, and getting it wrong is silent. The Redis
   * locking implementation is a **provider** of the `locking` module, not a
   * module: `@medusajs/locking`'s provider loader registers the in-memory
   * provider as the default first and only replaces it for a provider whose
   * declaration carries `is_default`.
   */
  it("registers the Redis locking provider as the locking module's default", () => {
    const locking = config.modules[Modules.LOCKING];
    expect(locking?.resolve).toBe("@medusajs/medusa/locking");

    const providers = locking?.options?.providers as
      | { resolve?: string; id?: string; is_default?: boolean }[]
      | undefined;
    expect(providers).toHaveLength(1);
    expect(providers?.[0]?.resolve).toBe("@medusajs/medusa/locking-redis");
    expect(providers?.[0]?.is_default).toBe(true);
    expect(providers?.[0]?.id).toBeTypeOf("string");
  });

  /**
   * The cache is deliberately left in memory. It is the one of Medusa's four
   * in-process defaults whose per-process copy is merely stale rather than
   * wrong, and a Redis cache is not part of this change; this pins the choice
   * so adding one is a decision rather than a drift.
   */
  it("leaves the cache in memory, on purpose", () => {
    expect(config.modules[Modules.CACHE]?.resolve).toBe("@medusajs/medusa/cache-inmemory");
  });
});

/* ------------------------------------------------------------------ *
 * 2. The loaders, run against the options this config produces
 * ------------------------------------------------------------------ */

describe("the connections Medusa's own loaders build from this configuration", () => {
  it("gives the event bus a connection to the configured Redis, authenticated", async () => {
    const constructions = await runModuleLoaders("@medusajs/medusa/event-bus-redis", {
      container: loaderContainer(),
      logger: undefined,
      options: config.modules[Modules.EVENT_BUS]?.options,
    });

    expect(constructions).not.toHaveLength(0);
    for (const { url, options } of constructions) {
      expect(url).toBe(EXPECTED_URL);
      expect(options.password).toBe(EXPECTED_PASSWORD);
    }
  });

  it("gives the workflow engine connections to the configured Redis, authenticated", async () => {
    const constructions = await runModuleLoaders("@medusajs/medusa/workflow-engine-redis", {
      container: loaderContainer(),
      logger: undefined,
      options: config.modules[Modules.WORKFLOW_ENGINE]?.options,
    });

    // The orchestrator opens a queue connection, a worker connection and a
    // publish/subscribe pair. Every one of them has to reach the same server.
    expect(constructions.length).toBeGreaterThanOrEqual(2);
    for (const { url, options } of constructions) {
      expect(url).toBe(EXPECTED_URL);
      expect(options.password).toBe(EXPECTED_PASSWORD);
    }
  });

  it("gives the locking provider a connection to the configured Redis, authenticated", async () => {
    const providers = config.modules[Modules.LOCKING]?.options?.providers as {
      options?: Record<string, unknown>;
    }[];

    const constructions = await runModuleLoaders("@medusajs/medusa/locking-redis", {
      container: loaderContainer(),
      logger: undefined,
      options: providers[0]?.options,
    });

    expect(constructions).not.toHaveLength(0);
    for (const { url, options } of constructions) {
      expect(url).toBe(EXPECTED_URL);
      expect(options.password).toBe(EXPECTED_PASSWORD);
    }
  });

  /**
   * The step above proves the *provider* connects where it is told. It does not
   * prove the provider is the one anything uses — that is the `locking` module's
   * decision, and it is the only link in this chain that was ever taken on
   * reading. So run `@medusajs/medusa/locking`'s own provider loader against the
   * options this configuration produces and read back what it registered.
   *
   * `LockingDefaultProvider` starts as the in-memory provider's identifier and
   * is overwritten for a declared provider that is `is_default` **or** the only
   * one in the list. Resolving it to `locking-redis` is the fact the whole
   * locking wiring rests on, and a Medusa upgrade that changes either rule, the
   * registration key, or the identifier turns this red.
   */
  it("makes that provider the locking module's default, by running the module's loader", async () => {
    const locking = config.modules[Modules.LOCKING];
    const container = loaderContainer();

    await withImageModulePaths(() =>
      runModuleLoaders(
        "@medusajs/medusa/locking",
        { container, logger: undefined, options: locking?.options },
        { worker_mode: "shared" },
        "@medusajs/medusa/locking-redis",
      ),
    );

    const { LockingDefaultProvider } = require_("@medusajs/locking/dist/types") as {
      LockingDefaultProvider: string;
    };
    const providers = locking?.options?.providers as { id?: string }[];

    expect(container.resolve(LockingDefaultProvider)).toBe(providers[0]?.id);
    expect(container.resolve(LockingDefaultProvider)).toBe("locking-redis");
  });
});

/* ------------------------------------------------------------------ *
 * 3. The shapes are not interchangeable, and each loader says so
 * ------------------------------------------------------------------ */

describe("the option shapes the loaders refuse", () => {
  /**
   * The event bus reads `redisUrl` at the top of its options. The nested shape
   * the workflow engine wants is not a URL to it.
   */
  it("refuses an event bus given the workflow engine's nested shape", async () => {
    await expect(
      runModuleLoaders("@medusajs/medusa/event-bus-redis", {
        container: loaderContainer(),
        logger: undefined,
        options: { redis: { redisUrl: EXPECTED_URL } },
      }),
    ).rejects.toThrow(/redisUrl/);
  });

  /**
   * And the reverse, which is the mistake worth catching: a workflow engine
   * given the event bus's flat shape does not fall back to a default or warn —
   * it destructures `options.redis` and fails. Proving it fails here is what
   * makes the nested literal in `medusa-config.ts` a fact rather than a guess.
   *
   * Matched, like its two siblings, rather than left as a bare `toThrow()`: an
   * unmatched rejection is also satisfied by the *harness* throwing — a renamed
   * export, a moved `discoveryPath`, a package that no longer resolves — which
   * would leave this reading green while proving nothing. The real refusal is
   * `TypeError: Cannot destructure property 'url' of '(intermediate value)'`, so
   * `url` is matched: it is Medusa's own identifier rather than V8's wording,
   * and no way of failing to reach the loader mentions it.
   */
  it("refuses a workflow engine given the event bus's flat shape", async () => {
    await expect(
      runModuleLoaders("@medusajs/medusa/workflow-engine-redis", {
        container: loaderContainer(),
        logger: undefined,
        options: { redisUrl: EXPECTED_URL },
      }),
    ).rejects.toThrow(/url/i);
  });

  it("refuses a locking provider with no redisUrl", async () => {
    await expect(
      runModuleLoaders("@medusajs/medusa/locking-redis", {
        container: loaderContainer(),
        logger: undefined,
        options: { redis: { redisUrl: EXPECTED_URL } },
      }),
    ).rejects.toThrow(/redisUrl/);
  });
});

/* ------------------------------------------------------------------ *
 * 4. The project config half, which is sessions and the log line
 * ------------------------------------------------------------------ */

/** A shipped Medusa file, read as text, located through Node's own resolver. */
function medusaSource(specifier: string, ...within: string[]): string {
  const entry = require_.resolve(specifier);
  const root = entry.slice(0, entry.indexOf("/dist/") + "/dist/".length);
  return readFileSync(root + within.join("/"), "utf8");
}

function frameworkSource(...within: string[]): string {
  return medusaSource("@medusajs/framework/utils", ...within);
}

describe("projectConfig.redisUrl, which is the session store and nothing else", () => {
  it("carries a credential-free URL and the password beside it", () => {
    expect(config.projectConfig.redisUrl).toBe(EXPECTED_URL);
    expect(config.projectConfig.redisOptions).toMatchObject({ password: EXPECTED_PASSWORD });
  });

  /**
   * The framework fact the pair rests on: the express loader builds the
   * `connect-redis` session store from `projectConfig.redisUrl` **and**
   * `projectConfig.redisOptions`, so a password left out of the options is a
   * session store that cannot authenticate — on a backend whose modules all
   * connected fine.
   */
  it("is the exact pair the framework's session store reads", () => {
    const source = frameworkSource("http/express-loader.js");

    expect(source).toContain("configModule?.projectConfig?.redisUrl");
    expect(source).toContain(
      "new ioredis_1.default(configModule.projectConfig.redisUrl, configModule.projectConfig.redisOptions",
    );
  });

  /**
   * And that it is *only* that. `ConfigManager` keys the "A fake redis instance
   * will be used." line on `projectConfig.redisUrl` alone, which is why setting
   * it silenced the symptom while every module stayed in memory — the belief
   * that made this defect survive review.
   */
  it("is what the fake-redis log line was ever about", () => {
    const source = frameworkSource("config/config.js");

    expect(source).toContain("A fake redis instance will be used.");
    expect(source).toContain("if (!outputConfig?.redisUrl)");
  });
});

/* ------------------------------------------------------------------ *
 * 5. Worker mode, which decides who consumes the queue
 * ------------------------------------------------------------------ */

describe("who consumes the queue", () => {
  /**
   * Medusa's rule, pinned because the operator decision in `deploys` depends on
   * it: a process starts an event-bus consumer unless its worker mode is
   * exactly `server`. `backend.yaml` sets no `MEDUSA_WORKER_MODE`, so the API
   * defaults to `shared` and consumes alongside `plepic-worker`. With Redis
   * that is a sharing arrangement rather than a bug — before Redis it was the
   * only reason anything worked at all.
   */
  it("starts a consumer in every mode but server", () => {
    const source = medusaSource("@medusajs/utils", "event-bus/index.js");

    expect(source).toContain('this.isWorkerMode = moduleDeclaration.worker_mode !== "server"');
  });

  it("defaults an unset worker mode to shared", () => {
    const source = frameworkSource("config/config.js");

    expect(source).toContain('workerMode = "shared"');
  });
});
