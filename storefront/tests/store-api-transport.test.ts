import { createServer, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import { forwardStoreApiRequest } from "../src/lib/store-api-transport.js";

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
