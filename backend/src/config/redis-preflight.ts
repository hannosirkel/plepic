// Extensionless on purpose, exactly as `runtime.ts` imports its own neighbours
// and for the same reason: the `redis:preflight` script runs this file from the
// compiled `.js` in the image and from the `.ts` through `ts-node` in a source
// checkout, and ts-node resolves a relative specifier literally — a `.js`
// suffix here would not map back onto the `.ts` file beside it.
import { createClient } from "redis";

import { readRedisRuntimeConfig, type RedisRuntimeConfig } from "./runtime";

/**
 * **One `PING` in front of Medusa, because a Medusa that dials Redis itself
 * writes the password into the pod log.**
 *
 * `ioredis` — the client every Medusa Redis module uses, and the one this
 * repository never imports directly — attaches the failing command to its
 * `ReplyError`:
 *
 * ```text
 * ReplyError: WRONGPASS invalid username-password pair or user is disabled.
 *     at parseError (…/redis-parser/lib/parser.js:179:12) {
 *   command: { name: 'auth', args: [ '<the password, in plaintext>' ] }
 * }
 * ```
 *
 * Nothing redacts it, because nothing formats it: `@medusajs/cli`'s entry point
 * installs `process.on("uncaughtException", (error) => console.log(error))`, and
 * `console.log` of an `Error` is `util.inspect`, which prints every enumerable
 * own property the error carries. Measured from the built server against a real
 * Redis started with `--requirepass`, one failed `medusa start` writes the
 * plaintext password **29 times**, and one `medusa db:migrate` — which exits
 * **0** — writes it 6 more.
 *
 * So the failure is moved in front of Medusa, and this file is the whole of what
 * runs there. It has three properties, and each of them is why it exists:
 *
 * 1. **It uses `redis`, not `ioredis`.** `redis@6.2.1` is a declared dependency
 *    of this workspace and is already the newsletter limiter's client; `ioredis`
 *    is neither declared nor imported here and arrives only inside Medusa. The
 *    choice is not stylistic: node-redis raises a `SimpleError` carrying the
 *    server's reply text and **no command and no arguments**, verified against
 *    the same `--requirepass` server, so the client this file dials with cannot
 *    reproduce the leak it exists to prevent.
 * 2. **It prints no value it read.** Not the password, not the host, not the
 *    port, and never an error object or an upstream error message. The two
 *    failures below are classified from the reply and then described in this
 *    file's own words — the reply text itself is read and discarded. That is the
 *    standard `runtime.ts` already keeps: name the variable, never the value.
 * 3. **It is bounded.** A Redis whose SYN is dropped by a NetworkPolicy answers
 *    nothing at all, so the connect timeout and an outer deadline are both here.
 *    A preflight that hangs is a pod that never reports anything, which is worse
 *    than the log it replaces.
 *
 * **What it also closes.** `medusa db:migrate` exits 0 with no Redis at all —
 * the one fail-open path in this image — so `predeploy` used to migrate happily
 * against a Redis that was never there and fail one command later. With the
 * preflight in front of it the Job refuses first, and a green migration stops
 * being evidence of nothing.
 *
 * **What it is not.** It is a check at one instant, not a guarantee. A password
 * rotated in Redis while a pod is running still reaches `ioredis`, and that pod
 * still logs it. `README.md` says so where an operator will read it.
 */
export const REDIS_PREFLIGHT_TIMEOUT_MS = 5_000;

export type RedisPreflightFailure = "unreachable" | "authentication";

/**
 * The replies that mean *the credential was refused* rather than *nothing
 * answered*.
 *
 * The distinction is the one Finding 2 is about and the one an operator acts on:
 * `unreachable` is a networking or ordering problem, `authentication` is a
 * credential-rotation incident. Matching is on the RESP error code at the start
 * of the reply — `WRONGPASS` for a wrong password against `--requirepass` or an
 * ACL user, `NOAUTH` for a server that wanted a password it was not given,
 * `NOPERM` for an ACL that permits no `PING`, and the two `ERR` forms Redis
 * still uses for AUTH against a server with no password set.
 *
 * Anything unmatched is reported as `unreachable`, which is the safe direction:
 * it is the message that claims less.
 */
const AUTHENTICATION_REPLY =
  /^(?:WRONGPASS|NOAUTH|NOPERM)\b|^ERR (?:Client sent AUTH|invalid password)/;

/**
 * Dial the configured Redis, authenticate, `PING`, and say what happened.
 *
 * Resolves `undefined` when the server answered `PONG`. It never rejects and it
 * never returns anything derived from what the server said.
 */
export async function pingRedis(
  redis: RedisRuntimeConfig,
  timeoutMs: number = REDIS_PREFLIGHT_TIMEOUT_MS,
): Promise<RedisPreflightFailure | undefined> {
  const client = createClient({
    disableOfflineQueue: true,
    password: redis.password,
    socket: {
      connectTimeout: timeoutMs,
      host: redis.host,
      port: redis.port,
      reconnectStrategy: false,
    },
  });

  // node-redis emits every failure as an `error` event as well as rejecting the
  // call that caused it. Without a listener that event is unhandled, and Node
  // renders an unhandled `error` event by inspecting it — which is the exact
  // rendering this file exists to keep out of the log, whatever the client
  // happens to attach to its errors today.
  client.on("error", () => undefined);

  let deadline: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      (async () => {
        await client.connect();
        await client.ping();
      })(),
      new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(() => {
          reject(new Error("Redis preflight deadline elapsed"));
        }, timeoutMs);
      }),
    ]);

    return undefined;
  } catch (error) {
    return classifyFailure(error);
  } finally {
    if (deadline !== undefined) {
      clearTimeout(deadline);
    }

    // `destroy` on a client that never connected is allowed to throw, and a
    // preflight that crashed while tidying up would print a stack instead of
    // its one line.
    try {
      client.destroy();
    } catch {
      // Nothing to release.
    }
  }
}

/**
 * Read the reply, keep the classification, discard the text.
 *
 * `message` is deliberately never returned, logged or interpolated. It is a
 * string from the server, and the rule this file keeps is that nothing it did
 * not write itself reaches the log.
 */
function classifyFailure(error: unknown): RedisPreflightFailure {
  const message = error instanceof Error ? error.message : "";

  return AUTHENTICATION_REPLY.test(message) ? "authentication" : "unreachable";
}

/**
 * The two refusals, in this file's own words.
 *
 * Each names the variables that decide the outcome and quotes none of them.
 * `authentication` says *credential-rotation event* on purpose: that is the
 * operational fact the old 29-line dump buried, and the reason a WRONGPASS
 * crash-loop is not merely a restart.
 */
const REFUSAL: Record<RedisPreflightFailure, string> = {
  unreachable:
    "no Redis answered. REDIS_HOST and REDIS_PORT name the server this workload " +
    "must reach before Medusa starts, and nothing answered there within " +
    `${String(REDIS_PREFLIGHT_TIMEOUT_MS)}ms.`,
  authentication:
    "Redis refused the credential. REDIS_PASSWORD does not match this server's, " +
    "so this is a credential-rotation event and not a restart.",
};

export async function runRedisPreflight(): Promise<number> {
  let redis: RedisRuntimeConfig;

  try {
    redis = readRedisRuntimeConfig(process.env);
  } catch (error) {
    // Safe to quote: every throw in `readRedisRuntimeConfig` names the variable
    // and never its value, and `tests/redis-preflight.test.ts` holds it to that
    // by running this path with a malformed port and a real-looking password
    // and asserting neither value appears.
    const named = error instanceof Error ? error.message : "the Redis configuration is unusable";
    process.stderr.write(`Redis preflight refused: ${named}\n`);

    return 1;
  }

  const failure = await pingRedis(redis);

  if (failure === undefined) {
    process.stdout.write("Redis preflight: PING answered.\n");

    return 0;
  }

  process.stderr.write(`Redis preflight failed: ${REFUSAL[failure]}\n`);

  return 1;
}

if (require.main === module) {
  void runRedisPreflight().then((code) => {
    process.exitCode = code;
  });
}
