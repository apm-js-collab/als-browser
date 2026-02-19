/**
 * Utility for managing patches with Symbol-based marking
 * to prevent double-patching and enable reversal
 */

export const ORIGINAL_SYMBOL = Symbol.for("als-browser:original");

export interface PatchTarget {
  [key: string | symbol]: any;
}

/**
 * Check if a target's property has been patched
 */
export function isPatched(
  target: PatchTarget,
  property: string | symbol
): boolean {
  const current = target[property];
  return current && typeof current === "object" && ORIGINAL_SYMBOL in current;
}

/**
 * Get the original implementation of a patched property
 */
export function getOriginal<T>(
  target: PatchTarget,
  property: string | symbol
): T | undefined {
  const current = target[property];
  return current?.[ORIGINAL_SYMBOL];
}

/**
 * Apply a patch to a property, storing the original on the patched value
 */
export function patch<T>(
  target: PatchTarget,
  property: string | symbol,
  patcher: (original: T) => T
): void {
  // Check if property exists on target
  if (target[property] === undefined) {
    return;
  }

  // Check if already patched
  if (isPatched(target, property)) {
    return;
  }

  // Store the original
  const original = target[property] as T;

  // Apply the patch
  const patched = patcher(original);

  // Store the original on the patched value
  (patched as any)[ORIGINAL_SYMBOL] = original;

  target[property] = patched as any;
}

/**
 * Reverse a patch, restoring the original implementation
 */
export function unpatch(
  target: PatchTarget,
  property: string | symbol
): boolean {
  const original = getOriginal(target, property);
  if (original === undefined) {
    return false; // Not patched
  }

  target[property] = original;
  return true;
}

/**
 * Check if a target's property descriptor has been patched
 */
export function isDescriptorPatched(
  target: PatchTarget,
  property: string | symbol
): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  return descriptor ? ORIGINAL_SYMBOL in descriptor : false;
}

/**
 * Get the original descriptor of a patched property
 */
export function getOriginalDescriptor(
  target: PatchTarget,
  property: string | symbol
): PropertyDescriptor | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  return (descriptor as any)?.[ORIGINAL_SYMBOL];
}

/**
 * Apply a patch to a property descriptor, storing the original on the patched descriptor
 */
export function patchDescriptor(
  target: PatchTarget,
  property: string | symbol,
  patcher: (original: PropertyDescriptor) => PropertyDescriptor
): void {
  // Get the current descriptor
  const original = Object.getOwnPropertyDescriptor(target, property);

  // Check if property exists
  if (!original) {
    return;
  }

  // Check if already patched
  if (isDescriptorPatched(target, property)) {
    return;
  }

  // Apply the patch
  const patched = patcher(original);

  // Store the original on the patched descriptor
  (patched as any)[ORIGINAL_SYMBOL] = original;

  Object.defineProperty(target, property, patched);
}

/**
 * Reverse a descriptor patch, restoring the original descriptor
 */
export function unpatchDescriptor(
  target: PatchTarget,
  property: string | symbol
): boolean {
  const original = getOriginalDescriptor(target, property);
  if (!original) {
    return false; // Not patched
  }

  Object.defineProperty(target, property, original);
  return true;
}
