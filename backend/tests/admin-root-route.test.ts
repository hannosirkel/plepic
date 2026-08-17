import { describe, expect, it } from "vitest";

import { GET } from "../src/api/route.js";

describe("Medusa Admin root route", () => {
  it("redirects GET / to the Admin UI at exactly /app", async () => {
    const response = {
      location: undefined as string | undefined,
      statusCode: 200,
      redirect(location: string) {
        this.location = location;
        this.statusCode = 302;
        return this;
      },
    };

    await GET({} as never, response as never);

    expect(response.statusCode).toBe(302);
    expect(response.location).toBe("/app");
  });
});
