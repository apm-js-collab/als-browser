import { AsyncLocalStorage } from "../async-local-storage";
import { patch, unpatch } from "./patch-helper";

// WeakMap to track original listeners so we can remove them properly
const listenerMap = new WeakMap<
  EventTarget,
  Map<EventListenerOrEventListenerObject, EventListenerOrEventListenerObject>
>();

/**
 * Patch EventTarget.addEventListener to preserve async context.
 * This ensures that event listeners maintain their async context when they execute.
 *
 * This single patch covers all EventTarget-based APIs including:
 * - DOM events (Element, Document, Window)
 * - WebSocket events
 * - MessagePort events
 * - BroadcastChannel events
 * - EventSource (SSE) events
 * - FileReader events
 * - XMLHttpRequest events
 * - IndexedDB request events
 * - And many more...
 */
export function patchEventTarget(): void {
  patch(
    EventTarget.prototype as any,
    "addEventListener",
    (original: typeof EventTarget.prototype.addEventListener) => {
      return function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
      ) {
        if (!listener) {
          return original.call(this, type, listener, options);
        }

        // Bind the listener to preserve async context
        const bound =
          typeof listener === "function"
            ? AsyncLocalStorage.bind(listener)
            : {
                handleEvent: AsyncLocalStorage.bind(
                  listener.handleEvent.bind(listener)
                ),
              };

        // Store the mapping from original to bound listener for removeEventListener
        if (!listenerMap.has(this)) {
          listenerMap.set(this, new Map());
        }
        listenerMap.get(this)!.set(listener, bound);

        return original.call(this, type, bound, options);
      };
    }
  );

  patch(
    EventTarget.prototype as any,
    "removeEventListener",
    (original: typeof EventTarget.prototype.removeEventListener) => {
      return function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions
      ) {
        if (!listener) {
          return original.call(this, type, listener, options);
        }

        // Look up the bound listener that we registered
        const map = listenerMap.get(this);
        const bound = map?.get(listener);

        if (bound) {
          // Remove the bound listener
          const result = original.call(this, type, bound, options);
          // Clean up the mapping
          map!.delete(listener);
          return result;
        }

        // Fallback to the original listener if we don't have a mapping
        return original.call(this, type, listener, options);
      };
    }
  );
}

/**
 * Remove EventTarget patches, restoring original behavior.
 */
export function unpatchEventTarget(): void {
  unpatch(EventTarget.prototype as any, "addEventListener");
  unpatch(EventTarget.prototype as any, "removeEventListener");
}
