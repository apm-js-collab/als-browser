import { describe, it, expect, beforeEach } from "vitest";
import { AsyncLocalStorage } from "../async-local-storage";
import { AsyncContextFrame } from "../async-context-frame";
import { patchTimers } from "./timers";

describe("Timers patch", () => {
  let als: AsyncLocalStorage<number>;

  beforeEach(() => {
    AsyncContextFrame.set(undefined);
    als = new AsyncLocalStorage<number>();
    patchTimers();
  });

  describe("setTimeout", () => {
    it("should preserve context through setTimeout", async () => {
      const promise = new Promise<number | undefined>((resolve) => {
        als.run(100, () => {
          setTimeout(() => {
            resolve(als.getStore());
          }, 10);
        });
      });

      const result = await promise;
      expect(result).toBe(100);
    });

    it("should preserve context through chained setTimeout calls", async () => {
      const sequence: number[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(200, () => {
          sequence.push(als.getStore()!);
          setTimeout(() => {
            sequence.push(als.getStore()!);
            setTimeout(() => {
              sequence.push(als.getStore()!);
              resolve();
            }, 10);
          }, 10);
        });
      });

      await promise;
      expect(sequence).toEqual([200, 200, 200]);
    });

    it("should isolate contexts in parallel setTimeout calls", async () => {
      const results: number[] = [];

      const promises = [1, 2, 3].map((value) => {
        return new Promise<void>((resolve) => {
          als.run(value, () => {
            setTimeout(() => {
              results.push(als.getStore()!);
              resolve();
            }, 10);
          });
        });
      });

      await Promise.all(promises);
      expect(results.sort()).toEqual([1, 2, 3]);
    });

    it("should pass arguments to setTimeout callback", async () => {
      const promise = new Promise<{ args: any[]; store: number | undefined }>(
        (resolve) => {
          als.run(300, () => {
            setTimeout(
              (a: number, b: string) => {
                resolve({ args: [a, b], store: als.getStore() });
              },
              10,
              42,
              "test"
            );
          });
        }
      );

      const result = await promise;
      expect(result).toEqual({ args: [42, "test"], store: 300 });
    });

  });

  describe("setInterval", () => {
    it("should preserve context through setInterval", async () => {
      const values: (number | undefined)[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(500, () => {
          let count = 0;
          const intervalId = setInterval(() => {
            values.push(als.getStore());
            count++;
            if (count >= 3) {
              clearInterval(intervalId);
              resolve();
            }
          }, 10);
        });
      });

      await promise;
      expect(values).toEqual([500, 500, 500]);
    });

    it("should maintain same context across interval iterations", async () => {
      const values: number[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(600, () => {
          let count = 0;
          const intervalId = setInterval(() => {
            values.push(als.getStore()!);
            count++;
            if (count >= 5) {
              clearInterval(intervalId);
              resolve();
            }
          }, 5);
        });
      });

      await promise;
      expect(values).toEqual([600, 600, 600, 600, 600]);
    });

    it("should pass arguments to setInterval callback", async () => {
      const promise = new Promise<{ args: any[]; store: number | undefined }>(
        (resolve) => {
          als.run(700, () => {
            const intervalId = setInterval(
              (a: number, b: string) => {
                clearInterval(intervalId);
                resolve({ args: [a, b], store: als.getStore() });
              },
              10,
              99,
              "interval"
            );
          });
        }
      );

      const result = await promise;
      expect(result).toEqual({ args: [99, "interval"], store: 700 });
    });
  });

  describe("requestAnimationFrame", () => {
    it("should preserve context through requestAnimationFrame", async () => {
      if (!globalThis.requestAnimationFrame) {
        return; // Skip if not available
      }

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(800, () => {
          requestAnimationFrame(() => {
            resolve(als.getStore());
          });
        });
      });

      const result = await promise;
      expect(result).toBe(800);
    });

    it("should preserve context through chained requestAnimationFrame calls", async () => {
      if (!globalThis.requestAnimationFrame) {
        return; // Skip if not available
      }

      const sequence: number[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(900, () => {
          sequence.push(als.getStore()!);
          requestAnimationFrame(() => {
            sequence.push(als.getStore()!);
            requestAnimationFrame(() => {
              sequence.push(als.getStore()!);
              resolve();
            });
          });
        });
      });

      await promise;
      expect(sequence).toEqual([900, 900, 900]);
    });

    it("should receive timestamp parameter", async () => {
      if (!globalThis.requestAnimationFrame) {
        return; // Skip if not available
      }

      const promise = new Promise<{ timestamp: number; store: number | undefined }>(
        (resolve) => {
          als.run(1000, () => {
            requestAnimationFrame((timestamp) => {
              resolve({ timestamp, store: als.getStore() });
            });
          });
        }
      );

      const result = await promise;
      expect(result.store).toBe(1000);
      expect(typeof result.timestamp).toBe("number");
    });
  });

  describe("requestIdleCallback", () => {
    it("should preserve context through requestIdleCallback", async () => {
      if (!globalThis.requestIdleCallback) {
        return; // Skip if not available
      }

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(1100, () => {
          requestIdleCallback(() => {
            resolve(als.getStore());
          });
        });
      });

      const result = await promise;
      expect(result).toBe(1100);
    });

    it("should preserve context with timeout option", async () => {
      if (!globalThis.requestIdleCallback) {
        return; // Skip if not available
      }

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(1200, () => {
          requestIdleCallback(
            () => {
              resolve(als.getStore());
            },
            { timeout: 100 }
          );
        });
      });

      const result = await promise;
      expect(result).toBe(1200);
    });

    it("should receive deadline parameter", async () => {
      if (!globalThis.requestIdleCallback) {
        return; // Skip if not available
      }

      const promise = new Promise<{
        hasDeadline: boolean;
        store: number | undefined;
      }>((resolve) => {
        als.run(1300, () => {
          requestIdleCallback((deadline) => {
            resolve({
              hasDeadline: deadline !== undefined,
              store: als.getStore(),
            });
          });
        });
      });

      const result = await promise;
      expect(result.store).toBe(1300);
      expect(result.hasDeadline).toBe(true);
    });
  });

  describe("setImmediate", () => {
    it("should preserve context through setImmediate if available", async () => {
      if (!(globalThis as any).setImmediate) {
        return; // Skip if not available
      }

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(1400, () => {
          (globalThis as any).setImmediate(() => {
            resolve(als.getStore());
          });
        });
      });

      const result = await promise;
      expect(result).toBe(1400);
    });

    it("should pass arguments to setImmediate callback if available", async () => {
      if (!(globalThis as any).setImmediate) {
        return; // Skip if not available
      }

      const promise = new Promise<{ args: any[]; store: number | undefined }>(
        (resolve) => {
          als.run(1500, () => {
            (globalThis as any).setImmediate(
              (a: number, b: string) => {
                resolve({ args: [a, b], store: als.getStore() });
              },
              77,
              "immediate"
            );
          });
        }
      );

      const result = await promise;
      expect(result).toEqual({ args: [77, "immediate"], store: 1500 });
    });
  });
});
