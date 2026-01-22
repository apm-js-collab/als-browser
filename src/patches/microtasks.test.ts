import { describe, it, expect, beforeEach } from "vitest";
import { AsyncLocalStorage } from "../async-local-storage";
import { AsyncContextFrame } from "../async-context-frame";
import { patchMicrotasks } from "./microtasks";
import { patchTimers } from "./timers";

describe("Microtasks patch", () => {
  let als: AsyncLocalStorage<number>;

  beforeEach(() => {
    AsyncContextFrame.set(undefined);
    als = new AsyncLocalStorage<number>();
    patchMicrotasks();
    patchTimers(); // Needed for tests that use setTimeout
  });

  describe("queueMicrotask", () => {
    it("should preserve context through queueMicrotask", async () => {
      const promise = new Promise<number | undefined>((resolve) => {
        als.run(100, () => {
          queueMicrotask(() => {
            resolve(als.getStore());
          });
        });
      });

      const result = await promise;
      expect(result).toBe(100);
    });

    it("should preserve context through chained queueMicrotask calls", async () => {
      const stores: (number | undefined)[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(200, () => {
          stores.push(als.getStore());
          queueMicrotask(() => {
            stores.push(als.getStore());
            queueMicrotask(() => {
              stores.push(als.getStore());
              queueMicrotask(() => {
                stores.push(als.getStore());
                resolve();
              });
            });
          });
        });
      });

      await promise;
      expect(stores).toEqual([200, 200, 200, 200]);
    });

    it("should isolate contexts in parallel queueMicrotask calls", async () => {
      const results: number[] = [];

      const promises = [1, 2, 3, 4, 5].map((value) => {
        return new Promise<void>((resolve) => {
          als.run(value, () => {
            queueMicrotask(() => {
              results.push(als.getStore()!);
              resolve();
            });
          });
        });
      });

      await Promise.all(promises);
      expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it("should preserve context when microtask updates context", async () => {
      const sequence: number[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(300, () => {
          sequence.push(als.getStore()!);
          queueMicrotask(() => {
            sequence.push(als.getStore()!);
            als.enterWith(400);
            sequence.push(als.getStore()!);
            queueMicrotask(() => {
              sequence.push(als.getStore()!);
              resolve();
            });
          });
        });
      });

      await promise;
      expect(sequence).toEqual([300, 300, 400, 400]);
    });

    it("should preserve context through microtasks scheduled from different contexts", async () => {
      const results: Array<{ source: string; store: number | undefined }> = [];

      const promise1 = new Promise<void>((resolve) => {
        als.run(500, () => {
          queueMicrotask(() => {
            results.push({ source: "first", store: als.getStore() });
            resolve();
          });
        });
      });

      const promise2 = new Promise<void>((resolve) => {
        als.run(600, () => {
          queueMicrotask(() => {
            results.push({ source: "second", store: als.getStore() });
            resolve();
          });
        });
      });

      await Promise.all([promise1, promise2]);

      const first = results.find((r) => r.source === "first");
      const second = results.find((r) => r.source === "second");

      expect(first?.store).toBe(500);
      expect(second?.store).toBe(600);
    });

    it("should preserve context through multiple queueMicrotask calls in sequence", async () => {
      const sequence: Array<{ step: string; store: number | undefined }> = [];

      const promise = new Promise<void>((resolve) => {
        als.run(700, () => {
          sequence.push({ step: "start", store: als.getStore() });

          queueMicrotask(() => {
            sequence.push({ step: "microtask1", store: als.getStore() });

            queueMicrotask(() => {
              sequence.push({ step: "microtask2", store: als.getStore() });

              queueMicrotask(() => {
                sequence.push({ step: "microtask3", store: als.getStore() });
                resolve();
              });
            });
          });
        });
      });

      await promise;

      expect(sequence).toEqual([
        { step: "start", store: 700 },
        { step: "microtask1", store: 700 },
        { step: "microtask2", store: 700 },
        { step: "microtask3", store: 700 },
      ]);
    });

    it("should preserve context when queueMicrotask is called outside of run()", async () => {
      const promise = new Promise<number | undefined>((resolve) => {
        als.run(800, () => {
          // Call queueMicrotask
          queueMicrotask(() => {
            resolve(als.getStore());
          });
        });
      });

      const result = await promise;
      expect(result).toBe(800);
    });

    it("should execute microtasks before next macrotask", async () => {
      const sequence: string[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(900, () => {
          sequence.push("run");

          setTimeout(() => {
            sequence.push(`timeout:${als.getStore()}`);
            resolve();
          }, 10);

          queueMicrotask(() => {
            sequence.push(`microtask:${als.getStore()}`);
          });

          sequence.push("run-end");
        });
      });

      await promise;

      // Microtask should execute before timeout
      expect(sequence[0]).toBe("run");
      expect(sequence[1]).toBe("run-end");
      expect(sequence[2]).toBe("microtask:900");
      expect(sequence[3]).toBe("timeout:900");
    });


    it("should preserve context across mix of microtasks and macrotasks", async () => {
      const sequence: string[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(1100, () => {
          sequence.push(`start:${als.getStore()}`);

          queueMicrotask(() => {
            sequence.push(`microtask1:${als.getStore()}`);

            setTimeout(() => {
              sequence.push(`timeout:${als.getStore()}`);

              queueMicrotask(() => {
                sequence.push(`microtask2:${als.getStore()}`);
                resolve();
              });
            }, 10);
          });
        });
      });

      await promise;

      expect(sequence).toEqual([
        "start:1100",
        "microtask1:1100",
        "timeout:1100",
        "microtask2:1100",
      ]);
    });
  });
});
