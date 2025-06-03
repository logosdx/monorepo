import { attempt, attemptSync } from './attempt.ts';
import { AnyFunc } from './_helpers.ts';

const DEFAULT_MAX_FAILURES = 3;
const DEFAULT_RESET_AFTER = 1000;
const DEFAULT_HALF_OPEN_MAX_ATTEMPTS = 1;

enum CircuitBreakerState {
    Closed,
    Open,
    HalfOpen
}

type CircuitBreakerStore = {
    state: CircuitBreakerState,
    failures: number,
    halfOpenAttempts: number,
    trippedAt: number | null,
    testInProgress: boolean,
}

type CircuitBreakerOptions<T extends AnyFunc> = {
    maxFailures?: number,
    halfOpenMaxAttempts?: number,
    resetAfter?: number,
    onTripped?: (error: CircuitBreakerError, store: CircuitBreakerStore) => void
    onError?: (error: Error, args: Parameters<T>) => void
    onReset?: () => void
    onHalfOpen?: (store: CircuitBreakerStore) => void
    shouldTripOnError?: (error: Error) => boolean
}

export class CircuitBreakerError extends Error {
    constructor(message: string) {
        super(message);
    }
}

const resetStore = (
    store: CircuitBreakerStore,
    onReset?: () => void
) => {

    store.failures = 0;
    store.halfOpenAttempts = 0;
    store.trippedAt = null;
    store.testInProgress = false;
    store.state = CircuitBreakerState.Closed;

    onReset?.();
}

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
            maxFailures,
            resetAfter,
            halfOpenMaxAttempts = DEFAULT_HALF_OPEN_MAX_ATTEMPTS,
            onTripped,
            onHalfOpen,
            onReset,
            shouldTripOnError
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

            onTripped?.(circError, store);

            throw circError;
        }

        store.testInProgress = true;
    }
}

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
        opts: { onError, onReset, shouldTripOnError, onTripped, maxFailures }
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

                    const circError = new CircuitBreakerError('Circuit breaker tripped');
                    onTripped?.(circError, store);
                }
            }

            else if (store.state === CircuitBreakerState.HalfOpen) {
                store.state = CircuitBreakerState.Open;
                store.trippedAt = Date.now();

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
    opts: CircuitBreakerOptions<T>
) => {

    const store: CircuitBreakerStore = {
        failures: 0,
        halfOpenAttempts: 0,
        trippedAt: null,
        testInProgress: false,
        state: CircuitBreakerState.Closed
    }


    return function (...args: Parameters<T>) {

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
    opts: CircuitBreakerOptions<T>
) => {

    const store: CircuitBreakerStore = {
        failures: 0,
        halfOpenAttempts: 0,
        trippedAt: null,
        testInProgress: false,
        state: CircuitBreakerState.Closed
    }

    return async function (...args: Parameters<T>) {

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
}