import {
    describe,
    it,
    vi,
    expect
} from 'vitest'


import { mockHelpers } from '../../_helpers';

import {
    attempt,
    attemptSync,
    circuitBreaker,
    CircuitBreakerError,
    circuitBreakerSync,
    wait,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    const { calledExactly } = mockHelpers(expect);

    describe('flow-control: circuit breaker', () => {

        it('should implement a circuit breaker', async () => {

            const fn = vi.fn(() => {
                throw new Error('poop');
            });

            const onTripped = vi.fn();
            const onError = vi.fn();
            const onReset = vi.fn();
            const onHalfOpen = vi.fn();

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
            const fn = vi.fn(() => {
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
            const fn = vi.fn(() => {
                if (shouldFail) {
                    throw new Error('temporary failure');
                }
                return 'success';
            });

            const onReset = vi.fn();
            const onHalfOpen = vi.fn();

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
            const fn = vi.fn(() => {
                if (errorType === 'network') {
                    throw new NetworkError('Network timeout');
                } else {
                    throw new ValidationError('Invalid input');
                }
            });

            const onTripped = vi.fn();

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
                onTripped: vi.fn()
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
            const fn = vi.fn(() => {
                if (shouldFail) {
                    throw new Error('intermittent failure');
                }
                return 'success';
            });

            const onTripped = vi.fn();

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
            const fn = vi.fn(() => {
                throw new Error('sync failure');
            });

            const onTripped = vi.fn();

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
            const fn = vi.fn(() => {
                if (shouldSucceed) {
                    return 'success';
                }
                throw new Error('failing');
            });

            const onReset = vi.fn();
            const onHalfOpen = vi.fn();

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

        it('should validate circuitBreaker parameters', () => {

            const fn = vi.fn(() => 'ok');

            // fn must be a function
            expect(() => circuitBreaker('not a function' as any, {})).to.throw('fn must be a function');

            // maxFailures validation
            expect(() => circuitBreaker(fn, { maxFailures: 0 })).to.throw('maxFailures must be a positive number');
            expect(() => circuitBreaker(fn, { maxFailures: -1 })).to.throw('maxFailures must be a positive number');
            expect(() => circuitBreaker(fn, { maxFailures: 'not a number' as any })).to.throw('maxFailures must be a positive number');

            // halfOpenMaxAttempts validation
            expect(() => circuitBreaker(fn, { halfOpenMaxAttempts: 0 })).to.throw('halfOpenMaxAttempts must be a positive number');
            expect(() => circuitBreaker(fn, { halfOpenMaxAttempts: -1 })).to.throw('halfOpenMaxAttempts must be a positive number');

            // resetAfter validation
            expect(() => circuitBreaker(fn, { resetAfter: 0 })).to.throw('resetAfter must be a positive number');
            expect(() => circuitBreaker(fn, { resetAfter: -1000 })).to.throw('resetAfter must be a positive number');

            // Callback function validation
            expect(() => circuitBreaker(fn, { onTripped: 'not a function' as any })).to.throw('onTripped must be a function');
            expect(() => circuitBreaker(fn, { onError: 'not a function' as any })).to.throw('onError must be a function');
            expect(() => circuitBreaker(fn, { onReset: 'not a function' as any })).to.throw('onReset must be a function');
            expect(() => circuitBreaker(fn, { onHalfOpen: 'not a function' as any })).to.throw('onHalfOpen must be a function');
            expect(() => circuitBreaker(fn, { shouldTripOnError: 'not a function' as any })).to.throw('shouldTripOnError must be a function');
        });

        it('should validate circuitBreakerSync parameters', () => {

            const fn = vi.fn(() => 'ok');

            // fn must be a function
            expect(() => circuitBreakerSync('not a function' as any, {})).to.throw('fn must be a function');

            // maxFailures validation
            expect(() => circuitBreakerSync(fn, { maxFailures: 0 })).to.throw('maxFailures must be a positive number');
            expect(() => circuitBreakerSync(fn, { maxFailures: -1 })).to.throw('maxFailures must be a positive number');

            // Callback function validation
            expect(() => circuitBreakerSync(fn, { onTripped: 'not a function' as any })).to.throw('onTripped must be a function');
        });

        it('should work with default values', async () => {

            const fn = vi.fn(() => {
                throw new Error('test failure');
            });

            // Should work with minimal options (using defaults)
            const wrappedFn = circuitBreaker(fn, {});

            // Should use default maxFailures of 3
            await attempt(wrappedFn);
            await attempt(wrappedFn);

            // Third failure should trip using default maxFailures
            const [, error] = await attempt(wrappedFn);
            expect(error).to.be.an.instanceof(Error);
            expect((error as Error).message).to.equal('test failure');

            const [, circuitError] = await attempt(wrappedFn);
            expect(circuitError).to.be.an.instanceof(Error);
            expect((circuitError as Error).message).to.equal('Circuit breaker tripped');

            calledExactly(fn, 3, 'should use default maxFailures of 3');
        });

        it('should test CircuitBreakerError class', async () => {

            const fn = vi.fn(() => {
                throw new Error('service failure');
            });

            const wrappedFn = circuitBreaker(fn, { maxFailures: 1 });

            // Trip the circuit
            await attempt(wrappedFn);

            // Should throw CircuitBreakerError
            const [, circuitError] = await attempt(wrappedFn);

            expect(circuitError).to.be.an.instanceof(Error);
            expect((circuitError as Error).constructor.name).to.equal('CircuitBreakerError');
            expect((circuitError as Error).message).to.equal('Circuit breaker tripped');
        });

        it('should return nextAvailable date when circuit is open', async () => {

            const fn = vi.fn(() => {
                throw new Error('service failure');
            });

            const onTripped = vi.fn();

            const wrappedFn = circuitBreaker(fn, {
                maxFailures: 1,
                resetAfter: 100,
                onTripped
            });

            const now = Date.now();

            // Trip the circuit
            await attempt(wrappedFn);

            // Should throw CircuitBreakerError
            const [, circuitError] = await attempt(wrappedFn);

            expect(circuitError).to.be.an.instanceof(Error);
            expect((circuitError as Error).constructor.name).to.equal('CircuitBreakerError');
            expect((circuitError as Error).message).to.equal('Circuit breaker tripped');

            calledExactly(onTripped, 1, 'should call onTripped callback');

            const [err, store] = onTripped.mock.calls[0] || [];
            expect(err).to.be.an.instanceof(CircuitBreakerError);
            expect(store).to.be.an('object');
            expect(store.nextAvailable).to.be.a('number');
            expect(store.nextAvailable).to.be.greaterThan(now);
            expect(store.nextAvailable).to.be.lessThanOrEqual(now + 101);
        });

        it('should not double wrap the function', async () => {

            const fn1 = vi.fn(() => 'ok');
            const fn2 = vi.fn(() => 'ok');

            const wrappedFnAsync = circuitBreaker(fn1);
            const wrappedFnSync = circuitBreakerSync(fn2);

            const [, error1] = attemptSync(() => circuitBreakerSync(wrappedFnSync));
            const [, error2] = await attempt(() => circuitBreaker(wrappedFnAsync) as any);

            expect(error1).to.be.an.instanceof(Error);
            expect((error1 as Error).message).to.match(/Function is already wrapped/);
            expect(error2).to.be.an.instanceof(Error);
            expect((error2 as Error).message).to.match(/Function is already wrapped/);

        });
    })
});