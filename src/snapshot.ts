import { AsyncContextFrame } from "./async-context-frame";

/**
 * Container object for storing async context snapshots around await points.
 */
export interface SnapshotContainer {
  frame?: AsyncContextFrame;
}

/**
 * Capture the current async context frame before an await.
 * Stores the frame in the container and returns the promise unchanged.
 *
 * Usage: `restore(container, await capture(container, promise))`
 */
export function capture<T>(
  container: SnapshotContainer,
  promise: T
): T {
  container.frame = AsyncContextFrame.current();
  return promise;
}

/**
 * Restore the async context frame after an await.
 * Retrieves the frame from the container, sets it as current, and returns the value unchanged.
 *
 * Usage: `restore(container, await capture(container, promise))`
 */
export function restore<T>(
  container: SnapshotContainer,
  value: T
): T {
  if (container.frame !== undefined) {
    AsyncContextFrame.set(container.frame);
  }
  return value;
}
