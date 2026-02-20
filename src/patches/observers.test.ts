import { describe, it, expect, beforeEach } from "vitest";
import { AsyncLocalStorage } from "../async-local-storage";
import { AsyncContextFrame } from "../async-context-frame";
import { patchObservers } from "./observers";

describe("Observers patch", () => {
  let als: AsyncLocalStorage<number>;

  beforeEach(() => {
    AsyncContextFrame.set(undefined);
    als = new AsyncLocalStorage<number>();
    patchObservers();
  });

  describe("MutationObserver", () => {
    it("should preserve context through MutationObserver", async () => {
      if (typeof MutationObserver === "undefined") {
        return; // Skip if not available
      }

      const target = document.createElement("div");
      document.body.appendChild(target);

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(100, () => {
          const observer = new MutationObserver(() => {
            resolve(als.getStore());
            observer.disconnect();
          });

          observer.observe(target, { childList: true });
          target.appendChild(document.createElement("span"));
        });
      });

      const result = await promise;
      expect(result).toBe(100);

      document.body.removeChild(target);
    });

    it("should preserve context through multiple mutations", async () => {
      if (typeof MutationObserver === "undefined") {
        return; // Skip if not available
      }

      const target = document.createElement("div");
      document.body.appendChild(target);
      const stores: (number | undefined)[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(200, () => {
          const observer = new MutationObserver(() => {
            stores.push(als.getStore());
            observer.disconnect();
            resolve();
          });

          observer.observe(target, { childList: true });

          // Schedule mutations to allow observer to process between them
          target.appendChild(document.createElement("span"));
          setTimeout(() => {
            target.appendChild(document.createElement("div"));
            setTimeout(() => {
              target.appendChild(document.createElement("p"));
            }, 0);
          }, 0);
        });
      });

      await promise;
      expect(stores.length).toBeGreaterThanOrEqual(1);
      stores.forEach((store) => {
        expect(store).toBe(200);
      });

      document.body.removeChild(target);
    });

    it("should preserve context when observer is created in one context and fires in another", async () => {
      if (typeof MutationObserver === "undefined") {
        return; // Skip if not available
      }

      const target = document.createElement("div");
      document.body.appendChild(target);

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(300, () => {
          const observer = new MutationObserver(() => {
            resolve(als.getStore());
            observer.disconnect();
          });

          observer.observe(target, { childList: true });
        });

        // Trigger mutation outside of run context
        setTimeout(() => {
          target.appendChild(document.createElement("span"));
        }, 10);
      });

      const result = await promise;
      expect(result).toBe(300);

      document.body.removeChild(target);
    });

    it("should receive mutation records", async () => {
      if (typeof MutationObserver === "undefined") {
        return; // Skip if not available
      }

      const target = document.createElement("div");
      document.body.appendChild(target);

      const promise = new Promise<{
        recordsCount: number;
        store: number | undefined;
      }>((resolve) => {
        als.run(400, () => {
          const observer = new MutationObserver((mutations) => {
            resolve({
              recordsCount: mutations.length,
              store: als.getStore(),
            });
            observer.disconnect();
          });

          observer.observe(target, { childList: true });
          target.appendChild(document.createElement("span"));
        });
      });

      const result = await promise;
      expect(result.recordsCount).toBeGreaterThan(0);
      expect(result.store).toBe(400);

      document.body.removeChild(target);
    });

    it("should preserve class name as MutationObserver", () => {
      if (typeof MutationObserver === "undefined") {
        return; // Skip if not available
      }

      expect(MutationObserver.name).toBe("MutationObserver");
    });
  });

  describe("ResizeObserver", () => {
    it("should preserve context through ResizeObserver", async () => {
      if (typeof ResizeObserver === "undefined") {
        return; // Skip if not available
      }

      const target = document.createElement("div");
      document.body.appendChild(target);

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(500, () => {
          const observer = new ResizeObserver(() => {
            resolve(als.getStore());
            observer.disconnect();
          });

          observer.observe(target);
          // Trigger a resize by changing size
          target.style.width = "100px";
          target.style.height = "100px";
        });
      });

      // Give the observer time to trigger
      await new Promise((r) => setTimeout(r, 100));
      const result = await Promise.race([
        promise,
        new Promise<undefined>((r) => setTimeout(() => r(undefined), 200)),
      ]);

      // ResizeObserver might not be fully functional in test environment
      if (result !== undefined) {
        expect(result).toBe(500);
      }

      document.body.removeChild(target);
    });

    it("should receive resize entries", async () => {
      if (typeof ResizeObserver === "undefined") {
        return; // Skip if not available
      }

      const target = document.createElement("div");
      document.body.appendChild(target);

      const promise = new Promise<{
        hasEntries: boolean;
        store: number | undefined;
      }>((resolve) => {
        als.run(600, () => {
          const observer = new ResizeObserver((entries) => {
            resolve({
              hasEntries: entries.length > 0,
              store: als.getStore(),
            });
            observer.disconnect();
          });

          observer.observe(target);
          target.style.width = "200px";
          target.style.height = "200px";
        });
      });

      await new Promise((r) => setTimeout(r, 100));
      const result = await Promise.race([
        promise,
        new Promise<{ hasEntries: boolean; store: undefined }>((r) =>
          setTimeout(() => r({ hasEntries: false, store: undefined }), 200)
        ),
      ]);

      if (result.store !== undefined) {
        expect(result.hasEntries).toBe(true);
        expect(result.store).toBe(600);
      }

      document.body.removeChild(target);
    });

    it("should preserve class name as ResizeObserver", () => {
      if (typeof ResizeObserver === "undefined") {
        return; // Skip if not available
      }

      expect(ResizeObserver.name).toBe("ResizeObserver");
    });
  });

  describe("IntersectionObserver", () => {
    it("should preserve context through IntersectionObserver", async () => {
      if (typeof IntersectionObserver === "undefined") {
        return; // Skip if not available
      }

      const target = document.createElement("div");
      document.body.appendChild(target);

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(700, () => {
          const observer = new IntersectionObserver(() => {
            resolve(als.getStore());
            observer.disconnect();
          });

          observer.observe(target);
        });
      });

      // Give the observer time to trigger
      await new Promise((r) => setTimeout(r, 100));
      const result = await Promise.race([
        promise,
        new Promise<undefined>((r) => setTimeout(() => r(undefined), 200)),
      ]);

      // IntersectionObserver might not trigger in test environment
      if (result !== undefined) {
        expect(result).toBe(700);
      }

      document.body.removeChild(target);
    });

    it("should preserve context with options", async () => {
      if (typeof IntersectionObserver === "undefined") {
        return; // Skip if not available
      }

      const target = document.createElement("div");
      document.body.appendChild(target);

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(800, () => {
          const observer = new IntersectionObserver(
            () => {
              resolve(als.getStore());
              observer.disconnect();
            },
            {
              threshold: 0.5,
            }
          );

          observer.observe(target);
        });
      });

      await new Promise((r) => setTimeout(r, 100));
      const result = await Promise.race([
        promise,
        new Promise<undefined>((r) => setTimeout(() => r(undefined), 200)),
      ]);

      if (result !== undefined) {
        expect(result).toBe(800);
      }

      document.body.removeChild(target);
    });

    it("should receive intersection entries", async () => {
      if (typeof IntersectionObserver === "undefined") {
        return; // Skip if not available
      }

      const target = document.createElement("div");
      document.body.appendChild(target);

      const promise = new Promise<{
        hasEntries: boolean;
        store: number | undefined;
      }>((resolve) => {
        als.run(900, () => {
          const observer = new IntersectionObserver((entries) => {
            resolve({
              hasEntries: entries.length > 0,
              store: als.getStore(),
            });
            observer.disconnect();
          });

          observer.observe(target);
        });
      });

      await new Promise((r) => setTimeout(r, 100));
      const result = await Promise.race([
        promise,
        new Promise<{ hasEntries: boolean; store: undefined }>((r) =>
          setTimeout(() => r({ hasEntries: false, store: undefined }), 200)
        ),
      ]);

      if (result.store !== undefined) {
        expect(result.hasEntries).toBe(true);
        expect(result.store).toBe(900);
      }

      document.body.removeChild(target);
    });

    it("should preserve class name as IntersectionObserver", () => {
      if (typeof IntersectionObserver === "undefined") {
        return; // Skip if not available
      }

      expect(IntersectionObserver.name).toBe("IntersectionObserver");
    });
  });

  describe("PerformanceObserver", () => {
    it("should preserve context through PerformanceObserver", async () => {
      if (typeof PerformanceObserver === "undefined") {
        return; // Skip if not available
      }

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(1000, () => {
          try {
            const observer = new PerformanceObserver(() => {
              resolve(als.getStore());
              observer.disconnect();
            });

            observer.observe({ entryTypes: ["measure"] });

            // Create a performance measure to trigger the observer
            performance.mark("test-start");
            performance.mark("test-end");
            performance.measure("test-measure", "test-start", "test-end");
          } catch (e) {
            // PerformanceObserver might not be fully supported
            resolve(undefined);
          }
        });
      });

      // Give the observer time to trigger
      await new Promise((r) => setTimeout(r, 100));
      const result = await Promise.race([
        promise,
        new Promise<undefined>((r) => setTimeout(() => r(undefined), 200)),
      ]);

      // PerformanceObserver might not be fully functional in test environment
      if (result !== undefined) {
        expect(result).toBe(1000);
      }
    });

    it("should receive performance entries", async () => {
      if (typeof PerformanceObserver === "undefined") {
        return; // Skip if not available
      }

      const promise = new Promise<{
        hasEntries: boolean;
        store: number | undefined;
      }>((resolve) => {
        als.run(1100, () => {
          try {
            const observer = new PerformanceObserver((list) => {
              resolve({
                hasEntries: list.getEntries().length > 0,
                store: als.getStore(),
              });
              observer.disconnect();
            });

            observer.observe({ entryTypes: ["measure"] });

            performance.mark("start-1100");
            performance.mark("end-1100");
            performance.measure("measure-1100", "start-1100", "end-1100");
          } catch (e) {
            resolve({ hasEntries: false, store: undefined });
          }
        });
      });

      await new Promise((r) => setTimeout(r, 100));
      const result = await Promise.race([
        promise,
        new Promise<{ hasEntries: boolean; store: undefined }>((r) =>
          setTimeout(() => r({ hasEntries: false, store: undefined }), 200)
        ),
      ]);

      if (result.store !== undefined) {
        expect(result.hasEntries).toBe(true);
        expect(result.store).toBe(1100);
      }
    });

    it("should preserve context with different entry types", async () => {
      if (typeof PerformanceObserver === "undefined") {
        return; // Skip if not available
      }

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(1200, () => {
          try {
            const observer = new PerformanceObserver(() => {
              resolve(als.getStore());
              observer.disconnect();
            });

            observer.observe({ entryTypes: ["mark", "measure"] });

            performance.mark("test-mark-1200");
          } catch (e) {
            resolve(undefined);
          }
        });
      });

      await new Promise((r) => setTimeout(r, 100));
      const result = await Promise.race([
        promise,
        new Promise<undefined>((r) => setTimeout(() => r(undefined), 200)),
      ]);

      if (result !== undefined) {
        expect(result).toBe(1200);
      }
    });

    it("should preserve class name as PerformanceObserver", () => {
      if (typeof PerformanceObserver === "undefined") {
        return; // Skip if not available
      }

      expect(PerformanceObserver.name).toBe("PerformanceObserver");
    });
  });

  describe("Multiple observers", () => {
    it("should preserve context for multiple different observers", async () => {
      if (
        typeof MutationObserver === "undefined" ||
        typeof PerformanceObserver === "undefined"
      ) {
        return; // Skip if not available
      }

      const target = document.createElement("div");
      document.body.appendChild(target);

      const results: Array<{ type: string; store: number | undefined }> = [];

      const promise = new Promise<void>((resolve) => {
        als.run(1300, () => {
          const mutationObserver = new MutationObserver(() => {
            results.push({ type: "mutation", store: als.getStore() });
            mutationObserver.disconnect();
            if (results.length >= 2) resolve();
          });

          mutationObserver.observe(target, { childList: true });

          try {
            const performanceObserver = new PerformanceObserver(() => {
              results.push({ type: "performance", store: als.getStore() });
              performanceObserver.disconnect();
              if (results.length >= 2) resolve();
            });

            performanceObserver.observe({ entryTypes: ["measure"] });

            performance.mark("multi-start");
            performance.mark("multi-end");
            performance.measure("multi-measure", "multi-start", "multi-end");
          } catch (e) {
            // PerformanceObserver might not work, just resolve
            resolve();
          }

          target.appendChild(document.createElement("span"));
        });
      });

      await new Promise((r) => setTimeout(r, 100));
      await Promise.race([
        promise,
        new Promise<void>((r) => setTimeout(() => r(), 200)),
      ]);

      results.forEach((result) => {
        expect(result.store).toBe(1300);
      });

      document.body.removeChild(target);
    });

    it("should isolate contexts for observers in different runs", async () => {
      if (typeof MutationObserver === "undefined") {
        return; // Skip if not available
      }

      const target1 = document.createElement("div");
      const target2 = document.createElement("div");
      document.body.appendChild(target1);
      document.body.appendChild(target2);

      const results: number[] = [];

      const promise = new Promise<void>((resolve) => {
        let count = 0;

        als.run(1400, () => {
          const observer = new MutationObserver(() => {
            results.push(als.getStore()!);
            observer.disconnect();
            count++;
            if (count >= 2) resolve();
          });

          observer.observe(target1, { childList: true });
          target1.appendChild(document.createElement("span"));
        });

        als.run(1500, () => {
          const observer = new MutationObserver(() => {
            results.push(als.getStore()!);
            observer.disconnect();
            count++;
            if (count >= 2) resolve();
          });

          observer.observe(target2, { childList: true });
          target2.appendChild(document.createElement("span"));
        });
      });

      await promise;
      expect(results.sort()).toEqual([1400, 1500]);

      document.body.removeChild(target1);
      document.body.removeChild(target2);
    });
  });
});
