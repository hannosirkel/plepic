import { describe, expect, it } from "vitest";

import { cartLinesFromStore } from "../src/lib/cart-store.js";

describe("Medusa cart money boundary", () => {
  it("converts major-unit line prices to integer cents", () => {
    expect(cartLinesFromStore({
      currency_code: "eur",
      items: [{
        id: "line_example",
        title: "Lunar Base",
        unit_price: 25,
        quantity: 1,
        variant: { manage_inventory: false },
      }],
    })).toEqual([{
      id: "line_example",
      productName: "Lunar Base",
      unitAmount: 2500,
      currency: "EUR",
      quantity: 1,
      availability: "InStock",
    }]);
  });
});
