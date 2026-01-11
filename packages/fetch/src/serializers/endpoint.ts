import type { RequestKeyOptions } from '../types.ts';

/**
 * Endpoint serializer for generating rate limit and retry keys.
 *
 * Serializes by endpoint identity only (method + pathname).
 * Used for policies that protect endpoints from overload.
 *
 * @param ctx - Request key context
 * @returns A unique string key for the endpoint
 *
 * @example
 * ```typescript
 * endpointSerializer({
 *     method: 'GET',
 *     path: '/users/123',
 *     url: new URL('https://api.example.com/users/123?page=1'),
 *     headers: { Authorization: 'Bearer token' }
 * });
 * // Returns: 'GET|/users/123'
 * ```
 */
export const endpointSerializer = (ctx: RequestKeyOptions): string => {

    return `${ctx.method}|${ctx.url.pathname}`;
};
