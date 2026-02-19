import { AsyncLocalStorage } from "../async-local-storage";
import { patch, unpatch } from "./patch-helper";

/**
 * Patch queueMicrotask to preserve async context.
 * This ensures that microtasks scheduled via queueMicrotask
 * maintain their async context when they execute.
 */
export function patchMicrotasks(): void {
  patch(
    globalThis as any,
    "queueMicrotask",
    (original: typeof queueMicrotask) => {
      return function (callback: VoidFunction) {
        const bound = AsyncLocalStorage.bind(callback);
        return original(bound);
      };
    }
  );
}

/**
 * Remove the queueMicrotask patch, restoring original behavior.
 */
export function unpatchMicrotasks(): void {
  unpatch(globalThis as any, "queueMicrotask");
}
