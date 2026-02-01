/**
 * Environment detection utilities
 * Helps determine if code is running in Node.js or browser
 */

/**
 * Check if running in Node.js environment
 */
export function isNode(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'process' in globalThis &&
    typeof (globalThis as Record<string, unknown>).process === 'object' &&
    (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node != null
  );
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'window' in globalThis &&
    typeof (globalThis as { window?: { document?: unknown } }).window?.document !== 'undefined'
  );
}

/**
 * Environment type
 */
export type Environment = 'node' | 'browser' | 'unknown';

/**
 * Get the current environment
 */
export function getEnvironment(): Environment {
  if (isNode()) {
    return 'node';
  }
  if (isBrowser()) {
    return 'browser';
  }
  return 'unknown';
}
