import { patchTimers, unpatchTimers } from "./timers";
import { patchXHR, unpatchXHR } from "./xhr";
import { patchPromise, unpatchPromise } from "./promise";
import { patchMicrotasks, unpatchMicrotasks } from "./microtasks";
import { patchObservers, unpatchObservers } from "./observers";
import { patchEventTarget, unpatchEventTarget } from "./event-target";

// Re-export individual unpatch functions
export {
  unpatchTimers,
  unpatchXHR,
  unpatchPromise,
  unpatchMicrotasks,
  unpatchObservers,
  unpatchEventTarget,
};

/**
 * Apply all browser API patches to enable async context propagation.
 * This function is idempotent - it will only patch once even if called multiple times.
 *
 * @returns A function that can be called to remove all patches
 */
export function patchAll(): () => void {
  // Patch Promise continuation methods (.then, .catch, .finally)
  patchPromise();

  // Patch microtask scheduling
  patchMicrotasks();

  // Patch generic EventTarget.addEventListener (covers most event-based APIs)
  patchEventTarget();

  // Patch timer functions (setTimeout, setInterval, etc.)
  patchTimers();

  // Patch XHR on* properties (addEventListener is covered by EventTarget patch)
  patchXHR();

  // Patch Observer APIs (MutationObserver, ResizeObserver, etc.)
  patchObservers();

  return unpatchAll;
}

/**
 * Remove all browser API patches, restoring original behavior.
 * This function is idempotent - it will only unpatch once even if called multiple times.
 */
export function unpatchAll(): void {
  unpatchObservers();
  unpatchXHR();
  unpatchTimers();
  unpatchEventTarget();
  unpatchMicrotasks();
  unpatchPromise();
}
