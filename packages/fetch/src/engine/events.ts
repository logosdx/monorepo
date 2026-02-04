import type { HttpMethods, DictAndT } from '../types.ts';
import type { FetchError } from '../helpers/fetch-error.ts';


/**
 * Base event data payload for FetchEngine events.
 *
 * Contains common fields shared across all fetch-related events.
 *
 * @template S - Instance state type
 * @template H - Instance headers type
 * @template P - Instance params type
 */
export interface EventData<S = unknown, H = unknown, P = unknown> {

    state: S;
    url?: string | URL | undefined;
    method?: HttpMethods | undefined;
    headers?: DictAndT<H> | undefined;
    params?: DictAndT<P> | undefined;
    error?: Error | FetchError<{}, DictAndT<H>> | undefined;
    response?: Response | undefined;
    data?: unknown;
    payload?: unknown;
    attempt?: number | undefined;
    nextAttempt?: number | undefined;
    delay?: number | undefined;
    step?: 'fetch' | 'parse' | 'response' | undefined;
    status?: number | undefined;
    path?: string | undefined;
    aborted?: boolean | undefined;

    /** Unique ID for this request, flows through all events */
    requestId?: string | undefined;

    /** Timestamp (ms) when the request entered the execution pipeline */
    requestStart?: number | undefined;

    /** Timestamp (ms) when the request resolved (success, error, or abort) */
    requestEnd?: number | undefined;
}


/**
 * Event data for deduplication events.
 *
 * Extends base event data with deduplication-specific fields.
 *
 * @template S - Instance state type
 * @template H - Instance headers type
 * @template P - Instance params type
 */
export interface DedupeEventData<S = unknown, H = unknown, P = unknown> extends EventData<S, H, P> {

    /** The generated deduplication key */
    key: string;

    /** Number of callers waiting on this request (join events only) */
    waitingCount?: number | undefined;
}


/**
 * Event data for cache events.
 *
 * Extends base event data with cache-specific fields.
 *
 * @template S - Instance state type
 * @template H - Instance headers type
 * @template P - Instance params type
 */
export interface CacheEventData<S = unknown, H = unknown, P = unknown> extends EventData<S, H, P> {

    /** The generated cache key */
    key: string;

    /** Whether the cache entry is stale (SWR) */
    isStale?: boolean | undefined;

    /** Time until expiration (ms) */
    expiresIn?: number | undefined;
}


/**
 * Event data for rate limit events.
 *
 * Extends base event data with rate limiting-specific fields.
 *
 * @template S - Instance state type
 * @template H - Instance headers type
 * @template P - Instance params type
 */
export interface RateLimitEventData<S = unknown, H = unknown, P = unknown> extends EventData<S, H, P> {

    /** The rate limit bucket key */
    key: string;

    /** Current tokens available in the bucket */
    currentTokens: number;

    /** Maximum capacity of the bucket */
    capacity: number;

    /** Time to wait before next token is available (ms) */
    waitTimeMs: number;

    /** When the next token will be available */
    nextAvailable: Date;
}


/**
 * Event data for state mutation events.
 *
 * @template S - Instance state type
 */
export interface StateEventData<S = unknown> {

    /** Key that was set (for single key updates) */
    key?: keyof S | undefined;

    /** Value that was set */
    value?: S[keyof S] | Partial<S> | undefined;

    /** Previous state before the change */
    previous?: S | undefined;

    /** Current state after the change */
    current: S;
}


/**
 * Event data for property (header/param) events.
 *
 * @template T - Property type (headers or params)
 */
export interface PropertyEventData<T = unknown> {

    /** Key that was added/removed */
    key?: string | string[] | undefined;

    /** Value that was set (for add events) */
    value?: string | Partial<T> | undefined;

    /** HTTP method this change applies to (undefined = all methods) */
    method?: HttpMethods | undefined;
}


/**
 * Event data for options change events.
 */
export interface OptionsEventData {

    /** Path that was changed (for path-based sets) */
    path?: string | undefined;

    /** Value that was set */
    value?: unknown;
}


/**
 * Event data for modifyOptions change events.
 */
export interface ModifyOptionsEventData {

    /** The new modifyOptions function (or undefined if cleared) */
    fn?: ((opts: unknown, state: unknown) => unknown) | undefined;
}


/**
 * Event data for modifyMethodOptions change events.
 */
export interface ModifyMethodOptionsEventData {

    /** HTTP method this change applies to */
    method: string;

    /** The new modifyOptions function for the method (or undefined if cleared) */
    fn?: ((opts: unknown, state: unknown) => unknown) | undefined;
}


/**
 * Event map for FetchEngine - maps event names to their data types.
 *
 * Event names have been simplified by removing the `fetch-` prefix.
 * This provides cleaner API while maintaining full type safety.
 *
 * @template S - Instance state type
 * @template H - Instance headers type
 * @template P - Instance params type
 *
 * @example
 * ```typescript
 * // Subscribe to events
 * engine.on('before-request', (data) => console.log('Request starting:', data.url));
 * engine.on('cache-hit', (data) => console.log('Cache hit:', data.key));
 * engine.on('state-set', (data) => console.log('State changed:', data.current));
 * ```
 */
export interface EventMap<S = unknown, H = unknown, P = unknown> {

    // Request lifecycle events
    'before-request': EventData<S, H, P>;
    'after-request': EventData<S, H, P>;
    'abort': EventData<S, H, P>;
    'error': EventData<S, H, P>;
    'response': EventData<S, H, P>;
    'retry': EventData<S, H, P>;

    // Property mutation events
    'header-add': PropertyEventData<DictAndT<H>>;
    'header-remove': PropertyEventData<DictAndT<H>>;
    'param-add': PropertyEventData<DictAndT<P>>;
    'param-remove': PropertyEventData<DictAndT<P>>;

    // State mutation events
    'state-set': StateEventData<S>;
    'state-reset': StateEventData<S>;

    // Configuration change events
    'config-change': OptionsEventData;
    'modify-config-change': ModifyOptionsEventData;
    'modify-method-config-change': ModifyMethodOptionsEventData;
    'url-change': { url: string; state: S };

    // Deduplication events
    'dedupe-start': DedupeEventData<S, H, P>;
    'dedupe-join': DedupeEventData<S, H, P>;

    // Cache events
    'cache-hit': CacheEventData<S, H, P>;
    'cache-stale': CacheEventData<S, H, P>;
    'cache-miss': CacheEventData<S, H, P>;
    'cache-set': CacheEventData<S, H, P>;
    'cache-revalidate': CacheEventData<S, H, P>;
    'cache-revalidate-error': CacheEventData<S, H, P>;

    // Rate limiting events
    'ratelimit-wait': RateLimitEventData<S, H, P>;
    'ratelimit-reject': RateLimitEventData<S, H, P>;
    'ratelimit-acquire': RateLimitEventData<S, H, P>;
}


/**
 * Helper type to extract event names from EventMap.
 */
export type EventNames<S = unknown, H = unknown, P = unknown> = keyof EventMap<S, H, P>;
