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
  if (typeof MutationObserver !== "undefined") {
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
  }

  // Patch ResizeObserver
  if (typeof ResizeObserver !== "undefined") {
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
  }

  // Patch IntersectionObserver
  if (typeof IntersectionObserver !== "undefined") {
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
  }

  // Patch PerformanceObserver
  if (typeof PerformanceObserver !== "undefined") {
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
}

/**
 * Remove all Observer patches, restoring original behavior.
 */
export function unpatchObservers(): void {
  if (typeof MutationObserver !== "undefined") {
    unpatch(globalThis as any, "MutationObserver");
  }
  if (typeof ResizeObserver !== "undefined") {
    unpatch(globalThis as any, "ResizeObserver");
  }
  if (typeof IntersectionObserver !== "undefined") {
    unpatch(globalThis as any, "IntersectionObserver");
  }
  if (typeof PerformanceObserver !== "undefined") {
    unpatch(globalThis as any, "PerformanceObserver");
  }
}
