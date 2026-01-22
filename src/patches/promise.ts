import { AsyncLocalStorage } from "../async-local-storage";
import { patch, unpatch } from "./patch-helper";

/**
 * Patch Promise continuation methods to preserve async context.
 * This ensures that callbacks passed to .then(), .catch(), and .finally()
 * maintain their async context when they execute.
 *
 * Note: This patches the continuation methods, not `await` itself.
 * Using `await` requires code transformation via capture/restore.
 */
export function patchPromise(): void {
  // Patch Promise.prototype.then
  patch(
    Promise.prototype as any,
    "then",
    (original: typeof Promise.prototype.then) => {
      return function <T, R1 = T, R2 = never>(
        this: Promise<T>,
        onFulfilled?:
          | ((value: T) => R1 | PromiseLike<R1>)
          | undefined
          | null,
        onRejected?: ((reason: any) => R2 | PromiseLike<R2>) | undefined | null
      ): Promise<R1 | R2> {
        const boundFulfilled = onFulfilled
          ? AsyncLocalStorage.bind(onFulfilled)
          : onFulfilled;
        const boundRejected = onRejected
          ? AsyncLocalStorage.bind(onRejected)
          : onRejected;
        return original.call(
          this,
          boundFulfilled,
          boundRejected
        ) as Promise<R1 | R2>;
      };
    }
  );

  // Patch Promise.prototype.catch
  patch(
    Promise.prototype as any,
    "catch",
    (original: typeof Promise.prototype.catch) => {
      return function <T = never>(
        this: Promise<any>,
        onRejected?: ((reason: any) => T | PromiseLike<T>) | undefined | null
      ): Promise<T> {
        const boundRejected = onRejected
          ? AsyncLocalStorage.bind(onRejected)
          : onRejected;
        return original.call(this, boundRejected);
      };
    }
  );

  // Patch Promise.prototype.finally
  patch(
    Promise.prototype as any,
    "finally",
    (original: typeof Promise.prototype.finally) => {
      return function (
        this: Promise<any>,
        onFinally?: (() => void) | undefined | null
      ): Promise<any> {
        const boundFinally = onFinally
          ? AsyncLocalStorage.bind(onFinally)
          : onFinally;
        return original.call(this, boundFinally);
      };
    }
  );
}

/**
 * Remove all Promise patches, restoring original behavior.
 */
export function unpatchPromise(): void {
  unpatch(Promise.prototype as any, "then");
  unpatch(Promise.prototype as any, "catch");
  unpatch(Promise.prototype as any, "finally");
}
