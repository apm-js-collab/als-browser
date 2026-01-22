import { AsyncLocalStorage } from "../async-local-storage";
import { patch, unpatch } from "./patch-helper";

const originalDescriptors = new Map<string, PropertyDescriptor>();

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
    const descriptor = Object.getOwnPropertyDescriptor(
      XMLHttpRequest.prototype,
      prop
    );
    if (descriptor?.set) {
      // Store the original descriptor for unpatching
      originalDescriptors.set(prop, descriptor);

      const originalSet = descriptor.set;
      Object.defineProperty(XMLHttpRequest.prototype, prop, {
        ...descriptor,
        set(handler: ((this: XMLHttpRequest, ev: any) => any) | null) {
          const bound = handler ? AsyncLocalStorage.bind(handler) : null;
          originalSet.call(this, bound);
        },
      });
    }
  }
}

/**
 * Remove XMLHttpRequest patches, restoring original behavior.
 */
export function unpatchXHR(): void {
  if (!globalThis.XMLHttpRequest) return;

  // Restore original property descriptors for on* properties
  originalDescriptors.forEach((descriptor, prop) => {
    Object.defineProperty(XMLHttpRequest.prototype, prop, descriptor);
  });
  originalDescriptors.clear();
}
