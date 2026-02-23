import { AsyncContextFrame } from "../async-context-frame";
import { patch, unpatch } from "./patch-helper";

// Entry for tracking a registered listener with its wrapped version
interface ListenerEntry {
  type: string;
  listener: EventListenerOrEventListenerObject;
  bound: EventListenerOrEventListenerObject;
  capture: boolean;
}

// WeakMap to track original listeners so we can remove them properly
// Using an array allows us to track multiple registrations of the same listener
// with different event types and capture flags
const listenerMap = new WeakMap<EventTarget, ListenerEntry[]>();

/**
 * Helper function to normalize options to a capture boolean.
 * Per DOM spec, only the capture flag matters for listener matching.
 */
function getCaptureFlag(options?: boolean | AddEventListenerOptions): boolean {
  if (typeof options === "boolean") return options;
  return options?.capture ?? false;
}

/**
 * Wrap a function-type event listener to preserve async context.
 * Always creates a wrapper to ensure context isolation - the listener runs with
 * the context from registration time, not dispatch time.
 */
function wrapFunctionListener(
  listener: EventListener,
  capturedFrame: AsyncContextFrame | undefined
): EventListener {
  return function (this: any, evt: Event) {
    // Isolate the listener to run with the captured context
    // (which may be undefined if no context existed at registration)
    const prior = AsyncContextFrame.exchange(capturedFrame);
    try {
      return listener.call(this, evt);
    } finally {
      AsyncContextFrame.set(prior);
    }
  };
}

/**
 * Wrap an EventListenerObject to preserve async context.
 * Always creates a wrapper to ensure context isolation - the listener runs with
 * the context from registration time, not dispatch time.
 * The wrapper maintains the same prototype chain as the original for transparency.
 */
function wrapEventListenerObject(
  listener: EventListenerObject,
  capturedFrame: AsyncContextFrame | undefined
): EventListenerObject {
  return Object.setPrototypeOf({
    handleEvent(this: any, evt: Event) {
      // Isolate the listener to run with the captured context
      // (which may be undefined if no context existed at registration)
      const prior = AsyncContextFrame.exchange(capturedFrame);
      try {
        return listener.handleEvent.call(listener, evt);
      } finally {
        AsyncContextFrame.set(prior);
      }
    },
  }, listener);
}

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

        // Capture the current context frame at registration time
        const capturedFrame = AsyncContextFrame.current();

        // Create a wrapper that preserves async context
        const bound =
          typeof listener === "function"
            ? wrapFunctionListener(listener, capturedFrame)
            : wrapEventListenerObject(listener, capturedFrame);

        // Store the mapping for removeEventListener
        // We track: event type, original listener, bound listener, and capture flag
        // This allows us to properly remove listeners even when the same listener
        // is registered multiple times with different event types or capture flags
        const capture = getCaptureFlag(options);
        const entries = listenerMap.get(this) || [];

        // Check if this exact combination already exists
        // Per DOM spec, adding the same listener multiple times with the same
        // event type and capture flag should NOT create multiple registrations
        const existingIndex = entries.findIndex(
          (e) =>
            e.type === type && e.listener === listener && e.capture === capture
        );

        if (existingIndex !== -1) {
          // Already registered with these exact options
          // Per DOM spec and browser behavior, this should be a no-op
          // We return early to avoid creating orphaned bound listeners
          return;
        }

        // New registration - add it and register with browser
        entries.push({ type, listener, bound, capture });
        listenerMap.set(this, entries);

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

        // Look up the bound listener that matches this exact registration
        // We need to match on: event type, listener, and capture flag
        const capture = getCaptureFlag(options);
        const entries = listenerMap.get(this);

        if (!entries) {
          // No entries for this target - fallback to original
          return original.call(this, type, listener, options);
        }

        // Find the matching entry
        const index = entries.findIndex(
          (e) =>
            e.type === type && e.listener === listener && e.capture === capture
        );

        if (index !== -1) {
          // Found the matching registration
          const entry = entries[index];

          // Remove from the browser with the bound listener
          const result = original.call(this, type, entry.bound, options);

          // Remove from our tracking array
          entries.splice(index, 1);

          // Clean up the WeakMap entry if no more listeners
          if (entries.length === 0) {
            listenerMap.delete(this);
          }

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
