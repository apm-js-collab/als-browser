import { describe, it, expect, beforeEach } from "vitest";
import { AsyncLocalStorage } from "./async-local-storage";
import { AsyncContextFrame } from "./async-context-frame";
import { capture, restore, SnapshotContainer } from "./snapshot";

describe("snapshot (capture/restore)", () => {
  let als: AsyncLocalStorage<number>;

  beforeEach(() => {
    // Reset the global context frame before each test
    AsyncContextFrame.set(undefined);
    als = new AsyncLocalStorage<number>();
  });

  it("should preserve context across simulated await", async () => {
    const container: SnapshotContainer = {};

    const promise = new Promise<number>((resolve) => {
      als.run(777, async () => {
        // Simulate: restore(container, await capture(container, promise))
        const captured = capture(container, Promise.resolve(42));
        const value = await captured;
        const result = restore(container, value);

        resolve(als.getStore()!);
      });
    });

    const storeValue = await promise;
    expect(storeValue).toBe(777);
  });

  it("should handle multiple sequential awaits", async () => {
    const container: SnapshotContainer = {};
    const results: (number | undefined)[] = [];

    await als.run(888, async () => {
      results.push(als.getStore());

      // First await
      restore(container, await capture(container, Promise.resolve()));
      results.push(als.getStore());

      // Second await
      restore(container, await capture(container, Promise.resolve()));
      results.push(als.getStore());
    });

    expect(results).toEqual([888, 888, 888]);
  });

  it("should work with actual async operations", async () => {
    const container: SnapshotContainer = {};

    const result = await als.run(999, async () => {
      const delayedValue = new Promise<string>((resolve) => {
        setTimeout(() => resolve("done"), 10);
      });

      restore(container, await capture(container, delayedValue));
      return als.getStore();
    });

    expect(result).toBe(999);
  });
});
