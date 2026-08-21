/**
 * What a failed basket action says to the browser console.
 *
 * Every catch in the basket flow used to discard the exception. The visitor got
 * "That did not work. Nothing has changed." and the operator got nothing at
 * all — so a real defect could only be reported as "adding to basket does not
 * work", which is true, unactionable, and exactly what happened: the first
 * report of the Medusa field defect could not distinguish a missing line total
 * from a rejected publishable key from a stale cart, because all three arrive
 * here as the same sentence.
 *
 * The visitor-facing message does not change. This writes to the console, which
 * is where someone diagnosing a shop looks and where nobody else does.
 *
 * **It logs the error, never the cart.** A cart carries an address, an email
 * and line prices once a checkout has started; a console line that quotes it
 * ends up in a screenshot in an issue tracker. The failing operation and the
 * error are enough to name the fault, and nothing here reads the response body.
 */

/** The operations a basket failure can come from, for the log line's first field. */
export type CartOperation =
  | "add"
  | "restore"
  | "update-quantity"
  | "remove"
  | "product-page-add";

/**
 * Reports a basket failure to the console and returns nothing.
 *
 * Callers keep their own recovery — this only makes the failure legible, so it
 * is deliberately not a rethrow and deliberately not a UI change.
 */
export function reportCartFailure(operation: CartOperation, error: unknown): void {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(
    `plepic basket: ${operation} failed and the basket is unchanged. ${detail}`,
  );
}
