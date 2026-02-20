import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use jsdom instead of happy-dom due to happy-dom bugs:
    // - Does not fire listeners when same function registered with different capture flags
    // - Violates DOM spec section 2.8 (addEventListener duplicate detection)
    environment: "jsdom",
    globals: true,
  },
});
