import { serializer } from '@logosdx/utils';
import type { RequestKeyOptions } from '../types.ts';


/**
 * Headers that are stable across requests and semantically meaningful
 * for cache/dedupe key generation.
 *
 * These headers affect the response content and should differentiate cache entries:
 * - authorization: Different users get different responses
 * - accept: Different response formats (JSON, XML, etc.)
 * - accept-language: Localized responses
 * - content-type: Format of request payload (for POST/PUT)
 * - accept-encoding: Response compression format
 *
 * Headers NOT included (dynamic per-request):
 * - X-Timestamp, Date: Change every request
 * - X-HMAC-Signature: Computed per-request
 * - X-Request-Id, X-Correlation-Id: Unique per-request
 * - Cache-Control, Pragma: Control directives, not identity
 */
const KEY_HEADERS = new Set([
    'authorization',
    'accept',
    'accept-language',
    'content-type',
    'accept-encoding'
]);


/**
 * Extract stable headers for key generation.
 *
 * Only includes headers that are semantically meaningful for cache/dedupe.
 * Iterates over header keys and matches against lowercase.
 *
 * @param headers - Request headers object
 * @returns Object with only stable headers (lowercase keys), or undefined if none present
 */
const extractKeyHeaders = (
    headers: Record<string, string> | undefined
): Record<string, string> | undefined => {

    if (!headers) {

        return undefined;
    }

    const result: Record<string, string> = {};
    let hasHeaders = false;

    for (const key in headers) {

        const lowerKey = key.toLowerCase();

        if (KEY_HEADERS.has(lowerKey) && headers[key] !== undefined) {

            result[lowerKey] = headers[key];
            hasHeaders = true;
        }
    }

    return hasHeaders ? result : undefined;
};


/**
 * Request serializer for generating deduplication and cache keys.
 *
 * Serializes by request identity: method + URL path+search + payload + stable headers.
 * Used for policies that identify duplicate requests.
 *
 * Only includes stable, semantically-meaningful headers (Authorization, Accept,
 * Accept-Language, Content-Type, Accept-Encoding). Dynamic headers like timestamps,
 * HMAC signatures, and request IDs are excluded to prevent cache pollution.
 *
 * Header lookup is case-insensitive (keys are lowercased for comparison).
 *
 * Uses `url.pathname + url.search` which:
 * - Includes the full path and query parameters
 * - Excludes the hash fragment (which shouldn't affect request identity)
 * - Excludes the origin (handled by FetchEngine instance)
 *
 * @param ctx - Request key context
 * @returns A unique string key for the request
 *
 * @example
 * ```typescript
 * requestSerializer({
 *     method: 'GET',
 *     path: '/users/123',
 *     url: new URL('https://api.example.com/users/123?page=1'),
 *     payload: undefined,
 *     headers: {
 *         'Authorization': 'Bearer token',
 *         'X-Timestamp': '1234567890',  // Ignored (dynamic)
 *         'Accept': 'application/json'
 *     }
 * });
 * // Returns: 'GET|/users/123?page=1|undefined|{"accept":"application/json","authorization":"Bearer token"}'
 * ```
 */
export const requestSerializer = (ctx: RequestKeyOptions): string => {

    const urlKey = ctx.url.pathname + ctx.url.search;
    const keyHeaders = extractKeyHeaders(ctx.headers as Record<string, string>);

    const parts = [
        serializer([ctx.method]),
        serializer([urlKey]),
        serializer([ctx.payload]),
        serializer([keyHeaders])
    ];

    return parts.join('|');
};
