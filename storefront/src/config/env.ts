/**
 * The one place `process.env` is read directly.
 *
 * Every other config module goes through {@link readEnv}, {@link optionalEnv}
 * or {@link readEnvList} rather than touching `process.env` itself, so a
 * value's origin is always traceable to here, and so a test can stub
 * `NodeJS.ProcessEnv` instead of the real process environment. The name each
 * of them is called with is a literal at the call site, on purpose:
 * `tests/runtime-config.test.ts` scans for those literals and asserts they
 * are exactly `config/runtime-env.ts`'s `RUNTIME_ENV_VARS`, which is in turn
 * what forces every variable to have a build-time canary.
 *
 * Nothing in this file — or anything that imports it — may be evaluated at
 * module scope in a way that runs during `next build`. Every call site reads
 * environment values from inside a function invoked per request (a Server
 * Component, a Route Handler, `generateMetadata`, `sitemap()`, `robots()`),
 * after the route has opted into dynamic rendering. That is what keeps a
 * per-environment value out of the built artifact: `next build` never
 * executes a dynamic route's body, so it never sees the real value, and the
 * same built image reads a different value from each environment's process
 * environment at container start.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * A structural view of `process.env` — every value optional, exactly as
 * `NodeJS.ProcessEnv` actually behaves at runtime (an unset variable reads as
 * `undefined`). Used instead of `NodeJS.ProcessEnv` itself so a test can pass
 * a plain `{}` or a partial object without also supplying every ambient
 * variable the installed `@types/node` happens to declare as present.
 */
export type EnvRecord = Record<string, string | undefined>;

/** Reads `name` from `env`, trimmed, or `undefined` if unset or blank. */
export function readEnv(name: string, env: EnvRecord = process.env): string | undefined {
  const value = env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Reads `name`, falling back to `fallback` if unset. Never throws. */
export function optionalEnv(name: string, fallback: string, env: EnvRecord = process.env): string {
  return readEnv(name, env) ?? fallback;
}

/** Splits a comma-separated env value into trimmed, non-empty entries. */
export function readEnvList(name: string, env: EnvRecord = process.env): readonly string[] {
  const raw = readEnv(name, env);
  if (raw === undefined) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
