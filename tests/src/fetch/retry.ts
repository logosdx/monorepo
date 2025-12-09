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

});
