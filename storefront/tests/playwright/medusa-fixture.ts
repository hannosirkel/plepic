import { createServer } from "node:http";

const port = 3199;

const product = {
  products: [
    {
      id: "prod_lunar_base",
      title: "Lunar Base",
      variants: [
        {
          id: "variant_lunar_base",
          manage_inventory: true,
          allow_backorder: false,
          inventory_quantity: 12,
          calculated_price: {
            currency_code: "eur",
            calculated_amount: 25,
          },
        },
      ],
    },
  ],
};
const completions = new Map<string, string[]>();

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }

  const cart = /^\/store\/carts\/(cart_return_[\w-]+)$/.exec(request.url ?? "");
  if (cart !== null && request.method === "GET") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ cart: { id: cart[1]!, currency_code: "eur", item_total: 25, subtotal: 32, shipping_total: 7, total: 32, items: [{ title: "Lunar Base", quantity: 1 }], shipping_address: { first_name: "Ada", address_1: "1 Example Street", postal_code: "10115", city: "Tallinn", country_code: "ee" }, shipping_methods: [{ amount: 7, is_tax_inclusive: true, shipping_option_id: "so_standard" }] } }));
    return;
  }
  const completion = /^\/store\/carts\/(cart_return_[\w-]+)\/complete$/.exec(request.url ?? "");
  if (completion !== null && request.method === "POST") {
    const tokens = completions.get(completion[1]!) ?? [];
    tokens.push(String(request.headers["x-plepic-turnstile-token"] ?? ""));
    completions.set(completion[1]!, tokens);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(tokens.length === 1 ? { type: "cart" } : { type: "order", order: { id: "order_fixture", display_id: 42 } }));
    return;
  }
  const inspect = /^\/inspect\/(cart_return_[\w-]+)$/.exec(request.url ?? "");
  if (inspect !== null) { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ tokens: completions.get(inspect[1]!) ?? [] })); return; }

  if ((request.url ?? "").startsWith("/store/products?limit=1&fields=")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(product));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end('{"message":"fixture route not found"}');
});

server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  globalThis.process.on(signal, () => server.close(() => globalThis.process.exit(0)));
}
