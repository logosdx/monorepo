import type { Cookie } from './types.ts';
import { matchesDomain } from './domain.ts';
import { matchesPath } from './path.ts';


/**
 * RFC 6265 §5.4 — Build the candidate cookie list for an outgoing request.
 *
 * Returns all cookies from `cookies` that match the request URL,
 * filtered by domain, path, expiry, secure, and httpOnly rules.
 *
 * Does NOT mutate lastAccessTime — the jar handles that on retrieval.
 */
export function getMatchingCookies(
    cookies: Cookie[],
    requestUrl: URL,
    isHttpApi = true
): Cookie[] {

    const requestHost = requestUrl.hostname.toLowerCase();
    const requestPath = requestUrl.pathname;
    const isSecure = requestUrl.protocol === 'https:';
    const now = Date.now();

    return cookies.filter(cookie => {

        // Expiry
        if (cookie.expiryTime !== Infinity && now > cookie.expiryTime) return false;

        // Domain match (§5.4 step 1)
        if (cookie.hostOnlyFlag) {

            if (requestHost !== cookie.domain) return false;
        }
        else {

            if (!matchesDomain(cookie.domain, requestHost)) return false;
        }

        // Path match (§5.4 step 1)
        if (!matchesPath(cookie.path, requestPath)) return false;

        // Secure flag (§5.4 step 1)
        if (cookie.secureOnlyFlag && !isSecure) return false;

        // HttpOnly flag (§5.4 step 1)
        if (cookie.httpOnlyFlag && !isHttpApi) return false;

        return true;
    });
}


/**
 * RFC 6265 §5.4 — Serialize a list of matching cookies into a Cookie header value.
 *
 * Sorts by: longer path first, then earlier creationTime first.
 * Joins with "; " (semicolon + space).
 *
 * @example
 *     serializeCookies([...]) // → 'session=abc123; token=xyz'
 */
export function serializeCookies(cookies: Cookie[]): string {

    const sorted = [...cookies].sort((a, b) => {

        if (b.path.length !== a.path.length) return b.path.length - a.path.length;

        return a.creationTime - b.creationTime;
    });

    return sorted.map(c => `${c.name}=${c.value}`).join('; ');
}
