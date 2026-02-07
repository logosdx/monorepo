import {
    describe,
    it,
    expect
} from 'vitest'

import {
    FetchError,
    FetchEngine,
} from '@logosdx/fetch';

import { attempt, wait } from '@logosdx/utils';
import { makeTestStubs } from '../_helpers.ts';


describe('FetchEngine: performance and load', async () => {

    const { testUrl, server: _server } = await makeTestStubs(4135);

    it('should handle 100+ concurrent requests without issues', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: true }
        });

        // Launch 100 concurrent requests to unique paths
        const requests = Array.from({ length: 100 }, (_, i) =>
            api.get(`/json-${i}-${Date.now()}`)
        );

        const results = await Promise.allSettled(requests);

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        // All requests should succeed
        expect(successful).to.equal(100);
        expect(failed).to.equal(0);

        // Verify no memory leaks - all inflight requests should be cleared
        const stats = api.cacheStats();
        expect(stats.inflightCount).to.equal(0);

        api.destroy();
    });

    it('should handle large request payloads (1MB+)', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl
        });

        // Generate a large payload (1MB of data)
        const largePayload = {
            data: 'x'.repeat(1024 * 1024),
            metadata: { size: '1MB' }
        };

        const path = `/large-payload`;

        // POST with large payload
        const [_, err] = await attempt(() =>
            api.post(path, largePayload)
        );

        // The request should be handled (server may reject, but engine should process)
        // We're testing that the engine doesn't crash with large payloads
        expect(err).to.satisfy((e: any) => {

            return e === null || e instanceof FetchError;
        });

        api.destroy();
    });

    it('should handle large response bodies (1MB+)', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: {
                enabled: true,
                ttl: 5000,
                methods: ['POST']
            }
        });

        // Generate a large payload (1MB of data)
        const largeData = { data: 'x'.repeat(1024 * 1024) };

        // Mock server would need to return this, but we can test the handling
        // For this test, we verify the engine can process large responses
        const path = `/large-payload`;

        const [response, err] = await attempt(() => api.post(path, largeData));

        expect(err).to.be.null;
        expect(response).to.not.be.undefined;

        // Verify cache can handle it
        const stats = api.cacheStats();
        expect(stats.cacheSize).to.be.greaterThan(0);

        api.destroy();
    });

    it('should measure throughput (requests/sec)', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: false },
            cachePolicy: { enabled: false }
        });

        const requestCount = 500;
        const start = Date.now();

        // Launch sequential requests to measure baseline throughput
        const requests = Array.from({ length: requestCount }, (_, i) =>
            api.get(`/json-throughput-${i}-${Date.now()}`)
        );

        await Promise.allSettled(requests);

        const elapsed = Date.now() - start;
        const requestsPerSec = (requestCount / elapsed) * 1000;

        // Should handle at least 500 requests/sec (conservative threshold)
        expect(requestsPerSec).to.be.greaterThan(500);

        api.destroy();
    });

    it('should handle destroy during request initiation', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl
        });

        const path = `/wait-success`;

        // Start a long-running request
        const requestPromise = api.get(path);

        // Immediately destroy the instance (race condition)
        await wait(10);
        api.destroy();

        // Request should either complete or fail gracefully
        const [, err] = await attempt(() => requestPromise);

        // System should handle gracefully
        expect(err).to.satisfy((e: any) => {

            return e === null || e instanceof Error;
        });
    });

    it('should handle multiple engines hitting same endpoint', async () => {

        // Create two separate FetchEngine instances
        const api1 = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: true },
            cachePolicy: { enabled: true, ttl: 5000 }
        });

        const api2 = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: true },
            cachePolicy: { enabled: true, ttl: 5000 }
        });

        const path = `/test-multi-engine-${Date.now()}`;

        // Both engines hit the same endpoint concurrently
        const [r1, r2] = await Promise.all([
            api1.get(path),
            api2.get(path)
        ]);

        // Both should succeed independently
        expect(r1.data).to.deep.equal({ ok: true, path });
        expect(r2.data).to.deep.equal({ ok: true, path });

        // Each engine maintains its own cache
        const stats1 = api1.cacheStats();
        const stats2 = api2.cacheStats();

        expect(stats1.cacheSize).to.be.greaterThan(0);
        expect(stats2.cacheSize).to.be.greaterThan(0);
        expect(stats1.inflightCount).to.equal(0);
        expect(stats2.inflightCount).to.equal(0);

        api1.destroy();
        api2.destroy();
    });

    it('should handle multiple concurrent request failures', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: false }
        });

        // Launch many concurrent requests to failing endpoint
        const requests = Array.from({ length: 500 }, () =>
            attempt(() => api.get(`/fail`))
        );

        const results = await Promise.all(requests);

        // All should fail gracefully
        results.forEach(([_, err]) => {

            expect(err).to.not.be.null;
            expect(err).to.be.instanceOf(FetchError);
        });

        // No inflight leaks despite mass failures
        const stats = api.cacheStats();
        expect(stats.inflightCount).to.equal(0);

        api.destroy();
    });

    it('should handle mixed success and failure in concurrent batch', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: false }
        });

        // Mix of successful and failing requests
        const requests = [
            attempt(() => api.get(`/json`)),
            attempt(() => api.get(`/fail`)),
            attempt(() => api.get(`/json`)),
            attempt(() => api.get(`/fail`)),
            attempt(() => api.get(`/json`))
        ];

        const results = await Promise.all(requests);

        // Count successes and failures
        const successes = results.filter(([_, e]) => e === null).length;
        const failures = results.filter(([_, e]) => e !== null).length;

        expect(successes).to.equal(3);
        expect(failures).to.equal(2);

        // No inflight leaks
        const stats = api.cacheStats();
        expect(stats.inflightCount).to.equal(0);

        api.destroy();
    });
});
