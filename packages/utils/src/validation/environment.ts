
/**
 * Checks if the current environment is a browser.
 *
 * Tests for the presence of window and window.document objects.
 *
 * @returns true if running in a browser environment
 *
 * @example
 * if (isBrowser()) {
 *     // Safe to use DOM APIs
 *     document.querySelector('#app');
 * }
 */
export const isBrowser = () => typeof window !== 'undefined' && typeof window.document !== 'undefined';

/**
 * Checks if the current environment is React Native.
 *
 * Tests for the presence of navigator.product === 'ReactNative'.
 *
 * @returns true if running in React Native environment
 *
 * @example
 * if (isReactNative()) {
 *     // Use React Native specific APIs
 *     Alert.alert('Hello');
 * }
 */
export const isReactNative = () => typeof navigator !== 'undefined' && navigator?.product === 'ReactNative';

/**
 * Checks if the current environment is Cloudflare Workers.
 *
 * Tests for Cloudflare Workers specific user agent string.
 *
 * @returns true if running in Cloudflare Workers environment
 *
 * @example
 * if (isCloudflare()) {
 *     // Use Cloudflare Workers specific APIs
 *     addEventListener('fetch', event => {
 *         event.respondWith(handleRequest(event.request));
 *     });
 * }
 */
export const isCloudflare = () => typeof globalThis !== 'undefined' && globalThis?.navigator?.userAgent === 'Cloudflare-Workers';

/**
 * Checks if the current environment is browser-like (browser, React Native, or Cloudflare).
 *
 * Combines checks for browser, React Native, and Cloudflare environments.
 *
 * @returns true if running in any browser-like environment
 *
 * @example
 * if (isBrowserLike()) {
 *     // Safe to use navigation APIs
 *     window.location.href = '/dashboard';
 * } else {
 *     // Use Node.js specific path handling
 *     const path = require('path');
 *     const fullPath = path.join(process.cwd(), 'dashboard');
 * }
 */
export const isBrowserLike = () => isBrowser() || isReactNative() || isCloudflare();

/**
 * Checks if the current environment is Node.js.
 *
 * Tests for the presence of process.versions.node.
 *
 * @returns true if running in Node.js environment
 *
 * @example
 * if (isNode()) {
 *     // Safe to use Node.js APIs
 *     const fs = require('fs');
 *     const data = fs.readFileSync('file.txt', 'utf8');
 * }
 */
export const isNode = () => typeof process !== 'undefined' && process.versions?.node;
