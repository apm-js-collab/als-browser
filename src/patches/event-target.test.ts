import { describe, it, expect, beforeEach } from "vitest";
import { AsyncLocalStorage } from "../async-local-storage";
import { AsyncContextFrame } from "../async-context-frame";
import { patchEventTarget } from "./event-target";

describe("EventTarget patch", () => {
  let als: AsyncLocalStorage<number>;

  beforeEach(() => {
    AsyncContextFrame.set(undefined);
    als = new AsyncLocalStorage<number>();
    patchEventTarget();
  });

  describe("addEventListener with function listener", () => {
    it("should preserve context through addEventListener", async () => {
      const target = new EventTarget();

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(100, () => {
          target.addEventListener("test", () => {
            resolve(als.getStore());
          });

          target.dispatchEvent(new Event("test"));
        });
      });

      const result = await promise;
      expect(result).toBe(100);
    });

    it("should preserve context across multiple events", async () => {
      const target = new EventTarget();
      const results: (number | undefined)[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(200, () => {
          let count = 0;
          target.addEventListener("test", () => {
            results.push(als.getStore());
            count++;
            if (count >= 3) {
              resolve();
            }
          });

          target.dispatchEvent(new Event("test"));
          target.dispatchEvent(new Event("test"));
          target.dispatchEvent(new Event("test"));
        });
      });

      await promise;
      expect(results).toEqual([200, 200, 200]);
    });

    it("should preserve context when event is dispatched later", async () => {
      const target = new EventTarget();

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(300, () => {
          target.addEventListener("test", () => {
            resolve(als.getStore());
          });
        });

        // Dispatch event outside of run context
        setTimeout(() => {
          target.dispatchEvent(new Event("test"));
        }, 10);
      });

      const result = await promise;
      expect(result).toBe(300);
    });

    it("should isolate contexts for different event listeners", async () => {
      const target = new EventTarget();
      const results: number[] = [];

      const promise = new Promise<void>((resolve) => {
        let count = 0;

        als.run(400, () => {
          target.addEventListener("test", () => {
            results.push(als.getStore()!);
            count++;
            if (count >= 2) resolve();
          });
        });

        als.run(500, () => {
          target.addEventListener("test", () => {
            results.push(als.getStore()!);
            count++;
            if (count >= 2) resolve();
          });
        });

        target.dispatchEvent(new Event("test"));
      });

      await promise;
      expect(results.sort()).toEqual([400, 500]);
    });

    it("should handle multiple listeners for the same event", async () => {
      const target = new EventTarget();
      const results: number[] = [];

      const promise = new Promise<void>((resolve) => {
        let callCount = 0;
        als.run(600, () => {
          target.addEventListener("test", () => {
            results.push(als.getStore()!);
            callCount++;
            if (callCount === 2) resolve();
          });

          target.addEventListener("test", () => {
            results.push(als.getStore()! + 1000);
            callCount++;
            if (callCount === 2) resolve();
          });

          target.dispatchEvent(new Event("test"));
        });
      });

      await promise;
      expect(results.length).toBe(2);
      expect(results).toContain(600);
      expect(results).toContain(1600);
    });

    it("should pass event object to listener", async () => {
      const target = new EventTarget();

      const promise = new Promise<{
        type: string;
        target: EventTarget | null;
        store: number | undefined;
      }>((resolve) => {
        als.run(700, () => {
          target.addEventListener("custom", (event) => {
            resolve({
              type: event.type,
              target: event.target,
              store: als.getStore(),
            });
          });

          target.dispatchEvent(new Event("custom"));
        });
      });

      const result = await promise;
      expect(result.type).toBe("custom");
      expect(result.target).toBe(target);
      expect(result.store).toBe(700);
    });

    it("should handle event listener with options", async () => {
      const target = new EventTarget();
      let callCount = 0;

      const promise = new Promise<void>((resolve) => {
        als.run(800, () => {
          target.addEventListener(
            "test",
            () => {
              callCount++;
              expect(als.getStore()).toBe(800);
              if (callCount === 1) {
                resolve();
              }
            },
            { once: true }
          );

          target.dispatchEvent(new Event("test"));
          target.dispatchEvent(new Event("test"));
        });
      });

      await promise;
      expect(callCount).toBe(1);
    });

    it("should handle capture phase events", async () => {
      if (typeof document === "undefined") {
        return; // Skip in non-browser environment
      }

      const parent = document.createElement("div");
      const child = document.createElement("span");
      parent.appendChild(child);

      const sequence: string[] = [];

      const promise = new Promise<void>((resolve) => {
        als.run(900, () => {
          parent.addEventListener(
            "test",
            () => {
              sequence.push(`parent-capture:${als.getStore()}`);
            },
            { capture: true }
          );

          child.addEventListener("test", () => {
            sequence.push(`child:${als.getStore()}`);
          });

          parent.addEventListener("test", () => {
            sequence.push(`parent-bubble:${als.getStore()}`);
            resolve();
          });

          child.dispatchEvent(new Event("test", { bubbles: true }));
        });
      });

      await promise;
      expect(sequence).toEqual([
        "parent-capture:900",
        "child:900",
        "parent-bubble:900",
      ]);
    });
  });

  describe("addEventListener with EventListenerObject", () => {
    it("should preserve context with EventListenerObject", async () => {
      const target = new EventTarget();

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(1000, () => {
          const listener = {
            handleEvent() {
              resolve(als.getStore());
            },
          };

          target.addEventListener("test", listener);
          target.dispatchEvent(new Event("test"));
        });
      });

      const result = await promise;
      expect(result).toBe(1000);
    });

    it("should preserve 'this' binding in handleEvent", async () => {
      const target = new EventTarget();

      const promise = new Promise<{
        thisValue: any;
        store: number | undefined;
      }>((resolve) => {
        als.run(1100, () => {
          const listener = {
            value: 42,
            handleEvent(this: any) {
              resolve({
                thisValue: this.value,
                store: als.getStore(),
              });
            },
          };

          target.addEventListener("test", listener);
          target.dispatchEvent(new Event("test"));
        });
      });

      const result = await promise;
      expect(result.thisValue).toBe(42);
      expect(result.store).toBe(1100);
    });

    it("should pass event to handleEvent", async () => {
      const target = new EventTarget();

      const promise = new Promise<{
        eventType: string;
        store: number | undefined;
      }>((resolve) => {
        als.run(1200, () => {
          const listener = {
            handleEvent(event: Event) {
              resolve({
                eventType: event.type,
                store: als.getStore(),
              });
            },
          };

          target.addEventListener("custom-event", listener);
          target.dispatchEvent(new Event("custom-event"));
        });
      });

      const result = await promise;
      expect(result.eventType).toBe("custom-event");
      expect(result.store).toBe(1200);
    });
  });

  describe("removeEventListener", () => {
    it("should support removeEventListener with bound listeners", () => {
      const target = new EventTarget();
      let callCount = 0;

      als.run(1300, () => {
        const listener = () => {
          callCount++;
          expect(als.getStore()).toBe(1300);
        };

        target.addEventListener("test", listener);
        target.dispatchEvent(new Event("test"));
        expect(callCount).toBe(1);

        target.removeEventListener("test", listener);
        target.dispatchEvent(new Event("test"));
        expect(callCount).toBe(1); // Should not increase
      });
    });

    it("should support removeEventListener with EventListenerObject", () => {
      const target = new EventTarget();
      let callCount = 0;

      als.run(1400, () => {
        const listener = {
          handleEvent() {
            callCount++;
            expect(als.getStore()).toBe(1400);
          },
        };

        target.addEventListener("test", listener);
        target.dispatchEvent(new Event("test"));
        expect(callCount).toBe(1);

        target.removeEventListener("test", listener);
        target.dispatchEvent(new Event("test"));
        expect(callCount).toBe(1); // Should not increase
      });
    });

    it("should handle removeEventListener before any events are dispatched", () => {
      const target = new EventTarget();
      let callCount = 0;

      als.run(1500, () => {
        const listener = () => {
          callCount++;
        };

        target.addEventListener("test", listener);
        target.removeEventListener("test", listener);
        target.dispatchEvent(new Event("test"));
        expect(callCount).toBe(0);
      });
    });

    it("should only remove the specific listener", () => {
      const target = new EventTarget();
      const calls: string[] = [];

      als.run(1600, () => {
        const listener1 = () => {
          calls.push("listener1");
        };
        const listener2 = () => {
          calls.push("listener2");
        };

        target.addEventListener("test", listener1);
        target.addEventListener("test", listener2);

        target.dispatchEvent(new Event("test"));
        expect(calls).toEqual(["listener1", "listener2"]);

        calls.length = 0;
        target.removeEventListener("test", listener1);
        target.dispatchEvent(new Event("test"));
        expect(calls).toEqual(["listener2"]);
      });
    });
  });

  describe("DOM elements (if available)", () => {
    it("should preserve context with DOM element events", async () => {
      if (typeof document === "undefined") {
        return; // Skip in non-browser environment
      }

      const button = document.createElement("button");
      document.body.appendChild(button);

      const promise = new Promise<number | undefined>((resolve) => {
        als.run(1700, () => {
          button.addEventListener("click", () => {
            resolve(als.getStore());
          });

          button.click();
        });
      });

      const result = await promise;
      expect(result).toBe(1700);

      document.body.removeChild(button);
    });

    it("should preserve context with custom events", async () => {
      if (typeof document === "undefined") {
        return; // Skip in non-browser environment
      }

      const element = document.createElement("div");

      const promise = new Promise<{
        detail: any;
        store: number | undefined;
      }>((resolve) => {
        als.run(1800, () => {
          element.addEventListener("custom", ((event: CustomEvent) => {
            resolve({
              detail: event.detail,
              store: als.getStore(),
            });
          }) as EventListener);

          element.dispatchEvent(
            new CustomEvent("custom", { detail: { foo: "bar" } })
          );
        });
      });

      const result = await promise;
      expect(result.detail).toEqual({ foo: "bar" });
      expect(result.store).toBe(1800);
    });
  });

  describe("null and undefined listeners", () => {
    it("should pass null listener to original implementation", () => {
      const target = new EventTarget();

      // Should pass null through without modification
      als.run(1900, () => {
        target.addEventListener("test", null);
        // We don't dispatch because behavior is environment-specific
      });
    });

    it("should pass undefined listener to original implementation", () => {
      const target = new EventTarget();

      // Should pass undefined through without modification
      als.run(2000, () => {
        target.addEventListener("test", undefined as any);
        // We don't dispatch because behavior is environment-specific
      });
    });

    it("should handle removeEventListener with null", () => {
      const target = new EventTarget();

      // This should not throw
      als.run(2100, () => {
        target.removeEventListener("test", null);
      });
    });
  });
});
