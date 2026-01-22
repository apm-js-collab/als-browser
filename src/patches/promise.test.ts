import { describe, it, expect, beforeEach } from "vitest";
import { AsyncLocalStorage } from "../async-local-storage";
import { AsyncContextFrame } from "../async-context-frame";
import { patchPromise } from "./promise";

describe("Promise patch", () => {
  let als: AsyncLocalStorage<number>;

  beforeEach(() => {
    AsyncContextFrame.set(undefined);
    als = new AsyncLocalStorage<number>();
    patchPromise();
  });

  describe("Promise.then()", () => {
    it("should preserve context through Promise.then()", async () => {
      const result = await als.run(100, () => {
        return Promise.resolve(42).then((value) => {
          return { value, store: als.getStore() };
        });
      });

      expect(result).toEqual({ value: 42, store: 100 });
    });

    it("should preserve context through chained .then() calls", async () => {
      const stores: (number | undefined)[] = [];

      const result = await als.run(200, () => {
        return Promise.resolve(1)
          .then((value) => {
            stores.push(als.getStore());
            return value + 1;
          })
          .then((value) => {
            stores.push(als.getStore());
            return value + 1;
          })
          .then((value) => {
            stores.push(als.getStore());
            return value + 1;
          });
      });

      expect(result).toBe(4);
      expect(stores).toEqual([200, 200, 200]);
    });

    it("should preserve context through .then() with both callbacks", async () => {
      const fulfilledStore = await als.run(300, () => {
        return Promise.resolve(42).then(
          () => als.getStore(),
          () => undefined
        );
      });
      expect(fulfilledStore).toBe(300);

      const rejectedStore = await als.run(400, () => {
        return Promise.reject(new Error("test")).then(
          () => undefined,
          () => als.getStore()
        );
      });
      expect(rejectedStore).toBe(400);
    });

    it("should preserve context when returning a Promise from .then()", async () => {
      const result = await als.run(500, () => {
        return Promise.resolve(1).then(() => {
          return Promise.resolve(2).then(() => {
            return als.getStore();
          });
        });
      });

      expect(result).toBe(500);
    });

    it("should preserve context when .then() is called without callbacks", async () => {
      const result = await als.run(600, () => {
        return Promise.resolve(42).then().then((value) => {
          return { value, store: als.getStore() };
        });
      });

      expect(result).toEqual({ value: 42, store: 600 });
    });

    it("should preserve context through .then() on rejected promise", async () => {
      const result = await als.run(700, () => {
        return Promise.reject(new Error("test")).then(null, (err) => {
          return { error: err.message, store: als.getStore() };
        });
      });

      expect(result).toEqual({ error: "test", store: 700 });
    });

    it("should isolate contexts in parallel .then() calls", async () => {
      const results: number[] = [];

      const promises = [1, 2, 3].map((value) => {
        return als.run(value, () => {
          return Promise.resolve().then(() => {
            results.push(als.getStore()!);
          });
        });
      });

      await Promise.all(promises);
      expect(results.sort()).toEqual([1, 2, 3]);
    });
  });

  describe("Promise.catch()", () => {
    it("should preserve context through Promise.catch()", async () => {
      const result = await als.run(800, () => {
        return Promise.reject(new Error("test")).catch((err) => {
          return { error: err.message, store: als.getStore() };
        });
      });

      expect(result).toEqual({ error: "test", store: 800 });
    });

    it("should preserve context through chained .catch() calls", async () => {
      const stores: (number | undefined)[] = [];

      const result = await als.run(900, () => {
        return Promise.reject(new Error("first"))
          .catch((err) => {
            stores.push(als.getStore());
            throw new Error("second");
          })
          .catch((err) => {
            stores.push(als.getStore());
            return "recovered";
          });
      });

      expect(result).toBe("recovered");
      expect(stores).toEqual([900, 900]);
    });

    it("should preserve context when .catch() is called on fulfilled promise", async () => {
      const result = await als.run(1000, () => {
        return Promise.resolve(42)
          .catch(() => {
            // Should not be called
            return 0;
          })
          .then((value) => {
            return { value, store: als.getStore() };
          });
      });

      expect(result).toEqual({ value: 42, store: 1000 });
    });

    it("should preserve context when returning a Promise from .catch()", async () => {
      const result = await als.run(1100, () => {
        return Promise.reject(new Error("test")).catch(() => {
          return Promise.resolve(als.getStore());
        });
      });

      expect(result).toBe(1100);
    });
  });

  describe("Promise.finally()", () => {
    it("should preserve context through Promise.finally() on fulfilled promise", async () => {
      let finallyStore: number | undefined;

      const result = await als.run(1200, () => {
        return Promise.resolve(42).finally(() => {
          finallyStore = als.getStore();
        });
      });

      expect(result).toBe(42);
      expect(finallyStore).toBe(1200);
    });

    it("should preserve context through Promise.finally() on rejected promise", async () => {
      let finallyStore: number | undefined;

      const result = await als.run(1300, () => {
        return Promise.reject(new Error("test"))
          .finally(() => {
            finallyStore = als.getStore();
          })
          .catch(() => "recovered");
      });

      expect(result).toBe("recovered");
      expect(finallyStore).toBe(1300);
    });

    it("should preserve context through chained .finally() calls", async () => {
      const stores: (number | undefined)[] = [];

      const result = await als.run(1400, () => {
        return Promise.resolve(42)
          .finally(() => {
            stores.push(als.getStore());
          })
          .finally(() => {
            stores.push(als.getStore());
          })
          .finally(() => {
            stores.push(als.getStore());
          });
      });

      expect(result).toBe(42);
      expect(stores).toEqual([1400, 1400, 1400]);
    });

    it("should preserve context when .finally() is combined with .then()", async () => {
      const sequence: string[] = [];

      const result = await als.run(1500, () => {
        return Promise.resolve(1)
          .then((value) => {
            sequence.push(`then:${als.getStore()}`);
            return value + 1;
          })
          .finally(() => {
            sequence.push(`finally:${als.getStore()}`);
          })
          .then((value) => {
            sequence.push(`then2:${als.getStore()}`);
            return value + 1;
          });
      });

      expect(result).toBe(3);
      expect(sequence).toEqual(["then:1500", "finally:1500", "then2:1500"]);
    });

    it("should preserve context when .finally() returns a promise", async () => {
      let finallyStore: number | undefined;

      const result = await als.run(1600, () => {
        return Promise.resolve(42).finally(() => {
          return Promise.resolve().then(() => {
            finallyStore = als.getStore();
          });
        });
      });

      expect(result).toBe(42);
      expect(finallyStore).toBe(1600);
    });
  });

  describe("Promise combinations", () => {
    it("should preserve context through .then().catch().finally()", async () => {
      const sequence: string[] = [];

      const result = await als.run(1700, () => {
        return Promise.reject(new Error("test"))
          .then(() => {
            sequence.push("then (should not run)");
          })
          .catch((err) => {
            sequence.push(`catch:${als.getStore()}`);
            return "recovered";
          })
          .finally(() => {
            sequence.push(`finally:${als.getStore()}`);
          });
      });

      expect(result).toBe("recovered");
      expect(sequence).toEqual(["catch:1700", "finally:1700"]);
    });

    it("should preserve context in nested promise chains", async () => {
      const result = await als.run(1800, () => {
        return Promise.resolve(1)
          .then((value) => {
            return Promise.resolve(value + 1).then((nested) => {
              return Promise.resolve(nested + 1).then((doubleNested) => {
                return { value: doubleNested, store: als.getStore() };
              });
            });
          });
      });

      expect(result).toEqual({ value: 3, store: 1800 });
    });

    it("should preserve context when promises are created outside run()", async () => {
      const promise = Promise.resolve(42);

      const result = await als.run(1900, () => {
        return promise.then((value) => {
          return { value, store: als.getStore() };
        });
      });

      expect(result).toEqual({ value: 42, store: 1900 });
    });

    it("should preserve context through Promise.all()", async () => {
      const result = await als.run(2000, () => {
        return Promise.all([
          Promise.resolve(1).then(() => als.getStore()),
          Promise.resolve(2).then(() => als.getStore()),
          Promise.resolve(3).then(() => als.getStore()),
        ]);
      });

      expect(result).toEqual([2000, 2000, 2000]);
    });

    it("should preserve context through Promise.race()", async () => {
      const result = await als.run(2100, () => {
        return Promise.race([
          Promise.resolve(1).then(() => als.getStore()),
          Promise.resolve(2).then(() => als.getStore()),
        ]);
      });

      expect(result).toBe(2100);
    });

    it("should preserve context through Promise.allSettled()", async () => {
      const result = await als.run(2200, () => {
        return Promise.allSettled([
          Promise.resolve(1).then(() => als.getStore()),
          Promise.reject(new Error("test")).catch(() => als.getStore()),
        ]);
      });

      expect(result).toEqual([
        { status: "fulfilled", value: 2200 },
        { status: "fulfilled", value: 2200 },
      ]);
    });

    it("should preserve context through Promise.any()", async () => {
      const result = await als.run(2300, () => {
        return Promise.any([
          Promise.reject(new Error("test")),
          Promise.resolve(1).then(() => als.getStore()),
        ]);
      });

      expect(result).toBe(2300);
    });
  });
});
