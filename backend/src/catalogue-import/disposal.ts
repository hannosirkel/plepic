import { rm } from "node:fs/promises";

/**
 * The staged archive could not be removed, so it is still on the assets PVC: a
 * WooCommerce export left at rest on a production volume, with no later run
 * coming back for it.
 *
 * The underlying filesystem error is the `cause`. The message names the path
 * and nothing else: the archive is a WooCommerce export, and a Job log is not
 * a place to put anything that came out of one.
 */
export class StagedArchiveDisposalFailure extends Error {
  constructor(
    readonly archivePath: string,
    cause: unknown,
  ) {
    super(
      `the staged catalogue archive at ${archivePath} could not be disposed of and is still on the assets PVC`,
      { cause },
    );
    this.name = "StagedArchiveDisposalFailure";
  }
}

/**
 * Removes whatever is staged at the archive path — a file, or a **directory**.
 *
 * `recursive` is not defensive padding. `kubectl cp` of a directory onto the
 * archive path is an easy operator slip, and a non-recursive `rm` answers it
 * with `EISDIR` and leaves the mis-staged export in place. `force` covers the
 * ordinary case of there being nothing staged at all, which is not a failure:
 * the command disposes of the archive before it knows whether one exists.
 *
 * Failure is returned rather than thrown so the caller decides what outranks
 * it. Nothing else here can throw.
 */
async function disposeOfStagedArchive(
  archivePath: string,
): Promise<StagedArchiveDisposalFailure | null> {
  try {
    await rm(archivePath, { recursive: true, force: true });
    return null;
  } catch (error) {
    return new StagedArchiveDisposalFailure(archivePath, error);
  }
}

/** Has this failure already been reported against the error now in flight? */
function alreadyReported(inFlight: unknown, archivePath: string): boolean {
  if (inFlight instanceof StagedArchiveDisposalFailure) return inFlight.archivePath === archivePath;
  return (
    inFlight instanceof Error &&
    inFlight.cause instanceof StagedArchiveDisposalFailure &&
    inFlight.cause.archivePath === archivePath
  );
}

/**
 * Runs `body` and disposes of the staged archive afterwards, whatever happened.
 *
 * **A disposal failure is reported alongside the refusal that caused it, never
 * instead of it.** That is the whole point of this wrapper. A bare
 * `finally { await rm(...) }` throws the filesystem error out of the `finally`
 * and discards the in-flight refusal, so an operator whose staging directory is
 * not writable is told `EACCES: permission denied, unlink` and never learns
 * that the import refused because the archive's checksum did not match. Losing
 * the reason the import refused is the worse half of a leak.
 *
 * So:
 *
 * - the refusal wins the exit status and the message, and carries the disposal
 *   failure as its `cause`;
 * - the disposal failure is written to the Job log on its own line, once;
 * - and when nothing else went wrong, the disposal failure *is* the failure —
 *   a Job that seeded the catalogue and left a WooCommerce export on the served
 *   volume has not succeeded, and must not exit zero saying it did.
 *
 * There is deliberately no `finally` block: a `finally` that throws is exactly
 * the construct this exists to replace.
 */
export async function withStagedArchiveDisposal<T>(
  archivePath: string,
  body: () => Promise<T>,
): Promise<T> {
  let outcome: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };

  try {
    outcome = { ok: true, value: await body() };
  } catch (error) {
    outcome = { ok: false, error };
  }

  const failure = await disposeOfStagedArchive(archivePath);

  if (failure !== null && !(!outcome.ok && alreadyReported(outcome.error, archivePath))) {
    console.error(`${failure.message}: ${String(failure.cause)}`);
    if (!outcome.ok && outcome.error instanceof Error && outcome.error.cause === undefined) {
      outcome.error.cause = failure;
    }
    if (outcome.ok) throw failure;
  }

  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
