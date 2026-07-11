import {
    describe,
    it,
    expect
} from 'vitest'

import {
    FetchEngine,
} from '@logosdx/fetch';

import { attempt } from '@logosdx/utils';

import { makeTestStubs } from '../_helpers.ts';


describe('FetchEngine: per-call policy overrides', async () => {

    // Separate servers: /fail-once holds per-server state (fails only the first call)
    const { testUrl: urlA } = await makeTestStubs(4302);
    const { testUrl: urlB } = await makeTestStubs(4303);

    it('should honor per-call retry: false over engine retry config', async () => {

        const api = new FetchEngine({
            baseUrl: urlA,
            retry: { maxAttempts: 3, baseDelay: 1 }
        });

        const retryEvents: number[] = [];

        api.on('retry', (data) => {

            retryEvents.push(data.attempt ?? 0);
        });

        // 503 is retryable — without the override this would retry into a 200
        const [res, err] = await attempt(() => api.get('/fail-once', { retry: false }));

        expect(err).to.equal(null);
        expect(res!.ok).to.equal(false);
        expect(res!.status).to.equal(503);
        expect(retryEvents.length).to.equal(0);

        // Reported config matches the override actually applied, not the
        // engine's maxAttempts: 3
        expect(res!.config.retry.maxAttempts).to.equal(0);

        api.destroy();
    });

    it('should honor per-call retry config over engine retry: false', async () => {

        const api = new FetchEngine({
            baseUrl: urlB,
            retry: false
        });

        const retryEvents: number[] = [];

        api.on('retry', (data) => {

            retryEvents.push(data.attempt ?? 0);
        });

        // First call to /fail-once returns 503; the per-call config must
        // re-enable retrying even though the engine disabled it
        const [res, err] = await attempt(() => api.get('/fail-once', {
            retry: { maxAttempts: 2, baseDelay: 1 }
        }));

        expect(err).to.equal(null);
        expect(res!.ok).to.equal(true);
        expect(retryEvents.length).to.equal(1);

        // Reported config matches the override actually applied, not the
        // engine's retry: false
        expect(res!.config.retry.maxAttempts).to.equal(2);

        api.destroy();
    });

    it('should reflect the engine retry config when no per-call override is given', async () => {

        const withRetry = new FetchEngine({
            baseUrl: urlA,
            retry: { maxAttempts: 3, baseDelay: 1 }
        });

        const [resWithRetry] = await attempt(() => withRetry.get('/json'));

        expect(resWithRetry!.config.retry.maxAttempts).to.equal(3);

        withRetry.destroy();

        const withoutRetry = new FetchEngine({
            baseUrl: urlB,
            retry: false
        });

        const [resWithoutRetry] = await attempt(() => withoutRetry.get('/json'));

        expect(resWithoutRetry!.config.retry.maxAttempts).to.equal(0);

        withoutRetry.destroy();
    });

    it('should bypass cache lookup and store with per-call skipCache', async () => {

        const api = new FetchEngine({
            baseUrl: urlA,
            cachePolicy: { ttl: 60000 }
        });

        const hits: string[] = [];

        api.on('cache-hit', (data) => {

            hits.push(data.key!);
        });

        await api.get('/json');                        // miss + store
        await api.get('/json');                        // hit
        expect(hits.length).to.equal(1);

        const [res, err] = await attempt(() => api.get('/json', { skipCache: true }));

        expect(err).to.equal(null);
        expect(res!.ok).to.equal(true);
        expect(hits.length).to.equal(1);               // no lookup happened

        await api.get('/json');                        // prior entry still intact
        expect(hits.length).to.equal(2);

        api.destroy();
    });
});
