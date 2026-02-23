export { AsyncLocalStorage } from "./async-local-storage";
export type { AsyncLocalStorageOptions } from "./async-local-storage";
export { capture, restore } from "./snapshot";
export type { SnapshotContainer } from "./snapshot";
export * from "./patches";

// Auto-patch on import
import { patchAll } from "./patches";
patchAll();
