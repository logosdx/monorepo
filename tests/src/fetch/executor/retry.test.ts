import {
    describe,
    it,
    expect,
    vi
} from 'vitest'


import {
    FetchError,
    FetchEngine,
    isFetchError,
} from '@logosdx/fetch';

import { attempt } from '@logosdx/utils';
import { sandbox } from '../../_helpers.ts';
import { makeTestStubs } from '../_helpers.ts';

describe('@logosdx/fetch: retry', async () => {

    const { testUrl, resetFlaky, resetFailOnce } = await makeTestStubs(4124);

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

    it('retries on specific status codes then resolves ok:false after exhausting attempts', async () => {

        const retryEvents: FetchEngine.RetryEventData[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: {
                maxAttempts: 3,
                baseDelay: 10,
                useExponentialBackoff: false,
                retryableStatusCodes: [400],
            },
        });

        api.on('retry', (data) => retryEvents.push(data));

        const [result, err] = await attempt(() => api.get('/validate?name=&age=17'));

        expect(err).to.be.null;
        expect(result?.ok).to.be.false;
        expect(result?.status).to.eq(400);
        expect(retryEvents).to.have.length(2); // 2 retries between 3 attempts
    })

    it('retries with custom shouldRetry', async () => {

        const retryEvents: FetchEngine.RetryEventData[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: {
                maxAttempts: 3,
                baseDelay: 10,
                useExponentialBackoff: false,
                shouldRetry: (outcome) => !isFetchError(outcome) && outcome.status === 400,
            },
        });

        api.on('retry', (data) => retryEvents.push(data));

        // First request resolves 400 (validation error) - should retry twice then exhaust
        const [firstResult] = await attempt(() => api.get('/validate?name=&age=17'));

        expect(firstResult?.ok).to.be.false;
        expect(firstResult?.status).to.eq(400);
        expect(retryEvents).to.have.length(2);

        retryEvents.length = 0;
        resetFlaky();

        // /flaky succeeds first call (bumps state), fails 503 on the second -
        // 503 should NOT retry since shouldRetry only allows 400
        await attempt(() => api.get('/flaky'));
        const [secondResult] = await attempt(() => api.get('/flaky'));

        expect(secondResult?.ok).to.be.false;
        expect(secondResult?.status).to.eq(503);
        expect(retryEvents).to.have.length(0);
    });

    it('retries with custom shouldRetry that returns a number', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: {
                maxAttempts: 3,
                baseDelay: 10,
                useExponentialBackoff: false,
                shouldRetry: (outcome) => {

                    if (!isFetchError(outcome) && outcome.status === 400) {

                        return 50;
                    }

                    return false;
                },
            },
        });

        const start = Date.now();

        const [result, err] = await attempt(() => api.get('/validate?name=&age=17'));

        expect(err).to.be.null;
        expect(result?.ok).to.be.false;
        expect(result?.status).to.eq(400);

        const end = Date.now();

        // With maxAttempts: 3, we have 3 attempts and 2 delays (50ms each)
        expect(end - start).to.be.greaterThan(99);
    });

    it('throws the actual transport error after exhausting retries when shouldRetry always returns true', async () => {

        const shouldRetrySpy = vi.fn().mockReturnValue(true);

        const api = new FetchEngine({
            baseUrl: testUrl + 1, // unreachable port - transport failure, not a resolved response
            retry: {
                maxAttempts: 3,
                baseDelay: 10,
                shouldRetry: shouldRetrySpy,
            },
        });

        const [, err] = await attempt(() => api.get('/'));

        // Should throw the actual transport error, not "Unexpected end of retry logic"
        expect(err).to.be.instanceOf(FetchError);
        expect((err as FetchError).message).to.not.include('Unexpected end of retry logic');
        expect((err as FetchError).status).to.eq(499);
        expect(shouldRetrySpy).toHaveBeenCalledTimes(3);
    });

    it('resolves ok:false (never throws) after exhausting HTTP-status retries when shouldRetry always returns true', async () => {

        const shouldRetrySpy = vi.fn().mockReturnValue(true);

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: {
                maxAttempts: 3,
                baseDelay: 10,
                shouldRetry: shouldRetrySpy,
            },
        });

        const [result, err] = await attempt(() => api.get('/validate?name=&age=17'));

        // Exhausted attempts on ok:false resolve - they are never converted to a throw.
        expect(err).to.be.null;
        expect(result?.ok).to.be.false;
        expect(result?.status).to.eq(400);
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

        const retryEvents: FetchEngine.RetryEventData[] = [];
        api.on('retry', (data) => retryEvents.push(data));

        const reqConfig: FetchEngine.CallConfig = {
            retry: {
                maxAttempts: 2,
                baseDelay: 10,
                useExponentialBackoff: false,
                retryableStatusCodes: [400],
            },
        }

        const start = Date.now();

        const [result] = await attempt(() => api.get('/validate?name=&age=17', reqConfig));

        const end = Date.now();

        const calc = (10 * 2) + 20; // Give some buffer

        expect(end - start).to.be.lessThan(calc);
        expect(result?.ok).to.be.false;
        expect(retryEvents).to.have.length(1); // 1 retry between 2 attempts (per-request override)

        retryEvents.length = 0;

        // Without the per-request override, the instance default applies - 400 isn't
        // in the default retryableStatusCodes, so it resolves after a single attempt.
        const [result2] = await attempt(() => api.get('/validate?name=&age=17'));

        expect(result2?.ok).to.be.false;
        expect(retryEvents).to.have.length(0);
    });

    it('configures default retry', async () => {

        const retryEvents: FetchEngine.RetryEventData[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: true
        });

        api.on('retry', (data) => retryEvents.push(data));

        const [result, err] = await attempt(() => api.get('/rate-limit'));

        // 429 is in the default retryableStatusCodes - retried to exhaustion, then resolves.
        expect(err).to.be.null;
        expect(result?.ok).to.be.false;
        expect(result?.status).to.eq(429);
        expect(retryEvents).to.have.length(2); // default maxAttempts: 3 -> 2 retries
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
            api.on('dedupe-start', () => events.push('dedupe-start'));
            api.on('retry', () => events.push('retry'));

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
            api.on('dedupe-start', () => events.push('dedupe-start'));
            api.on('dedupe-join', () => events.push('dedupe-join'));
            api.on('retry', () => events.push('retry'));

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
                totalTimeout: 50, // 50ms timeout
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                },
            });

            api.on('before-request', () => attemptCount++);

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

            api.on('before-request', () => attemptCount++);

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

        it('emits retry event for timed out requests when using attemptTimeout', async () => {

            const retryEvents: FetchEngine.RetryEventData[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                attemptTimeout: 50, // Per-attempt timeout allows retries
                retry: {
                    maxAttempts: 2,
                    baseDelay: 10,
                    shouldRetry: (error) => error.status === 499,
                },
            });

            api.on('retry', (data) => retryEvents.push(data));

            await attempt(() => api.get('/slow-success/200'));

            // With maxAttempts: 2, we get 1 retry event (between attempt 1 and 2)
            expect(retryEvents).to.have.length(1);
            expect(retryEvents[0]!.attempt).to.eq(1);
            expect(retryEvents[0]!.nextAttempt).to.eq(2);
            expect(retryEvents[0]!.requestStart).to.be.a('number');
            expect(retryEvents[0]!.requestEnd).to.not.exist;

            api.destroy();
        });

        it('emits fetch-abort event for timed out requests', async () => {

            const abortEvents: any[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                totalTimeout: 50,
                retry: {
                    maxAttempts: 1, // No retries
                    baseDelay: 10,
                },
            });

            api.on('abort', (data) => abortEvents.push(data));

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
                totalTimeout: 150, // Timeout longer than first attempt but shorter than total
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                    retryableStatusCodes: [503],
                },
            });

            api.on('before-request', () => attemptCount++);

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
                totalTimeout: 500, // Instance timeout: 500ms (would succeed)
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                },
            });

            api.on('before-request', () => attemptCount++);

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

            api.on('before-request', () => attemptCount++);

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
                totalTimeout: 50,
                retry: {
                    maxAttempts: 1,
                },
            });

            await attempt(() =>
                api.get('/slow-success/200', { onError: onErrorStub })
            );

            expect(onErrorStub.called).to.be.true;
            expect(onErrorStub.callCount).to.eq(1);

            const error = onErrorStub.args[0]![0] as FetchError;
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
                api.on('retry', () => events.push('retry'));

                // OPTIONS method name
                const methodName = method.toLowerCase() as Lowercase<typeof method>;
                const payload = (method === 'POST' || method === 'PUT' || method === 'PATCH')
                    ? { data: 'test' }
                    : undefined;

                const methodFn = api[methodName as keyof typeof api] as any;

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

            api.on('before-request', (data) => controllers.push((data as any).controller));

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

    describe('attemptTimeout fires when retrying is disabled', () => {

        it('rejects at ~attemptTimeout ms when retry: false (engine-level) against a slow endpoint', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: false,
                attemptTimeout: 60,
            });

            const start = Date.now();

            // /wait hangs 1000ms - proves the abort fires from attemptTimeout,
            // not from the endpoint eventually resolving.
            const [, err] = await attempt(() => api.get('/wait'));

            const end = Date.now();

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;
            expect((err as FetchError).timedOut).to.be.true;
            expect(end - start).to.be.lessThan(500);

            api.destroy();
        });

        it('rejects at ~attemptTimeout ms when retry: false is set per-call', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: { maxAttempts: 3, baseDelay: 10 },
                attemptTimeout: 60,
            });

            const start = Date.now();

            const [, err] = await attempt(() => api.get('/wait', { retry: false }));

            const end = Date.now();

            expect(err).to.be.instanceOf(FetchError);
            expect((err as FetchError).aborted).to.be.true;
            expect((err as FetchError).timedOut).to.be.true;
            expect(end - start).to.be.lessThan(500);

            api.destroy();
        });

        it('performs exactly one attempt - a 503-then-200 endpoint returns the 503', async () => {

            resetFailOnce();

            let attemptCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: false,
            });

            api.on('before-request', () => attemptCount++);

            const [result, err] = await attempt(() => api.get('/fail-once'));

            expect(err).to.be.null;
            expect(result?.ok).to.be.false;
            expect(result?.status).to.eq(503);
            expect(attemptCount).to.eq(1);

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

            api.on('before-request', () => attemptCount++);

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

            api.on('before-request', () => attemptCount++);

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
            const retryEvents: FetchEngine.RetryEventData[] = [];

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

            api.on('before-request', () => attemptCount++);
            api.on('retry', (data) => retryEvents.push(data));

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

    describe('retry on resolved ok:false responses (HTTP-status retries)', () => {

        it('retries a 503 and resolves ok:true once the endpoint recovers', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: {
                    maxAttempts: 3,
                    baseDelay: 10,
                },
            });

            // /fail-once resolves 503 on the first attempt, 200 on the next
            const [result, err] = await attempt(() => api.get<{ ok: boolean }>('/fail-once'));

            expect(err).to.be.null;

            if (!result?.ok) throw new Error('expected a successful response');

            expect(result.data.ok).to.be.true;

            api.destroy();
        });

        it('resolves ok:false after exhausting retries against an endpoint that never recovers', async () => {

            // Prime the flaky endpoint via a direct call (bypassing the engine)
            // so every subsequent call resolves 503.
            await fetch(testUrl + '/flaky');

            let attemptCount = 0;
            const retryEvents: FetchEngine.RetryEventData[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: {
                    maxAttempts: 3,
                    baseDelay: 5,
                    useExponentialBackoff: false,
                },
            });

            api.on('before-request', () => attemptCount++);
            api.on('retry', (data) => retryEvents.push(data));

            const [result, err] = await attempt(() => api.get('/flaky'));

            expect(err).to.be.null;
            expect(result?.ok).to.be.false;
            expect(result?.status).to.eq(503);
            expect(attemptCount).to.eq(3);
            expect(retryEvents).to.have.length(2);

            api.destroy();
        });

        it('does NOT retry a 4xx by default (not in retryableStatusCodes)', async () => {

            let attemptCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: { maxAttempts: 3, baseDelay: 5 },
            });

            api.on('before-request', () => attemptCount++);

            const [result, err] = await attempt(() => api.get('/fail'));

            expect(err).to.be.null;
            expect(result?.ok).to.be.false;
            expect(result?.status).to.eq(400);
            expect(attemptCount).to.eq(1);

            api.destroy();
        });

        it('honors the numeric delay returned by a custom shouldRetry (Retry-After pattern)', async () => {

            const retryEvents: FetchEngine.RetryEventData[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: {
                    maxAttempts: 2,
                    baseDelay: 1000, // large on purpose - proves the override, not backoff, is used
                    shouldRetry: (outcome) => {

                        if (isFetchError(outcome)) return false;
                        if (outcome.status !== 429) return false;

                        const after = outcome.headers['retry-after'];
                        return after ? Number(after) : 20;
                    },
                },
            });

            api.on('retry', (data) => retryEvents.push(data));

            const start = Date.now();
            const [result, err] = await attempt(() => api.get('/rate-limit'));
            const end = Date.now();

            expect(err).to.be.null;
            expect(result?.ok).to.be.false;
            expect(result?.status).to.eq(429);
            expect(retryEvents).to.have.length(1);
            expect(retryEvents[0]!.delay).to.eq(20);
            expect(end - start).to.be.lessThan(1000);

            api.destroy();
        });

        it('invokes shouldRetry with a FetchResponse for an HTTP trigger and a FetchError for a transport trigger', async () => {

            const httpOutcomes: unknown[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: {
                    maxAttempts: 1, // observe without actually retrying
                    shouldRetry: (outcome) => {

                        httpOutcomes.push(outcome);
                        return false;
                    },
                },
            });

            await attempt(() => api.get('/fail'));

            expect(httpOutcomes).to.have.length(1);
            expect(isFetchError(httpOutcomes[0])).to.be.false;
            expect((httpOutcomes[0] as { ok: boolean; status: number }).ok).to.be.false;
            expect((httpOutcomes[0] as { ok: boolean; status: number }).status).to.eq(400);

            api.destroy();

            const transportOutcomes: unknown[] = [];

            const badApi = new FetchEngine({
                baseUrl: testUrl + 1, // unreachable port - transport failure
                retry: {
                    maxAttempts: 1,
                    shouldRetry: (outcome) => {

                        transportOutcomes.push(outcome);
                        return false;
                    },
                },
            });

            await attempt(() => badApi.get('/'));

            expect(transportOutcomes).to.have.length(1);
            expect(isFetchError(transportOutcomes[0])).to.be.true;

            badApi.destroy();
        });

        it('carries the triggering outcome on the retry event payload', async () => {

            const retryEvents: FetchEngine.RetryEventData[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: { maxAttempts: 2, baseDelay: 5 },
            });

            api.on('retry', (data) => retryEvents.push(data));

            // HTTP-status trigger: 429 is retryable by default
            await attempt(() => api.get('/rate-limit'));

            expect(retryEvents).to.have.length(1);

            const httpOutcome = retryEvents[0]!.outcome;

            if (isFetchError(httpOutcome)) throw new Error('expected a response outcome');

            expect(httpOutcome.ok).to.be.false;
            expect(httpOutcome.status).to.eq(429);

            retryEvents.length = 0;

            // Transport trigger: unreachable port
            const badApi = new FetchEngine({
                baseUrl: testUrl + 1,
                retry: { maxAttempts: 2, baseDelay: 5 },
            });

            badApi.on('retry', (data) => retryEvents.push(data));

            await attempt(() => badApi.get('/'));

            expect(retryEvents).to.have.length(1);

            const transportOutcome = retryEvents[0]!.outcome;

            if (!isFetchError(transportOutcome)) throw new Error('expected an error outcome');

            expect(transportOutcome.status).to.eq(499);

            api.destroy();
            badApi.destroy();
        });

        it('boundary: maxAttempts 1 never retries a retryable status, resolves on the first attempt', async () => {

            let attemptCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: { maxAttempts: 1 },
            });

            api.on('before-request', () => attemptCount++);

            const [result, err] = await attempt(() => api.get('/rate-limit'));

            expect(err).to.be.null;
            expect(result?.ok).to.be.false;
            expect(attemptCount).to.eq(1);

            api.destroy();
        });

        it('bad input: an empty retryableStatusCodes array disables the default HTTP-status trigger', async () => {

            let attemptCount = 0;

            const api = new FetchEngine({
                baseUrl: testUrl,
                retry: { maxAttempts: 3, baseDelay: 5, retryableStatusCodes: [] },
            });

            api.on('before-request', () => attemptCount++);

            const [result, err] = await attempt(() => api.get('/flaky'));

            expect(err).to.be.null;
            expect(result?.ok).to.be.true; // /flaky succeeds on the first call
            expect(attemptCount).to.eq(1);

            api.destroy();
        });
    });

});
