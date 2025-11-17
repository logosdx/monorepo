import { attempt, attemptSync } from '../async/attempt.ts';
import { AnyFunc, markWrapped, assertNotWrapped } from './_helpers.ts';
import { assert, assertOptional, isFunction, isPlainObject } from '../validation/index.ts';

const DEFAULT_MAX_FAILURES = 3;
const DEFAULT_RESET_AFTER = 1000;
const DEFAULT_HALF_OPEN_MAX_ATTEMPTS = 1;

/**
 * Represents the three states of a circuit breaker.
 */
enum CircuitBreakerState {
    /** Normal operation - all calls pass through and failures are counted */
    Closed,
    /** Circuit is tripped - all calls fail immediately without invoking the function */
    Open,
    /** Testing recovery - allows limited test calls to check if service has recovered */
    HalfOpen
}

/**
 * Internal state store for circuit breaker operations.
 */
class CircuitBreakerStore {
    /** Current state of the circuit breaker */
    state: CircuitBreakerState = CircuitBreakerState.Closed;
    /** Number of consecutive failures in closed state */
    failures: number = 0;
    /** Number of attempts made in half-open state */
    halfOpenAttempts: number = 0;
    /** Timestamp when circuit was last tripped (opened) */
    trippedAt: number | null = null;
    /** Flag indicating if a test call is currently in progress in half-open state */
    testInProgress: boolean = false;
    /** Timestamp when the circuit breaker will be available again */
    nextAvailable: number | null = null;
}

/**
 * Configuration options for circuit breaker behavior.
 *
 * @template T - The function type being protected
 */
export type CircuitBreakerOptions<T extends AnyFunc> = {
    /**
     * Maximum number of consecutive failures before tripping the circuit
     *
     * @default 3
     */
    maxFailures?: number,
    /**
     * Maximum number of test attempts allowed in half-open state
     *
     * @default 1
     */
    halfOpenMaxAttempts?: number,
    /**
     * Time in milliseconds to wait before testing recovery
     *
     * @default 1000
     */
    resetAfter?: number,
    /**
     * Callback invoked when circuit breaker trips (opens)
     */
    onTripped?: (error: CircuitBreakerError, store: CircuitBreakerStore) => void
    /**
     * Callback invoked when the protected function throws an error
     */
    onError?: (error: Error, args: Parameters<T>) => void
    /**
     * Callback invoked when circuit breaker resets (closes)
     */
    onReset?: () => void
    /**
     * Callback invoked when circuit breaker enters half-open state
     */
    onHalfOpen?: (store: CircuitBreakerStore) => void
    /**
     * Predicate function to determine if an error should trip the circuit
     *
     * @default all errors trip
     */
    shouldTripOnError?: (error: Error) => boolean
}

/**
 * Error thrown when circuit breaker is in open state and prevents function execution.
 */
export class CircuitBreakerError extends Error {
    /**
     * Creates a new CircuitBreakerError.
     *
     * @param message - Error message describing the circuit breaker state
     */
    constructor(message: string) {
        super(message);
        this.name = 'CircuitBreakerError';
    }
}

export const isCircuitBreakerError = (error: unknown): error is CircuitBreakerError => {
    return error?.constructor?.name === CircuitBreakerError.name;
}

/**
 * Validates circuit breaker configuration options.
 *
 * @template T - The function type being protected
 * @param opts - Configuration options to validate
 * @throws {Error} When validation fails
 */
const validateOpts = <T extends AnyFunc>(opts: CircuitBreakerOptions<T>) => {

    assert(isPlainObject(opts), 'opts must be an object');

    assertOptional(
        opts.maxFailures,
        typeof opts.maxFailures === 'number' && opts.maxFailures > 0,
        'maxFailures must be a positive number'
    );

    assertOptional(
        opts.halfOpenMaxAttempts,
        typeof opts.halfOpenMaxAttempts === 'number' && opts.halfOpenMaxAttempts > 0,
        'halfOpenMaxAttempts must be a positive number'
    );

    assertOptional(
        opts.resetAfter,
        typeof opts.resetAfter === 'number' && opts.resetAfter > 0,
        'resetAfter must be a positive number'
    );

    assertOptional(opts.onTripped, isFunction(opts.onTripped), 'onTripped must be a function');
    assertOptional(opts.onError, isFunction(opts.onError), 'onError must be a function');
    assertOptional(opts.onReset, isFunction(opts.onReset), 'onReset must be a function');
    assertOptional(opts.onHalfOpen, isFunction(opts.onHalfOpen), 'onHalfOpen must be a function');
    assertOptional(opts.shouldTripOnError, isFunction(opts.shouldTripOnError), 'shouldTripOnError must be a function');
}

/**
 * Resets the circuit breaker store to closed state.
 *
 * @param store - Circuit breaker state store to reset
 * @param onReset - Optional callback to invoke after reset
 */
const resetStore = (
    store: CircuitBreakerStore,
    onReset?: () => void
) => {

    store.failures = 0;
    store.halfOpenAttempts = 0;
    store.trippedAt = null;
    store.testInProgress = false;
    store.state = CircuitBreakerState.Closed;
    store.nextAvailable = null;

    onReset?.();
}

/**
 * Performs pre-attempt checks and state transitions before function execution.
 *
 * @template T - The function type being protected
 * @param opts - Options containing store, arguments, and configuration
 * @throws {CircuitBreakerError} When circuit breaker is in open state or half-open limits exceeded
 */
const preAttempt = <T extends AnyFunc>(
    opts: {
        store: CircuitBreakerStore,
        args: Parameters<T>,
        opts: CircuitBreakerOptions<T>
    }
) => {

    const {
        store,
        opts: {
            resetAfter,
            halfOpenMaxAttempts = DEFAULT_HALF_OPEN_MAX_ATTEMPTS,
            onTripped,
            onHalfOpen,
            onReset: _onReset,
            shouldTripOnError: _shouldTripOnError
        }
    } = opts;

    const now = Date.now();
    const circError = new CircuitBreakerError('Circuit breaker tripped');

    if (
        store.state === CircuitBreakerState.Open &&
        store.trippedAt &&
        now - store.trippedAt > (resetAfter ?? DEFAULT_RESET_AFTER)
    ) {

        store.state = CircuitBreakerState.HalfOpen;
        store.halfOpenAttempts = 0;
        store.testInProgress = false;
        onHalfOpen?.(store);
    }

    if (store.state === CircuitBreakerState.Open) {

        throw circError;
    }

    if (store.state === CircuitBreakerState.HalfOpen) {

        if (store.testInProgress) {
            throw circError;
        }

        store.halfOpenAttempts++;

        if (store.halfOpenAttempts > halfOpenMaxAttempts) {

            store.state = CircuitBreakerState.Open;
            store.trippedAt = now;
            store.testInProgress = false;
            store.nextAvailable = null;

            onTripped?.(circError, store);

            throw circError;
        }

        store.testInProgress = true;
    }
}

/**
 * Performs post-attempt processing and state management after function execution.
 *
 * @template T - The function type being protected
 * @param opts - Options containing result, store, arguments, and configuration
 * @returns The function result if successful
 * @throws {Error} The original error if function failed
 */
const postAttempt = <T extends AnyFunc>(
    opts: {
        value?: ReturnType<T> | null,
        error?: Error | null,
        store: CircuitBreakerStore,
        args: Parameters<T>,
        opts: CircuitBreakerOptions<T>
    }
) => {

    const {
        value,
        error,
        store,
        args,
        opts: {
            onError,
            onReset,
            shouldTripOnError,
            onTripped,
            maxFailures,
            resetAfter
        }
    } = opts;

    const originalState = store.state;

    if (originalState === CircuitBreakerState.HalfOpen) {
        store.testInProgress = false;
    }

    if (error) {

        onError?.(error, args);

        const shouldTrip = shouldTripOnError?.(error) ?? true;

        if (shouldTrip) {
            if (store.state === CircuitBreakerState.Closed) {
                store.failures++;

                if (store.failures >= (maxFailures ?? DEFAULT_MAX_FAILURES)) {
                    store.state = CircuitBreakerState.Open;
                    store.trippedAt = Date.now();
                    store.nextAvailable = store.trippedAt + (resetAfter ?? DEFAULT_RESET_AFTER);

                    const circError = new CircuitBreakerError('Circuit breaker tripped');
                    onTripped?.(circError, store);
                }
            }

            else if (store.state === CircuitBreakerState.HalfOpen) {
                store.state = CircuitBreakerState.Open;
                store.trippedAt = Date.now();
                store.nextAvailable = store.trippedAt + (resetAfter ?? DEFAULT_RESET_AFTER);

                const circError = new CircuitBreakerError('Circuit breaker tripped');
                onTripped?.(circError, store);
            }
        }

        throw error;
    }

    if (originalState === CircuitBreakerState.HalfOpen) {
        resetStore(store, onReset);
    }

    else if (originalState === CircuitBreakerState.Closed) {
        store.failures = 0;
    }

    return value;
}

/**
 * Circuit breaker that protects a function from failing too many times.
 *
 * Implements the Circuit Breaker design pattern to improve system resilience and fault tolerance
 * by preventing cascading failures in distributed systems. The circuit breaker monitors function
 * calls and automatically "trips" (opens) when failures exceed a threshold, preventing further
 * calls to the failing function until it has time to recover.
 *
 * The circuit breaker operates in three states:
 * - **Closed**: Normal operation, all calls pass through. Failures are counted.
 * - **Open**: Circuit is tripped, all calls fail immediately without invoking the function.
 * - **Half-Open**: After a timeout, allows limited test calls to check if the service has recovered.
 *
 * Key features:
 * - Configurable failure thresholds and recovery timeouts
 * - Concurrency control during half-open testing
 * - Selective error handling via `shouldTripOnError` predicate
 * - Comprehensive callback system for monitoring and alerting
 * - Thread-safe operation
 *
 * @param fn - Function to protect with circuit breaker
 * @param opts - Configuration options for the circuit breaker
 * @returns Protected function that implements circuit breaker logic
 *
 * @see {@link https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern Circuit Breaker Design Pattern}
 *
 * @example
 * ```typescript
 * const unstableService = () => {
 *     if (Math.random() > 0.7) throw new Error('Service failed');
 *     return 'Success';
 * };
 *
 * const protectedService = circuitBreakerSync(unstableService, {
 *     maxFailures: 3,        // Trip after 3 consecutive failures
 *     resetAfter: 5000,      // Test recovery after 5 seconds
 *     onTripped: (error) => console.log('Circuit breaker tripped:', error.message),
 *     onReset: () => console.log('Circuit breaker reset - service recovered')
 * });
 *
 * // Usage
 * try {
 *     const result = protectedService(); // May throw CircuitBreakerError if open
 *     console.log(result);
 * } catch (error) {
 *     if (error instanceof CircuitBreakerError) {
 *         console.log('Circuit breaker is open - service unavailable');
 *     } else {
 *         console.log('Service error:', error.message);
 *     }
 * }
 * ```
 */
export const circuitBreakerSync = <T extends AnyFunc>(
    fn: T,
    opts: CircuitBreakerOptions<T> = {}
) => {

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'circuitBreaker');
    validateOpts(opts);

    const store = new CircuitBreakerStore();

    const circuitBreakerSyncFunction = function(...args: Parameters<T>) {

        preAttempt({
            store,
            args,
            opts
        });

        const [value, error] = attemptSync(() => fn(...args));

        return postAttempt({
            value,
            error,
            store,
            args,
            opts
        });
    }

    markWrapped(circuitBreakerSyncFunction, 'circuitBreaker');

    return circuitBreakerSyncFunction;
}

/**
 * Async circuit breaker that protects a function from failing too many times.
 *
 * Implements the Circuit Breaker design pattern to improve system resilience and fault tolerance
 * by preventing cascading failures in distributed systems. The circuit breaker monitors async
 * function calls and automatically "trips" (opens) when failures exceed a threshold, preventing
 * further calls to the failing function until it has time to recover.
 *
 * The circuit breaker operates in three states:
 * - **Closed**: Normal operation, all calls pass through. Failures are counted.
 * - **Open**: Circuit is tripped, all calls fail immediately without invoking the function.
 * - **Half-Open**: After a timeout, allows limited test calls to check if the service has recovered.
 *
 * Key features:
 * - Configurable failure thresholds and recovery timeouts
 * - Concurrency control during half-open testing
 * - Selective error handling via `shouldTripOnError` predicate
 * - Comprehensive callback system for monitoring and alerting
 * - Thread-safe operation for async environments
 *
 * @param fn - Async function to protect with circuit breaker
 * @param opts - Configuration options for the circuit breaker
 * @returns Protected async function that implements circuit breaker logic
 *
 * @see {@link https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern Circuit Breaker Design Pattern}
 *
 * @example
 * ```typescript
 * const unstableApiCall = async (url: string) => {
 *     const response = await fetch(url);
 *     if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *     return response.json();
 * };
 *
 * const protectedApiCall = circuitBreaker(unstableApiCall, {
 *     maxFailures: 5,
 *     resetAfter: 10000,
 *     shouldTripOnError: (error) => {
 *         // Only trip on server errors, not client errors
 *         return error.message.includes('HTTP 5') || error.name === 'NetworkError';
 *     },
 *     onTripped: (error, store) => {
 *         console.log(`Circuit breaker tripped after ${store.failures} failures`);
 *     },
 *     onHalfOpen: () => console.log('Testing service recovery...'),
 *     onReset: () => console.log('Service recovered - circuit breaker reset')
 * });
 *
 * // Usage
 * try {
 *     const data = await protectedApiCall('/api/users');
 *     console.log('API response:', data);
 * } catch (error) {
 *     if (error instanceof CircuitBreakerError) {
 *         console.log('API temporarily unavailable - circuit breaker is open');
 *         // Implement fallback logic here
 *     } else {
 *         console.log('API error:', error.message);
 *     }
 * }
 * ```
 */
export const circuitBreaker = <T extends AnyFunc>(
    fn: T,
    opts: CircuitBreakerOptions<T> = {}
) => {

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'circuitBreaker');
    validateOpts(opts);

    const store = new CircuitBreakerStore();

    const circuitBreakerFunction = async function(...args: Parameters<T>) {

        preAttempt({
            store,
            args,
            opts
        });

        const [value, error] = await attempt(() => fn(...args));

        return postAttempt({
            value,
            error,
            store,
            args,
            opts
        });
    }

    markWrapped(circuitBreakerFunction, 'circuitBreaker');

    return circuitBreakerFunction;
}