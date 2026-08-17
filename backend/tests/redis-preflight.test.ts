import { spawn } from "node:child_process";
import { createServer, type Server } from "node:net";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  pingRedis,
  REDIS_PREFLIGHT_TIMEOUT_MS,
  runRedisPreflight,
  type RedisPreflightFailure,
} from "../src/config/redis-preflight";

/**
 * **The regression this suite exists to catch is a credential in a log line.**
 *
 * `ioredis` attaches the failing command to its `ReplyError`, and
 * `@medusajs/cli` renders an uncaught error with `console.log`, which is
 * `util.inspect` and prints every enumerable own property:
 *
 * ```text
 * ReplyError: WRONGPASS invalid username-password pair or user is disabled. {
 *   command: { name: 'auth', args: [ '<the password, in plaintext>' ] }
 * }
 * ```
 *
 * Measured from the built server against a real Redis started with
 * `--requirepass`: 29 plaintext copies in one failed `medusa start`, and 6 more
 * in a `medusa db:migrate` that exits **0**. `src/config/redis-preflight.ts`
 * stops Medusa ever making that connection, and the assertions below are what
 * hold it to it — every one of them is written against what the preflight
 * *emits*, never against what its source says.
 *
 * The password below is a fixture string. It is sent to a stub server inside
 * this process and to nothing else; it guards no Redis anywhere.
 */
const FIXTURE_PASSWORD = "preflight-fixture-password-not-a-credential";

/**
 * A Redis that is only as real as these tests need, so the suite needs no
 * server, no container and no network — `scripts/validate` runs it on a laptop
 * and CI runs it beside an unauthenticated Redis service it must not touch.
 *
 * It has to speak enough RESP to be believed: node-redis 6.2.1 opens every
 * connection by pipelining `HELLO 3 AUTH default <password>` with two
 * `CLIENT SETINFO`s and a `CLIENT MAINT_NOTIFICATIONS`, and a stub that answers
 * `+OK` to all of them leaves the client waiting for a protocol map it never
 * gets. `HELLO` is therefore the command that decides authentication here, which
 * is also where a real server decides it.
 */
type StubBehaviour = "answers" | "wrongpass" | "noauth" | "silent";

const HELLO_MAP =
  "%7\r\n" +
  "$6\r\nserver\r\n$5\r\nredis\r\n" +
  "$7\r\nversion\r\n$5\r\n7.4.6\r\n" +
  "$5\r\nproto\r\n:3\r\n" +
  "$2\r\nid\r\n:1\r\n" +
  "$4\r\nmode\r\n$10\r\nstandalone\r\n" +
  "$4\r\nrole\r\n$6\r\nmaster\r\n" +
  "$7\r\nmodules\r\n*0\r\n";

/** Split whatever has arrived into whole RESP command arrays, keeping the tail. */
function takeCommands(pending: Buffer): { commands: string[][]; rest: Buffer<ArrayBufferLike> } {
  const commands: string[][] = [];
  let offset = 0;

  for (;;) {
    const start = offset;

    if (pending[offset] !== 0x2a) break; // '*'

    let end = pending.indexOf("\r\n", offset);
    if (end < 0) break;

    const count = Number(pending.subarray(offset + 1, end).toString());
    offset = end + 2;

    const parts: string[] = [];
    let whole = true;

    for (let index = 0; index < count; index += 1) {
      if (pending[offset] !== 0x24) {
        whole = false;
        break;
      } // '$'

      end = pending.indexOf("\r\n", offset);
      if (end < 0) {
        whole = false;
        break;
      }

      const length = Number(pending.subarray(offset + 1, end).toString());
      offset = end + 2;

      if (pending.length < offset + length + 2) {
        whole = false;
        break;
      }

      parts.push(pending.subarray(offset, offset + length).toString());
      offset += length + 2;
    }

    if (!whole) {
      offset = start;
      break;
    }

    commands.push(parts);
  }

  return { commands, rest: pending.subarray(offset) };
}

const running: Server[] = [];

async function startStubRedis(behaviour: StubBehaviour): Promise<number> {
  const server = createServer((socket) => {
    let pending: Buffer<ArrayBufferLike> = Buffer.alloc(0);

    socket.on("error", () => undefined);
    socket.on("data", (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);

      const { commands, rest } = takeCommands(pending);
      pending = rest;

      if (behaviour === "silent") return;

      for (const command of commands) {
        const name = (command[0] ?? "").toUpperCase();

        if (name === "HELLO") {
          socket.write(
            behaviour === "wrongpass"
              ? "-WRONGPASS invalid username-password pair or user is disabled.\r\n"
              : HELLO_MAP,
          );
        } else if (name === "PING") {
          socket.write(behaviour === "noauth" ? "-NOAUTH Authentication required.\r\n" : "+PONG\r\n");
        } else {
          socket.write("+OK\r\n");
        }
      }
    });
  });

  running.push(server);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("the stub Redis did not bind a TCP port");
  }

  return address.port;
}

/** A port nothing is listening on, for the unreachable case. */
async function closedPort(): Promise<number> {
  const port = await startStubRedis("answers");
  const server = running.pop();

  await new Promise<void>((resolve) => (server as Server).close(() => resolve()));

  return port;
}

afterEach(async () => {
  await Promise.all(
    running.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

function configFor(port: number, password = FIXTURE_PASSWORD) {
  return { host: "127.0.0.1", port, password } as const;
}

describe("pingRedis", () => {
  it("reports success when the server answers PONG", async () => {
    await expect(pingRedis(configFor(await startStubRedis("answers")), 2_000)).resolves.toBeUndefined();
  });

  /**
   * The two failures are told apart because an operator acts on them
   * differently: `unreachable` is a networking or start-ordering problem,
   * `authentication` is a credential-rotation incident. Both RESP codes a real
   * Redis uses are pinned, because the classification is the only thing that
   * survives the reply — the reply text itself is discarded.
   */
  it.each<[string, StubBehaviour]>([
    ["WRONGPASS", "wrongpass"],
    ["NOAUTH", "noauth"],
  ])("classifies a %s reply as an authentication failure", async (_code, behaviour) => {
    const failure: RedisPreflightFailure | undefined = await pingRedis(
      configFor(await startStubRedis(behaviour)),
      2_000,
    );

    expect(failure).toBe("authentication");
  });

  it("reports a closed port as unreachable", async () => {
    await expect(pingRedis(configFor(await closedPort()), 2_000)).resolves.toBe("unreachable");
  });

  /**
   * A NetworkPolicy that drops the SYN, or a Redis wedged mid-handshake, answers
   * nothing at all. Without the outer deadline the preflight would wait forever
   * and the pod would report nothing — strictly worse than the log it replaces,
   * because at least the log arrived. The upper bound is generous; what is being
   * pinned is that one exists.
   */
  it("gives up on a server that never answers, rather than hanging the workload", async () => {
    const port = await startStubRedis("silent");
    const started = Date.now();

    await expect(pingRedis(configFor(port), 700)).resolves.toBe("unreachable");

    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(600);
    expect(elapsed).toBeLessThan(5_000);
  });

  it("keeps a deadline short enough to be a preflight", () => {
    expect(REDIS_PREFLIGHT_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
});

/**
 * What the preflight writes, captured from the streams it writes to, because
 * "does not print the password" is a claim about output and nothing else.
 */
async function captureRedisPreflight(environment: Record<string, string | undefined>): Promise<{
  code: number;
  output: string;
}> {
  const restore = { ...process.env };
  const chunks: string[] = [];
  const write = (chunk: unknown): boolean => {
    chunks.push(String(chunk));
    return true;
  };
  const stdout = process.stdout.write.bind(process.stdout);
  const stderr = process.stderr.write.bind(process.stderr);

  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  process.stdout.write = write as typeof process.stdout.write;
  process.stderr.write = write as typeof process.stderr.write;

  try {
    return { code: await runRedisPreflight(), output: chunks.join("") };
  } finally {
    process.stdout.write = stdout;
    process.stderr.write = stderr;
    for (const name of Object.keys(process.env)) {
      if (!(name in restore)) delete process.env[name];
    }
    Object.assign(process.env, restore);
  }
}

describe("what the preflight writes", () => {
  it("names the variable and never the password when the credential is refused", async () => {
    const port = await startStubRedis("wrongpass");
    const { code, output } = await captureRedisPreflight({
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: String(port),
      REDIS_PASSWORD: FIXTURE_PASSWORD,
    });

    expect(code).toBe(1);
    expect(output).not.toContain(FIXTURE_PASSWORD);
    expect(output).toContain("REDIS_PASSWORD");
    // The operational fact the 29-line dump buried, and the reason the README
    // calls a WRONGPASS crash-loop a rotation event rather than a restart.
    expect(output).toContain("credential-rotation event");
    // Nothing the server said, and no rendered error object.
    expect(output).not.toContain("WRONGPASS");
    expect(output).not.toContain("command:");
  });

  it("names the host and port variables, and no password, when nothing answers", async () => {
    const { code, output } = await captureRedisPreflight({
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: String(await closedPort()),
      REDIS_PASSWORD: FIXTURE_PASSWORD,
    });

    expect(code).toBe(1);
    expect(output).not.toContain(FIXTURE_PASSWORD);
    expect(output).toContain("REDIS_HOST");
    expect(output).toContain("REDIS_PORT");
    expect(output).not.toContain("ECONNREFUSED");
  });

  it("says the ping was answered, and nothing else, on the path that succeeds", async () => {
    const { code, output } = await captureRedisPreflight({
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: String(await startStubRedis("answers")),
      REDIS_PASSWORD: FIXTURE_PASSWORD,
    });

    expect(code).toBe(0);
    expect(output).toContain("PING answered");
    expect(output).not.toContain(FIXTURE_PASSWORD);
  });

  /**
   * The one path that quotes an upstream message: a configuration
   * `readRedisRuntimeConfig` refuses. It is quoted because every throw in that
   * function names the variable and never its value — and this is the assertion
   * that keeps it true, with a malformed port and a real-looking password both
   * distinctive enough that either leaking would fail here.
   */
  it("quotes the configuration refusal without quoting either value", async () => {
    const { code, output } = await captureRedisPreflight({
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: "6379zzz-not-a-port",
      REDIS_PASSWORD: FIXTURE_PASSWORD,
    });

    expect(code).toBe(1);
    expect(output).not.toContain(FIXTURE_PASSWORD);
    expect(output).not.toContain("6379zzz-not-a-port");
    expect(output).toContain("REDIS_PORT");
  });

  it("refuses a missing password by name", async () => {
    const { code, output } = await captureRedisPreflight({
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: "6379",
      REDIS_PASSWORD: undefined,
    });

    expect(code).toBe(1);
    expect(output).toContain("REDIS_PASSWORD");
  });
});

/**
 * The whole mechanism, as a process, because everything above calls an exported
 * function and the image calls a file.
 *
 * This is what `npm run redis:preflight` runs in a source checkout; the built
 * image runs the compiled `.js` beside it. It proves the three things the
 * in-process assertions cannot: that the module runs itself when it is the
 * entry point, that a refusal becomes a non-zero exit status so `&&` stops
 * before Medusa, and that nothing — not an unhandled `error` event, not a
 * rendered stack — puts the password on a stream on the way out.
 */
describe("the preflight as the image runs it", () => {
  it(
    "exits non-zero on a refused credential with no copy of it anywhere in the output",
    async () => {
      const port = await startStubRedis("wrongpass");
      const backend = join(__dirname, "..");

      // `spawn`, never `spawnSync`: the stub Redis is served by this process's
      // own event loop, and a synchronous spawn blocks it — the child would find
      // a socket nothing ever accepts and report the wrong failure.
      const child = spawn(
        process.execPath,
        ["-r", "ts-node/register", join(backend, "src", "config", "redis-preflight.ts")],
        {
          cwd: backend,
          env: {
            ...process.env,
            REDIS_HOST: "127.0.0.1",
            REDIS_PORT: String(port),
            REDIS_PASSWORD: FIXTURE_PASSWORD,
          },
        },
      );

      let output = "";
      child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));

      const status = await new Promise<number | null>((resolve) => {
        child.on("close", resolve);
      });

      expect(status).toBe(1);
      expect(output).not.toContain(FIXTURE_PASSWORD);
      expect(output).toContain("REDIS_PASSWORD");
      expect(output).toContain("credential-rotation event");
    },
    60_000,
  );
});
