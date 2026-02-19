import { AsyncLocalStorage } from "../async-local-storage";
import { patchDescriptor, unpatchDescriptor } from "./patch-helper";

/**
 * Patch XMLHttpRequest to preserve async context.
 * This ensures that XHR on* event handlers maintain their async context.
 * Note: addEventListener is inherited from EventTarget and doesn't need patching here.
 */
export function patchXHR(): void {
  if (!globalThis.XMLHttpRequest) return;

  // Patch on* event handler properties
  const eventProps = [
    "onload",
    "onerror",
    "onabort",
    "ontimeout",
    "onprogress",
    "onloadstart",
    "onloadend",
    "onreadystatechange",
  ];

  for (const prop of eventProps) {
    patchDescriptor(
      XMLHttpRequest.prototype,
      prop,
      (descriptor: PropertyDescriptor) => {
        if (!descriptor.set) {
          return descriptor;
        }

        const originalSet = descriptor.set;
        return {
          ...descriptor,
          set(handler: ((this: XMLHttpRequest, ev: any) => any) | null) {
            const bound = handler ? AsyncLocalStorage.bind(handler) : null;
            originalSet.call(this, bound);
          },
        };
      }
    );
  }
}

/**
 * Remove XMLHttpRequest patches, restoring original behavior.
 */
export function unpatchXHR(): void {
  if (!globalThis.XMLHttpRequest) return;

  // Restore original property descriptors for on* properties
  const eventProps = [
    "onload",
    "onerror",
    "onabort",
    "ontimeout",
    "onprogress",
    "onloadstart",
    "onloadend",
    "onreadystatechange",
  ];

  for (const prop of eventProps) {
    unpatchDescriptor(XMLHttpRequest.prototype, prop);
  }
}
