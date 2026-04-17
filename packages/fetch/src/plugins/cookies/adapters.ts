import type { Cookie, CookieAdapter } from './types.ts';


/**
 * Reference in-memory adapter for testing and prototyping.
 *
 * Stores cookies in a plain array — no persistence across process restarts.
 * Use this as a starting point when building localStorage, Redis, or
 * filesystem adapters.
 *
 * @example
 *     const plugin = cookiePlugin({ adapter: new MemoryAdapter() });
 */
export class MemoryAdapter implements CookieAdapter {

    #cookies: Cookie[] = [];

    async load(): Promise<Cookie[]> {

        return [...this.#cookies];
    }

    async save(cookies: Cookie[]): Promise<void> {

        this.#cookies = [...cookies];
    }
}


/**
 * Example: how to build a localStorage adapter for browser environments.
 *
 * Not exported as a named adapter — callers implement this pattern
 * with their own storage key and serialization.
 *
 * @example
 *     const plugin = cookiePlugin({
 *         adapter: {
 *             async load() {
 *                 const raw = localStorage.getItem('cookies');
 *                 return raw ? JSON.parse(raw) : [];
 *             },
 *             async save(cookies) {
 *                 localStorage.setItem('cookies', JSON.stringify(cookies));
 *             }
 *         }
 *     });
 */


/**
 * Example: how to build a Redis adapter for horizontal scaling.
 *
 * @example
 *     import { createClient } from 'redis';
 *     const redis = createClient({ url: process.env.REDIS_URL });
 *     await redis.connect();
 *
 *     const plugin = cookiePlugin({
 *         syncOnRequest: true,   // re-load before each request
 *         adapter: {
 *             async load() {
 *                 const raw = await redis.get('fetch:cookies');
 *                 return raw ? JSON.parse(raw) : [];
 *             },
 *             async save(cookies) {
 *                 await redis.set('fetch:cookies', JSON.stringify(cookies));
 *             }
 *         }
 *     });
 */
