import { describe, it, expect, beforeEach } from "vitest";
import { AsyncLocalStorage } from "./index";
import { AsyncContextFrame } from "./async-context-frame";

describe("AsyncLocalStorage", () => {
  let als: AsyncLocalStorage<number>;

  beforeEach(() => {
    // Reset the global context frame before each test
    AsyncContextFrame.set(undefined);
    als = new AsyncLocalStorage<number>();
  });

  describe("Basic API", () => {
    it("should return undefined when no store is set", () => {
      expect(als.getStore()).toBeUndefined();
    });

    it("should return default value when configured", () => {
      const alsWithDefault = new AsyncLocalStorage<number>({
        defaultValue: 42,
      });
      expect(alsWithDefault.getStore()).toBe(42);
    });

    it("should support name option", () => {
      const namedAls = new AsyncLocalStorage<number>({ name: "test-store" });
      expect(namedAls.name).toBe("test-store");
    });

    it("should preserve context in run()", () => {
      const result = als.run(123, () => {
        return als.getStore();
      });
      expect(result).toBe(123);
    });

    it("should restore context after run() completes", () => {
      expect(als.getStore()).toBeUndefined();
      als.run(123, () => {
        expect(als.getStore()).toBe(123);
      });
      expect(als.getStore()).toBeUndefined();
    });

    it("should handle nested run() calls", () => {
      als.run(1, () => {
        expect(als.getStore()).toBe(1);
        als.run(2, () => {
          expect(als.getStore()).toBe(2);
          als.run(3, () => {
            expect(als.getStore()).toBe(3);
          });
          expect(als.getStore()).toBe(2);
        });
        expect(als.getStore()).toBe(1);
      });
      expect(als.getStore()).toBeUndefined();
    });

    it("should support enterWith()", () => {
      expect(als.getStore()).toBeUndefined();
      als.enterWith(456);
      expect(als.getStore()).toBe(456);
      als.enterWith(789);
      expect(als.getStore()).toBe(789);
    });

    it("should support exit()", () => {
      als.enterWith(100);
      expect(als.getStore()).toBe(100);
      const result = als.exit(() => {
        expect(als.getStore()).toBeUndefined();
        return "exited";
      });
      expect(result).toBe("exited");
      expect(als.getStore()).toBe(100);
    });

    it("should support disable()", () => {
      als.enterWith(200);
      expect(als.getStore()).toBe(200);
      als.disable();
      expect(als.getStore()).toBeUndefined();
    });
  });

  describe("Static methods", () => {
    it("should bind function to current context", () => {
      let capturedValue: number | undefined;

      als.run(999, () => {
        const bound = AsyncLocalStorage.bind(() => {
          capturedValue = als.getStore();
        });

        // Call bound function outside of run context
        AsyncContextFrame.set(undefined);
        bound();
      });

      expect(capturedValue).toBe(999);
    });

    it("should preserve 'this' context in bound functions", () => {
      const obj = {
        value: 42,
        getValue(this: { value: number }) {
          return this.value;
        },
      };

      const bound = AsyncLocalStorage.bind(obj.getValue);
      expect(bound.call(obj)).toBe(42);
    });

    it("should support snapshot()", () => {
      const snapshot = als.run(555, () => {
        return AsyncLocalStorage.snapshot();
      });

      // Run snapshot outside of original context
      AsyncContextFrame.set(undefined);
      const result = snapshot(() => {
        return als.getStore();
      });

      expect(result).toBe(555);
    });
  });


  describe("Multiple stores", () => {
    it("should isolate different AsyncLocalStorage instances", () => {
      const als1 = new AsyncLocalStorage<string>();
      const als2 = new AsyncLocalStorage<number>();

      als1.run("hello", () => {
        als2.run(42, () => {
          expect(als1.getStore()).toBe("hello");
          expect(als2.getStore()).toBe(42);
        });
      });
    });

    it("should handle nested runs with multiple stores", () => {
      const als1 = new AsyncLocalStorage<string>();
      const als2 = new AsyncLocalStorage<number>();

      als1.run("outer", () => {
        als2.run(1, () => {
          expect(als1.getStore()).toBe("outer");
          expect(als2.getStore()).toBe(1);

          als1.run("inner", () => {
            als2.run(2, () => {
              expect(als1.getStore()).toBe("inner");
              expect(als2.getStore()).toBe(2);
            });
            expect(als1.getStore()).toBe("inner");
            expect(als2.getStore()).toBe(1);
          });

          expect(als1.getStore()).toBe("outer");
          expect(als2.getStore()).toBe(1);
        });
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle run() with same value as current", () => {
      als.enterWith(777);
      const callCount = { count: 0 };

      als.run(777, () => {
        callCount.count++;
        expect(als.getStore()).toBe(777);
      });

      expect(callCount.count).toBe(1);
    });

    it("should pass arguments to run() callback", () => {
      const result = als.run(
        100,
        (a: number, b: string, c: boolean) => {
          return { a, b, c, store: als.getStore() };
        },
        1,
        "test",
        true
      );

      expect(result).toEqual({ a: 1, b: "test", c: true, store: 100 });
    });

    it("should pass arguments to exit() callback", () => {
      const result = als.exit(
        (x: number, y: number) => {
          return x + y;
        },
        5,
        10
      );

      expect(result).toBe(15);
    });

    it("should handle undefined as a valid store value", () => {
      als.run(undefined as any, () => {
        expect(als.getStore()).toBeUndefined();
      });
    });

    it("should handle null as a valid store value", () => {
      const alsNull = new AsyncLocalStorage<string | null>();
      alsNull.run(null, () => {
        expect(alsNull.getStore()).toBeNull();
      });
    });
  });

  describe("Context propagation", () => {
    it("should propagate through chained setTimeout calls", async () => {
      const sequence: number[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(1, () => {
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
      expect(sequence).toEqual([1, 1, 1]);
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
  });

});
