import { createServer, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import { forwardStoreApiRequest, resolveStoreApiPath } from "../src/lib/store-api-transport.js";

/**
 * The staged catalogue archive is a WooCommerce export carrying customer
 * accounts, sessions and order history. The import Job mounts the assets PVC at
 * the media root *and* at the staging path, `subPath: import`, of the same
 * claim — so while an archive is staged it is also a file under the directory
 * Medusa serves as `/static/*`, which this storefront re-exposes as
 * `/store-api/static/*`.
 *
 * The import disposing of the archive on every exit path is the fix. This is
 * the second lock: the served surface refuses the staging directory outright,
 * in the same normalized way it refuses `/store-api/admin`, so the window
 * between staging and disposal is not a window in which the export is
 * downloadable through the public origin.
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
