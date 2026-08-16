import { createServer, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import {
  forwardStoreApiRequest,
  resolveStoreApiPath,
  resolveStoreApiTarget,
} from "../src/lib/store-api-transport.js";

/**
 * The staged catalogue archive is a WooCommerce export carrying customer
 * accounts, sessions and order history. It is staged under the assets PVC's
 * `subPath: import`, a sibling of the `subPath: media` subtree the backend
 * serves as `/static/*` and this storefront re-exposes as
 * `/store-api/static/*`, so a staged archive is not reachable through the
 * public origin to begin with.
 *
 * The served surface refuses the staging directory anyway, in the same
 * normalized way it refuses `/store-api/admin`. That layout is enforced by the
 * `deploys` manifests, in another repository; this refusal is what a regression
 * there lands on, and it is pinned here so it cannot be dropped as dead weight.
 * Disposing of the archive on every exit path is the control that matters.
 */
describe("the store-api prefix allowlist", () => {
  it("refuses the import staging directory under the static prefix", () => {
    for (const pathname of [
      "/store-api/static/import",
      "/store-api/static/import/catalogue.tar.gz",
      "/store-api/static/import/media/lunar-base-box.webp",
      "/store-api/static/Import/catalogue.tar.gz",
      "/store-api/static/IMPORT/catalogue.tar.gz",
    ]) {
      expect(resolveStoreApiPath(pathname), pathname).toBeNull();
    }
  });

  it("still forwards product media and the other allowlisted prefixes", () => {
    expect(resolveStoreApiPath("/store-api/static/lunar-base-box.webp")).toBe(
      "/static/lunar-base-box.webp",
    );
    expect(resolveStoreApiPath("/store-api/static/products/lunar-base.webp")).toBe(
      "/static/products/lunar-base.webp",
    );
    expect(resolveStoreApiPath("/store-api/static/imported-box.webp")).toBe(
      "/static/imported-box.webp",
    );
    expect(resolveStoreApiPath("/store-api/store/products")).toBe("/store/products");
    expect(resolveStoreApiPath("/store-api/hooks/payment/stripe_stripe")).toBe(
      "/hooks/payment/stripe_stripe",
    );
  });

  it("keeps refusing every path outside the allowlist", () => {
    for (const pathname of [
      "/store-api/admin/users",
      "/store-api/app",
      "/store-api/%2e%2e/app",
      "/store-api/store/../admin/users",
      "/store-api//admin/users",
    ]) {
      expect(resolveStoreApiPath(pathname), pathname).toBeNull();
    }
  });
});

/**
 * The Admin surface, approached through every encoding of a dot segment the
 * WHATWG URL parser resolves.
 *
 * This is not a hypothetical. `resolveStoreApiTarget` builds the forwarded
 * target by assigning the path to a `URL`, and that parser treats `%2e`,
 * `%2E`, `.` and their pairs as the *same* dot segment: assigning
 * `/store/%2e%2e/admin/users` yields the pathname `/admin/users`. So the
 * question this suite has to answer is not "does the string contain `..`" but
 * "can any input reach a backend path outside the namespace it was admitted
 * under", and the assertion below is written against the resolved target for
 * exactly that reason — a `null` from the resolver is the desired answer, but
 * a non-null one that still lands inside the namespace would be acceptable
 * too, and a non-null one that escapes it is the defect.
 *
 * `%2f` is here as well because an encoded separator is the other way to hide
 * a path boundary from a segment-wise check. The parser leaves it encoded, so
 * whether it escapes depends on the *backend's* router rather than on this
 * one; that is precisely why it is refused here rather than reasoned about.
 */
describe("no encoding of a dot segment reaches the Admin surface", () => {
  const escapes = [
    "/store-api/store/%2e%2e/admin/users",
    "/store-api/store/%2E%2E/admin/users",
    "/store-api/store/.%2e/admin/users",
    "/store-api/store/%2e./admin/users",
    "/store-api/store/%2e/%2e%2e/admin/users",
    "/store-api/store/%2e%2e/%2e%2e/app",
    "/store-api/hooks/%2e%2e/app",
    "/store-api/static/%2e%2e/admin/users",
    "/store-api/store/..%2fadmin/users",
    "/store-api/store/%2e%2e%2fadmin/users",
    "/store-api/store/%2e%2e/store/products",
  ];

  /**
   * Double encoding is deliberately **not** in the list above, and asserting
   * that it is refused would have been asserting the wrong thing. `%252e%252e`
   * decodes once to the literal text `%2e%2e`, which is a perfectly ordinary
   * segment: the URL parser does not resolve it, and a backend would have to
   * decode a second time — which no router in this stack does — for it to mean
   * anything. It is forwarded, inside its own namespace, exactly as any other
   * odd-looking filename would be. Refusing it would be a guess dressed up as
   * a control.
   */
  const notAnEscape = "/store-api/store/%252e%252e/admin/users";

  it("refuses every one of them outright", () => {
    for (const pathname of escapes) {
      expect(resolveStoreApiPath(pathname), pathname).toBeNull();
    }
  });

  it("forwards a double-encoded segment unresolved, inside its own namespace", () => {
    const upstream = resolveStoreApiPath(notAnEscape);
    expect(upstream).toBe("/store/%252e%252e/admin/users");
    expect(
      resolveStoreApiTarget(upstream ?? "", "", "http://backend.invalid:9000").pathname,
    ).toBe("/store/%252e%252e/admin/users");
  });

  it("cannot build a backend target outside the allowlisted namespace from any of them", () => {
    for (const pathname of [...escapes, notAnEscape]) {
      const upstream = resolveStoreApiPath(pathname);
      if (upstream === null) continue;
      const namespace = upstream.split("/")[1] ?? "";
      const target = resolveStoreApiTarget(upstream, "", "http://backend.invalid:9000");
      expect(target.pathname, `${pathname} escaped its namespace`).toMatch(
        new RegExp(`^/${namespace}/`),
      );
    }
  });

  it("still admits the legitimate paths a dot-segment refusal could plausibly break", () => {
    expect(resolveStoreApiPath("/store-api/static/products/lunar.base.webp")).toBe(
      "/static/products/lunar.base.webp",
    );
    expect(resolveStoreApiPath("/store-api/static/products/..webp")).toBe(
      "/static/products/..webp",
    );
    expect(resolveStoreApiPath("/store-api/static/products/a.b.c/d.webp")).toBe(
      "/static/products/a.b.c/d.webp",
    );
    expect(resolveStoreApiPath("/store-api/store/carts/cart_01ABC/line-items")).toBe(
      "/store/carts/cart_01ABC/line-items",
    );
  });
});

async function listen(server: Server): Promise<URL> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("test server did not expose a TCP port"));
        return;
      }
      resolve(new URL(`http://127.0.0.1:${address.port}/store/products`));
    });
  });
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

describe("forwardStoreApiRequest response framing", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(close));
  });

  it("delivers transparently decoded bytes without stale compression framing", async () => {
    const decoded = Buffer.from('{"products":[]}');
    const compressed = gzipSync(decoded);
    const server = createServer((_request, response) => {
      response.writeHead(307, {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
        "Content-Length": String(compressed.byteLength),
        Location: "/store/products?cursor=next",
        "Set-Cookie": ["cart=one; Path=/; HttpOnly", "region=eu; Path=/; SameSite=Lax"],
      });
      response.end(compressed);
    });
    servers.push(server);

    const target = await listen(server);
    const forwarded = await forwardStoreApiRequest(
      new Request("https://storefront.example/store-api/store/products"),
      target,
    );

    expect(Buffer.from(await forwarded.arrayBuffer())).toEqual(decoded);
    expect(forwarded.headers.get("content-encoding")).toBeNull();
    expect(forwarded.headers.get("content-length")).toBeNull();
    expect(forwarded.headers.get("location")).toBe("/store/products?cursor=next");
    expect(forwarded.headers.getSetCookie()).toEqual([
      "cart=one; Path=/; HttpOnly",
      "region=eu; Path=/; SameSite=Lax",
    ]);
  });
});
