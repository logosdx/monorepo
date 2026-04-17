/**
 * RFC 6265 §5.1.4 — Path computation and matching.
 */


/**
 * Compute the default-path for a request-uri per RFC 6265 §5.1.4.
 *
 * Rules:
 * 1. If uri-path is empty or lacks a leading "/", return "/".
 * 2. If uri-path contains at most one "/", return "/".
 * 3. Otherwise, return the uri-path up to (not including) the last "/".
 *
 * @example
 *     defaultPath('/foo/bar/baz') // → '/foo/bar'
 *     defaultPath('/foo')         // → '/'
 *     defaultPath('/')            // → '/'
 */
export function defaultPath(requestPath: string): string {

    if (!requestPath || !requestPath.startsWith('/')) return '/';

    const lastSlash = requestPath.lastIndexOf('/');

    if (lastSlash === 0) return '/';

    return requestPath.slice(0, lastSlash);
}


/**
 * RFC 6265 §5.1.4 — Path matching.
 *
 * `requestPath` path-matches `cookiePath` if any of:
 * - They are identical.
 * - `cookiePath` is a prefix of `requestPath` and `cookiePath` ends with "/".
 * - `cookiePath` is a prefix of `requestPath` and the next character
 *   in `requestPath` (after the prefix) is "/".
 *
 * @example
 *     matchesPath('/api', '/api/v1') // → true
 *     matchesPath('/api', '/apiv1')  // → false (no slash boundary)
 */
export function matchesPath(cookiePath: string, requestPath: string): boolean {

    if (cookiePath === requestPath) return true;

    if (!requestPath.startsWith(cookiePath)) return false;

    if (cookiePath.endsWith('/')) return true;

    if (requestPath[cookiePath.length] === '/') return true;

    return false;
}
