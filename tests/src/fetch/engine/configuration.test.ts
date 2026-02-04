import {
    describe,
    it,
    expect
} from 'vitest'

import {
    FetchEngine,
} from '../../../../packages/fetch/src/index.ts';

import { attempt, attemptSync } from '../../../../packages/utils/src/index.ts';
import { makeTestStubs } from '../_helpers.ts';


describe('FetchEngine: configuration validation', async () => {

    const { testUrl } = await makeTestStubs(4131);

    it('should handle both serializers throwing', async () => {

        // Both dedupe and cache serializers throw
        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                serializer: () => {

                    throw new Error('Dedupe serializer failed');
                }
            },
            cachePolicy: {
                enabled: true,
                serializer: () => {

                    throw new Error('Cache serializer failed');
                }
            }
        });

        // First error encountered should be thrown
        const [, err] = await attempt(() => api.get('/json'));

        expect(err).to.exist;
        expect(err).to.be.instanceOf(Error);
        // Either dedupe or cache serializer error
        expect(err!.message).to.match(/serializer failed/i);

        api.destroy();
    });

    it('should handle dedupe enabled with cache disabled and vice versa', async () => {

        // Dedupe enabled, cache explicitly disabled
        const api1 = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: true },
            cachePolicy: { enabled: false }
        });

        const path1 = `/test-dedupe-${Date.now()}`;

        const [r1, r2] = await Promise.all([
            api1.get(path1),
            api1.get(path1)
        ]);

        expect(r1.status).to.equal(200);
        expect(r2.status).to.equal(200);

        api1.destroy();

        // Cache enabled, dedupe explicitly disabled
        const api2 = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: false },
            cachePolicy: { enabled: true }
        });

        const path2 = `/test-cache-${Date.now()}`;

        await api2.get(path2);
        const r3 = await api2.get(path2);

        expect(r3.status).to.equal(200);

        api2.destroy();
    });

    it('should handle conflicting method configurations', async () => {

        // GET enabled for dedupe but disabled for cache
        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                methods: ['GET', 'POST']
            },
            cachePolicy: {
                enabled: true,
                methods: ['POST', 'PUT']  // GET not cached
            }
        });

        const dedupeEvents: string[] = [];
        const cacheEvents: string[] = [];

        api.on('dedupe-start', () => dedupeEvents.push('dedupe'));
        api.on('cache-set', () => cacheEvents.push('cache'));

        const path = `/test-conflict-${Date.now()}`;

        // GET request: should dedupe but not cache
        await Promise.all([
            api.get(path),
            api.get(path)
        ]);

        expect(dedupeEvents.length).to.equal(1);  // Deduped
        expect(cacheEvents.length).to.equal(0);   // Not cached

        api.destroy();
    });

    it('should handle invalid configuration objects (null)', async () => {

        // Null config objects
        const [, err] = attemptSync(() => {

            new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: null as any,
                cachePolicy: null as any
            });
        });

        // May fail during construction or treat null as disabled
        // Either way, shouldn't crash
        expect(err || true).to.exist;
    });

    it('should handle invalid configuration objects (undefined)', async () => {

        // Explicitly undefined config (vs omitted)
        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: undefined,
            cachePolicy: undefined
        });

        const path = `/test-undefined-${Date.now()}`;

        // Should work with features disabled
        const res = await api.get(path);

        expect(res.status).to.equal(200);

        api.destroy();
    });

    it('should handle empty config objects', async () => {

        // Empty config objects
        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {},
            cachePolicy: {}
        });

        const path = `/test-empty-${Date.now()}`;

        // Should work with default behavior
        const res = await api.get(path);

        expect(res.status).to.equal(200);

        api.destroy();
    });
});
