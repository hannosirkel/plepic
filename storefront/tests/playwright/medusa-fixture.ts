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
            calculated_amount: 2500,
          },
        },
      ],
    },
  ],
};

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }

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
