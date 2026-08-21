/**
 * The basket's failure reporting.
 *
 * This exists because of what a silent catch cost. Every failure in the basket
 * flow was discarded, so a real defect could only ever be reported as "adding
 * to basket does not work" — true, and impossible to act on. A missing line
 * total, a rejected publishable key and a stale cart id all reached the visitor
 * as the same sentence and reached the operator as nothing.
 *
 * So the assertions worth making are about what the line contains: the
 * operation, so the reader knows which of five calls failed, and the error's
 * own message, so they know why. And about what it must never contain — the
 * cart, which carries an address and an email once a checkout has started, and
 * which would then travel into whatever screenshot the failure is reported in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { reportCartFailure } from "../src/lib/cart-diagnostics.js";

afterEach(() => {
  vi.restoreAllMocks();
});

/*
 * The spy is restored before returning, so a test may call this more than once
 * and each call still measures exactly one line. Leaving it installed made the
 * counts accumulate across calls within a single test, which is a helper
 * measuring itself rather than the function.
 */
function captureOneLine(run: () => void): string {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    run();
    expect(spy).toHaveBeenCalledTimes(1);
    return String(spy.mock.calls[0]?.[0] ?? "");
  } finally {
    spy.mockRestore();
  }
}

describe("reportCartFailure", () => {
  it("names the operation and the error", () => {
    const line = captureOneLine(() =>
      reportCartFailure("add", new Error("Medusa Store cart line carries no total")),
    );

    expect(line).toContain("add");
    expect(line).toContain("Medusa Store cart line carries no total");
  });

  it("distinguishes the five operations, so a report says which call failed", () => {
    const operations = ["add", "restore", "update-quantity", "remove", "product-page-add"] as const;
    const lines = operations.map((operation) =>
      captureOneLine(() => reportCartFailure(operation, new Error("x"))),
    );

    expect(new Set(lines).size, "two operations produced the same line").toBe(operations.length);
  });

  it("survives a thrown value that is not an Error", () => {
    expect(captureOneLine(() => reportCartFailure("remove", "a bare string"))).toContain(
      "a bare string",
    );
    expect(captureOneLine(() => reportCartFailure("remove", undefined))).toContain("undefined");
  });

  it("says the basket is unchanged, which is what the visitor is being told", () => {
    expect(captureOneLine(() => reportCartFailure("add", new Error("x")))).toContain("unchanged");
  });

  /*
   * The rule that matters. This function takes an error and an operation and
   * has no access to a cart — the assertion is that its signature stays that
   * way, phrased as a test rather than a comment because the tempting next
   * change is "log the response too, it would have helped".
   */
  it("takes no cart, so no address or email can reach the console", () => {
    expect(reportCartFailure.length).toBe(2);
  });
});
