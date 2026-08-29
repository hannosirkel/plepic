import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createMedusaStoreClient } from "../src/lib/medusa-client.js";
import { fetchParcelMachines } from "../src/lib/omniva-locations.js";

/**
 * `fetchParcelMachines`, against a real HTTP server rather than a stubbed
 * `global.fetch`.
 *
 * **This is the regression this file exists to make impossible.**
 * `fetchParcelMachines` used to hand-roll its own `fetch("/store-api/store/
 * omniva/parcel-machines?...")` call carrying only an `accept` header, and
 * every test for it (there were none — see the deployed defect this change
 * fixes) would have stubbed `global.fetch` directly, the way
 * `storefront/tests` mostly does elsewhere: a stub answers whatever body the
 * test hands it, whether or not the request carries the
 * `x-publishable-api-key` header Medusa actually requires on every
 * `/store/*` route. A stubbed `fetch` cannot fail on a missing header,
 * because it never looks at headers at all. A real server can — this file
 * makes it, by asserting the header on every request it receives — and a
 * future hand-rolled `fetch()` here would show up as a request the server
 * never sees the key on.
 *
 * A real `node:http` server, not a mocked `fetch`, is what
 * `store-payment.test.ts` and `store-checkout.test.ts` already use for the
 * same reason; this file follows that convention rather than inventing a
 * second one.
 */

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
        reject(new Error("omniva-locations test server exposed no TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function client(origin: string) {
  return createMedusaStoreClient(
    { basePath: "/store-api", publishableKey: "pk_example_omniva" },
    origin,
  );
}

describe("fetchParcelMachines", () => {
  const servers: Server[] = [];

  afterEach(async () => Promise.all(servers.map(close)));

  it("goes through the Store client, carrying the publishable key Medusa requires", async () => {
    const seen: SeenRequest[] = [];
    const server = createServer((request, response) => {
      seen.push({
        path: request.url ?? "",
        publishableKey: request.headers["x-publishable-api-key"] as string | undefined,
      });
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          parcel_machines: [{ zip: "10101", name: "Tallinn Kaubamaja", group: "EE" }],
        }),
      );
    });
    servers.push(server);
    const origin = await listen(server);

    await expect(fetchParcelMachines(client(origin), "EE")).resolves.toEqual([
      { zip: "10101", name: "Tallinn Kaubamaja", group: "EE" },
    ]);

    expect(seen).toEqual([
      {
        path: "/store-api/store/omniva/parcel-machines?country=EE",
        publishableKey: "pk_example_omniva",
      },
    ]);
  });

  /**
   * The exact 400 the deployed test environment reproduced:
   * `{"type":"not_allowed","message":"Publishable API key required in the
   * request header: x-publishable-api-key. …"}`. Refused here as a
   * `ConfigError`, the same as an empty list — see `omniva-locations.ts`'s
   * doc comment for why the two are one branch — because both are "there is
   * nothing to choose from" from the picker's point of view.
   */
  it("refuses a 400 the way it refuses any other non-2xx response", async () => {
    const server = createServer((_request, response) => {
      response.statusCode = 400;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          type: "not_allowed",
          message:
            "Publishable API key required in the request header: x-publishable-api-key.",
        }),
      );
    });
    servers.push(server);
    const origin = await listen(server);

    await expect(fetchParcelMachines(client(origin), "EE")).rejects.toThrow(
      /parcel machine list is unavailable/,
    );
  });

  it("refuses an empty list the same way it refuses a non-2xx response", async () => {
    const server = createServer((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ parcel_machines: [] }));
    });
    servers.push(server);
    const origin = await listen(server);

    await expect(fetchParcelMachines(client(origin), "EE")).rejects.toThrow(
      /parcel machine list is unavailable/,
    );
  });

  it("refuses a 503 the backend answers when its own cache and Omniva are both unavailable", async () => {
    const server = createServer((_request, response) => {
      response.statusCode = 503;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ message: "The parcel machine list is unavailable" }));
    });
    servers.push(server);
    const origin = await listen(server);

    await expect(fetchParcelMachines(client(origin), "EE")).rejects.toThrow(
      /parcel machine list is unavailable/,
    );
  });
});
