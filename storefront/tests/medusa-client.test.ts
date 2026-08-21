import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClientRuntimeConfig } from "../src/lib/client-runtime-config.js";
import { createMedusaStoreClient } from "../src/lib/medusa-client.js";

interface SeenRequest {
  readonly path: string;
  readonly publishableKey: string | undefined;
}

async function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("test server did not expose a TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

const configured: ClientRuntimeConfig["medusa"] = {
  basePath: "/store-api",
  publishableKey: "pk_example_browser_runtime",
};

describe("createMedusaStoreClient", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all(servers.map(close));
  });

  it("fails closed before making a request when the runtime publishable key is missing", async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"products":[],"count":0,"offset":0,"limit":100}');
    });
    servers.push(server);
    const origin = await listen(server);

    expect(() =>
      createMedusaStoreClient({ basePath: "/store-api", publishableKey: null }, origin),
    ).toThrow("MEDUSA_PUBLISHABLE_API_KEY is required for Store API requests");
    expect(requests).toBe(0);
  });

  it("sends the request-time publishable key on every Store call through same-origin /store-api", async () => {
    const seen: SeenRequest[] = [];
    const server = createServer((request, response) => {
      const header = request.headers["x-publishable-api-key"];
      seen.push({
        path: request.url ?? "",
        publishableKey: Array.isArray(header) ? header[0] : header,
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"products":[],"count":0,"offset":0,"limit":100}');
    });
    servers.push(server);
    const origin = await listen(server);
    const client = createMedusaStoreClient(configured, origin);

    await client.store.product.list({ limit: 1 });
    await client.store.product.list({ limit: 2, offset: 1 });

    expect(seen).toEqual([
      {
        path: "/store-api/store/products?limit=1",
        publishableKey: "pk_example_browser_runtime",
      },
      {
        path: "/store-api/store/products?limit=2&offset=1",
        publishableKey: "pk_example_browser_runtime",
      },
    ]);
  });

  it("sends the browser's same-origin credentials through the Store API proxy", async () => {
    const credentials: RequestCredentials[] = [];
    vi.stubGlobal("fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
      credentials.push(init?.credentials ?? "same-origin");
      return new Response('{"products":[],"count":0,"offset":0,"limit":100}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = createMedusaStoreClient(configured, "https://storefront.example");

    await client.store.product.list({ limit: 1 });

    expect(credentials).toEqual(["same-origin"]);
  });
});
