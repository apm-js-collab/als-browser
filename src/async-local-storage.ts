import { AsyncContextFrame } from "./async-context-frame";

/**
 * @property {any} [defaultValue] - The default value to use when no value is set.
 * @property {string} [name] - The name of the storage.
 */
export interface AsyncLocalStorageOptions<T> {
  defaultValue?: T;
  name?: string;
}

/**
 * Browser-compatible implementation of Node.js AsyncLocalStorage.
 * Provides context isolation across async operations.
 */
export class AsyncLocalStorage<T> {
  #defaultValue: T | undefined;
  #name: string | undefined;

   /**
   * @param {AsyncLocalStorageOptions} [options]
   */
  constructor(options: AsyncLocalStorageOptions<T> = {}) {
    this.#defaultValue = options.defaultValue;
    this.#name = options.name;
  }

  /** @type {string} */
  get name(): string {
    return this.#name || "";
  }

  /**
   * Bind a function to the current async context.
   * The returned function will restore the captured context when called.
   */
  static bind<F extends (...args: any[]) => any>(fn: F): F {
    const frame = AsyncContextFrame.current();
    return function (this: any, ...args: any[]) {
      const prior = AsyncContextFrame.exchange(frame);
      try {
        return fn.apply(this, args);
      } finally {
        AsyncContextFrame.set(prior);
      }
    } as F;
  }

  /**
   * Capture the current async context and return a function that
   * can restore it when running a callback.
   */
  static snapshot(): <R>(fn: (...args: any[]) => R, ...args: any[]) => R {
    return AsyncLocalStorage.bind((cb, ...args) => cb(...args));
  }

  /**
   * Remove this store from the current async context.
   */
  disable(): void {
    AsyncContextFrame.disable(this);
  }

  /**
   * Enter a new async context with the given data.
   * Unlike run(), this doesn't use a callback - the context persists
   * until changed by another enterWith() or run() call.
   */
  enterWith(data: T | undefined): void {
    const frame = new AsyncContextFrame(this, data);
    AsyncContextFrame.set(frame);
  }

  /**
   * Run a function in a new async context with the given data.
   * The context is automatically restored after the function completes.
   */
  run<R>(data: T, fn: (...args: any[]) => R, ...args: any[]): R {
    const prior = this.getStore();

    if (Object.is(prior, data)) {
      return Reflect.apply(fn, null, args);
    }

    this.enterWith(data);
    try {
      return Reflect.apply(fn, null, args);
    } finally {
      this.enterWith(prior);
    }
  }

  /**
   * Run a function with the store value set to undefined.
   */
  exit<R>(fn: (...args: any[]) => R, ...args: any[]): R {
    return this.run(undefined as T, fn, ...args);
  }

  /**
   * Get the current value from this store.
   * Returns the default value if no value is set in the current context.
   */
  getStore(): T | undefined {
    const frame = AsyncContextFrame.current();
    if (!frame?.has(this)) {
      return this.#defaultValue;
    }
    return frame.get(this);
  }
}
