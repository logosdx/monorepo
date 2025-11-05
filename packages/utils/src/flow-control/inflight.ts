import type { AsyncFunc } from '../types.ts';

import { attemptSync } from './attempt.ts';
import { serializer } from './_helpers.ts';

/**
 * Lifecycle hooks for in-flight promise deduplication.
 * All hooks are optional and must be synchronous.
 * Hook errors are silently caught to prevent breaking deduplication logic.
 */
export interface InflightHooks<Key = string, Value = unknown> {

    /** Called when first caller starts producer for this key (before producer executes) */
    onStart?: (key: Key) => void;

    /** Called when subsequent caller joins existing in-flight promise */
    onJoin?: (key: Key) => void;

    /** Called when shared promise resolves successfully */
    onResolve?: (key: Key, value: Value) => void;

    /** Called when shared promise rejects */
    onReject?: (key: Key, error: unknown) => void;
}

/**
 * Configuration options for in-flight promise deduplication.
 */
export interface InflightOptions<Args extends any[] = any[], Key = string, Value = unknown> {

    /**
     * Optional key function. If omitted, uses a built-in serializer that handles:
     * - Primitives (string, number, boolean, null, undefined, bigint)
     * - Objects (plain objects with sorted keys for consistency)
     * - Arrays (preserves order)
     * - Dates (serialized as timestamps)
     * - RegExp (serialized as source/flags)
     * - Maps and Sets (serialized with sorted entries)
     * - Circular references (detected and marked)
     *
     * Unsupported types (serialized but may cause collisions):
     * - Functions: Serialized as "[Function]" - all functions collide
     * - Symbols: Serialized by description - symbols with same description collide
     * - WeakMap/WeakSet: Serialized as "[WeakMap/WeakSet]" - all instances collide
     * - Errors: Serialized by name and message only
     *
     * For identity-based deduplication, functions as arguments, or performance-critical
     * hot paths, provide a custom keyFn that extracts only discriminating fields
     * (e.g., `(id, _opts) => id`).
     */
    keyFn?: (...args: Args) => Key;

    /** Optional lifecycle hooks; all are no-ops by default. Must be synchronous. */
    hooks?: InflightHooks<Key, Value>;
}

/**
 * Wrap an async function so concurrent calls with the same key share the same in-flight promise.
 *
 * **What it does:**
 * - Deduplicates concurrent async calls with identical arguments (or custom key)
 * - First call starts the producer; concurrent calls join the same promise
 * - No caching after settlement - each new request starts fresh
 * - Automatic cleanup on resolve/reject
 *
 * **What it doesn't do:**
 * - No memoization/TTL/stale-while-revalidate (use `memoize` for that)
 * - No AbortController handling (callers manage their own cancellation)
 * - No request queuing (all concurrent calls share the same promise)
 *
 * **When to use:**
 * - Deduplicating database queries that might be triggered multiple times
 * - Preventing duplicate API calls during component re-renders
 * - Sharing expensive computations across concurrent callers
 * - Hot paths where multiple parts of code request the same resource
 *
 * **Performance notes:**
 * - Default key generation: O(n) in argument structure size
 * - For hot paths or complex args, use custom `keyFn` to extract only discriminating fields
 * - For functions as arguments, MUST use custom `keyFn` (functions always collide in default serializer)
 *
 * @template Args - Function argument types
 * @template Value - Function return type (unwrapped from Promise)
 * @template Key - Key type (defaults to string)
 * @param producer - Async function to wrap
 * @param opts - Optional configuration (keyFn, hooks)
 * @returns Wrapped function with in-flight deduplication
 *
 * @example
 * ```typescript
 * // Basic usage - database query deduplication
 * const fetchUser = async (id: string) => db.users.findById(id);
 * const getUser = withInflightDedup(fetchUser);
 *
 * // Three concurrent calls → one database query
 * const [user1, user2, user3] = await Promise.all([
 *   getUser("42"),
 *   getUser("42"),
 *   getUser("42")
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // With hooks for observability
 * const search = async (q: string) => api.search(q);
 * const dedupedSearch = withInflightDedup(search, {
 *   hooks: {
 *     onStart: (k) => logger.debug("search started", k),
 *     onJoin: (k) => logger.debug("joined existing search", k),
 *     onResolve: (k) => logger.debug("search completed", k),
 *     onReject: (k, e) => logger.error("search failed", k, e),
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Custom key - ignore volatile parameters
 * const fetchData = async (id: string, opts: { timestamp?: number }) => { };
 * const dedupedFetch = withInflightDedup(fetchData, {
 *   keyFn: (id) => id  // Only dedupe by id, ignore opts
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Hot path optimization - extract discriminating field only
 * const getProfile = async (req: { userId: string; meta: LargeObject }) => { };
 * const dedupedGetProfile = withInflightDedup(getProfile, {
 *   keyFn: (req) => req.userId  // Avoid serializing large meta object
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Functions as arguments - MUST use custom keyFn
 * const fetchWithTransform = async (url: string, transform: (data: any) => any) => { };
 * const dedupedFetch = withInflightDedup(fetchWithTransform, {
 *   keyFn: (url) => url  // Only dedupe by URL, ignore transform function
 * });
 * ```
 */
export function withInflightDedup<Args extends any[], Value, Key = string>(
    producer: AsyncFunc<Args, Value>,
    opts?: InflightOptions<Args, Key, Value>
): AsyncFunc<Args, Value> {

    const inflight = new Map<Key, Promise<Value>>();

    const wrapped = async (...args: Args): Promise<Value> => {

        const key = opts?.keyFn ? opts.keyFn(...args) : serializer(args) as Key;

        const existing = inflight.get(key);

        if (existing) {

            safeHook(opts?.hooks?.onJoin, key);
            return existing;
        }

        safeHook(opts?.hooks?.onStart, key);

        const promise = producer(...args)
            .then(value => {

                safeHook(opts?.hooks?.onResolve, key, value);
                return value;
            })
            .catch(error => {

                safeHook(opts?.hooks?.onReject, key, error);
                throw error;
            })
            .finally(() => {

                inflight.delete(key);
            });

        inflight.set(key, promise);

        return promise;
    };

    return wrapped;
}

/**
 * Helper function to safely execute hooks with error suppression.
 * Hooks must not break the deduplication logic.
 *
 * @param hook - Optional hook function to execute
 * @param args - Arguments to pass to the hook
 */
function safeHook(hook: Function | undefined, ...args: any[]): void {

    if (!hook) return;

    attemptSync(() => hook(...args));
}
