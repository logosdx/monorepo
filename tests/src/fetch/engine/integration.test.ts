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


describe('FetchEngine: feature combinations', async () => {

    const { testUrl } = await makeTestStubs(4133);

    it('should work with deduplication and timeout', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            totalTimeout: 500,
            dedupePolicy: { enabled: true, methods: ['GET'] }
        });

        const events: string[] = [];
        api.on('dedupe-start', () => events.push('dedupe-start'));
        api.on('dedupe-join', () => events.push('dedupe-join'));

        const path = '/wait';

        // Make two concurrent requests that will both timeout
        const promise1 = attempt(() => api.get(path));
        const promise2 = attempt(() => api.get(path));

        const [[_r1, e1], [_r2, e2]] = await Promise.all([promise1, promise2]);

        // Both should timeout since /wait takes 1000ms and timeout is 500ms
        expect(e1).to.be.instanceOf(Error);
        expect(e2).to.be.instanceOf(Error);
        expect(events).to.include('dedupe-start');
        expect(events).to.include('dedupe-join');

        api.destroy();
    });

    it('should work with caching and timeout', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            totalTimeout: 500,
            cachePolicy: { enabled: true, methods: ['GET'], ttl: 5000 }
        });

        const events: string[] = [];
        api.on('cache-miss', () => events.push('cache-miss'));

        // First request succeeds and caches
        const path = `/test-cache-timeout-${Date.now()}`;
        const [r1] = await attempt(() => api.get(path));
        expect(r1).to.exist;
        expect(events).to.include('cache-miss');

        // Second request hits cache, no timeout issue
        events.length = 0;
        const [r2] = await attempt(() => api.get(path));
        expect(r2).to.exist;
        expect(events).to.not.include('cache-miss');

        api.destroy();
    });
});
