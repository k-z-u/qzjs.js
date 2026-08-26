import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/qzjs.js/",
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
