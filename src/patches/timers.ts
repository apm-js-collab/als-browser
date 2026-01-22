import { AsyncLocalStorage } from "../async-local-storage";
import { patch, unpatch } from "./patch-helper";

/**
 * Patch timer functions to preserve async context.
 * This ensures that callbacks scheduled via setTimeout, setInterval, etc.
 * maintain their async context when they execute.
 */
export function patchTimers(): void {
  // Patch setTimeout
  patch(
    globalThis as any,
    "setTimeout",
    (original: typeof setTimeout) => {
      return function (
        callback: TimerHandler,
        delay?: number,
        ...args: any[]
      ) {
        const bound =
          typeof callback === "function"
            ? AsyncLocalStorage.bind(callback as (...args: any[]) => any)
            : callback;
        return original(bound, delay, ...args);
      } as typeof setTimeout;
    }
  );

  // Patch setInterval
  patch(
    globalThis as any,
    "setInterval",
    (original: typeof setInterval) => {
      return function (
        callback: TimerHandler,
        delay?: number,
        ...args: any[]
      ) {
        const bound =
          typeof callback === "function"
            ? AsyncLocalStorage.bind(callback as (...args: any[]) => any)
            : callback;
        return original(bound, delay, ...args);
      } as typeof setInterval;
    }
  );

  // Patch setImmediate (non-standard but available in some environments)
  if ((globalThis as any).setImmediate) {
    patch(
      globalThis as any,
      "setImmediate",
      (original: any) => {
        return function (callback: (...args: any[]) => void, ...args: any[]) {
          const bound = AsyncLocalStorage.bind(callback);
          return original(bound, ...args);
        };
      }
    );
  }

  // Patch requestAnimationFrame
  if (typeof (globalThis as any).requestAnimationFrame !== "undefined") {
    patch(
      globalThis as any,
      "requestAnimationFrame",
      (original: typeof requestAnimationFrame) => {
        return function (callback: FrameRequestCallback) {
          const bound = AsyncLocalStorage.bind(callback);
          return original(bound);
        };
      }
    );
  }

  // Patch requestIdleCallback
  if (typeof (globalThis as any).requestIdleCallback !== "undefined") {
    patch(
      globalThis as any,
      "requestIdleCallback",
      (original: typeof requestIdleCallback) => {
        return function (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions
        ) {
          const bound = AsyncLocalStorage.bind(callback);
          return original(bound, options);
        };
      }
    );
  }
}

/**
 * Remove all timer patches, restoring original behavior.
 */
export function unpatchTimers(): void {
  unpatch(globalThis as any, "setTimeout");
  unpatch(globalThis as any, "setInterval");
  if ((globalThis as any).setImmediate) {
    unpatch(globalThis as any, "setImmediate");
  }
  if (typeof (globalThis as any).requestAnimationFrame !== "undefined") {
    unpatch(globalThis as any, "requestAnimationFrame");
  }
  if (typeof (globalThis as any).requestIdleCallback !== "undefined") {
    unpatch(globalThis as any, "requestIdleCallback");
  }
}
