import { defineMiddlewares } from "@medusajs/framework/http";

import { readCheckoutTurnstileRuntimeConfig } from "../config/runtime.js";
import { checkoutTurnstileGate } from "../checkout/turnstile-gate.js";

export default defineMiddlewares({
  routes: [{
    matcher: "/store/carts/:id/complete",
    methods: ["POST"],
    middlewares: [async (req, res, next) => {
      await checkoutTurnstileGate(
        req,
        res,
        next,
        readCheckoutTurnstileRuntimeConfig(process.env),
      );
    }],
  }],
});
