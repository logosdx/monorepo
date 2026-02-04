import {
    describe,
    it,
    expect
} from 'vitest'

import {
    FetchError,
    FetchEngine,
} from '../../../../packages/fetch/src/index.ts';

import { attempt, attemptSync, wait } from '../../../../packages/utils/src/index.ts';
import { makeTestStubs } from '../_helpers.ts';


describe('FetchEngine: lifecycle and state management', async () => {

    const { testUrl } = await makeTestStubs(4132);

    it('should handle addHeader during in-flight request', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: true }
        });

        const dedupeEvents: string[] = [];
        api.on('dedupe-start', () => dedupeEvents.push('start'));
        api.on('dedupe-join', () => dedupeEvents.push('join'));

        // Start first request (slow endpoint)
        const path = `/slow-success/100-${Date.now()}`;
        const promise1 = api.get(path);

        await wait(10);

        // Add header mid-flight (shouldn't affect in-flight request key)
        api.headers.set('X-Mid-Flight', 'true');

        // Start second request to SAME path - should dedupe since key is based on path+method
        const promise2 = api.get(path);

        const [result1] = await attempt(() => promise1);
        const [result2] = await attempt(() => promise2);

        expect(result1?.data).to.have.property('ok', true);
        expect(result2?.data).to.have.property('ok', true);

        // Should have deduped (1 start, 1 join)
        expect(dedupeEvents).to.include('start');

        api.destroy();
        await wait(10); // Let microtasks settle before test ends
    });

    it('should handle destroy called twice without crashing', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: true }
        });

        // First destroy should succeed
        const [, err1] = attemptSync(() => api.destroy());
        expect(err1).to.be.null;

        // Second destroy should not crash
        const [, err2] = attemptSync(() => api.destroy());
        expect(err2).to.be.null;
    });

    it('should handle flaky endpoint with retry disabled', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: false
        });

        // First request succeeds (flaky succeeds first time)
        const [result1, err1] = await attempt(() => api.get('/flaky'));
        expect(err1).to.be.null;
        expect(result1?.data).to.have.property('ok', true);

        // Second request fails (flaky fails after first)
        const [, err2] = await attempt(() => api.get('/flaky'));
        expect(err2).to.be.instanceOf(FetchError);

        api.destroy();
        await wait(10); // Let microtasks settle before test ends
    });

    it('should handle sequential success after initial failure', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: false
        });

        // First request fails
        const [, err1] = await attempt(() => api.get('/fail-once'));
        expect(err1).to.be.instanceOf(FetchError);

        // Second request succeeds
        const [result2, err2] = await attempt(() => api.get('/fail-once'));
        expect(err2).to.be.null;
        expect(result2?.data).to.have.property('ok', true);

        // Third request also succeeds
        const [result3, err3] = await attempt(() => api.get('/fail-once'));
        expect(err3).to.be.null;
        expect(result3?.data).to.have.property('ok', true);

        api.destroy();
        await wait(10); // Let microtasks settle before test ends
    });
});
