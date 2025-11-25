import {
    describe,
    it,
    mock,
} from 'node:test'

import { expect } from 'chai';

import { mockHelpers } from '../../_helpers';

import {
    composeFlow,
    attempt,
    wait,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    const { calledExactly } = mockHelpers(expect);

    describe('flow-control: composeFlow', () => {

        it('should compose multiple flow control functions with retry and timeout', async () => {

            let i = 0;

            const shouldRetry = mock.fn(() => true);
            const onError = mock.fn(() => { });

            const originalFn = mock.fn(async (x: number) => {

                i++;

                // First call succeeds, second call fails on first attempt but succeeds on retry
                if (i === 2) {
                    throw new Error('test');
                }

                await wait(5);
                return x * 2;
            });

            const composedFn = composeFlow(originalFn, {
                retry: { retries: 2, shouldRetry, delay: 5 },
                withTimeout: { timeout: 100, onError }
            });

            const results = await Promise.all([
                composedFn(5),   // i=1, succeeds immediately
                composedFn(10)   // i=2 fails, i=3 succeeds on retry
            ]);

            expect(results).to.deep.equal([10, 20]); // 5*2, 10*2

            // Should be called 3 times total (1 for first call, 2 for second call with retry)
            calledExactly(originalFn, 3, 'should call original function 3 times');
            calledExactly(shouldRetry, 1, 'should retry once');
        });

        it('should apply flow controls in order of options object keys', async () => {

            let i = 0;
            const shouldRetry = mock.fn(() => true);
            const onError = mock.fn(() => { });

            const originalFn = mock.fn(async (x: number) => {

                i++;

                // Second call fails on first attempt, succeeds on retry
                if (i === 2) {
                    throw new Error('test');
                }

                await wait(20);
                return x + 1;
            });

            // Order: withTimeout -> retry
            const composedFn = composeFlow(originalFn, {
                withTimeout: { timeout: 15, throws: true, onError },
                retry: { retries: 2, delay: 10, shouldRetry } // 2 total attempts
            });

            const [results] = await attempt(
                () => Promise.all([
                    composedFn(5),
                    composedFn(10)
                ])
            );

            expect(results).to.equal(null);

            // First call: i=1 succeeds
            // Second call: i=2 fails, i=3 fails, i=4 succeeds on retry
            calledExactly(originalFn, 4, 'should call original function 4 times');
            calledExactly(shouldRetry, 3, 'should retry 3 times');
            calledExactly(onError, 3, 'should call onError 3 times');
        });

        it('should validate options is an object', () => {

            const fn = async () => 'test';

            expect(() => composeFlow(fn, null as any)).to.throw('Options must be an object');
            expect(() => composeFlow(fn, undefined as any)).to.throw('Options must be an object');
            expect(() => composeFlow(fn, 'not an object' as any)).to.throw('Options must be an object');
            expect(() => composeFlow(fn, 123 as any)).to.throw('Options must be an object');
        });

        it('should validate options has at least two keys', () => {

            const fn = async () => 'test';

            expect(() => composeFlow(fn, {})).to.throw('Options must have at least two keys');
            expect(() => composeFlow(fn, { rateLimit: { maxCalls: 1, windowMs: 1000 } })).to.throw('Options must have at least two keys');
        });

        it('should validate all keys are valid flow functions', () => {

            const fn = async () => 'test';

            expect(() => composeFlow(fn, {
                rateLimit: { maxCalls: 1, windowMs: 1000 },
                invalidKey: { some: 'option' }
            } as any)).to.throw('invalidKey is not a flow function');

            expect(() => composeFlow(fn, {
                rateLimit: { maxCalls: 1, windowMs: 1000 },
                retry: { retries: 1 },
                unknownFunction: { option: 'value' }
            } as any)).to.throw('unknownFunction is not a flow function');
        });

        it('should work with all valid flow control functions', async () => {

            const originalFn = mock.fn(async (x: number) => {

                await wait(5);
                return x * 3;
            });

            const composedFn = composeFlow(originalFn, {
                rateLimit: { maxCalls: 2, windowMs: 1000 },
                withTimeout: { timeout: 50 }
            });

            // Should work normally
            const result = await composedFn(5);
            expect(result).to.equal(15); // 5 * 3
            calledExactly(originalFn, 1, 'should call original function');
        });

        it('should handle rate limiting in composition', async () => {

            const originalFn = mock.fn(async (x: number) => {

                await wait(5);
                return x + 10;
            });

            const composedFn = composeFlow(originalFn, {
                rateLimit: { maxCalls: 2, windowMs: 100 },
                withTimeout: { timeout: 50, throws: true }
            });

            // First two calls should succeed
            const result1 = await composedFn(1);
            const result2 = await composedFn(2);

            expect(result1).to.equal(11); // 1 + 10
            expect(result2).to.equal(12); // 2 + 10
            calledExactly(originalFn, 2, 'should call original function twice');

            // Third call should be rate limited
            const [, error] = await attempt(() => composedFn(3));
            expect((error as Error).message).to.include('Rate limit exceeded');

            calledExactly(originalFn, 2, 'should not call original function due to rate limit');
        });

        it('should handle circuit breaker in composition', async () => {

            const originalFn = mock.fn(async (_x: number) => {

                await wait(5);
                throw new Error('Service error');
            });

            const composedFn = composeFlow(originalFn, {

                circuitBreaker: { maxFailures: 2, resetAfter: 50 },
                withTimeout: { timeout: 50, throws: true }
            });

            // First two failures should go through
            const [, error1] = await attempt(() => composedFn(1));

            expect((error1 as Error).message).to.equal('Service error');

            const [, error2] = await attempt(() => composedFn(2));
            expect((error2 as Error).message).to.equal('Service error');

            calledExactly(originalFn, 2, 'should call original function twice');

            // Third call should trip circuit breaker
            const [, error3] = await attempt(() => composedFn(3));
            expect((error3 as Error).message).to.equal('Circuit breaker tripped');

            calledExactly(originalFn, 2, 'should not call original function due to circuit breaker');
        });

        it('should handle timeout in composition', async () => {

            const originalFn = mock.fn(async (x: number) => {

                await wait(100); // Longer than timeout
                return x * 2;
            });

            const composedFn = composeFlow(originalFn, {
                withTimeout: { timeout: 50 },
                rateLimit: { maxCalls: 5, windowMs: 1000 }
            });

            const [, error] = await attempt(() => composedFn(5));
            expect((error as Error).message).to.equal('Function timed out');

            calledExactly(originalFn, 1, 'should call original function once before timeout');
        });

        it('should preserve function signature and return type', async () => {

            const originalFn = async (x: number, y: string): Promise<string> => {

                await wait(5);
                return `${x}-${y}`;
            };

            const composedFn = composeFlow(originalFn, {
                retry: { retries: 1 },
                withTimeout: { timeout: 100 }
            });

            // TypeScript should infer the correct signature
            const result = await composedFn(5, 'test');

            expect(result).to.equal('5-test');
        });

        it('should handle retry with circuit breaker', async () => {

            let callCount = 0;

            const originalFn = mock.fn(async (_x: number) => {

                callCount++;

                // Always throw to test max retries behavior
                throw new Error('Service temporarily down');
            });

            const composedFn = composeFlow(originalFn, {
                retry: { retries: 2, delay: 10 }, // 2 total attempts each call
                circuitBreaker: { maxFailures: 3, resetAfter: 100 }
            });

            // First call should exhaust retries and throw "Max retries reached"
            const [, error1] = await attempt(() => composedFn(5));
            expect((error1 as Error).message).to.equal('Max retries reached');

            // Second call should also exhaust retries
            const [, error2] = await attempt(() => composedFn(5));
            expect((error2 as Error).message).to.equal('Max retries reached');

            // Should have called original function 4 times total (2 calls × 2 attempts each)
            calledExactly(originalFn, 4, 'should call original function 4 times (2 calls with 2 attempts each)');
        });

        it('should work with all four flow controls together', async () => {

            const originalFn = mock.fn(async (x: number) => {

                await wait(5);
                return x + 100;
            });

            const composedFn = composeFlow(originalFn, {
                rateLimit: { maxCalls: 3, windowMs: 1000 },
                circuitBreaker: { maxFailures: 5, resetAfter: 100 },
                retry: { retries: 1 },
                withTimeout: { timeout: 50 }
            });

            // Should work normally
            const result1 = await composedFn(10);
            const result2 = await composedFn(20);

            expect(result1).to.equal(110); // 10 + 100
            expect(result2).to.equal(120); // 20 + 100

            calledExactly(originalFn, 2, 'should call original function twice');
        });

        it('should simulate resilientFetch with all production options', async () => {

            let callCount = 0;
            let flakyCount = 0;

            // Mock fetch-like function that simulates real network behavior
            const mockFetch = mock.fn(async (url: string) => {

                callCount++;

                // Simulate different failure modes based on URL
                if (url.includes('/slow-endpoint')) {
                    await wait(100); // Longer than timeout (50ms)
                    return { ok: true, json: async () => ({ data: 'slow' }) };
                }

                if (url.includes('/flaky-endpoint')) {
                    flakyCount++;
                    // Fail first 2 attempts, succeed on 3rd (within retry limit)
                    if (flakyCount <= 2) {
                        throw new Error('Network timeout');
                    }
                    return { ok: true, json: async () => ({ data: 'flaky-success' }) };
                }

                if (url.includes('/broken-endpoint')) {
                    throw new Error('Service unavailable');
                }

                // Normal successful response
                await wait(10); // Reduced wait time
                return { ok: true, json: async () => ({ data: 'success' }) };
            });

            // Create resilientFetch with production-like settings
            const resilientFetch = composeFlow(mockFetch, {
                withTimeout: { timeout: 50, throws: true },
                retry: { retries: 3, delay: 10, backoff: 2 }, // Reduced delay for testing
                circuitBreaker: { maxFailures: 5, resetAfter: 300 },
                rateLimit: { maxCalls: 100, windowMs: 600 }
            });

            // Test 1: Normal successful request
            const successResult = await resilientFetch('/api/users');
            expect(successResult.ok).to.be.true;

            const successData = await successResult.json();
            expect(successData).to.deep.equal({ data: 'success' });

            // Test 2: Flaky endpoint that succeeds after retries
            flakyCount = 0; // Reset counter

            const flakyResult = await resilientFetch('/api/flaky-endpoint');
            expect(flakyResult.ok).to.be.true;

            const flakyData = await flakyResult.json();
            expect(flakyData).to.deep.equal({ data: 'flaky-success' });

            // Should have been called 3 times (initial + 2 retries)
            expect(flakyCount).to.equal(3);

            // Test 3: Timeout behavior
            const [, error1] = await attempt(() => resilientFetch('/api/slow-endpoint'));
            expect(['Function timed out', 'Max retries reached']).to.include((error1 as Error).message);

            // Test 4: Circuit breaker behavior with broken endpoint
            // Make failed calls to trip the circuit breaker
            for (let i = 0; i < 6; i++) {

                const [, error2] = await attempt(() => resilientFetch('/api/broken-endpoint'));

                if ((error2 as Error).message === 'Circuit breaker tripped') {
                    break;
                }

                // Should be either "Max retries reached" or original error
                expect(['Max retries reached', 'Service unavailable']).to.include((error2 as Error).message);
            }

            // Test 5: Rate limiting behavior with a separate instance
            const rateLimitedFetch = composeFlow(mockFetch, {
                withTimeout: { timeout: 50, throws: true },
                retry: { retries: 1, delay: 10 },
                circuitBreaker: { maxFailures: 10, resetAfter: 300 },
                rateLimit: { maxCalls: 2, windowMs: 600 } // Very low limit for testing
            });

            // Make 2 successful calls (at rate limit)
            await rateLimitedFetch('/api/users');
            await rateLimitedFetch('/api/users');

            // 3rd call should be rate limited
            const [, error3] = await attempt(() => rateLimitedFetch('/api/users'));
            expect((error3 as Error).message).to.include('Rate limit exceeded');

            // Verify the original function was called the expected number of times
            expect(mockFetch.mock.calls.length).to.be.greaterThan(5);
        });

        it('should handle realistic API failure scenarios with resilientFetch', async () => {

            let orderCallCount = 0;
            let paymentCallCount = 0;

            const mockApiCall = mock.fn(async (endpoint: string) => {

                // Simulate realistic API patterns with separate counters
                if (endpoint === '/api/orders/123') {

                    orderCallCount++;

                    if (orderCallCount <= 2) {

                        // Fail first 2 calls, succeed on 3rd (retry will handle this)
                        const errors = ['Service temporarily unavailable', 'Network timeout'];
                        throw new Error(errors[orderCallCount - 1] || 'Unknown error');
                    }

                    return { id: '123', total: 99.99, status: 'confirmed' };
                }

                if (endpoint === '/api/payment/process') {

                    paymentCallCount++;

                    // Consistently fail to test circuit breaker
                    throw new Error('Payment service down');
                }

                // Default success
                return { success: true };
            });

            const resilientAPI = composeFlow(mockApiCall, {
                withTimeout: { timeout: 50, throws: true },
                retry: {
                    retries: 3,
                    delay: 10,
                    backoff: 1,
                    shouldRetry: (error) => error.message.includes('temporarily') || error.message.includes('timeout')
                },
                circuitBreaker: {
                    maxFailures: 3,
                    resetAfter: 300,
                    shouldTripOnError: (error) => error.message.includes('service down') || error.message.includes('Service down')
                },
                rateLimit: { maxCalls: 50, windowMs: 600 }
            });

            // Test successful order processing after retries
            orderCallCount = 0;

            const orderResult = await resilientAPI('/api/orders/123');

            expect(orderResult).to.deep.equal({ id: '123', total: 99.99, status: 'confirmed' });
            expect(orderCallCount).to.equal(3); // Failed twice, succeeded on 3rd attempt

            // Test circuit breaker with payment service
            paymentCallCount = 0;
            let circuitTripped = false;

            // Make enough failed calls to trip circuit breaker
            for (let i = 0; i < 5; i++) {

                const [, error] = await attempt(() => resilientAPI('/api/payment/process'));

                if ((error as Error).message === 'Circuit breaker tripped') {

                    circuitTripped = true;
                    break;
                }

                // Should be "Max retries reached" since shouldRetry returns false for payment errors
                expect((error as Error).message).to.equal('Payment service down');
            }

            // Circuit breaker should have been triggered
            if (!circuitTripped) {

                // Try one more call to see if circuit breaker kicks in
                const [, error] = await attempt(() => resilientAPI('/api/payment/process'));
                expect((error as Error).message).to.equal('Circuit breaker tripped');
            }

            expect(mockApiCall.mock.calls.length).to.be.greaterThan(3);
        });

        it('should deduplicate in-flight requests with inflight option', async () => {

            let callCount = 0;

            const fetchData = mock.fn(async (id: string) => {

                callCount++;
                await wait(20);
                return `data-${id}-${callCount}`;
            });

            const deduped = composeFlow(fetchData, {
                inflight: {},
                withTimeout: { timeout: 100 }
            });

            // Three concurrent calls with same argument
            const [r1, r2, r3] = await Promise.all([
                deduped('42'),
                deduped('42'),
                deduped('42')
            ]);

            expect(r1).to.equal('data-42-1');
            expect(r2).to.equal('data-42-1');
            expect(r3).to.equal('data-42-1');

            calledExactly(fetchData, 1, 'inflight: should call function once for concurrent requests');

            // After settlement, new call should execute
            await wait(30);
            const r4 = await deduped('42');
            expect(r4).to.equal('data-42-2');
            calledExactly(fetchData, 2, 'inflight: new call after settlement');
        });

        it('should combine inflight with retry for resilient deduplication', async () => {

            let callCount = 0;

            const flakyFetch = mock.fn(async (id: string) => {

                callCount++;

                // Fail first attempt, succeed on retry
                if (callCount === 1) {

                    throw new Error('temporary error');
                }

                await wait(10);
                return `data-${id}`;
            });

            const resilient = composeFlow(flakyFetch, {
                inflight: {},
                retry: { retries: 2, delay: 5 }
            });

            // Multiple concurrent calls - should share the retry logic
            const [r1, r2] = await Promise.all([
                resilient('test'),
                resilient('test')
            ]);

            expect(r1).to.equal('data-test');
            expect(r2).to.equal('data-test');

            // Should only execute twice: first fails, second succeeds (all callers share)
            calledExactly(flakyFetch, 2, 'inflight+retry: shared retry across concurrent calls');
        });

        it('should use custom generateKey with inflight in compose', async () => {

            const fetchWithOpts = mock.fn(async (id: string, _opts: { timestamp: number }) => {

                await wait(10);
                return `data-${id}`;
            });

            // Dedupe only by id, ignore opts
            const deduped = composeFlow(fetchWithOpts, {
                inflight: {
                    generateKey: (id: string) => id
                },
                withTimeout: { timeout: 50 }
            });

            // Different opts but same id - should dedupe
            const [r1, r2] = await Promise.all([
                deduped('123', { timestamp: 1000 }),
                deduped('123', { timestamp: 2000 })
            ]);

            expect(r1).to.equal('data-123');
            expect(r2).to.equal('data-123');
            calledExactly(fetchWithOpts, 1, 'custom generateKey: deduped despite different opts');
        });

        it('should handle inflight with circuit breaker', async () => {

            const failingFn = mock.fn(async (id: string) => {

                await wait(10);
                throw new Error(`service unavailable for ${id}`);
            });

            const composed = composeFlow(failingFn, {
                inflight: {},
                circuitBreaker: { maxFailures: 5, resetAfter: 200 }
            });

            // Test that inflight deduplication works
            const results1 = await Promise.allSettled([
                composed('test1'),
                composed('test1'),
                composed('test1')
            ]);

            // All should fail
            expect(results1.every(r => r.status === 'rejected')).to.be.true;

            // Inflight should have deduped the three concurrent calls into one
            calledExactly(failingFn, 1, 'inflight deduped three concurrent calls');

            // Verify circuit breaker also tracks failures across different keys
            // Make several more failing calls to trip the breaker
            await wait(20);
            await Promise.allSettled([composed('test2')]);
            await wait(20);
            await Promise.allSettled([composed('test3')]);
            await wait(20);
            await Promise.allSettled([composed('test4')]);
            await wait(20);
            await Promise.allSettled([composed('test5')]);

            // Now circuit should be tripped
            await wait(20);
            const [, error] = await attempt(() => composed('test6'));
            expect((error as Error).message).to.equal('Circuit breaker tripped');

            // Verify both mechanisms can work together
            expect(failingFn.mock.calls.length).to.be.greaterThan(1);
            expect(failingFn.mock.calls.length).to.be.lessThan(10); // Deduplication reduced total calls
        });

        it('should compose all flow controls including inflight', async () => {

            let callCount = 0;

            const complexFn = mock.fn(async (id: string) => {

                callCount++;
                await wait(15);
                return `result-${id}-${callCount}`;
            });

            const fullyComposed = composeFlow(complexFn, {
                inflight: {},
                rateLimit: { maxCalls: 10, windowMs: 1000 },
                retry: { retries: 1, delay: 5 },
                withTimeout: { timeout: 100 },
                circuitBreaker: { maxFailures: 5, resetAfter: 500 }
            });

            // Concurrent calls should be deduped
            const [r1, r2, r3] = await Promise.all([
                fullyComposed('test'),
                fullyComposed('test'),
                fullyComposed('test')
            ]);

            expect(r1).to.equal('result-test-1');
            expect(r2).to.equal('result-test-1');
            expect(r3).to.equal('result-test-1');

            calledExactly(complexFn, 1, 'all controls applied: one call for concurrent requests');
        });
    });
});