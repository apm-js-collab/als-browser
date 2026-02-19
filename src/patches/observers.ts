import { AsyncLocalStorage } from "../async-local-storage";
import { patch, unpatch } from "./patch-helper";

/**
 * Patch Observer APIs to preserve async context.
 * This ensures that observer callbacks maintain their async context when they execute.
 *
 * Patched observers:
 * - MutationObserver
 * - ResizeObserver
 * - IntersectionObserver
 * - PerformanceObserver
 */
export function patchObservers(): void {
  // Patch MutationObserver
  patch(
    globalThis as any,
    "MutationObserver",
    (OriginalMutationObserver: typeof MutationObserver) => {
      const PatchedClass = class extends OriginalMutationObserver {
        constructor(callback: MutationCallback) {
          super(AsyncLocalStorage.bind(callback));
        }
      };
      // Preserve the original class name
      Object.defineProperty(PatchedClass, "name", {
        value: "MutationObserver",
      });
      return PatchedClass as any;
    }
  );

  // Patch ResizeObserver
  patch(
    globalThis as any,
    "ResizeObserver",
    (OriginalResizeObserver: typeof ResizeObserver) => {
      const PatchedClass = class extends OriginalResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          super(AsyncLocalStorage.bind(callback));
        }
      };
      Object.defineProperty(PatchedClass, "name", {
        value: "ResizeObserver",
      });
      return PatchedClass as any;
    }
  );

  // Patch IntersectionObserver
  patch(
    globalThis as any,
    "IntersectionObserver",
    (OriginalIntersectionObserver: typeof IntersectionObserver) => {
      const PatchedClass = class extends OriginalIntersectionObserver {
        constructor(
          callback: IntersectionObserverCallback,
          options?: IntersectionObserverInit
        ) {
          super(AsyncLocalStorage.bind(callback), options);
        }
      };
      Object.defineProperty(PatchedClass, "name", {
        value: "IntersectionObserver",
      });
      return PatchedClass as any;
    }
  );

  // Patch PerformanceObserver
  patch(
    globalThis as any,
    "PerformanceObserver",
    (OriginalPerformanceObserver: typeof PerformanceObserver) => {
      const PatchedClass = class extends OriginalPerformanceObserver {
        constructor(callback: PerformanceObserverCallback) {
          super(AsyncLocalStorage.bind(callback));
        }
      };
      Object.defineProperty(PatchedClass, "name", {
        value: "PerformanceObserver",
      });
      return PatchedClass as any;
    }
  );
}

/**
 * Remove all Observer patches, restoring original behavior.
 */
export function unpatchObservers(): void {
  unpatch(globalThis as any, "MutationObserver");
  unpatch(globalThis as any, "ResizeObserver");
  unpatch(globalThis as any, "IntersectionObserver");
  unpatch(globalThis as any, "PerformanceObserver");
}
