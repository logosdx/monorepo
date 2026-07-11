import {
    describe,
    it,
    expect
} from 'vitest'

import {
    FetchEngine,
    FetchPlugin,
    retryPlugin,
    dedupePlugin,
    cachePlugin,
    rateLimitPlugin,
    cookiePlugin,
    isFetchError,
} from '@logosdx/fetch';

import { attempt, attemptSync, isRateLimitError } from '@logosdx/utils';

import { makeTestStubs } from '../_helpers.ts';


describe('FetchEngine: plugin resolution', async () => {

    const { testUrl } = await makeTestStubs(4301);

    it('should apply config-key policies alongside custom plugins', async () => {

        const hookCalls: string[] = [];

        const trackerPlugin: FetchPlugin = {
            name: 'tracker',
            install(engine) {

                return engine.hooks.add('beforeRequest', async () => {

                    hookCalls.push('hit');
                });
            }
        };

        const api = new FetchEngine({
            baseUrl: testUrl,
            rateLimitPolicy: { maxCalls: 100, windowMs: 60000 },
            plugins: [trackerPlugin]
        });

        const acquireEvents: string[] = [];

        api.on('ratelimit-acquire', (data) => {

            acquireEvents.push(data.path!);
        });

        await api.get('/json');

        expect(hookCalls.length).to.equal(1);     // custom plugin installed
        expect(acquireEvents.length).to.equal(1); // config policy NOT dropped

        api.destroy();
    });

    it('should keep config policies and the default retry plugin when plugins is an empty array', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            rateLimitPolicy: { maxCalls: 1, windowMs: 60000, waitForToken: false },
            plugins: []
        });

        const [first, firstErr] = await attempt(() => api.get('/json'));

        expect(firstErr).to.equal(null);
        expect(first!.ok).to.equal(true);

        // Second call exceeds maxCalls: 1 — proves rateLimitPolicy survived plugins: []
        const [, secondErr] = await attempt(() => api.get('/json'));

        expect(secondErr).to.not.equal(null);
        expect(isRateLimitError(secondErr)).to.equal(true);

        api.destroy();

        // Default retry plugin owns attemptTimeout — proves it survived plugins: []
        const plainApi = new FetchEngine({
            baseUrl: testUrl,
            plugins: []
        });

        const waitStart = Date.now();
        const [, timeoutErr] = await attempt(() => plainApi.get('/wait', { attemptTimeout: 60 }));
        const elapsed = Date.now() - waitStart;

        expect(timeoutErr).to.not.equal(null);
        expect(isFetchError(timeoutErr)).to.equal(true);
        if (!isFetchError(timeoutErr)) throw new Error('expected a FetchError');

        expect(timeoutErr.timedOut).to.equal(true);

        // Default retry = 3 attempts with exponential backoff (~1s + ~2s between);
        // each attempt is cut at 60ms by attemptTimeout, never reaching /wait's 1000ms.
        // Both the timedOut stamp and the retried-backoff timing shape are the
        // default retry plugin's — proof it survived plugins: [].
        expect(elapsed).to.be.greaterThan(1000);
        expect(elapsed).to.be.lessThan(4500);

        plainApi.destroy();
    });

    it('should throw when a config key and its plugin are both provided', () => {

        const conflicts: [string, () => FetchEngine][] = [
            ['retry', () => new FetchEngine({
                baseUrl: testUrl,
                retry: { maxAttempts: 2 },
                plugins: [retryPlugin({ maxAttempts: 5 })]
            })],
            ['dedupe', () => new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true,
                plugins: [dedupePlugin(true)]
            })],
            ['cache', () => new FetchEngine({
                baseUrl: testUrl,
                cachePolicy: { ttl: 1000 },
                plugins: [cachePlugin({ ttl: 5000 })]
            })],
            ['rate-limit', () => new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: { maxCalls: 5 },
                plugins: [rateLimitPlugin(true)]
            })],
            ['cookies', () => new FetchEngine({
                baseUrl: testUrl,
                cookies: true,
                plugins: [cookiePlugin()]
            })],
        ];

        for (const [pluginName, construct] of conflicts) {

            const [, err] = attemptSync(construct);

            expect(err, `expected '${pluginName}' conflict to throw`).to.not.equal(null);
            expect(err!.message).to.include(pluginName);
        }
    });

    it('should throw when the same policy plugin appears twice', () => {

        const [, err] = attemptSync(() => new FetchEngine({
            baseUrl: testUrl,
            plugins: [rateLimitPlugin(true), rateLimitPlugin(true)]
        }));

        expect(err).to.not.equal(null);
        expect(err!.message).to.include('rate-limit');
    });

    it('should let a user retry plugin replace the default when no retry key is set', async () => {

        // maxAttempts: 1 = no retries. /fail-once returns 503 first, 200 after.
        // If the default retry plugin (maxAttempts 3) were still installed,
        // the 503 would be retried into a 200.
        const api = new FetchEngine({
            baseUrl: testUrl,
            plugins: [retryPlugin({ maxAttempts: 1, shouldRetry: () => false })]
        });

        const [res, err] = await attempt(() => api.get('/fail-once'));

        expect(err).to.equal(null);
        expect(res!.ok).to.equal(false);
        expect(res!.status).to.equal(503); // user's no-retry plugin won

        api.destroy();
    });
});
