import { wait } from './misc.ts';
import { assert, assertOptional, isFunction, isPlainObject } from '../validation/index.ts';
import { assertNotWrapped, markWrapped } from '../_helpers.ts';
import { Func } from '../types.ts';

/**
 * Token bucket implementation of rate limiting with optional persistence support.
 *
 * @example
 * // Basic usage
 * const bucket = new RateLimitTokenBucket({
 *     capacity: 10,
 *     refillIntervalMs: 1000
 * });
 *
 * bucket.consume();
 * bucket.consume();
 *
 * const rateLimited = async () => {
 *     // 0 ms if tokens are available
 *     // 1000 / 10 = 100 ms if tokens are not available
 *     await bucket.waitAndConsume();
 *     return 'success';
 * }
 *
 * @example
 * // With persistence (e.g., Redis backend)
 * const bucket = new RateLimitTokenBucket({
 *     capacity: 100,
 *     refillIntervalMs: 60000,
 *     save: async (state) => {
 *         await redis.set('rate-limit:user:123', JSON.stringify(state));
 *     },
 *     load: async () => {
 *         const data = await redis.get('rate-limit:user:123');
 *         return data ? JSON.parse(data) : undefined;
 *     }
 * });
 *
 * // Load state from backend before using
 * await bucket.load();
 *
 * // Check and consume
 * if (bucket.hasTokens()) {
 *     bucket.consume();
 *     await bucket.save();
 * }
 */
export class RateLimitTokenBucket {

    #tokens: number;
    #lastRefill: number;
    #stats: RateLimitTokenBucket.Stats;
    #save: RateLimitTokenBucket.SaveFn | undefined;
    #load: RateLimitTokenBucket.LoadFn | undefined;

    readonly capacity: number;
    readonly refillIntervalMs: number;

    constructor(config: RateLimitTokenBucket.Config) {

        assert(isPlainObject(config), 'config must be an object');
        assert(typeof config.capacity === 'number' && config.capacity > 0, 'capacity must be a positive number');
        assert(typeof config.refillIntervalMs === 'number' && config.refillIntervalMs > 0, 'refillIntervalMs must be a positive number');
        assertOptional(config.save, isFunction(config.save), 'save must be a function');
        assertOptional(config.load, isFunction(config.load), 'load must be a function');
        assertOptional(config.initialState, isPlainObject(config.initialState), 'initialState must be an object');

        this.capacity = config.capacity;
        this.refillIntervalMs = config.refillIntervalMs;
        this.#save = config.save;
        this.#load = config.load;

        if (config.initialState) {

            this.#tokens = config.initialState.tokens ?? config.capacity;
            this.#lastRefill = config.initialState.lastRefill ?? Date.now();
            this.#stats = {
                totalRequests: config.initialState.stats?.totalRequests ?? 0,
                rejectedRequests: config.initialState.stats?.rejectedRequests ?? 0,
                totalWaitTime: config.initialState.stats?.totalWaitTime ?? 0,
                waitCount: config.initialState.stats?.waitCount ?? 0,
                createdAt: config.initialState.stats?.createdAt ?? Date.now()
            };
        }
        else {

            this.#tokens = config.capacity;
            this.#lastRefill = Date.now();
            this.#stats = {
                totalRequests: 0,
                rejectedRequests: 0,
                totalWaitTime: 0,
                waitCount: 0,
                createdAt: Date.now()
            };
        }
    }

    /**
     * Whether save and load functions are configured for persistence.
     */
    get isSaveable(): boolean {

        return isFunction(this.#save) && isFunction(this.#load);
    }

    /**
     * Get the current state for persistence.
     * This is the minimal data structure needed to restore the bucket.
     */
    get state(): RateLimitTokenBucket.State {

        this.#refill();
        return {
            tokens: this.#tokens,
            lastRefill: this.#lastRefill,
            stats: { ...this.#stats }
        };
    }

    /**
     * Save the current state using the configured save function.
     * @throws If no save function is configured
     */
    async save(): Promise<void> {

        const saveFn = this.#save;

        if (!isFunction(saveFn)) {

            throw new Error('No save function configured');
        }

        await saveFn(this.state);
    }

    /**
     * Load state from the configured load function.
     * If the load function returns undefined/null, the bucket state is not modified.
     * @throws If no load function is configured
     */
    async load(): Promise<void> {

        const loadFn = this.#load;

        if (!isFunction(loadFn)) {

            throw new Error('No load function configured');
        }

        const loadedState = await loadFn();

        if (loadedState) {

            this.#tokens = loadedState.tokens ?? this.capacity;
            this.#lastRefill = loadedState.lastRefill ?? Date.now();

            if (loadedState.stats) {

                this.#stats = {
                    totalRequests: loadedState.stats.totalRequests ?? 0,
                    rejectedRequests: loadedState.stats.rejectedRequests ?? 0,
                    totalWaitTime: loadedState.stats.totalWaitTime ?? 0,
                    waitCount: loadedState.stats.waitCount ?? 0,
                    createdAt: loadedState.stats.createdAt ?? Date.now()
                };
            }
        }
    }

    /**
     * Check if there are enough tokens available without consuming them.
     *
     * @param count - Number of tokens to check for (default: 1)
     * @returns true if tokens are available, false otherwise
     *
     * @example
     * if (bucket.hasTokens()) {
     *     // We're within rate limit, proceed
     *     bucket.consume();
     * }
     */
    hasTokens(count: number = 1): boolean {

        this.#refill();
        return this.#tokens >= count;
    }

    #refill() {

        const now = Date.now();
        const elapsed = now - this.#lastRefill;
        const refillRate = 1 / this.refillIntervalMs;

        // Protect against clock adjustments or very long delays
        if (elapsed < 0 || elapsed > this.refillIntervalMs * this.capacity * 2) {


            this.#lastRefill = now;
            this.#tokens = this.capacity;
            return;
        }

        if (elapsed > 0) {


            // Calculate how many tokens to add based on elapsed time and refill rate
            const tokensToAdd = elapsed * refillRate;
            this.#tokens = Math.min(this.capacity, this.#tokens + tokensToAdd);
            this.#lastRefill = now;
        }
    }

    reset() {
        this.#tokens = this.capacity;
        this.#lastRefill = Date.now();
    }

    get tokens() {
        return Math.floor(this.#tokens);
    }

    consume(count: number = 1): boolean {

        this.#refill();
        this.#stats.totalRequests++;

        if (this.#tokens >= count) {

            this.#tokens -= count;
            return true;
        }

        this.#stats.rejectedRequests++;
        return false;
    }

    getWaitTimeMs(count: number = 1) {

        this.#refill();
        const deficit = count - this.#tokens;

        if (deficit <= 0) return 0;

        const refillRate = 1 / this.refillIntervalMs;
        // Add a small buffer to ensure enough tokens are available after waiting
        const waitTime = Math.ceil(deficit / refillRate) + 1;
        return waitTime;
    }

    getNextAvailable(count: number = 1) {
        return new Date(Date.now() + this.getWaitTimeMs(count));
    }

    /**
     * Get a snapshot of current statistics and state.
     *
     * @returns Object containing usage statistics and current state
     */
    get snapshot() {
        this.#refill();
        const now = Date.now();
        const uptime = now - this.#stats.createdAt;

        return {
            currentTokens: this.tokens,
            capacity: this.capacity,
            refillIntervalMs: this.refillIntervalMs,
            totalRequests: this.#stats.totalRequests,
            rejectedRequests: this.#stats.rejectedRequests,
            successfulRequests: this.#stats.totalRequests - this.#stats.rejectedRequests,
            rejectionRate: this.#stats.totalRequests > 0 ? this.#stats.rejectedRequests / this.#stats.totalRequests : 0,
            totalWaitTime: this.#stats.totalWaitTime,
            waitCount: this.#stats.waitCount,
            averageWaitTime: this.#stats.waitCount > 0 ? this.#stats.totalWaitTime / this.#stats.waitCount : 0,
            uptime,
            createdAt: this.#stats.createdAt
        };
    }


    /**
     * Waits for the next token to be available before
     * allowing the caller to proceed.
     *
     * @param onRateLimit - Callback to invoke when the rate limit is exceeded
     *
     * @example
     * const bucket = new RateLimitTokenBucket({
     *     capacity: 10,
     *     refillIntervalMs: 1000
     * });
     *
     * await bucket.waitForToken(() => {
     *     console.log('Rate limit exceeded');
     * });
     * console.log('Token available');
     *
     * bucket.consume();
     * console.log('Token consumed');
     */
    async waitForToken(
        count: number = 1,
        opts: {
            onRateLimit?: ((error: RateLimitError, nextAvailable: Date) => void) | undefined,
            abortController?: AbortController | undefined,
            jitterFactor?: number | undefined
        } = {}
    ) {

        const {
            onRateLimit,
            abortController,
            jitterFactor = 0
        } = opts;

        // Check if tokens are already available without consuming them
        this.#refill();
        if (this.#tokens >= count) return;

        const waitStart = Date.now();
        this.#stats.waitCount++;

        while (this.#tokens < count) {

            if (abortController?.signal?.aborted) return;

            await onRateLimit?.(
                new RateLimitError('Rate limit exceeded', this.capacity),
                this.getNextAvailable(count)
            );

            await wait(this.getWaitTimeMs(count) + Math.random() * jitterFactor);
            this.#refill();
        }

        const waitEnd = Date.now();
        this.#stats.totalWaitTime += waitEnd - waitStart;
    }

    /**
     * Waits for tokens to be available and consumes them atomically.
     *
     * @param onRateLimit - Callback to invoke when the rate limit is exceeded
     *
     * @example
     * const bucket = new RateLimitTokenBucket({
     *     capacity: 10,
     *     refillIntervalMs: 1000
     * });
     *
     * await bucket.waitAndConsume(() => {
     *     console.log('Rate limit exceeded');
     * });
     * console.log('Token acquired and consumed');
     */
    async waitAndConsume(
        count: number = 1,
        opts: {
            onRateLimit?: ((error: RateLimitError, nextAvailable: Date) => void) | undefined,
            abortController?: AbortController | undefined,
            jitterFactor?: number | undefined
        } = {}
    ): Promise<boolean> {

        const {
            onRateLimit,
            abortController,
            jitterFactor = 0
        } = opts;

        // Check if tokens are already available and consume them atomically
        this.#refill();
        this.#stats.totalRequests++;

        if (this.#tokens >= count) {

            this.#tokens -= count;
            return true;
        }

        const waitStart = Date.now();
        this.#stats.waitCount++;

        while (this.#tokens < count) {

            if (abortController?.signal?.aborted) {

                this.#stats.rejectedRequests++;
                return false;
            }

            await onRateLimit?.(
                new RateLimitError('Rate limit exceeded', this.capacity),
                this.getNextAvailable(count)
            );

            await wait(this.getWaitTimeMs(count) + Math.random() * jitterFactor);
            this.#refill();
        }

        // Consume tokens after wait
        this.#tokens -= count;

        const waitEnd = Date.now();
        this.#stats.totalWaitTime += waitEnd - waitStart;

        return true;
    }
}

export namespace RateLimitTokenBucket {

    /**
     * Configuration options for creating a rate limit token bucket.
     */
    export interface Config {

        /** Maximum number of tokens in the bucket */
        capacity: number;

        /** Time in milliseconds required to generate one token */
        refillIntervalMs: number;

        /** Initial state to restore from (for persistence) */
        initialState?: State;

        /** Function to save the current state (for persistence) */
        save?: SaveFn;

        /** Function to load the state (for persistence) */
        load?: LoadFn;
    }

    /**
     * The minimal state structure for persistence.
     */
    export interface State {

        /** Current number of tokens */
        tokens: number;

        /** Timestamp of the last refill */
        lastRefill: number;

        /** Usage statistics */
        stats?: Stats;
    }

    /**
     * Usage statistics for the token bucket.
     */
    export interface Stats {

        totalRequests: number;
        rejectedRequests: number;
        totalWaitTime: number;
        waitCount: number;
        createdAt: number;
    }

    export type SaveFn = (state: State) => void | Promise<void>;
    export type LoadFn = () => State | undefined | null | Promise<State | undefined | null>;
}

/**
 * Error thrown when rate limit is exceeded.
 */
export class RateLimitError extends Error {

    maxCalls: number;

    constructor(message: string, maxCalls: number) {

        super(message);
        this.name = 'RateLimitError';
        this.maxCalls = maxCalls;
    }
}

export const isRateLimitError = (error: unknown): error is RateLimitError => {
    return error?.constructor?.name === RateLimitError.name;
}

/**
 * Configuration options for rate limiting behavior when creating a new bucket.
 *
 * @template T - The function type being rate limited
 */
export type RateLimitOptions<T extends Func> = {

    /** Maximum number of calls allowed within the time window */
    maxCalls: number;

    /** Time window in milliseconds for rate limiting (default: 1000) */
    windowMs?: number;

    /** Whether to throw an error when limit is exceeded (default: true) */
    throws?: boolean;

    /** Callback invoked when rate limit is exceeded */
    onLimitReached?: (error: RateLimitError, nextAvailable: Date, args: Parameters<T>) => void | Promise<void>;
}

/**
 * Configuration options for rate limiting behavior when using an existing bucket.
 *
 * @template T - The function type being rate limited
 */
export type RateLimitBucketOptions<T extends Func> = {

    /** An existing RateLimitTokenBucket instance to use */
    bucket: RateLimitTokenBucket;

    /** Whether to throw an error when limit is exceeded (default: true) */
    throws?: boolean;

    /** Callback invoked when rate limit is exceeded */
    onLimitReached?: (error: RateLimitError, nextAvailable: Date, args: Parameters<T>) => void | Promise<void>;
}

/**
 * Rate limiter that restricts function calls to a specified number per time window.
 *
 * Implements a token bucket rate limiting algorithm that enforces limits by either throwing errors or waiting for a token before proceeding.
 *
 * @template T - The function type being rate limited
 * @param fn - Function to apply rate limiting to
 * @param opts - Rate limiting configuration options or bucket options
 * @returns Rate-limited version of the original function (async)
 *
 * @example
 * // Throwing rate limiter with options
 * const rateLimitedFn = rateLimit(fn, {
 *     maxCalls: 10,
 *     windowMs: 1000,
 *     throws: true,
 *     onLimitReached: (error) => {
 *         console.error('Rate limit exceeded:', error.message);
 *     }
 * });
 *
 * for (let i = 0; i < 10; i++) {
 *     await rateLimitedFn();
 * }
 *
 * // will throw an error
 * await rateLimitedFn();
 *
 * @example
 * // With an existing bucket (useful for persistence)
 * const bucket = new RateLimitTokenBucket({
 *     capacity: 10,
 *     refillIntervalMs: 100,
 *     save: async (state) => redis.set('key', JSON.stringify(state)),
 *     load: async () => JSON.parse(await redis.get('key'))
 * });
 *
 * const rateLimitedFn = rateLimit(fn, {
 *     bucket,
 *     throws: true
 * });
 *
 * // When bucket.isSaveable is true, load() is called before each check
 * // and save() is called after each successful consume
 * await rateLimitedFn();
 *
 * @example
 * // Waits for token if throws: false
 * const rateLimitedWithoutThrowing = rateLimit(fn, {
 *     maxCalls: 10,
 *     windowMs: 1000,
 *     throws: false
 * });
 *
 * for (let i = 0; i < 10; i++) {
 *     await rateLimitedWithoutThrowing();
 * }
 *
 * // will wait for token, then call fn
 * await rateLimitedWithoutThrowing();
 *
 */
export function rateLimit<T extends Func>(
    fn: T,
    opts: RateLimitOptions<T> & { throws: false }
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

export function rateLimit<T extends Func>(
    fn: T,
    opts: RateLimitOptions<T> & { throws?: true }
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

export function rateLimit<T extends Func>(
    fn: T,
    opts: RateLimitBucketOptions<T> & { throws: false }
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

export function rateLimit<T extends Func>(
    fn: T,
    opts: RateLimitBucketOptions<T> & { throws?: true }
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

export function rateLimit<T extends Func>(
    fn: T,
    opts: RateLimitOptions<T> | RateLimitBucketOptions<T>
): (...args: Parameters<T>) => Promise<ReturnType<T>> {

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'rateLimit');
    assert(isPlainObject(opts), 'opts must be an object');

    const throws = opts.throws ?? true;
    const onLimitReached = opts.onLimitReached;

    assertOptional(throws, typeof throws === 'boolean', 'throws must be a boolean');
    assertOptional(onLimitReached, isFunction(onLimitReached), 'onLimitReached must be a function');

    let tokenBucket: RateLimitTokenBucket;

    if ('bucket' in opts && opts.bucket instanceof RateLimitTokenBucket) {

        tokenBucket = opts.bucket;
    }
    else {

        const { maxCalls, windowMs = 1000 } = opts as RateLimitOptions<T>;

        assert(typeof maxCalls === 'number' && maxCalls > 0, 'maxCalls must be a positive number');
        assertOptional(windowMs, typeof windowMs === 'number' && windowMs > 0, 'windowMs must be a positive number representing time in milliseconds');

        tokenBucket = new RateLimitTokenBucket({
            capacity: maxCalls,
            refillIntervalMs: windowMs / maxCalls
        });
    }

    const rateLimitedFunction = async function(...args: Parameters<T>): Promise<ReturnType<T>> {

        // Load state before checking if the bucket is saveable
        if (tokenBucket.isSaveable) {

            await tokenBucket.load();
        }

        const onceReached = async (limitErr: RateLimitError) => {

            await onLimitReached?.(
                limitErr,
                tokenBucket.getNextAvailable(1),
                args
            );

            if (throws) throw limitErr;
        }

        await tokenBucket.waitAndConsume(1, {
            onRateLimit: onceReached
        });

        // Save state after consuming if the bucket is saveable
        if (tokenBucket.isSaveable) {

            await tokenBucket.save();
        }

        return fn(...args);
    };

    markWrapped(fn, rateLimitedFunction as T, 'rateLimit');

    return rateLimitedFunction;
}
