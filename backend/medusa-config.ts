import { defineConfig, loadEnv } from "@medusajs/framework/utils";
import {
  readBackendRuntimeConfig,
  redisConnectionOptions,
  redisConnectionUrl,
} from "./src/config/runtime";
import { stripePaymentModule } from "./src/config/payment";
import { notificationModule } from "./src/config/notification";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const runtime = readBackendRuntimeConfig(process.env);

const redisUrl = redisConnectionUrl(runtime.redis);
const redisOptions = redisConnectionOptions(runtime.redis);

/**
 * **Four Redis wirings, because they are four separate things.**
 *
 * The backend and `plepic-worker` run the same image against the same Redis and
 * are supposed to be two halves of one system. They were not: with no Redis
 * anywhere in this file, `defineConfig` installs `event-bus-local`,
 * `workflow-engine-inmemory` and the in-memory locking provider in **both**
 * processes, so the worker consumed a queue nothing published to. Nothing
 * failed visibly — the backend runs in Medusa's default `shared` worker mode
 * and therefore fires its own subscribers, so orders confirmed, and
 * `worker.yaml` declares no probe, so "healthy" meant "running".
 *
 * Each line below fixes exactly one thing and none of them substitutes for
 * another:
 *
 * 1. `projectConfig.redisUrl` + `redisOptions` — **sessions, and nothing else.**
 *    `@medusajs/framework`'s express loader reads exactly this pair to build the
 *    `connect-redis` session store, and `ConfigManager.normalizeProjectConfig`
 *    reads `redisUrl` alone to decide whether to log *"redisUrl not found. A
 *    fake redis instance will be used."* Setting it silences that line and
 *    changes no module: outside Medusa Cloud, `resolveModules` installs the
 *    in-memory four regardless of what `projectConfig` says.
 * 2. **Event bus.** Without it, an event emitted in one process is delivered
 *    only to that process's subscribers.
 * 3. **Workflow engine.** Its option shape is nested and differs from the event
 *    bus's — the loader destructures `options.redis` — and it is required
 *    *separately*: a Redis event bus with an in-memory workflow engine still
 *    leaves async steps, retries and timeouts in whichever process began them,
 *    to die with that pod.
 * 4. **Locking.** Once two processes run workflows, per-process mutual
 *    exclusion excludes nothing. This one is the `locking` module with a
 *    provider, not a `locking-redis` module — Medusa's provider loader
 *    registers the in-memory provider as `LockingDefaultProvider` first, and
 *    then promotes a declared provider over it when that provider is marked
 *    `is_default` **or** when it is the only one in the list. Both are true
 *    below, so the promotion does not depend on which rule fires; `is_default`
 *    is written anyway, because it is the half that survives a second provider
 *    being added.
 *
 * **Do not read these four as a reachability check.** What is fail-closed is
 * naming a Redis, in `readBackendRuntimeConfig`; nothing here dials one, and
 * the loaders below report success when they have not connected — against a
 * closed port `event-bus-redis` logs *"Connection to Redis … established"*,
 * `workflow-engine-redis` logs it twice, `locking-redis` logs an error, and
 * none of them throws. What actually stops a misconfigured workload is the
 * first Redis command after boot: `medusa start` and `medusa exec` both fail
 * on it, `medusa db:migrate` does not. `README.md` has the measured table.
 *
 * The keys these declarations land on are Medusa's, not ours:
 * `REVERSED_MODULE_PACKAGE_NAMES` maps each package name back onto
 * `Modules.EVENT_BUS`, `Modules.WORKFLOW_ENGINE` and `Modules.LOCKING`, which is
 * why they *replace* the defaults instead of being added beside them.
 * `tests/redis-modules.test.ts` runs each loader against these exact objects
 * and reads the connection it built, so a Medusa upgrade that moves an option
 * turns that suite red rather than leaving a worker that shares no queue.
 *
 * The password is in `redisOptions`, never in the URL — see
 * `redisConnectionUrl`.
 */
const redisEventBusModule = {
  resolve: "@medusajs/medusa/event-bus-redis",
  options: { redisUrl, redisOptions },
} as const;

const redisWorkflowEngineModule = {
  resolve: "@medusajs/medusa/workflow-engine-redis",
  options: { redis: { redisUrl, redisOptions } },
} as const;

const redisLockingModule = {
  resolve: "@medusajs/medusa/locking",
  options: {
    providers: [
      {
        resolve: "@medusajs/medusa/locking-redis",
        id: "locking-redis",
        is_default: true,
        options: { redisUrl, redisOptions },
      },
    ],
  },
} as const;

/**
 * The File module is deliberately **not** overridden.
 *
 * `defineConfig` already registers `@medusajs/medusa/file-local`, whose
 * `upload_dir` defaults to `<cwd>/static` — the same directory the framework's
 * express loader serves at `/static/*` and the same directory the catalogue
 * import writes into. Overriding it bought nothing and cost a great deal: the
 * override set `backend_url` to the relative `/static`, and the provider does
 * `new URL(backend_url)` on every upload and presigned download, so every Admin
 * upload raised `TypeError: Invalid URL`. The import never used the provider —
 * it writes with `fs` and computes its own relative URLs — so the override was
 * dead configuration that was also broken.
 *
 * The default `backend_url` is `http://localhost:9000/static`, which is only
 * ever seen by an Admin user's own browser. It is not a per-environment value
 * this image bakes in, and the storefront drops any absolute media URL rather
 * than forwarding it, so it cannot reach a shopper. `tests/media-provider.test.ts`
 * exercises the provider this config registers.
 */
module.exports = defineConfig({
  projectConfig: {
    databaseUrl: runtime.databaseUrl,
    http: runtime.http,
    redisUrl,
    redisOptions,
  },
  modules: [
    stripePaymentModule(runtime.stripe),
    notificationModule(runtime.smtp),
    redisEventBusModule,
    redisWorkflowEngineModule,
    redisLockingModule,
  ],
});
