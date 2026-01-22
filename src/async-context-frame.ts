import type { AsyncLocalStorage } from "./async-local-storage";

// Use a global Symbol to coordinate between ESM and CJS builds
const CURRENT_FRAME_SYMBOL = Symbol.for("als-browser:currentFrame");

/**
 * AsyncContextFrame is a Map-based storage for async context.
 * In Node.js, this uses V8's continuation preserved embedder data.
 * In the browser, we use a global Symbol to coordinate between ESM/CJS builds.
 */
export class AsyncContextFrame extends Map<AsyncLocalStorage<any>, any> {
  constructor(store: AsyncLocalStorage<any>, data: any) {
    super(AsyncContextFrame.current());
    this.set(store, data);
  }

  disable(store:  AsyncLocalStorage<any>) {
    this.delete(store);
  }

  /**
   * Get the current async context frame.
   */
  static current(): AsyncContextFrame | undefined {
    return (globalThis as any)[CURRENT_FRAME_SYMBOL];
  }

  /**
   * Set the current async context frame.
   */
  static set(frame: AsyncContextFrame | undefined): void {
    (globalThis as any)[CURRENT_FRAME_SYMBOL] = frame;
  }

  /**
   * Exchange the current frame with a new one, returning the previous frame.
   */
  static exchange(
    frame: AsyncContextFrame | undefined
  ): AsyncContextFrame | undefined {
    const prior = this.current();
    this.set(frame);
    return prior;
  }

  /**
   * Disable (remove) a specific store from the current frame.
   */
  static disable(store: AsyncLocalStorage<any>): void {
    const frame = this.current();
    frame?.disable(store);
  }
}
