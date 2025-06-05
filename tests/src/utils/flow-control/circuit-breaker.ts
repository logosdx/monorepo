import {
    describe,
    it,
    before,
    after,
    mock,
    Mock
} from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import { mockHelpers } from '../../_helpers';

import {
    attempt,
    attemptSync,
    debounce,
    throttle,
    retry,
    batch,
    circuitBreaker,
    circuitBreakerSync,
    wait,
    memoizeSync,
    memoize,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    const { calledExactly } = mockHelpers(expect);

    describe('flow-control: circuit breaker', () => {

        it('should implement a circuit breaker', async () => {

            const fn = mock.fn(() => {
                throw new Error('poop');
            });

            const onTripped = mock.fn();
            const onError = mock.fn();
            const onReset = mock.fn();
            const onHalfOpen = mock.fn();

            const wrappedFn = circuitBreaker(fn, {
                maxFailures: 3,
                resetAfter: 50,
                onTripped,
                onError,
                onReset,
                onHalfOpen
            });

            // Test closed state - failures should increment
            await attempt(wrappedFn);
            calledExactly(fn, 1, 'circuit breaker fn 1');
            calledExactly(onError, 1, 'circuit breaker onError 1');
            calledExactly(onTripped, 0, 'circuit breaker onTripped 1');

            await attempt(wrappedFn);
            calledExactly(fn, 2, 'circuit breaker fn 2');
            calledExactly(onError, 2, 'circuit breaker onError 2');
            calledExactly(onTripped, 0, 'circuit breaker onTripped 2');

            // Third failure should trip the circuit
            await attempt(wrappedFn);
            calledExactly(fn, 3, 'circuit breaker fn 3');
            calledExactly(onError, 3, 'circuit breaker onError 3');
            calledExactly(onTripped, 1, 'circuit breaker onTripped 3');

            // Circuit should now be open - calls should fail immediately
            const [, error4] = await attempt(wrappedFn);
            expect(error4?.message).to.equal('Circuit breaker tripped');
            calledExactly(fn, 3, 'circuit breaker fn 4 - should not be called');
            calledExactly(onError, 3, 'circuit breaker onError 4 - should not increment');

            // Wait for reset timeout, then make a call to trigger half-open transition
            await wait(60);

            // This call should trigger the transition to half-open and then go through
            await attempt(wrappedFn);
            calledExactly(onHalfOpen, 1, 'circuit breaker onHalfOpen');
            calledExactly(fn, 4, 'circuit breaker fn 5 - half-open test');
            calledExactly(onError, 4, 'circuit breaker onError 5');

            // Should trip back to open after failure in half-open
            const [, error6] = await attempt(wrappedFn);
            expect(error6?.message).to.equal('Circuit breaker tripped');
            calledExactly(fn, 4, 'circuit breaker fn 6 - should not be called');
        });

        it('should test circuit breaker concurrency control in half-open state', async () => {
            const fn = mock.fn(() => {
                throw new Error('service down');
            });

            const wrappedFn = circuitBreaker(fn, {
                maxFailures: 2,
                resetAfter: 50,
                halfOpenMaxAttempts: 1
            });

            // Trip the circuit
            await attempt(wrappedFn);
            await attempt(wrappedFn);
            calledExactly(fn, 2, 'initial failures to trip circuit');

            // Wait for half-open transition
            await wait(60);

            // Make concurrent calls - only one should get through to test
            const promises = Array.from({ length: 5 }, () => attempt(wrappedFn));
            await Promise.all(promises);

            // Only one call should have gone through to the actual function
            calledExactly(fn, 3, 'only one call should reach fn in half-open');

            // The other 4 should have failed with circuit breaker error
            const results = await Promise.all(promises);
            const circuitBreakerErrors = results.filter(([, error]) =>
                error?.message === 'Circuit breaker tripped'
            );
            expect(circuitBreakerErrors.length).to.be.at.least(4);
        });

        it('should test circuit breaker success case and reset', async () => {
            let shouldFail = true;
            const fn = mock.fn(() => {
                if (shouldFail) {
                    throw new Error('temporary failure');
                }
                return 'success';
            });

            const onReset = mock.fn();
            const onHalfOpen = mock.fn();

            const wrappedFn = circuitBreaker(fn, {
                maxFailures: 2,
                resetAfter: 50,
                onReset,
                onHalfOpen
            });

            // Trip the circuit
            await attempt(wrappedFn);
            await attempt(wrappedFn);
            calledExactly(fn, 2, 'trip the circuit');

            // Wait for timeout, then make a call to trigger half-open
            await wait(60);

            // Service recovers
            shouldFail = false;

            // This call should trigger half-open transition and succeed
            const [result] = await attempt(wrappedFn);
            calledExactly(onHalfOpen, 1, 'should enter half-open');
            expect(result).to.equal('success');
            calledExactly(onReset, 1, 'should reset after success');

            // Subsequent calls should work normally
            const [result2] = await attempt(wrappedFn);
            expect(result2).to.equal('success');
            calledExactly(fn, 4, 'should work normally after reset');
        });

        it('should test circuit breaker error classification', async () => {
            class NetworkError extends Error {
                constructor(message: string) {
                    super(message);
                    this.name = 'NetworkError';
                }
            }

            class ValidationError extends Error {
                constructor(message: string) {
                    super(message);
                    this.name = 'ValidationError';
                }
            }

            let errorType: 'network' | 'validation' = 'network';
            const fn = mock.fn(() => {
                if (errorType === 'network') {
                    throw new NetworkError('Network timeout');
                } else {
                    throw new ValidationError('Invalid input');
                }
            });

            const onTripped = mock.fn();

            const wrappedFn = circuitBreaker(fn, {
                maxFailures: 2,
                shouldTripOnError: (error) => {
                    // Only trip on network errors, not validation errors
                    return error.name === 'NetworkError';
                },
                onTripped
            });

            // Network errors should contribute to tripping
            await attempt(wrappedFn);
            await attempt(wrappedFn);
            calledExactly(onTripped, 1, 'should trip on network errors');

            // Reset for next test
            errorType = 'validation';

            // Create a new circuit breaker for validation error test
            const wrappedFn2 = circuitBreaker(fn, {
                maxFailures: 2,
                shouldTripOnError: (error) => error.name === 'NetworkError',
                onTripped: mock.fn()
            });

            // Validation errors should NOT trip the circuit
            await attempt(wrappedFn2);
            await attempt(wrappedFn2);
            await attempt(wrappedFn2);
            await attempt(wrappedFn2);

            calledExactly(fn, 6, 'validation errors should not prevent calls');
        });

        it('should test circuit breaker with successful calls resetting failure count', async () => {
            let shouldFail = true;
            const fn = mock.fn(() => {
                if (shouldFail) {
                    throw new Error('intermittent failure');
                }
                return 'success';
            });

            const onTripped = mock.fn();

            const wrappedFn = circuitBreaker(fn, {
                maxFailures: 3,
                onTripped
            });

            // Two failures
            await attempt(wrappedFn);
            await attempt(wrappedFn);

            // Success should reset failure count
            shouldFail = false;
            const [result] = await attempt(wrappedFn);
            expect(result).to.equal('success');

            // Two more failures shouldn't trip (count was reset)
            shouldFail = true;
            await attempt(wrappedFn);
            await attempt(wrappedFn);
            calledExactly(onTripped, 0, 'should not trip after success reset');

            // Third failure should trip
            await attempt(wrappedFn);
            calledExactly(onTripped, 1, 'should trip after third consecutive failure');
        });

        it('should test circuit breaker sync version', () => {
            const fn = mock.fn(() => {
                throw new Error('sync failure');
            });

            const onTripped = mock.fn();

            const wrappedFn = circuitBreakerSync(fn, {
                maxFailures: 2,
                onTripped
            });

            // Trip the circuit
            attemptSync(wrappedFn);
            attemptSync(wrappedFn);
            calledExactly(onTripped, 1, 'sync circuit should trip');

            // Circuit should be open
            const [, error] = attemptSync(wrappedFn);
            expect(error?.message).to.equal('Circuit breaker tripped');
            calledExactly(fn, 2, 'sync circuit should not call fn when open');
        });

        it('should test half-open max attempts configuration', async () => {
            let shouldSucceed = false;
            const fn = mock.fn(() => {
                if (shouldSucceed) {
                    return 'success';
                }
                throw new Error('failing');
            });

            const onReset = mock.fn();
            const onHalfOpen = mock.fn();

            const wrappedFn = circuitBreaker(fn, {
                maxFailures: 2,
                resetAfter: 50,
                halfOpenMaxAttempts: 1,
                onReset,
                onHalfOpen
            });

            // Trip the circuit
            await attempt(wrappedFn);
            await attempt(wrappedFn);
            calledExactly(fn, 2, 'should trip after 2 failures');

            // Wait for timeout
            await wait(60);

            // Set function to succeed and make call to trigger half-open
            shouldSucceed = true;
            const [result] = await attempt(wrappedFn);

            calledExactly(onHalfOpen, 1, 'should trigger half-open transition');
            expect(result).to.equal('success');
            calledExactly(fn, 3, 'should allow the test call in half-open');
            calledExactly(onReset, 1, 'should reset after successful half-open test');
        });
    })
});