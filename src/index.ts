export { AsyncLocalStorage } from "./async-local-storage";
export type { AsyncLocalStorageOptions } from "./async-local-storage";
export { capture, restore } from "./snapshot";
export type { SnapshotContainer } from "./snapshot";

// Re-export patching utilities
export {
  unpatchAll,
  unpatchTimers,
  unpatchXHR,
  unpatchPromise,
  unpatchMicrotasks,
  unpatchObservers,
  unpatchEventTarget,
} from "./patches";

// Auto-patch on import
import { patchAll } from "./patches";
patchAll();
