import { describe, it, expect, beforeEach } from "vitest";
import { AsyncLocalStorage } from "../async-local-storage";
import { AsyncContextFrame } from "../async-context-frame";
import { patchXHR } from "./xhr";

describe("XMLHttpRequest patch", () => {
  let als: AsyncLocalStorage<number>;

  beforeEach(() => {
    AsyncContextFrame.set(undefined);
    als = new AsyncLocalStorage<number>();
    patchXHR();
  });

  describe("on* event handler properties", () => {
    it("should preserve context through onload property", () => {
      if (typeof XMLHttpRequest === "undefined") {
        return; // Skip if not available
      }

      let capturedValue: number | undefined;

      als.run(100, () => {
        const xhr = new XMLHttpRequest();

        // Set onload handler inside the context
        xhr.onload = () => {
          capturedValue = als.getStore();
        };

        // Manually trigger the event to test context preservation
        const event = new Event("load");
        xhr.dispatchEvent(event);
      });

      expect(capturedValue).toBe(100);
    });

    it("should preserve context through onerror property", () => {
      if (typeof XMLHttpRequest === "undefined") {
        return; // Skip if not available
      }

      let capturedValue: number | undefined;

      als.run(200, () => {
        const xhr = new XMLHttpRequest();

        xhr.onerror = () => {
          capturedValue = als.getStore();
        };

        const event = new Event("error");
        xhr.dispatchEvent(event);
      });

      expect(capturedValue).toBe(200);
    });

    it("should preserve context through onreadystatechange property", () => {
      if (typeof XMLHttpRequest === "undefined") {
        return; // Skip if not available
      }

      let capturedValue: number | undefined;

      als.run(300, () => {
        const xhr = new XMLHttpRequest();

        xhr.onreadystatechange = () => {
          capturedValue = als.getStore();
        };

        const event = new Event("readystatechange");
        xhr.dispatchEvent(event);
      });

      expect(capturedValue).toBe(300);
    });
  });
});
