import { attempt } from '@logosdx/utils';

import type { FetchPlugin, FetchEnginePublic } from '../../engine/types.ts';
import type { CookieAdapter, CookieConfig } from './types.ts';
import { CookieJar, type CookieJarOptions } from './jar.ts';
import { parseSetCookieHeader } from './parser.ts';
import { serializeCookies } from './serializer.ts';
import { getSetCookieHeaders } from './response-headers.ts';


/**
 * Return shape of `cookiePlugin()` — a `FetchPlugin` augmented with jar access,
 * adapter lifecycle methods, and a graceful shutdown `flush()`.
 */
export interface CookiePlugin<H = unknown, P = unknown, S = unknown>
    extends FetchPlugin<H, P, S> {

    /** The underlying cookie jar. Users may call `jar.set`, `jar.get`, etc. directly. */
    readonly jar: CookieJar;

    /**
     * Load persisted cookies from the adapter (if configured). Safe to call
     * multiple times; errors from the adapter are swallowed.
     */
    init(): Promise<void>;

    /**
     * Force any pending coalesced persistence to commit and perform one final
     * save. Call this on graceful shutdown (process exit, logout, etc.).
     *
     * Resolves after the save completes; rejects if the adapter throws. A
     * no-op when no adapter is configured.
     */
    flush(): Promise<void>;
}


/**
 * Cookie plugin for FetchEngine.
 *
 * Transparently manages a cookie jar across requests:
 * - `beforeRequest`: injects matching cookies as the `Cookie` header.
 * - `afterRequest`: captures `Set-Cookie` response headers into the jar.
 *
 * Works in both browser (alongside native cookie jar) and Node.js
 * (where the native fetch has no cookie jar).
 *
 * Persistence is coalesced via `queueMicrotask`: any burst of jar mutations
 * in the same tick produces exactly one `adapter.save()` call. For graceful
 * shutdown, call `plugin.flush()`.
 *
 * For horizontal scaling, provide an `adapter` (e.g., Redis) and set
 * `syncOnRequest: true` to reload the jar from the adapter before each request.
 *
 * @example
 *     const cookies = cookiePlugin();
 *     const api = new FetchEngine({ baseUrl: '...', plugins: [cookies] });
 *
 *     // Access jar directly for manual management
 *     cookies.jar.clear();
 *     cookies.jar.clearSession();
 *
 *     // Graceful shutdown
 *     await cookies.flush();
 */
export function cookiePlugin<H = unknown, P = unknown, S = unknown>(
    config?: CookieConfig
): CookiePlugin<H, P, S> {

    // === Declaration block ===
    const adapter: CookieAdapter | undefined = config?.adapter;
    const syncOnRequest = config?.syncOnRequest ?? false;
    const exclude = config?.exclude ?? [];

    let persistScheduled = false;

    async function persistJar(): Promise<void> {

        if (!adapter) return;

        const [, err] = await attempt(() => adapter.save(jar.all()));

        if (err) {

            // Persistence failure must not break the request pipeline.
            // Callers who need error visibility should subscribe to their
            // own adapter-level telemetry or call `plugin.flush()` explicitly.
        }
    }

    function schedulePersist(): void {

        if (!adapter || persistScheduled) return;

        persistScheduled = true;

        queueMicrotask(() => {

            persistScheduled = false;
            void persistJar();
        });
    }

    const jarConfig: CookieJarOptions = { onChange: schedulePersist };
    if (config?.maxCookies !== undefined) jarConfig.maxCookies = config.maxCookies;
    if (config?.maxCookiesPerDomain !== undefined) jarConfig.maxCookiesPerDomain = config.maxCookiesPerDomain;
    if (config?.maxCookieSize !== undefined) jarConfig.maxCookieSize = config.maxCookieSize;
    if (config?.httpApi !== undefined) jarConfig.httpApi = config.httpApi;

    const jar = new CookieJar(jarConfig);

    // Seed from config.cookies synchronously (fires onChange → schedules
    // one redundant save, which is fine).
    if (config?.cookies?.length) {

        jar.load(config.cookies);
    }

    function isExcluded(url: URL): boolean {

        const host = url.hostname;

        return exclude.some(pattern =>
            pattern instanceof RegExp ? pattern.test(host) : pattern === host
        );
    }

    // === Return plugin ===
    return {

        name: 'cookies',
        jar,

        async init(): Promise<void> {

            if (!adapter) return;

            const [cookies, err] = await attempt(() => adapter.load());

            if (err || !cookies) return;

            jar.load(cookies);
        },

        async flush(): Promise<void> {

            if (!adapter) return;

            // `persistJar()` uses `attempt`, so it never throws. To surface
            // shutdown failures to the caller, invoke adapter.save directly.
            await adapter.save(jar.all());
        },

        install(engine: FetchEnginePublic<H, P, S>): () => void {

            const cleanups: (() => void)[] = [];

            // §5.4 — Inject Cookie header before request.
            // Priority -25 → runs before cache's -20 so caches see the
            // request with cookies already attached (part of the key).
            cleanups.push(engine.hooks.add('beforeRequest', async (url, opts, ctx) => {

                if (isExcluded(url)) return;

                // Optionally reload from adapter for horizontal-scale sync
                if (syncOnRequest && adapter) {

                    const [cookies] = await attempt(() => adapter.load());

                    if (cookies) {

                        jar.clear();
                        jar.load(cookies);
                    }
                }

                // `jar.get(url)` applies §5.4 retrieval AND bumps
                // lastAccessTime on every returned cookie (fires onChange
                // once, coalesced).
                const matches = jar.get(url);

                if (!matches.length) return;

                const cookieHeader = serializeCookies(matches);

                // Read the incoming Cookie header without casting opts.headers:
                // `opts.headers` is `Partial<H>` where `H` is the engine's
                // user-provided header generic. `Reflect.get` gives us the
                // value at `'cookie'` without requiring the key to be in `H`.
                const existingRaw = opts.headers
                    ? Reflect.get(opts.headers, 'cookie')
                    : undefined;
                const existing = typeof existingRaw === 'string' ? existingRaw : '';
                const merged = existing ? `${existing}; ${cookieHeader}` : cookieHeader;

                ctx.args(url, {
                    ...opts,
                    headers: {
                        ...opts.headers,
                        cookie: merged,
                    },
                });

            }, { priority: -25 }));

            // §5.3 — Capture Set-Cookie from response.
            // Priority -5 → runs after cache's afterRequest (-10) so the
            // cache stores the fully-shaped response first.
            cleanups.push(engine.hooks.add('afterRequest', (response, url, _opts) => {

                if (isExcluded(url)) return;

                // `response.headers` is `Partial<RH>` — pass directly to the
                // reader, which accepts `unknown` and runtime-narrows.
                const setCookieHeaders = getSetCookieHeaders(response.headers);

                for (const header of setCookieHeaders) {

                    const cookie = parseSetCookieHeader(header, url);

                    if (cookie) {

                        // jar.set fires onChange → microtask-coalesced save
                        jar.set(cookie);
                    }
                }

            }, { priority: -5 }));

            return () => {

                for (const cleanup of cleanups) {

                    cleanup();
                }
            };
        },
    };
}
