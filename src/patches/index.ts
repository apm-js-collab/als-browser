import { patchEventTarget, unpatchEventTarget } from "./event-target";
import { patchMicrotasks, unpatchMicrotasks } from "./microtasks";
import { patchObservers, unpatchObservers } from "./observers";
import { patchPromise, unpatchPromise } from "./promise";
import { patchTimers, unpatchTimers } from "./timers";
import { patchXHR, unpatchXHR } from "./xhr";

// Re-export individual patch and unpatch functions
// This allows users to selectively enable/disable specific patches
export {
  patchEventTarget,
  unpatchEventTarget,
  patchMicrotasks,
  unpatchMicrotasks,
  patchObservers,
  unpatchObservers,
  patchPromise,
  unpatchPromise,
  patchTimers,
  unpatchTimers,
  patchXHR,
  unpatchXHR,
};

/**
 * Apply all browser API patches to enable async context propagation.
 */
export function patchAll(): void {
  patchEventTarget();
  patchMicrotasks();
  patchObservers();
  patchPromise();
  patchTimers();
  patchXHR();
}

/**
 * Remove all browser API patches, restoring original behavior.
 */
export function unpatchAll(): void {
  unpatchEventTarget();
  unpatchMicrotasks();
  unpatchObservers();
  unpatchPromise();
  unpatchTimers();
  unpatchXHR();
}
