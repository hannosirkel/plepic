import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["content/**/*.test.ts", "design/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
