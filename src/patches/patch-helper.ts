/**
 * Utility for managing patches with Symbol-based marking
 * to prevent double-patching and enable reversal
 */

const ORIGINAL_SYMBOL = Symbol.for("als-browser:original");

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
