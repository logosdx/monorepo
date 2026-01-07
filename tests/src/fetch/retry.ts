import {
    describe,
    it,
    expect,
    vi
} from 'vitest'


import {
    FetchError,
    FetchEngine,
} from '../../../packages/fetch/src/index.ts';

import { attempt } from '../../../packages/utils/src/index.ts';
import { sandbox } from '../_helpers.ts';
import { makeTestStubs } from './_helpers.ts';

describe('@logosdx/fetch: retry', async () => {

    const { testUrl, resetFlaky } = await makeTestStubs(4124);

    it('retries a configured number of requests', async () => {

        const onError = sandbox.stub();

        const api = new FetchEngine({
            baseUrl: testUrl + 1,
            retry: {
                maxAttempts: 2,
                baseDelay: 10
            },
        });

        await attempt(() => api.get('/', { onError }))

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(2);

        const [[c1], [c2]] = onError.args as [[FetchError], [FetchError], [FetchError]];

        expect(c1.status).to.eq(499);
        expect(c2.status).to.eq(499);

        expect(c1.attempt).to.eq(1);
        expect(c2.attempt).to.eq(2);

        // Helper method tests - connection lost (server not reachable)
        expect(c1.isConnectionLost()).to.be.true;
        expect(c1.isCancelled()).to.be.false;
        expect(c1.isTimeout()).to.be.false;
    });

    const calculateDelay = (
        baseDelay: number,
        attempts: number,
    ) => {

        return Array.from(
            { length: attempts },
            (_, i) => baseDelay * Math.pow(2, i)
        )
        .reduce((a, b) => a + b, 0);
    }

    it('retries requests with exponential backoff', async () => {

        const baseDelay = 10;

        const api = new FetchEngine({
            baseUrl: testUrl + 1,
            retry: {
                maxAttempts: 3,
                baseDelay,
                useExponentialBackoff: true,
            },
        });

        const start = Date.now();

        await attempt(() => api.get('/'))

        const end = Date.now();

        // With maxAttempts: 3, we have 3 attempts and 2 delays (between attempts)
        // Delays: baseDelay * 2^0 + baseDelay * 2^1 = 10 + 20 = 30ms
        const calc = calculateDelay(baseDelay, 2);

        expect(end - start).to.be.greaterThan(calc);
    });

    it('retries requests with exponential backoff and max delay', async () => {

        const baseDelay = 10;

        const api = new FetchEngine({
            baseUrl: testUrl + 1,
            retry: {
                maxAttempts: 5,
                baseDelay,
                useExponentialBackoff: true,
                maxDelay: 30,
            },
        });

        const start = Date.now();

        await attempt(() => api.get('/'))

        const end = Date.now();

        const calc = calculateDelay(baseDelay, 5);

        expect(end - start).to.be.lessThan(calc);
    });

    it('retries without exponential backoff', async () => {

        const baseDelay = 10;

        const api = new FetchEngine({
            baseUrl: testUrl + 1,
            retry: {
                maxAttempts: 3,
                baseDelay,
                useExponentialBackoff: false,
            },
        });

        const start = Date.now();

        await attempt(() => api.get('/'))

        const end = Date.now();

        const calc = (baseDelay * 3) + 15; // Give some buffer

        expect(end - start).to.be.lessThan(calc);
    });

    it('retries on specific status codes', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: {
                maxAttempts: 3,
                baseDelay: 10,
                useExponentialBackoff: false,
                retryableStatusCodes: [400],
            },
        });

        const onError = sandbox.stub();

        api.on('fetch-error', onError);

        await attempt(() => api.get('/validate?name=&age=17'))

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(3);
    })

    it('retries with custom shouldRetry', async () => {

        const onError = sandbox.stub();
        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: {
                maxAttempts: 3,
                baseDelay: 10,
                useExponentialBackoff: false,
                shouldRetry: (error) => error.status === 400,
            },
        });

        api.on('fetch-error', onError);

        // First request fails with 400 (validation error) - should retry 3 times
        await attempt(() => api.get('/validate?name=&age=17'))

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(3);

        // Reset the flaky endpoint state for this test
        resetFlaky();

        // Second request uses /flaky which fails with 503 - should NOT retry (not 400)
        // Skip first call to make it fail
        await attempt(() => api.get('/flaky'));
        await attempt(() => api.get('/flaky'));

        // Should have one more error event (503 is not retried)
        expect(onError.callCount).to.eq(4);
    });

    it('retries with custom shouldRetry that returns a number', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: {
                maxAttempts: 3,
                baseDelay: 10,
                useExponentialBackoff: false,
                shouldRetry: (error) => {

                    if (error.status === 400) {

                        return 50;
                    }

                    return false;
                },
            },
        });

        const onError = sandbox.stub();

        api.on('fetch-error', onError);

        const start = Date.now();

        await attempt(() => api.get('/validate?name=&age=17'))

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(3);

        const end = Date.now();

        // With maxAttempts: 3, we have 3 attempts and 2 delays (50ms each)
        expect(end - start).to.be.greaterThan(99);
    });

    it('throws the actual error after exhausting retries when shouldRetry always returns true', async () => {

        const shouldRetrySpy = vi.fn().mockReturnValue(true);

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: {
                maxAttempts: 3,
                baseDelay: 10,
                shouldRetry: shouldRetrySpy,
            },
        });

        const [, err] = await attempt(() => api.get('/validate?name=&age=17'));

        // Should throw the actual validation error, not "Unexpected end of retry logic"
        expect(err).to.be.instanceOf(FetchError);
        expect((err as FetchError).message).to.not.include('Unexpected end of retry logic');
        expect((err as FetchError).status).to.eq(400);
        expect(shouldRetrySpy).toHaveBeenCalledTimes(3);
    });

    it('can configure a retry per request', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: {
                maxAttempts: 5,
                baseDelay: 20,
                useExponentialBackoff: true,
            },
        });

        const onError = sandbox.stub();

        const reqConfig: FetchEngine.CallOptions = {
            retry: {
                maxAttempts: 2,
                baseDelay: 10,
                useExponentialBackoff: false,
                retryableStatusCodes: [400],
            },
            onError,
        }

        const start = Date.now();

        await attempt(() => api.get('/validate?name=&age=17', reqConfig))

        const end = Date.now();

        const calc = (10 * 2) + 20; // Give some buffer

        expect(end - start).to.be.lessThan(calc);

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(2);

        await attempt(() => api.get('/validate?name=&age=17', { onError }))

        expect(onError.callCount).to.eq(3);
    });

    it('configures default retry', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: true
        });

        const onError = sandbox.stub();

        api.on('fetch-error', onError);

        await attempt(() => api.get('/rate-limit'))

        expect(onError.called).to.be.true;
        expect(onError.callCount).to.eq(3);
    });

    describe('retry with deduplication', () => {

        it('should work with deduplication and retry', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                    retryableStatusCodes: [503]
                },
                dedupePolicy: { enabled: true, methods: ['GET'] }
            });

            const events: string[] = [];
            api.on('fetch-dedupe-start', () => events.push('dedupe-start'));
            api.on('fetch-retry', () => events.push('retry'));

            const path = '/fail-once';

            // First request will fail once then succeed
            const [r1] = await attempt(() => api.get(path));

            expect(r1).to.exist;
            expect(events).to.include('dedupe-start');
            expect(events).to.include('retry');

            api.destroy();
        });

        it('joiner joins at current retry iteration with attemptTimeout', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                attemptTimeout: 50, // Per-attempt timeout
                retry: {
                    maxAttempts: 3,
                    baseDelay: 30,
                    shouldRetry: (error) => error.status === 499
                },
                dedupePolicy: { enabled: true, methods: ['GET'] }
            });

            const events: string[] = [];
            api.on('fetch-dedupe-start', () => events.push('dedupe-start'));
            api.on('fetch-dedupe-join', () => events.push('dedupe-join'));
            api.on('fetch-retry', () => events.push('retry'));

            // Request A starts - will timeout on first attempt, retry
            const promiseA = api.get('/slow-success/100'); // 100ms response, 50ms timeout = timeout

            // Wait for first attempt to timeout and retry to start
            await new Promise(r => setTimeout(r, 70));

            // Request B joins during retry
            const promiseB = api.get('/slow-success/100');

            // Both should eventually fail (all attempts timeout)
            const [[, errA], [, errB]] = await Promise.all([
                attempt(() => promiseA),
                attempt(() => promiseB)
            ]);

            // Both should have errors (all retries exhausted)
            expect(errA).to.be.instanceOf(FetchError);
            expect(errB).to.be.instanceOf(FetchError);

            // Verify deduplication happened
            expect(events).to.include('dedupe-start');
            expect(events).to.include('dedupe-join');
            expect(events).to.include('retry');

            api.destroy();
        });
    });

    describe('retry with timeouts', () => {

        it('does NOT retry timed out requests by default', async () => {

            let attemptCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                timeout: 50, // 50ms timeout
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                },
            });

            api.on('fetch-before', () => attemptCount++);

            // /slow-success/200 waits 200ms, so 50ms timeout will trigger
            const [, err] = await attempt(() => api.get('/slow-success/200'));

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;
            expect((err as FetchError).status).to.eq(499);

            // Should only have 1 attempt (no retries for aborted requests by default)
            expect(attemptCount).to.eq(1);

            api.destroy();
        });

        it('CAN retry timed out requests with attemptTimeout', async () => {

            let attemptCount = 0;
            let shouldRetryCallCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                attemptTimeout: 50, // 50ms per-attempt timeout (allows retries)
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                    shouldRetry: (error) => {

                        shouldRetryCallCount++;

                        // Retry on timeout (status 499)
                        return error.status === 499;
                    },
                },
            });

            api.on('fetch-before', () => attemptCount++);

            // /slow-success/200 waits 200ms, so 50ms attemptTimeout will trigger each time
            const [, err] = await attempt(() => api.get('/slow-success/200'));

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;
            expect((err as FetchError).timedOut).to.be.true;

            // Should have 3 attempts (maxAttempts: 3)
            expect(attemptCount).to.eq(3);
            expect(shouldRetryCallCount).to.eq(3);

            api.destroy();
        });

        it('emits fetch-retry event for timed out requests when using attemptTimeout', async () => {

            const retryEvents: any[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                attemptTimeout: 50, // Per-attempt timeout allows retries
                retry: {
                    maxAttempts: 2,
                    baseDelay: 10,
                    shouldRetry: (error) => error.status === 499,
                },
            });

            api.on('fetch-retry', (data) => retryEvents.push(data));

            await attempt(() => api.get('/slow-success/200'));

            // With maxAttempts: 2, we get 1 retry event (between attempt 1 and 2)
            expect(retryEvents).to.have.length(1);
            expect(retryEvents[0].attempt).to.eq(1);
            expect(retryEvents[0].nextAttempt).to.eq(2);

            api.destroy();
        });

        it('emits fetch-abort event for timed out requests', async () => {

            const abortEvents: any[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                timeout: 50,
                retry: {
                    maxAttempts: 1, // No retries
                    baseDelay: 10,
                },
            });

            api.on('fetch-abort', (data) => abortEvents.push(data));

            await attempt(() => api.get('/slow-success/200'));

            expect(abortEvents).to.have.length(1);
            expect(abortEvents[0].aborted).to.be.true;

            api.destroy();
        });

        it('timeout is shared across retry attempts (same AbortController)', async () => {

            // This test verifies that the timeout applies to the entire request lifecycle,
            // not per-attempt. Once the timeout fires, the controller is aborted for all
            // subsequent retry attempts.
            let attemptCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                timeout: 150, // Timeout longer than first attempt but shorter than total
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                    retryableStatusCodes: [503],
                },
            });

            api.on('fetch-before', () => attemptCount++);

            // /slow-fail waits 200ms then returns 503
            // With 150ms timeout, first attempt will timeout before server responds
            const [, err] = await attempt(() => api.get('/slow-fail'));

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;

            // Only 1 attempt because timeout fired and aborted the controller
            expect(attemptCount).to.eq(1);

            api.destroy();
        });

        it('per-request timeout override affects retry behavior', async () => {

            let attemptCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                timeout: 500, // Instance timeout: 500ms (would succeed)
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                },
            });

            api.on('fetch-before', () => attemptCount++);

            // Override with shorter timeout that will fail
            const [, err] = await attempt(() =>
                api.get('/slow-success/200', { timeout: 50 })
            );

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;

            // No retries for aborted requests by default
            expect(attemptCount).to.eq(1);

            api.destroy();
        });

        it('manual abort is not retried', async () => {

            let attemptCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                },
            });

            api.on('fetch-before', () => attemptCount++);

            // Manual abort via returned promise's abort method
            const promise = api.get('/slow-success/500');
            setTimeout(() => promise.abort(), 10);

            const [, err] = await attempt(() => promise);

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;

            // Manual abort should not trigger retries
            expect(attemptCount).to.eq(1);

            api.destroy();
        });

        it('onError callback is called for timed out requests', async () => {

            const onErrorStub = sandbox.stub();

            const api = new FetchEngine({
                baseUrl: testUrl,
                timeout: 50,
                retry: {
                    maxAttempts: 1,
                },
            });

            await attempt(() =>
                api.get('/slow-success/200', { onError: onErrorStub })
            );

            expect(onErrorStub.called).to.be.true;
            expect(onErrorStub.callCount).to.eq(1);

            const error = onErrorStub.args[0][0] as FetchError;
            expect(error.aborted).to.be.true;
            expect(error.status).to.eq(499);

            api.destroy();
        });
    });

    describe('retry with HTTP methods', () => {

        const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

        methods.forEach(method => {

            it(`should handle ${method} with retry`, async () => {

                const api = new FetchEngine({
                    baseUrl: testUrl,
                    retry: {
                        maxAttempts: 3,
                        baseDelay: 10,
                        retryableStatusCodes: [503]
                    }
                });

                const events: string[] = [];
                api.on('fetch-retry', () => events.push('retry'));

                const methodName = method.toLowerCase() as Lowercase<typeof method>;
                const payload = (method === 'POST' || method === 'PUT' || method === 'PATCH')
                    ? { data: 'test' }
                    : undefined;

                const methodFn = api[methodName] as any;

                // fail-once endpoint will fail first call, succeed on retry
                const [r1] = await attempt(() => methodFn.call(api, '/fail-once', payload as any));

                expect(r1).to.exist;
                expect(events).to.include('retry');

                api.destroy();
            });
        });
    });

    describe('attemptTimeout feature', () => {

        it('creates fresh controller per attempt', async () => {

            const controllers: AbortController[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                attemptTimeout: 50,
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                    shouldRetry: (error) => error.status === 499,
                },
            });

            api.on('fetch-before', (data) => controllers.push(data.controller));

            await attempt(() => api.get('/slow-success/200'));

            // Each attempt should have a different controller
            expect(controllers).to.have.length(3);
            expect(controllers[0]).to.not.equal(controllers[1]);
            expect(controllers[1]).to.not.equal(controllers[2]);

            api.destroy();
        });

        it('succeeds when retry completes in time', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                attemptTimeout: 100, // 100ms per-attempt timeout
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                    retryableStatusCodes: [503],
                },
            });

            // /fail-once fails with 503 first time, succeeds on retry
            const [result, err] = await attempt(() => api.get('/fail-once'));

            expect(err).to.be.null;
            expect(result).to.exist;

            api.destroy();
        });
    });

    describe('totalTimeout feature', () => {

        it('works same as deprecated timeout', async () => {

            let attemptCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                totalTimeout: 50, // Using new totalTimeout name
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                },
            });

            api.on('fetch-before', () => attemptCount++);

            // /slow-success/200 waits 200ms, so 50ms totalTimeout will trigger
            const [, err] = await attempt(() => api.get('/slow-success/200'));

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;
            expect((err as FetchError).timedOut).to.be.true;

            // totalTimeout aborts parent controller, so no retries
            expect(attemptCount).to.eq(1);

            api.destroy();
        });
    });

    describe('attemptTimeout and totalTimeout together', () => {

        it('totalTimeout caps entire operation even with attemptTimeout', async () => {

            let attemptCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                totalTimeout: 30, // 30ms for entire operation - shorter than attemptTimeout
                attemptTimeout: 50, // 50ms per attempt (won't fully trigger)
                retry: {
                    maxAttempts: 10, // Would allow many attempts
                    baseDelay: 20,
                    shouldRetry: () => true,
                },
            });

            api.on('fetch-before', () => attemptCount++);

            // With 30ms totalTimeout, the first attempt should be cut short
            const [, err] = await attempt(() => api.get('/slow-success/200'));

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;
            expect((err as FetchError).timedOut).to.be.true;

            // Should only have 1 attempt because totalTimeout fired before attemptTimeout
            expect(attemptCount).to.eq(1);

            api.destroy();
        });

        it('attemptTimeout allows retry when totalTimeout has budget', async () => {

            let attemptCount = 0;
            const retryEvents: any[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                totalTimeout: 500, // 500ms for entire operation
                attemptTimeout: 50, // 50ms per attempt
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                    shouldRetry: (error) => error.status === 499,
                },
            });

            api.on('fetch-before', () => attemptCount++);
            api.on('fetch-retry', (data) => retryEvents.push(data));

            // /slow-success/200 waits 200ms, each attempt times out at 50ms
            // With 500ms total budget, we should get all 3 attempts
            const [, err] = await attempt(() => api.get('/slow-success/200'));

            expect(err).to.be.instanceOf(FetchError);
            expect(attemptCount).to.eq(3);
            expect(retryEvents).to.have.length(2); // 2 retries between 3 attempts

            api.destroy();
        });
    });

    describe('timedOut flag', () => {

        it('is true when totalTimeout fires', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                totalTimeout: 50,
                retry: { maxAttempts: 1 },
            });

            const [, err] = await attempt(() => api.get('/slow-success/200'));

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;
            expect((err as FetchError).timedOut).to.be.true;

            // Helper method tests
            expect((err as FetchError).isTimeout()).to.be.true;
            expect((err as FetchError).isCancelled()).to.be.false;

            api.destroy();
        });

        it('is false for manual abort', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: { maxAttempts: 1 },
            });

            const promise = api.get('/slow-success/500');
            setTimeout(() => promise.abort(), 10);

            const [, err] = await attempt(() => promise);

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;
            expect((err as FetchError).timedOut).to.be.undefined;

            // Helper method tests
            expect((err as FetchError).isCancelled()).to.be.true;
            expect((err as FetchError).isTimeout()).to.be.false;

            api.destroy();
        });

        it('is true for attemptTimeout abort', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                attemptTimeout: 50,
                retry: {
                    maxAttempts: 1,
                },
            });

            const [, err] = await attempt(() => api.get('/slow-success/200'));

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;
            expect((err as FetchError).timedOut).to.be.true;

            // Helper method tests
            expect((err as FetchError).isTimeout()).to.be.true;
            expect((err as FetchError).isCancelled()).to.be.false;

            api.destroy();
        });
    });

});
