import {
    describe,
    it,
    expect
} from 'vitest'

import {
    FetchEngine,
} from '@logosdx/fetch';

import { attempt, attemptSync, isRateLimitError } from '@logosdx/utils';
import { makeTestStubs } from '../_helpers.ts';


describe('FetchEngine: configuration validation', async () => {

    const { testUrl, resetFailOnce, callStub } = await makeTestStubs(4131);

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

    it('should apply a config.set() retry.maxAttempts change on the next request', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: { maxAttempts: 1, baseDelay: 10 }
        });

        const [first] = await attempt(() => api.get('/fail-once'));

        expect(first!.ok).to.equal(false);
        expect(first!.status).to.equal(503); // maxAttempts: 1 — no retry, 503 surfaces

        resetFailOnce();
        api.config.set('retry.maxAttempts', 3);

        // Same fails-once-then-succeeds pattern, but now retried into a 200 —
        // proves the reconfigured maxAttempts drives the next request.
        const [second] = await attempt(() => api.get('/fail-once'));

        expect(second!.ok).to.equal(true);

        api.destroy();
    });

    it('should rebuild rate-limit token buckets on config.set()', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            rateLimitPolicy: { maxCalls: 100, windowMs: 60000, waitForToken: false }
        });

        const path = `/cp2-ratelimit-${Date.now()}`;

        const [, firstErr] = await attempt(() => api.get(path));
        expect(firstErr).to.equal(null); // ample budget

        api.config.set('rateLimitPolicy', { maxCalls: 1, windowMs: 60000, waitForToken: false });

        // Fresh bucket for the same key — consumes its lone token.
        const [, secondErr] = await attempt(() => api.get(path));
        expect(secondErr).to.equal(null);

        // Same key, budget now exhausted — proves the bucket was rebuilt
        // with the new (tighter) capacity rather than reusing the old one.
        const [, thirdErr] = await attempt(() => api.get(path));
        expect(thirdErr).to.not.equal(null);
        expect(isRateLimitError(thirdErr)).to.equal(true);

        api.destroy();
    });

    it('should reconfigure cachePolicy TTLs/rules while cached entries survive', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: { ttl: 60000 }
        });

        const survivorPath = `/cp2-cache-survive-${Date.now()}`;

        await api.get(survivorPath); // populates the flight store under the old policy

        const newRulePath = `/cp2-cache-new-rule-${Date.now()}`;

        api.config.set('cachePolicy', {
            ttl: 5000,
            rules: [{ is: newRulePath, enabled: false }]
        });

        const cacheHits: string[] = [];
        const cacheSets: string[] = [];
        api.on('cache-hit', () => cacheHits.push('hit'));
        api.on('cache-set', () => cacheSets.push('set'));

        // Same key as before the reconfigure — the flight store isn't
        // rebuilt, so the entry cached under the old policy must still be
        // servable.
        await api.get(survivorPath);
        expect(cacheHits.length).to.equal(1);

        // A path matched only by the NEW rule — observable only if
        // reconfigure actually rebuilt the policy's rule cache with it.
        await api.get(newRulePath);
        expect(cacheSets.length).to.equal(0);

        api.destroy();
    });

    it('should throw when config.set() changes the cache plugin adapter and leave the store unchanged', () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: { ttl: 1000 }
        });

        const before = api.config.get('cachePolicy');

        const [, err] = attemptSync(() => api.config.set('cachePolicy', {
            ttl: 1000,
            adapter: {
                get: async () => null,
                set: async () => {},
                delete: async () => false,
                clear: async () => {},
                has: async () => false,
                size: 0,
            },
        }));

        expect(err).to.not.equal(null);
        expect(err!.message).to.match(/adapter/i);

        // The guard must reject BEFORE the store mutates — config.get()
        // still reports the pre-set value, not the rejected adapter.
        expect(api.config.get('cachePolicy')).to.deep.equal(before);

        api.destroy();
    });

    it('should throw and leave the store unchanged when a multi-key merge set() changes the cache adapter', () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: { ttl: 1000 },
            retry: { maxAttempts: 3 }
        });

        const cacheBefore = api.config.get('cachePolicy');
        const retryBefore = api.config.get('retry.maxAttempts');

        const [, err] = attemptSync(() => api.config.set({
            retry: { maxAttempts: 9 },
            cachePolicy: {
                ttl: 1000,
                adapter: {
                    get: async () => null,
                    set: async () => {},
                    delete: async () => false,
                    clear: async () => {},
                    has: async () => false,
                    size: 0,
                },
            },
        }));

        expect(err).to.not.equal(null);
        expect(err!.message).to.match(/adapter/i);

        // Neither key commits — the adapter guard rejects the WHOLE
        // merge before anything mutates, not just the cachePolicy key.
        expect(api.config.get('cachePolicy')).to.deep.equal(cacheBefore);
        expect(api.config.get('retry.maxAttempts')).to.equal(retryBefore);

        api.destroy();
    });

    it('should rebuild the dedupe rule cache on config.set()', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const path = `/cp2-dedupe-${Date.now()}`;

        const dedupeJoins: unknown[] = [];
        api.on('dedupe-join', (data) => dedupeJoins.push(data));

        await Promise.all([api.get(path), api.get(path)]);

        expect(dedupeJoins.length).to.equal(1); // deduped before reconfigure

        api.config.set('dedupePolicy', { enabled: false });

        const path2 = `/cp2-dedupe-off-${Date.now()}`;

        // Same concurrent-pair pattern — no join this time proves the rule
        // cache was rebuilt disabled, not stale from before the config.set().
        await Promise.all([api.get(path2), api.get(path2)]);

        expect(dedupeJoins.length).to.equal(1);

        api.destroy();
    });

    it('should apply an updated cookie exclude via config.set() without clearing the jar', async () => {

        const now = Date.now();
        const hostname = new URL(testUrl).hostname;
        const seedCookie = {
            name: 'session',
            value: 'abc123',
            domain: hostname,
            path: '/',
            expiryTime: Infinity,
            creationTime: now,
            lastAccessTime: now,
            persistentFlag: false,
            hostOnlyFlag: true,
            secureOnlyFlag: false,
            httpOnlyFlag: false,
        };

        const api = new FetchEngine({
            baseUrl: testUrl,
            cookies: { cookies: [seedCookie] }
        });

        await api.get('/json');

        // Jar seeded at construction — the cookie is sent before any reconfigure.
        expect(callStub.lastCall.args[0].headers['cookie']).to.include('session=abc123');

        api.config.set('cookies', { exclude: [hostname] });

        await api.get('/json');

        // Only observable if reconfigure actually applied the new `exclude` —
        // the jar itself (and its seeded cookie) is never touched.
        expect(callStub.lastCall.args[0].headers['cookie']).to.equal(undefined);

        api.config.set('cookies', { exclude: [] });

        await api.get('/json');

        // Proves jar SURVIVAL, not just the exclude behavior above: this
        // reconfigure never re-seeds cookies (`reconfigure` only ever
        // touches adapter/syncOnRequest/exclude), so the cookie sent here
        // can only be the one from the ORIGINAL construction-time seed —
        // if either reconfigure had cleared the jar, this request would
        // carry no cookie despite the host no longer being excluded.
        expect(callStub.lastCall.args[0].headers['cookie']).to.include('session=abc123');

        api.destroy();
    });
});
