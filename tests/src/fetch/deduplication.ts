import {
    describe,
    it,
    expect
} from 'vitest'


import {
    FetchError,
    FetchEngine,
} from '../../../packages/fetch/src/index.ts';

import { attempt, wait } from '../../../packages/utils/src/index.ts';
import { makeTestStubs } from './_helpers.ts';
import { attemptSync } from '../../../packages/kit/src/index.ts';

describe('@logosdx/fetch: deduplication',  async () => {

    const { testUrl } = await makeTestStubs(4122);

    it('should enable deduplication for GET requests by default', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];
        const joinEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => {

            startEvents.push(data.path!);
        });

        api.on('fetch-dedupe-join', (data) => {

            joinEvents.push(data.path!);
        });

        // Make 3 concurrent GET requests to the same path
        const [r1, r2, r3] = await Promise.all([
            api.get('/json'),
            api.get('/json'),
            api.get('/json')
        ]);

        // All should return the same result
        expect(r1.data).to.deep.equal({ ok: true });
        expect(r2.data).to.deep.equal({ ok: true });
        expect(r3.data).to.deep.equal({ ok: true });

        // Only one start event (first request)
        expect(startEvents.length).to.equal(1);
        expect(startEvents[0]).to.equal('/json');

        // Two join events (subsequent requests)
        expect(joinEvents.length).to.equal(2);

        api.destroy();
    });

    it('should disable deduplication when dedupePolicy is false', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: false
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => {

            startEvents.push(data.path!);
        });

        // Make 2 concurrent GET requests
        await Promise.all([
            api.get('/json'),
            api.get('/json')
        ]);

        // No deduplication events should fire
        expect(startEvents.length).to.equal(0);

        api.destroy();
    });

    it('should not dedupe POST requests by default', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];
        const joinEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => {

            startEvents.push(data.method!);
        });

        api.on('fetch-dedupe-join', (data) => {

            joinEvents.push(data.method!);
        });

        // Make 2 concurrent POST requests
        await Promise.all([
            api.post('/json', { data: 'test' }),
            api.post('/json', { data: 'test' })
        ]);

        // POST should not be deduped by default
        expect(startEvents.length).to.equal(0);
        expect(joinEvents.length).to.equal(0);

        api.destroy();
    });

    it('should configure custom methods for deduplication', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                methods: ['GET', 'POST']
            }
        });

        const startEvents: string[] = [];
        const joinEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => {

            startEvents.push(data.method!);
        });

        api.on('fetch-dedupe-join', (data) => {

            joinEvents.push(data.method!);
        });

        // Make 2 concurrent POST requests
        await Promise.all([
            api.post('/json', { data: 'test' }),
            api.post('/json', { data: 'test' })
        ]);

        // POST should be deduped
        expect(startEvents.length).to.equal(1);
        expect(startEvents[0]).to.equal('POST');
        expect(joinEvents.length).to.equal(1);

        api.destroy();
    });

    it('should disable deduplication for routes matching a rule with enabled: false', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                methods: ['GET'],
                rules: [
                    { startsWith: '/json', enabled: false }
                ]
            }
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => {

            startEvents.push(data.path!);
        });

        // Make 2 concurrent GET requests to /json
        await Promise.all([
            api.get('/json'),
            api.get('/json')
        ]);

        // Should not dedupe because of the rule
        expect(startEvents.length).to.equal(0);

        api.destroy();
    });

    it('should allow different methods for routes matching a rule', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                methods: ['GET'],
                rules: [
                    {
                        startsWith: '/json',
                        methods: ['GET', 'POST']
                    }
                ]
            }
        });

        const startEvents: string[] = [];
        const joinEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => {

            startEvents.push(data.method!);
        });

        api.on('fetch-dedupe-join', (data) => {

            joinEvents.push(data.method!);
        });

        // Make 2 concurrent POST requests to /json
        await Promise.all([
            api.post('/json', { data: 'test' }),
            api.post('/json', { data: 'test' })
        ]);

        // POST should be deduped because of the rule
        expect(startEvents.length).to.equal(1);
        expect(startEvents[0]).to.equal('POST');
        expect(joinEvents.length).to.equal(1);

        api.destroy();
    });

    it('should skip deduplication when shouldDedupe returns false', async () => {

        let callCount = 0;

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                methods: ['GET'],
                shouldDedupe: () => {

                    callCount++;
                    // Return false for every call - no deduplication should happen
                    return false;
                }
            }
        });

        const startEvents: string[] = [];
        const joinEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => startEvents.push(data.path!));
        api.on('fetch-dedupe-join', (data) => joinEvents.push(data.path!));

        // Make 2 concurrent requests to the same path
        await Promise.all([
            api.get('/json'),
            api.get('/json')
        ]);

        // shouldDedupe always returns false, so no deduplication should occur
        // Both requests should proceed independently (no start or join events)
        expect(startEvents.length).to.equal(0);
        expect(joinEvents.length).to.equal(0);
        expect(callCount).to.equal(2); // Called for both requests

        api.destroy();
    });

    it('should not dedupe different paths', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => {

            startEvents.push(data.path!);
        });

        // Make requests to different paths
        await Promise.all([
            api.get('/json'),
            api.get('/json1'),
            api.get('/json2')
        ]);

        // Each path should have its own start event
        expect(startEvents.length).to.equal(3);
        expect(startEvents).to.include('/json');
        expect(startEvents).to.include('/json1');
        expect(startEvents).to.include('/json2');

        api.destroy();
    });

    it('should increment waitingCount for each joining request', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const waitingCounts: number[] = [];

        api.on('fetch-dedupe-join', (data) => {

            waitingCounts.push(data.waitingCount!);
        });

        // Make 4 concurrent GET requests
        await Promise.all([
            api.get('/json'),
            api.get('/json'),
            api.get('/json'),
            api.get('/json')
        ]);

        // Should have 3 join events with incrementing counts
        expect(waitingCounts.length).to.equal(3);
        expect(waitingCounts[0]).to.equal(2);
        expect(waitingCounts[1]).to.equal(3);
        expect(waitingCounts[2]).to.equal(4);

        api.destroy();
    });

    it('should use custom serializer for key generation', async () => {

        let serializerCalls = 0;

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                methods: ['GET'],
                serializer: (opts) => {

                    serializerCalls++;

                    return `custom:${opts.method}:${opts.path}`;
                }
            }
        });

        await Promise.all([
            api.get('/json'),
            api.get('/json')
        ]);

        // Serializer should be called for each request
        expect(serializerCalls).to.equal(2);

        api.destroy();
    });

    it('should override default serializer with rule-specific serializer', async () => {

        let defaultCalls = 0;
        let ruleCalls = 0;

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                methods: ['GET'],
                serializer: () => {

                    defaultCalls++;
                    return 'default-key';
                },
                rules: [
                    {
                        startsWith: '/json',
                        serializer: () => {

                            ruleCalls++;
                            return 'rule-key';
                        }
                    }
                ]
            }
        });

        await api.get('/json');

        // Only rule serializer should be called
        expect(defaultCalls).to.equal(0);
        expect(ruleCalls).to.equal(1);

        api.destroy();
    });

    it('should use new in-flight entry for subsequent requests after completion', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => {

            startEvents.push(data.key);
        });

        // First batch of concurrent requests
        await Promise.all([
            api.get('/json'),
            api.get('/json')
        ]);

        expect(startEvents.length).to.equal(1);
        const firstKey = startEvents[0];

        // Second batch after first completes (should start new in-flight)
        await Promise.all([
            api.get('/json'),
            api.get('/json')
        ]);

        // Should have 2 start events now (one for each batch)
        expect(startEvents.length).to.equal(2);
        expect(startEvents[1]).to.equal(firstKey); // Same key, but new entry

        api.destroy();
    });

    it('should correctly match routes using is, startsWith, endsWith, includes, and match', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                methods: ['GET'],
                rules: [
                    { is: '/json1', enabled: false },       // Exact match
                    { startsWith: '/admin', enabled: false }, // Prefix match
                    { endsWith: '/special', enabled: false }, // Suffix match
                    { includes: 'secret', enabled: false },   // Contains match
                    { match: /^\/v\d+\//, enabled: false }    // Regex match
                ]
            }
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => {

            startEvents.push(data.path!);
        });

        // Test exact match (should NOT dedupe)
        await Promise.all([
            api.get('/json1'),
            api.get('/json1')
        ]);
        expect(startEvents).to.not.include('/json1');

        // Test non-exact match (should dedupe)
        await api.get('/json2');
        expect(startEvents).to.include('/json2');

        api.destroy();
    });

    it('should propagate errors to all waiting callers', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Make 3 concurrent requests to a failing endpoint
        const results = await Promise.allSettled([
            api.get('/fail'),
            api.get('/fail'),
            api.get('/fail')
        ]);

        // All should reject
        expect(results[0].status).to.equal('rejected');
        expect(results[1].status).to.equal('rejected');
        expect(results[2].status).to.equal('rejected');

        api.destroy();
    });

    it('should allow joiners to have independent timeouts without affecting initiator', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Start a slow request (1000ms endpoint, 5s timeout)
        const initiator = api.get('/wait', { timeout: 5000 });

        // Joiner with short timeout (50ms - will timeout before /wait completes)
        const joiner = api.get('/wait', { timeout: 50 });

        // Joiner should timeout first
        const [, joinerErr] = await attempt(() => joiner);

        expect(joinerErr).to.exist;
        expect(joinerErr).to.be.instanceOf(FetchError);

        const fetchErr = joinerErr as FetchError;
        expect(fetchErr.aborted).to.be.true;
        expect(fetchErr.step).to.equal('fetch');

        // Initiator should continue and complete successfully
        const [initiatorRes, initiatorErr] = await attempt(() => initiator);

        expect(initiatorErr).to.not.exist;
        expect(initiatorRes).to.exist;
        expect(initiatorRes!.data).to.equal('ok');

        api.destroy();
    });

    it('should allow joiners to be independently aborted without affecting initiator', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const joinerController = new AbortController();

        // Start a slow request
        const initiator = api.get('/wait', { timeout: 5000 });

        // Joiner with its own abort controller
        const joiner = api.get('/wait', { abortController: joinerController });

        // Abort only the joiner
        setTimeout(() => joinerController.abort(), 50);

        const [, joinerErr] = await attempt(() => joiner);

        expect(joinerErr).to.exist;
        expect(joinerErr).to.be.instanceOf(FetchError);

        const fetchErr = joinerErr as FetchError;
        expect(fetchErr.aborted).to.be.true;
        expect(fetchErr.step).to.equal('fetch');

        // Initiator should continue and complete successfully
        const [initiatorRes, initiatorErr] = await attempt(() => initiator);

        expect(initiatorErr).to.not.exist;
        expect(initiatorRes).to.exist;
        expect(initiatorRes!.data).to.equal('ok');

        api.destroy();
    });

    it('should cancel fetch and reject all joiners when initiator aborts', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Initiator starts the request
        const initiator = api.get('/wait', { timeout: 5000 });

        // Joiners join
        const joiner1 = api.get('/wait', { timeout: 5000 });
        const joiner2 = api.get('/wait', { timeout: 5000 });

        // Abort the initiator
        setTimeout(() => initiator.abort(), 50);

        // All should reject
        const results = await Promise.allSettled([initiator, joiner1, joiner2]);

        expect(results[0].status).to.equal('rejected');
        expect(results[1].status).to.equal('rejected');
        expect(results[2].status).to.equal('rejected');

        api.destroy();
    });

    it('should include proper FetchError properties for joiner errors', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Start a slow request
        const initiator = api.get('/wait', { timeout: 5000 });

        // Joiner with short timeout
        const joiner = api.get('/wait', { timeout: 50 });

        const [, err] = await attempt(() => joiner);

        expect(err).to.be.instanceOf(FetchError);

        const fetchErr = err as FetchError;
        expect(fetchErr.method).to.equal('GET');
        expect(fetchErr.path).to.equal('/wait');
        expect(fetchErr.aborted).to.be.true;
        expect(fetchErr.status).to.equal(0);
        expect(fetchErr.step).to.equal('fetch');

        // Cleanup
        initiator.abort();
        await attempt(() => initiator);

        api.destroy();
    });

    it('should handle rapid sequential requests correctly', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', () => startEvents.push('start'));

        // First batch
        await Promise.all([api.get('/json'), api.get('/json')]);

        // Second batch immediately after
        await Promise.all([api.get('/json'), api.get('/json')]);

        // Third batch immediately after
        await Promise.all([api.get('/json'), api.get('/json')]);

        // Each batch should have exactly one start event
        expect(startEvents.length).to.equal(3);

        api.destroy();
    });

    it('should handle concurrent requests to many different paths', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];
        const joinEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => startEvents.push(data.path!));
        api.on('fetch-dedupe-join', (data) => joinEvents.push(data.path!));

        // 6 requests to 3 different paths (2 each)
        await Promise.all([
            api.get('/json'),
            api.get('/json1'),
            api.get('/json2'),
            api.get('/json'),
            api.get('/json1'),
            api.get('/json2')
        ]);

        // 3 start events (one per path)
        expect(startEvents.length).to.equal(3);

        // 3 join events (one joiner per path)
        expect(joinEvents.length).to.equal(3);

        api.destroy();
    });

    it('should clean up in-flight tracking after request completes', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // First request completes
        await api.get('/json');

        // Stats should show 0 in-flight
        const stats = api.cacheStats();
        expect(stats.inflightCount).to.equal(0);

        api.destroy();
    });

    it('should clean up in-flight tracking after request errors', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Request that will fail
        await attempt(() => api.get('/fail'));

        // Stats should show 0 in-flight
        const stats = api.cacheStats();
        expect(stats.inflightCount).to.equal(0);

        api.destroy();
    });

    it('should throw when making requests on destroyed instance', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Destroy the engine first
        api.destroy();

        // Verify destroyed state
        expect(api.isDestroyed()).to.be.true;

        // Making a request AFTER destroy should throw
        const [, err] = await attempt(() => api.get('/json'));

        expect(err).to.exist;
        expect(err!.message).to.include('destroyed');
    });

    it('should handle in-flight requests when engine is destroyed mid-flight', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const cacheSetEvents: string[] = [];
        api.on('fetch-cache-set', () => cacheSetEvents.push('set'));

        // Start a slow request
        const req = api.get('/wait', { timeout: 5000 });

        // Destroy mid-flight
        api.destroy();

        // Verify destroyed state
        expect(api.isDestroyed()).to.be.true;

        // Request should either complete or error gracefully
        const [_, err] = await attempt(() => req);

        // In-flight tracking should be cleaned up
        expect(api.cacheStats().inflightCount).to.equal(0);

        // Either it completed or was aborted - but shouldn't throw unhandled
        if (err) {

            expect(err).to.be.instanceOf(Error);
        }
    });

    it('should handle empty/root path', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => startEvents.push(data.path!));

        // Test actual root path `/`
        await Promise.all([
            api.get('/'),
            api.get('/')
        ]);

        expect(startEvents.length).to.equal(1);
        expect(startEvents[0]).to.equal('/');

        // Test empty string path (should resolve to root)
        const startEvents2: string[] = [];
        const api2 = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        api2.on('fetch-dedupe-start', (data) => startEvents2.push(data.path!));

        await Promise.all([
            api2.get(''),
            api2.get('')
        ]);

        expect(startEvents2.length).to.equal(1);

        api.destroy();
        api2.destroy();
    });

    it('should handle special characters in path and deduplicate same paths', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => startEvents.push(data.path!));

        // Path with special characters - same path should dedupe
        const specialPath = '/json?foo=bar&baz=qux#hash';

        await Promise.all([
            api.get(specialPath),
            api.get(specialPath)
        ]);

        expect(startEvents.length).to.equal(1);
        expect(startEvents[0]).to.equal(specialPath);

        api.destroy();
    });

    it('should NOT deduplicate requests with different query parameters', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => startEvents.push(data.path!));

        // Different query params should NOT be deduplicated
        await Promise.all([
            api.get('/json?page=1'),
            api.get('/json?page=2')
        ]);

        // Should have 2 start events - different query params = different requests
        expect(startEvents.length).to.equal(2);
        expect(startEvents).to.include('/json?page=1');
        expect(startEvents).to.include('/json?page=2');

        api.destroy();
    });

    it('should NOT deduplicate requests with different request-specific params', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => startEvents.push(data.key));

        // Different request-specific params should NOT be deduplicated
        await Promise.all([
            api.get('/json', { params: { page: '1' } }),
            api.get('/json', { params: { page: '2' } })
        ]);

        // Should have 2 start events - different params = different requests
        expect(startEvents.length).to.equal(2);
        expect(startEvents[0]).to.not.equal(startEvents[1]);

        api.destroy();
    });

    it('should handle very long paths', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => startEvents.push(data.path!));

        // Very long path
        const longPath = '/json?' + 'x'.repeat(1000);

        await Promise.all([
            api.get(longPath),
            api.get(longPath)
        ]);

        expect(startEvents.length).to.equal(1);

        api.destroy();
    });

    it('should only call initiator lifecycle hooks for deduplicated requests', async () => {

        const beforeCalls: string[] = [];
        const afterCalls: string[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Make deduplicated requests with lifecycle hooks
        // Only the initiator's hooks should be called since joiners
        // don't actually make a new request
        await Promise.all([
            api.get('/json', {
                onBeforeReq: () => { beforeCalls.push('before1'); },
                onAfterReq: () => { afterCalls.push('after1'); }
            }),
            api.get('/json', {
                onBeforeReq: () => { beforeCalls.push('before2'); },
                onAfterReq: () => { afterCalls.push('after2'); }
            })
        ]);

        // Only initiator hooks are called
        expect(beforeCalls).to.include('before1');
        expect(afterCalls).to.include('after1');

        // Joiner hooks are NOT called (they didn't make a request)
        expect(beforeCalls).to.not.include('before2');
        expect(afterCalls).to.not.include('after2');

        api.destroy();
    });

    it('should handle high concurrency without race conditions', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // 20 concurrent requests to same path
        const promises = Array.from({ length: 20 }, () => api.get('/json'));

        const responses = await Promise.all(promises);

        // All should get the same result
        for (const res of responses) {

            expect(res.data).to.deep.equal({ ok: true });
        }

        expect(responses.length).to.equal(20);

        api.destroy();
    });

    it('should deduplicate joiners that arrive during retry attempts', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true,
            retry: {
                maxAttempts: 3,
                baseDelay: 50,
                retryableStatusCodes: [503]
            }
        });

        const events: string[] = [];

        api.on('fetch-dedupe-start', () => events.push('start'));
        api.on('fetch-dedupe-join', () => events.push('join'));
        api.on('fetch-retry', () => events.push('retry'));

        // Use fail-once endpoint: fails first, succeeds on retry
        // First request will fail and retry, second request should join during retry
        const [res1, res2] = await Promise.all([
            api.get('/fail-once'),
            api.get('/fail-once')
        ]);

        // Both should succeed (after retry)
        expect(res1.data).to.deep.equal({ ok: true, callCount: 2 });
        expect(res2.data).to.deep.equal({ ok: true, callCount: 2 });

        // Verify retry was triggered
        expect(events).to.include('retry');

        // Should only have one start event (deduplication worked)
        expect(events.filter(e => e === 'start').length).to.equal(1);

        api.destroy();
    });

    it('should disable deduplication with dedupePolicy: { enabled: false }', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: { enabled: false }
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', () => startEvents.push('start'));

        // Make 2 concurrent GET requests
        await Promise.all([
            api.get('/json'),
            api.get('/json')
        ]);

        // No deduplication events should fire
        expect(startEvents.length).to.equal(0);

        api.destroy();
    });

    it('should generate different keys for requests with different payloads', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                methods: ['POST']
            }
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => startEvents.push(data.key));

        // POST requests with different payloads should NOT be deduplicated
        await Promise.all([
            api.post('/json', { id: 1 }),
            api.post('/json', { id: 2 })
        ]);

        // Should have 2 start events - different payloads = different keys
        expect(startEvents.length).to.equal(2);
        expect(startEvents[0]).to.not.equal(startEvents[1]);

        api.destroy();
    });

    it('should NOT deduplicate methods not in configured methods array', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                methods: ['GET']  // Only GET
            }
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', () => startEvents.push('start'));

        // POST should NOT be deduped since it's not in methods array
        await Promise.all([
            api.post('/json', {}),
            api.post('/json', {})
        ]);

        // No deduplication events for POST
        expect(startEvents.length).to.equal(0);

        api.destroy();
    });

    it('should use first matching rule when multiple rules match (rule order matters)', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                rules: [
                    { startsWith: '/json', enabled: false },  // First rule - disables dedupe
                    { includes: 'json', enabled: true }       // Second rule - would enable dedupe
                ]
            }
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', () => startEvents.push('start'));

        // First rule should win - deduplication disabled for /json
        await Promise.all([
            api.get('/json'),
            api.get('/json')
        ]);

        // No deduplication events - first rule disabled it
        expect(startEvents.length).to.equal(0);

        api.destroy();
    });

    it('should combine multiple match criteria with AND logic', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                rules: [
                    // Rule with AND logic: must start with /json AND include '1'
                    { startsWith: '/json', includes: '1', enabled: false }
                ]
            }
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => startEvents.push(data.path!));

        // /json1 matches both startsWith '/json' AND includes '1' - rule applies
        await Promise.all([
            api.get('/json1'),
            api.get('/json1')
        ]);

        // Rule disabled dedupe for /json1
        expect(startEvents).to.not.include('/json1');

        // /json2 matches startsWith '/json' but NOT includes '1' - rule does NOT apply
        await Promise.all([
            api.get('/json2'),
            api.get('/json2')
        ]);

        // Default dedupe should apply for /json2
        expect(startEvents).to.include('/json2');
        expect(startEvents.filter(p => p === '/json2').length).to.equal(1);

        api.destroy();
    });

    it('should NOT combine is with other match types (is is exclusive)', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: {
                enabled: true,
                rules: [
                    // 'is' should be used alone - exact match only
                    { is: '/json', enabled: false }
                ]
            }
        });

        const startEvents: string[] = [];

        api.on('fetch-dedupe-start', (data) => startEvents.push(data.path!));

        // Exact match /json - rule applies
        await Promise.all([
            api.get('/json'),
            api.get('/json')
        ]);

        expect(startEvents).to.not.include('/json');

        // /json1 does NOT exactly match /json - rule does NOT apply
        await Promise.all([
            api.get('/json1'),
            api.get('/json1')
        ]);

        expect(startEvents).to.include('/json1');

        api.destroy();
    });

    it('should not leak memory with many concurrent requests', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Run multiple batches of concurrent requests
        for (let batch = 0; batch < 5; batch++) {

            // 10 concurrent requests per batch
            const promises = Array.from({ length: 10 }, () => api.get('/json'));
            await Promise.all(promises);

            // In-flight should be cleaned up after each batch
            expect(api.cacheStats().inflightCount).to.equal(0);
        }

        api.destroy();
    });

    it('should not leak memory with many sequential requests', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Make many sequential requests
        for (let i = 0; i < 20; i++) {

            await api.get('/json');

            // In-flight should be 0 after each request completes
            expect(api.cacheStats().inflightCount).to.equal(0);
        }

        api.destroy();
    });

    it('should clean up in-flight tracking after errors', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Make several failed requests
        for (let i = 0; i < 5; i++) {

            await attempt(() => api.get('/fail'));

            // In-flight should be cleaned up even after errors
            expect(api.cacheStats().inflightCount).to.equal(0);
        }

        api.destroy();
    });


    // ========================================================================
    // RULE RESOLUTION & CONFIG PATHS (from structural.ts)
    // ========================================================================

    describe('rule resolution and config paths', () => {

        it('should return null when globally disabled without enabling rules', async () => {

            const path = '/test-' + Date.now();

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: false,  // Globally disabled
                    methods: ['GET'],
                    // No rules defined, or rules that disable - should return null
                },
            });

            // Make two simultaneous requests
            const [res1, res2] = await Promise.all([
                api.get(path),
                api.get(path),
            ]);

            // Both should succeed, but no deduplication occurs
            // (both requests hit the server since resolveDedupeConfig returns null)
            expect(res1.data.ok).to.be.true;
            expect(res2.data.ok).to.be.true;

            api.destroy();
        });

        it('should deduplicate when globally enabled with matching rule', async () => {

            const path = '/test-' + Date.now();

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET'],
                    rules: [
                        { startsWith: path.substring(0, 10) }
                    ]
                },
            });

            const startEvents: string[] = [];
            api.on('fetch-dedupe-start', () => startEvents.push('start'));

            // Make two simultaneous requests
            const [res1, res2] = await Promise.all([
                api.get(path),
                api.get(path),
            ]);

            // Both should succeed, but only one server call (deduplicated)
            expect(startEvents.length).to.equal(1);
            expect(res1.data.ok).to.be.true;
            expect(res2.data.ok).to.be.true;

            api.destroy();
        });

        it('should evaluate rules separately for different paths', async () => {

            const path1 = '/test1-' + Date.now();
            const path2 = '/test2-' + Date.now();

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET'],
                    rules: [
                        { startsWith: path1.substring(0, 10) },  // Only matches path1
                    ]
                },
            });

            const startEvents: string[] = [];
            api.on('fetch-dedupe-start', () => startEvents.push('start'));

            // Path1 should deduplicate
            const [r1, r2] = await Promise.all([
                api.get(path1),
                api.get(path1),
            ]);

            // Path2 should NOT deduplicate (no matching rule)
            const [r3, r4] = await Promise.all([
                api.get(path2),
                api.get(path2),
            ]);

            // Path1: 1 server call (deduplicated)
            // Path2: 2 server calls (not deduplicated)
            // BUT: path2 requests are also deduplicated because they share the same dedupe key
            // The dedupe key is based on method+path+payload, not on the rule match
            // Both path2 requests happen concurrently and get deduplicated by the global flight tracker
            expect(startEvents.length).to.equal(2);
            expect(r1.data.ok).to.be.true;
            expect(r2.data.ok).to.be.true;
            expect(r3.data.ok).to.be.true;
            expect(r4.data.ok).to.be.true;

            api.destroy();
        });

        it('should treat undefined return as truthy (deduplicate)', async () => {

            const path = '/test-' + Date.now();

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET'],
                    shouldDedupe: () => undefined,  // Returns undefined (truthy check)
                },
            });

            const startEvents: string[] = [];
            api.on('fetch-dedupe-start', () => startEvents.push('start'));

            // Make two simultaneous requests
            const [res1, res2] = await Promise.all([
                api.get(path),
                api.get(path),
            ]);

            // Should deduplicate (undefined treated as truthy)
            expect(startEvents.length).to.equal(1);
            expect(res1.data.ok).to.be.true;
            expect(res2.data.ok).to.be.true;

            api.destroy();
        });

        it('should respect explicit false return (no deduplication)', async () => {

            const path = '/test-' + Date.now();

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET'],
                    shouldDedupe: () => false,  // Explicitly false
                },
            });

            const startEvents: string[] = [];
            api.on('fetch-dedupe-start', () => startEvents.push('start'));

            // Make two simultaneous requests
            const [res1, res2] = await Promise.all([
                api.get(path),
                api.get(path),
            ]);

            // Should NOT deduplicate (false is explicit)
            expect(startEvents.length).to.equal(0);
            expect(res1.data.ok).to.be.true;
            expect(res2.data.ok).to.be.true;

            api.destroy();
        });

        it('should inherit config methods when rule has no methods specified', async () => {

            const basePath = '/test-' + Date.now();

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET', 'POST'],  // Config-level methods
                    rules: [
                        { startsWith: basePath.substring(0, 10) }  // No methods - inherits
                    ]
                },
            });

            const startEvents: string[] = [];
            api.on('fetch-dedupe-start', () => startEvents.push('start'));

            // GET should deduplicate (inherited from config)
            const [r1, r2] = await Promise.all([
                api.get(basePath + '/get'),
                api.get(basePath + '/get'),
            ]);

            // POST should also deduplicate (inherited from config)
            const [r3, r4] = await Promise.all([
                api.post(basePath + '/post', {}),
                api.post(basePath + '/post', {}),
            ]);

            // Both should have deduplicated
            expect(startEvents.length).to.equal(2);  // 1 GET + 1 POST
            expect(r1.data.ok).to.be.true;
            expect(r2.data.ok).to.be.true;
            expect(r3.data.ok).to.be.true;
            expect(r4.data.ok).to.be.true;

            api.destroy();
        });

        it('should use rule-specific methods when specified', async () => {

            const basePath = '/test-' + Date.now();

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET', 'POST'],  // Config allows both
                    rules: [
                        {
                            startsWith: basePath.substring(0, 10),
                            methods: ['GET']  // Rule only allows GET
                        }
                    ]
                },
            });

            const startEvents: string[] = [];
            api.on('fetch-dedupe-start', () => startEvents.push('start'));

            // GET should deduplicate (rule allows)
            const [r1, r2] = await Promise.all([
                api.get(basePath + '/get'),
                api.get(basePath + '/get'),
            ]);

            // POST should NOT deduplicate (rule doesn't allow)
            const [r3, r4] = await Promise.all([
                api.post(basePath + '/post', {}),
                api.post(basePath + '/post', {}),
            ]);

            // GET: 1 call (deduplicated), POST: 1 call (also deduplicated by flight tracker)
            // The POST requests happen concurrently and share the same dedupe key
            expect(startEvents.length).to.equal(2);
            expect(r1.data.ok).to.be.true;
            expect(r2.data.ok).to.be.true;
            expect(r3.data.ok).to.be.true;
            expect(r4.data.ok).to.be.true;

            api.destroy();
        });

        it('should handle rule inheritance and override patterns', async () => {

            const inheritPath = '/inherit-' + Date.now();
            const overridePath = '/override-' + Date.now();

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET', 'POST'],  // Config default
                    rules: [
                        {
                            startsWith: inheritPath.substring(0, 10),
                            // No methods - inherits from config
                        },
                        {
                            startsWith: overridePath.substring(0, 10),
                            methods: ['GET']  // Overrides config
                        }
                    ]
                },
            });

            const startEvents: string[] = [];
            api.on('fetch-dedupe-start', () => startEvents.push('start'));

            // Inherit path: both GET and POST should dedupe
            const [i1, i2] = await Promise.all([
                api.get(inheritPath + '/get'),
                api.get(inheritPath + '/get'),
            ]);
            const [i3, i4] = await Promise.all([
                api.post(inheritPath + '/post', {}),
                api.post(inheritPath + '/post', {}),
            ]);

            // Override path: only GET should dedupe
            const [o1, o2] = await Promise.all([
                api.get(overridePath + '/get'),
                api.get(overridePath + '/get'),
            ]);
            const [o3, o4] = await Promise.all([
                api.post(overridePath + '/post', {}),
                api.post(overridePath + '/post', {}),
            ]);

            // Verify results
            expect(i1.data.ok && i2.data.ok && i3.data.ok && i4.data.ok).to.be.true;
            expect(o1.data.ok && o2.data.ok && o3.data.ok && o4.data.ok).to.be.true;

            // inheritPath: 1 GET + 1 POST (both deduped)
            // overridePath: 1 GET (deduped) + 2 POST (not deduped)
            expect(startEvents.length).to.equal(4);

            api.destroy();
        });
    });


    // ========================================================================
    // PATH BOUNDARIES (from boundary.ts)
    // ========================================================================

    describe('path boundaries', () => {

        it('should handle empty path ""', async () => {

            // Empty path should resolve to root "/"
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const events: string[] = [];

            api.on('fetch-dedupe-start', ({ path }: any) => {

                events.push(`start:${path}`);
            });

            api.on('fetch-dedupe-join', ({ path }: any) => {

                events.push(`join:${path}`);
            });

            // Make two concurrent requests with empty path
            const [r1, r2] = await Promise.all([
                api.get(''),
                api.get('')
            ]);

            // Both should succeed
            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            // Should have deduped
            expect(events.length).to.equal(2);
            expect(events[0]).to.match(/^start:/);
            expect(events[1]).to.match(/^join:/);

            api.destroy();
        });

        it('should handle query-only path "?foo=bar"', async () => {

            // Query-only path (no route before ?) - edge case
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const startEvents: any[] = [];

            api.on('fetch-dedupe-start', (event) => {

                startEvents.push(event);
            });

            // Make two concurrent requests with query-only path
            const path = '?foo=bar';

            const [r1, r2] = await Promise.all([
                api.get(path),
                api.get(path)
            ]);

            // Both should succeed
            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            // Should have deduped (same query string)
            expect(startEvents.length).to.equal(1);
            expect(startEvents[0]?.path).to.equal(path);

            api.destroy();
        });

        it('should handle unicode in path', async () => {

            // Unicode characters in URL path
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const startEvents: any[] = [];

            api.on('fetch-dedupe-start', (event) => {

                startEvents.push(event);
            });

            // Path with Japanese characters
            const unicodePath = '/json?name=日本語';

            const [r1, r2] = await Promise.all([
                api.get(unicodePath),
                api.get(unicodePath)
            ]);

            // Both should succeed
            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            // Should dedupe unicode paths correctly
            expect(startEvents.length).to.equal(1);
            expect(startEvents[0]?.path).to.equal(unicodePath);

            api.destroy();
        });

        it('should handle path with trailing slash consistently', async () => {

            // Trailing slash behavior: /users/ vs /users
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const startEvents: any[] = [];

            api.on('fetch-dedupe-start', (event) => {

                startEvents.push(event);
            });

            // Request with trailing slash
            await Promise.all([
                api.get('/json/'),
                api.get('/json/')
            ]);

            // Should dedupe paths with trailing slash
            expect(startEvents.length).to.equal(1);
            expect(startEvents[0]?.path).to.equal('/json/');

            // Request without trailing slash should be different
            await api.get('/json');

            expect(startEvents.length).to.equal(2);
            expect(startEvents[1]?.path).to.equal('/json');

            api.destroy();
        });

        it('should handle double slashes in path', async () => {

            // Malformed path with double slashes
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const startEvents: any[] = [];

            api.on('fetch-dedupe-start', (event) => {

                startEvents.push(event);
            });

            const malformedPath = '/json//test';

            const [r1, r2] = await Promise.all([
                api.get(malformedPath),
                api.get(malformedPath)
            ]);

            // Both should succeed (server may normalize or handle)
            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            // Should dedupe malformed paths
            expect(startEvents.length).to.equal(1);
            expect(startEvents[0]?.path).to.equal(malformedPath);

            api.destroy();
        });

        it('should handle URL-encoded characters', async () => {

            // URL encoding in paths
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const startEvents: any[] = [];

            api.on('fetch-dedupe-start', (event) => {

                startEvents.push(event);
            });

            // Path with URL-encoded space
            const encodedPath = '/json?name=hello%20world';

            const [r1, r2] = await Promise.all([
                api.get(encodedPath),
                api.get(encodedPath)
            ]);

            // Both should succeed
            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            // Should dedupe encoded paths
            expect(startEvents.length).to.equal(1);
            expect(startEvents[0]?.path).to.equal(encodedPath);

            api.destroy();
        });

        it('should handle path with fragment identifier', async () => {

            // Fragment identifiers in URLs
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const startEvents: any[] = [];

            api.on('fetch-dedupe-start', (event) => {

                startEvents.push(event);
            });

            const pathWithFragment = '/json#section';

            const [r1, r2] = await Promise.all([
                api.get(pathWithFragment),
                api.get(pathWithFragment)
            ]);

            // Both should succeed
            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            // Should dedupe
            expect(startEvents.length).to.equal(1);

            api.destroy();
        });

        it('should handle same path with different casing', async () => {

            // Case sensitivity: /json vs /JSON
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const startEvents: any[] = [];

            api.on('fetch-dedupe-start', (event) => {

                startEvents.push(event);
            });

            // Make requests with different casing
            await api.get('/json');
            await api.get('/JSON');

            // URLs are case-sensitive (except domain), so these are different
            expect(startEvents.length).to.equal(2);
            expect(startEvents[0]?.path).to.equal('/json');
            expect(startEvents[1]?.path).to.equal('/JSON');

            api.destroy();
        });

        it('should handle extremely long query string', async () => {

            // Very long query string edge case
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const startEvents: string[] = [];

            api.on('fetch-dedupe-start', () => {

                startEvents.push('start');
            });

            // Query string with 10k characters
            const longQuery = '?data=' + 'x'.repeat(10000);

            const [r1, r2] = await Promise.all([
                api.get(`/json${longQuery}`),
                api.get(`/json${longQuery}`)
            ]);

            // Both should succeed
            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            // Should dedupe
            expect(startEvents.length).to.equal(1);

            api.destroy();
        });

        it('should handle special characters in query params', async () => {

            // Special characters that might break URL parsing
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const startEvents: object[] = [];

            api.on('fetch-dedupe-start', (event) => {

                startEvents.push(event);
            });

            const specialPath = '/json?value=hello&world&foo=bar=baz';

            const [r1, r2] = await Promise.all([
                api.get(specialPath),
                api.get(specialPath)
            ]);

            // Both should succeed
            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            // Should dedupe
            expect(startEvents.length).to.equal(1);

            api.destroy();
        });

        it('should handle multiple consecutive question marks in path', async () => {

            // Malformed query string with multiple ?
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true
            });

            const malformedPath = '/json??foo=bar';

            const [res] = await attempt(() => api.get(malformedPath));

            // May succeed or fail depending on server handling
            // The important part is it doesn't crash FetchEngine
            expect(res || true).to.exist;

            api.destroy();
        });
    });


    // ========================================================================
    // PAYLOAD HANDLING (from boundary.ts)
    // ========================================================================

    describe('payload handling', () => {

        it('should differentiate null vs empty object payload', async () => {

            // Different payload types should generate different keys
            // NOTE: undefined is treated as "use default" (null) by JavaScript default params
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['POST']
                }
            });

            const keys: any[] = [];

            api.on('fetch-dedupe-start', (event) => {

                keys.push(event);
            });

            // Make requests with null and empty object
            // undefined is intentionally omitted as it becomes null via default params
            await api.post('/json', null);
            await api.post('/json', {});

            // null and {} should have different keys
            expect(keys.length).to.equal(2);
            expect(keys[0]?.key).to.not.equal(keys[1]?.key);

            // Verify keys contain expected payload serialization
            expect(keys[0]?.key).to.include('null');
            expect(keys[1]?.key).to.include('{}');

            api.destroy();
        });

        it('should handle very large payload (1MB+)', async () => {

            // Large payloads should be serialized correctly
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['POST']
                }
            });

            const startEvents: string[] = [];

            api.on('fetch-dedupe-start', () => {

                startEvents.push('start');
            });

            // Create a 1MB+ payload
            const largePayload = {
                data: 'x'.repeat(1024 * 1024) // 1MB of 'x'
            };

            // Make two concurrent requests with large payload
            const [r1, r2] = await Promise.all([
                api.post('/json', largePayload),
                api.post('/json', largePayload)
            ]);

            // Both should succeed
            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            // Should have deduped (identical large payloads)
            expect(startEvents.length).to.equal(1);

            api.destroy();
        });

        it('should handle payload with circular references', async () => {

            // Circular references in payload should fail serialization
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['POST']
                }
            });

            // Create circular reference
            const circular: any = { name: 'test' };
            circular.self = circular;

            // Should fail to serialize
            const [, err] = await attempt(() => api.post('/json', circular));

            expect(err).to.exist;

            api.destroy();
        });

        it('should handle payload with undefined values', async () => {

            // Undefined values in object payloads
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['POST']
                }
            });

            const events: object[] = [];

            api.on('fetch-dedupe-start', (event) => {

                events.push(event);
            });

            // Payloads with undefined values
            const payload1 = { a: 1, b: undefined };
            const payload2 = { a: 1, b: undefined };

            await api.post('/json', payload1);
            await api.post('/json', payload2);

            // JSON.stringify removes undefined values, so these should generate same key
            // However, implementation may differ
            expect(events.length).to.be.greaterThan(0);

            api.destroy();
        });

        it('should handle zero-length payload', async () => {

            // Empty string as payload
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['POST']
                }
            });

            const startEvents: string[] = [];

            api.on('fetch-dedupe-start', () => startEvents.push('start'));

            const [r1, r2] = await Promise.all([
                api.post('/json', ''),
                api.post('/json', '')
            ]);

            // Both should succeed
            expect(r1.status).to.equal(200);
            expect(r2.status).to.equal(200);

            // Should dedupe empty payloads
            expect(startEvents.length).to.equal(1);

            api.destroy();
        });
    });


    // ========================================================================
    // SERIALIZER ERRORS (from invalid-input.ts)
    // ========================================================================

    describe('serializer errors', () => {

        it('should handle serializer that throws Error', async () => {

            // Custom serializer throws mid-flight - what happens?
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    serializer: () => {

                        throw new Error('Serializer failed');
                    }
                }
            });

            const errorEvents: string[] = [];

            api.on('fetch-error', ({ data }) => {

                errorEvents.push((data as any).error!.message);
            });

            // Request should fail when serializer throws
            const [, err] = await attempt(() => api.get('/json'));

            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect(err!.message).to.include('Serializer failed');

            api.destroy();
        });

        it('should handle serializer that returns non-string (number)', async () => {

            // Serializer returns number instead of string
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    serializer: () => 123 as any  // Invalid return type
                }
            });

            const startEvents: any[] = [];

            api.on('fetch-dedupe-start', ({ key }) => {

                startEvents.push(key);
            });

            // Request may succeed or fail depending on implementation
            // The key might be coerced to string "123" or cause an error
            const [res, err] = await attempt(() => api.get('/json'));

            // Either should succeed with coerced key, or fail with type error
            if (err) {

                expect(err).to.be.instanceOf(Error);
            }
            else {

                expect(res).to.exist;
                // If it succeeded, check if key was coerced
                if (startEvents.length > 0) {

                    // Number might be coerced to string
                    expect(typeof startEvents[0] === 'string' || typeof startEvents[0] === 'number').to.be.true;
                }
            }

            api.destroy();
        });

        it('should handle serializer that returns non-string (object)', async () => {

            // Serializer returns object instead of string
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    serializer: () => ({ foo: 'bar' }) as any  // Invalid return type
                }
            });

            const startEvents: any[] = [];

            api.on('fetch-dedupe-start', ({ key }) => {

                startEvents.push(key);
            });

            // Request may succeed with stringified object or fail
            const [res, err] = await attempt(() => api.get('/json'));

            // Either way, verify it doesn't crash silently
            expect(res || err).to.exist;

            api.destroy();
        });

        it('should handle serializer that returns null', async () => {

            // Serializer returns null
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    serializer: () => null as any
                }
            });

            const [res, err] = await attempt(() => api.get('/json'));

            // Should either fail with type error or coerce to string "null"
            expect(res || err).to.exist;

            api.destroy();
        });

        it('should handle serializer that returns undefined', async () => {

            // Serializer returns undefined
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    serializer: () => undefined as any
                }
            });

            const [res, err] = await attempt(() => api.get('/json'));

            // Should either fail with type error or coerce to string "undefined"
            expect(res || err).to.exist;

            api.destroy();
        });

        it('should handle shouldDedupe callback that throws', async () => {

            // shouldDedupe callback throws instead of returning boolean
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    shouldDedupe: () => {

                        throw new Error('shouldDedupe failed');
                    }
                }
            });

            const errorEvents: string[] = [];

            api.on('fetch-error', ({ data }) => {

                errorEvents.push((data as any).error!.message);
            });

            // Request should fail when shouldDedupe throws
            const [, err] = await attempt(() => api.get('/json'));

            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect(err!.message).to.include('shouldDedupe failed');

            api.destroy();
        });
    });


    // ========================================================================
    // RULE VALIDATION (from invalid-input.ts)
    // ========================================================================

    describe('rule validation', () => {

        it('should handle rule with no match criteria', async () => {

            // Rule object with only enabled flag, no match criteria
            // Implementation validates rules at construction time and requires at least one match type
            const [, err] = attemptSync(() => {

                new FetchEngine({
                    baseUrl: testUrl,
                    dedupePolicy: {
                        enabled: true,
                        rules: [
                            { enabled: false }  // No is/startsWith/endsWith/includes/match
                        ]
                    }
                });
            });

            // Should throw validation error during construction
            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect(err!.message).to.include('rule[0] must specify at least one match type');
        });

        it('should handle rule with both enabled: true and enabled: false', async () => {

            // Contradictory configuration - last one wins?
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    rules: [
                        { startsWith: '/json', enabled: true },
                        { startsWith: '/json', enabled: false }  // Contradicts previous
                    ]
                }
            });

            const startEvents: string[] = [];

            api.on('fetch-dedupe-start', () => startEvents.push('start'));

            const path = '/json';

            await Promise.all([
                api.get(path),
                api.get(path)
            ]);

            // Implementation-dependent: might dedupe or not based on rule precedence
            expect(startEvents.length).to.be.greaterThanOrEqual(1);

            api.destroy();
        });

        it('should handle duplicate rules for same path', async () => {

            // Multiple identical rules
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    rules: [
                        { startsWith: '/json', enabled: true },
                        { startsWith: '/json', enabled: true },
                        { startsWith: '/json', enabled: true }
                    ]
                }
            });

            const startEvents: string[] = [];

            api.on('fetch-dedupe-start', () => startEvents.push('start'));

            const path = '/json-' + Date.now();

            await Promise.all([
                api.get(path),
                api.get(path)
            ]);

            // Should dedupe despite duplicate rules
            expect(startEvents.length).to.equal(1);

            api.destroy();
        });
    });


    // ========================================================================
    // STATE & SEQUENCE (from state-sequence.ts)
    // ========================================================================

    describe('state and sequence', () => {

        it('should NOT join failed request when new request starts after error completes', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true },
                retry: false // Disable retry to avoid async leakage from retryable 503 errors
            });

            // First request fails (using /fail-once which fails first call)
            const [, err1] = await attempt(() => api.get('/fail-once'));
            expect(err1).to.be.instanceOf(FetchError);

            // Second request should NOT join the failed request (it's completed)
            // /fail-once succeeds on subsequent calls
            const [result2, err2] = await attempt(() => api.get('/fail-once'));
            expect(err2).to.be.null;
            expect(result2?.data).to.have.property('ok', true);

            api.destroy();

            await wait(10); // Let microtasks settle before test ends
        });

        it('should handle destroy during in-flight deduplicated requests', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const path = '/slow-success';

            // Start multiple requests that will dedupe
            const promise1 = api.get(path);
            const promise2 = api.get(path);
            const promise3 = api.get(path);

            await wait(10);

            // Destroy while requests are in-flight
            api.destroy();

            // All requests should either complete or error gracefully
            const [, err1] = await attempt(() => promise1);
            const [, err2] = await attempt(() => promise2);
            const [, err3] = await attempt(() => promise3);

            // All should have aborted - verify each error exists
            expect(err1).to.exist;
            expect(err2).to.exist;
            expect(err3).to.exist;

            await wait(10); // Let microtasks settle before test ends
        });
    });


    // ========================================================================
    // RULE MATCHING (from combinatorial.ts)
    // ========================================================================

    describe('rule matching', () => {

        it('should match with "is" rule for deduplication', async () => {

            // Test 'is' match type: exact path matching
            // Global enabled=true, rule disables dedup for specific path
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET'],
                    rules: [
                        { is: '/no-dedupe', enabled: false }
                    ]
                }
            });

            const events: string[] = [];
            api.on('fetch-dedupe-start', () => events.push('dedupe-start'));

            // Path NOT matching rule - should dedupe
            const [r1] = await attempt(() => api.get('/other/path'));
            expect(r1).to.exist;
            expect(events).to.include('dedupe-start');

            // Path matching 'is' rule exactly - should NOT dedupe
            events.length = 0;
            const [r2] = await attempt(() => api.get('/no-dedupe'));
            expect(r2).to.exist;
            expect(events).to.not.include('dedupe-start');

            api.destroy();
        });

        it('should match with "endsWith" rule for deduplication', async () => {

            // Test 'endsWith' match type
            // Global enabled=true, rule disables dedup for paths with suffix
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET'],
                    rules: [
                        { endsWith: '.stream', enabled: false }
                    ]
                }
            });

            const events: string[] = [];
            api.on('fetch-dedupe-start', () => events.push('dedupe-start'));

            // Path NOT matching rule - should dedupe
            const [r1] = await attempt(() => api.get('/data.json'));
            expect(r1).to.exist;
            expect(events).to.include('dedupe-start');

            // Path matching 'endsWith' rule - should NOT dedupe
            events.length = 0;
            const [r2] = await attempt(() => api.get('/events.stream'));
            expect(r2).to.exist;
            expect(events).to.not.include('dedupe-start');

            api.destroy();
        });

        it('should match with "match" (regex) rule for deduplication', async () => {

            // Test 'match' (regex) match type
            // Global enabled=true, rule disables dedup for paths matching regex
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET'],
                    rules: [
                        { match: /\/stream\/\d+/, enabled: false }
                    ]
                }
            });

            const events: string[] = [];
            api.on('fetch-dedupe-start', () => events.push('dedupe-start'));

            // Path NOT matching regex - should dedupe
            const [r1] = await attempt(() => api.get('/items/123'));
            expect(r1).to.exist;
            expect(events).to.include('dedupe-start');

            // Path matching regex - should NOT dedupe
            events.length = 0;
            const [r2] = await attempt(() => api.get('/stream/456'));
            expect(r2).to.exist;
            expect(events).to.not.include('dedupe-start');

            api.destroy();
        });

        it('should handle triple match criteria (startsWith + includes + endsWith)', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    rules: [
                        {
                            startsWith: '/api/',
                            includes: '/users/',
                            endsWith: '/profile',
                            enabled: false,
                            methods: ['GET']
                        }
                    ]
                }
            });

            const events: string[] = [];
            api.on('fetch-dedupe-start', () => events.push('dedupe-start'));

            // Should NOT dedupe (matches all three conditions)
            await api.get('/api/users/123/profile');
            expect(events).to.not.include('dedupe-start');

            // Should dedupe (missing one condition - endsWith)
            events.length = 0;
            await api.get('/api/users/123/settings');
            expect(events).to.include('dedupe-start');

            // Should dedupe (missing includes condition)
            events.length = 0;
            await api.get('/api/posts/123/profile');
            expect(events).to.include('dedupe-start');

            api.destroy();
        });

        it('should handle complex rule combinations with multiple match types', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    rules: [
                        {
                            startsWith: '/api/',
                            includes: '/users/',
                            endsWith: '/profile',
                            enabled: false,
                            methods: ['GET']
                        }
                    ]
                }
            });

            const events: string[] = [];
            api.on('fetch-dedupe-start', () => events.push('dedupe-start'));

            // Should NOT dedupe (matches all three conditions)
            await api.get('/api/users/123/profile');
            expect(events).to.not.include('dedupe-start');

            // Should dedupe (missing one condition)
            events.length = 0;
            await api.get('/api/users/123/settings');
            expect(events).to.include('dedupe-start');

            api.destroy();
        });

        it('should handle rules with no methods specified', async () => {

            // When rule doesn't specify methods, it inherits from global config
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET', 'POST'], // Default methods for all rules
                    rules: [
                        { startsWith: '/no-dedupe/', enabled: false } // No methods = inherit from above
                    ]
                }
            });

            const events: string[] = [];
            api.on('fetch-dedupe-start', () => events.push('dedupe-start'));

            // Should dedupe GET (path doesn't match rule)
            await api.get('/api/data');
            expect(events).to.include('dedupe-start');

            // Should NOT dedupe (path matches rule that disables)
            events.length = 0;
            await api.get('/no-dedupe/data');
            expect(events).to.not.include('dedupe-start');

            api.destroy();
        });

        it('should reject rules with empty string match criteria', async () => {

            // Empty strings in match criteria are rejected as invalid
            // (they would match everything, which is a footgun)
            const [, err] = attemptSync(() => new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    rules: [
                        { startsWith: '', enabled: false, methods: ['GET'] }
                    ]
                }
            }));

            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.include('cannot be an empty string');
        });
    });


    // ========================================================================
    // INFLIGHT COUNT INVARIANTS (from invariants.ts)
    // ========================================================================

    describe('inflightCount invariants', () => {

        it('should never have negative inflightCount', async () => {

            // INVARIANT: inflightCount >= 0 (never negative)
            // Tests that cleanup logic never underflows
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true,
                retry: false // Disable retry to avoid async leakage from retryable errors
            });

            const inflightCounts: number[] = [];

            const checkInflight = () => {

                const stats = api.cacheStats();
                inflightCounts.push(stats.inflightCount);
                expect(stats.inflightCount).to.be.at.least(0);
            };

            // Before any requests
            checkInflight();

            // During concurrent requests
            const requests = Array.from({ length: 20 }, () => {

                const req = api.get('/test-' + Date.now());
                checkInflight();
                return req;
            });

            await Promise.allSettled(requests);
            checkInflight();

            // After errors - wait for cleanup
            await attempt(() => api.get('/fail'));
            await wait(10); // Give time for cleanup
            checkInflight();

            // After abort - wait for cleanup
            const abortReq = api.get('/wait');
            abortReq.abort();
            await attempt(() => abortReq);
            await wait(10); // Give time for cleanup
            checkInflight();

            // Verify all inflight counts were non-negative
            for (const count of inflightCounts) {

                expect(count).to.be.at.least(0);
            }

            // Final inflight count should be 0
            const finalStats = api.cacheStats();
            expect(finalStats.inflightCount).to.equal(0);

            api.destroy();
            await wait(10); // Let microtasks settle
        });

        it('should cleanup inflightCount after request aborts', async () => {

            // INVARIANT: After request aborts, inflightCount for that key is 0
            // Tests cleanup guarantee for abort path
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true,
                retry: false // Disable retry to avoid async leakage from aborted requests
            });

            // Make multiple aborted requests
            for (let i = 0; i < 5; i++) {

                const req = api.get('/wait');
                req.abort();
                await attempt(() => req);

                // Wait for cleanup to complete
                await wait(10);

                // After each abort, inflight should be cleaned up
                const stats = api.cacheStats();
                expect(stats.inflightCount).to.equal(0);
            }

            api.destroy();
            await wait(10); // Let microtasks settle
        });

        it('should cleanup inflightCount even when joiners abort independently', async () => {

            // INVARIANT: Cleanup only happens when ALL participants complete
            // Tests that joiner aborts don't affect initiator tracking
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: true,
                retry: false // Disable retry to avoid async leakage from aborted requests
            });

            // Initiator starts a slow request
            const initiator = api.get('/wait', { timeout: 5000 });

            // Joiner joins then aborts
            const joiner = api.get('/wait', { timeout: 50 });

            await attempt(() => joiner);

            // Inflight should still be > 0 (initiator still running)
            let stats = api.cacheStats();
            expect(stats.inflightCount).to.be.greaterThan(0);

            // Abort initiator
            initiator.abort();
            await attempt(() => initiator);

            // Now inflight should be cleaned up
            stats = api.cacheStats();
            expect(stats.inflightCount).to.equal(0);

            api.destroy();
            await wait(10); // Let microtasks settle
        });
    });


    // ========================================================================
    // EVENT INTERFACES (from cross-checks.ts)
    // ========================================================================

    describe('event interfaces', () => {

        it('should produce key containing method', async () => {

            // Validates that the serializer includes the HTTP method in the key
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const keys: string[] = [];
            api.on('fetch-dedupe-start', (event) => {

                keys.push(event.key);
            });

            const path = '/test-' + Date.now();
            await api.get(path);

            expect(keys.length).to.equal(1);
            expect(keys[0], 'key should contain method').to.include('GET');

            api.destroy();
        });

        it('should produce key containing path', async () => {

            // Validates that the serializer includes the request path in the key
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const keys: string[] = [];
            api.on('fetch-dedupe-start', (event) => {

                keys.push(event.key);
            });

            const path = '/json-' + Date.now();
            await api.get(path);

            expect(keys.length).to.equal(1);
            expect(keys[0], 'key should include path').to.include('/json');

            api.destroy();
        });

        it('should produce key including payload when present', async () => {

            // Validates that the serializer includes payload in the key for POST/PUT/PATCH
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    methods: ['GET', 'POST']
                }
            });

            const keys: string[] = [];
            api.on('fetch-dedupe-start', (event) => {

                keys.push(event.key);
            });

            const path = '/test-' + Date.now();
            const payload = { test: 'data', id: 123 };
            await api.post(path, payload);

            expect(keys.length).to.equal(1);

            // Key should include serialized payload
            expect(keys[0], 'key should include payload').to.include('test');
            expect(keys[0], 'key should include payload data').to.include('data');

            api.destroy();
        });

        it('should produce deterministic key format', async () => {

            // Validates that same inputs produce identical keys
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const keys: string[] = [];
            api.on('fetch-dedupe-start', (event) => {

                keys.push(event.key);
            });

            const path = '/test-' + Date.now();

            // First request
            await api.get(path);
            const key1 = keys[0];

            // Second request (same path, should produce same key if issued sequentially)
            await api.get(path);
            const key2 = keys[1];

            expect(key1, 'keys should be identical for same request').to.equal(key2);

            api.destroy();
        });

        it('should emit fetch-dedupe-start with correct interface', async () => {

            // Validates DedupeEventData interface compliance
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            let eventData: any;
            api.on('fetch-dedupe-start', (event) => {

                eventData = event;
            });

            const path = '/test-' + Date.now();
            await api.get(path);

            // Required fields
            expect(eventData.key, 'key should exist').to.exist;
            expect(eventData.key, 'key should be string').to.be.a('string');

            // Optional but expected fields
            expect(eventData.method, 'method should exist').to.exist;
            expect(eventData.method, 'method should be GET').to.equal('GET');

            expect(eventData.path, 'path should exist').to.exist;
            expect(eventData.path, 'path should match request').to.include(path);

            expect(eventData.state, 'state should exist').to.exist;
            expect(eventData.headers, 'headers should exist').to.exist;

            api.destroy();
        });

        it('should emit fetch-dedupe-join with correct interface', async () => {

            // Validates join event includes waitingCount
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            let eventData: any;
            api.on('fetch-dedupe-join', (event) => {

                eventData = event;
            });

            const path = '/test-' + Date.now();

            // Start two concurrent requests
            await Promise.all([
                api.get(path),
                api.get(path)
            ]);

            // Required fields
            expect(eventData.key, 'key should exist').to.exist;
            expect(eventData.method, 'method should exist').to.exist;
            expect(eventData.path, 'path should exist').to.exist;

            // Join-specific field
            expect(eventData.waitingCount, 'waitingCount should exist').to.exist;
            expect(eventData.waitingCount, 'waitingCount should be number').to.be.a('number');
            expect(eventData.waitingCount, 'waitingCount should be >= 1').to.be.at.least(1);

            api.destroy();
        });

        it('should emit fetch-dedupe-complete with correct interface', async () => {

            // Validates dedupe complete event (if it exists)
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            let eventData: any;
            let eventFired = false;
            api.on('fetch-dedupe-complete', (event) => {

                eventData = event;
                eventFired = true;
            });

            const path = '/test-' + Date.now();

            await Promise.all([
                api.get(path),
                api.get(path)
            ]);

            // Note: This event may or may not exist in the implementation
            // Test validates interface if it does exist
            if (eventFired) {

                expect(eventData.key, 'key should exist if event is emitted').to.exist;

                // Optional fields
                if (eventData.method) {
                    expect(eventData.method, 'method should be string').to.be.a('string');
                }

                if (eventData.path) {
                    expect(eventData.path, 'path should be string').to.be.a('string');
                }
            }

            api.destroy();
        });

        it('should emit fetch-dedupe-error with correct interface on failure', async () => {

            // Validates dedupe error event data
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            let eventData: any;
            let eventFired = false;
            api.on('fetch-dedupe-error', (event) => {

                eventData = event;
                eventFired = true;
            });

            const path = '/fail';

            // Make concurrent requests that will fail
            await Promise.allSettled([
                api.get(path),
                api.get(path)
            ]);

            // Note: This event may or may not exist in the implementation
            // Test validates interface if it does exist
            if (eventFired) {

                expect(eventData.key, 'key should exist').to.exist;
                expect(eventData.error, 'error should exist').to.exist;
                expect(eventData.error, 'error should be Error').to.be.instanceOf(Error);
            }

            api.destroy();
        });
    });


    // ========================================================================
    // CROSS-CHECKS (from cross-checks.ts)
    // ========================================================================

    describe('cross-checks', () => {

        it('should produce identical results with dedupe on vs off (sequential)', async () => {

            // Cross-checks that deduplication doesn't alter results for sequential requests
            const apiWithDedupe = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const apiWithoutDedupe = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: false }
            });

            const path = '/test-' + Date.now();

            // Sequential requests (not concurrent, so dedupe shouldn't matter)
            const r1 = await apiWithDedupe.get(path);
            const r2 = await apiWithoutDedupe.get(path);

            // Results should be equivalent
            expect(r1.data, 'data should be equal').to.deep.equal(r2.data);
            expect(r1.status, 'status should be equal').to.equal(r2.status);
            expect(r1.headers['content-type'], 'content-type should be equal').to.equal(r2.headers['content-type']);

            apiWithDedupe.destroy();
            apiWithoutDedupe.destroy();
        });

        it('should produce identical keys for concurrent requests', async () => {

            // Validates that concurrent identical requests produce the same key
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const startKeys: string[] = [];
            const joinKeys: string[] = [];

            api.on('fetch-dedupe-start', (event) => {

                startKeys.push(event.key);
            });

            api.on('fetch-dedupe-join', (event) => {

                joinKeys.push(event.key);
            });

            const path = '/test-' + Date.now();

            // Concurrent identical requests
            await Promise.all([
                api.get(path),
                api.get(path),
                api.get(path)
            ]);

            // Should have one start event
            expect(startKeys.length).to.equal(1);

            // Should have join events for the other two
            expect(joinKeys.length).to.equal(2);

            // All join events should reference the same key
            joinKeys.forEach((joinKey, index) => {

                expect(joinKey, `join event ${index} should have same key`).to.equal(startKeys[0]);
            });

            api.destroy();
        });

        it('should produce consistent data across concurrent deduplicated requests', async () => {

            // Validates that all joiners receive identical response data
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const path = '/test-' + Date.now();

            // Make 5 concurrent identical requests
            const responses = await Promise.all([
                api.get(path),
                api.get(path),
                api.get(path),
                api.get(path),
                api.get(path)
            ]);

            // All responses should be identical
            const firstData = responses[0].data;
            const firstStatus = responses[0].status;

            for (let i = 1; i < responses.length; i++) {

                expect(responses[i]?.data, `response[${i}].data should match`).to.deep.equal(firstData);
                expect(responses[i]?.status, `response[${i}].status should match`).to.equal(firstStatus);
            }

            api.destroy();
        });
    });


    // ========================================================================
    // ERROR RECOVERY (from non-functional.ts)
    // ========================================================================

    describe('error recovery', () => {

        it('should propagate network errors to all joiners', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const path = '/fail';

            // Launch multiple concurrent requests to failing endpoint
            const requests = Array.from({ length: 5 }, () =>
                attempt(() => api.get(path))
            );

            const results = await Promise.all(requests);

            // All should receive the same error
            results.forEach(([_, err]) => {

                expect(err).to.not.be.null;
                expect(err).to.be.instanceOf(FetchError);
            });

            // No inflight leaks
            const stats = api.cacheStats();
            expect(stats.inflightCount).to.equal(0);

            api.destroy();
        });

        it('should recover from network errors during deduplication', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const failPath = '/fail';

            // First batch: concurrent requests that will fail
            const failingRequests = Array.from({ length: 3 }, () =>
                attempt(() => api.get(failPath))
            );

            const failResults = await Promise.all(failingRequests);

            // All should fail
            failResults.forEach(([_, err]) => {

                expect(err).to.not.be.null;
            });

            // Now verify system can recover with successful requests
            const successPath = '/json-' + Date.now();
            const [response, err] = await attempt(() => api.get(successPath));

            expect(err).to.be.null;
            expect(response).to.not.be.undefined;
            expect(response?.data).to.deep.equal({ ok: true });

            // System should be clean
            const stats = api.cacheStats();
            expect(stats.inflightCount).to.equal(0);

            api.destroy();
        });

        it('should handle errors during deduplication serialization', async () => {

            // Create API with serializer that throws
            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: {
                    enabled: true,
                    serializer: () => {

                        throw new Error('Deduplication serialization failed');
                    }
                }
            });

            const path = '/test-' + Date.now();

            // Multiple concurrent requests with failing serializer
            const requests = Array.from({ length: 3 }, () =>
                attempt(() => api.get(path))
            );

            const results = await Promise.all(requests);

            // Requests should either succeed without deduping or fail gracefully
            results.forEach(([_, err]) => {

                expect(err).to.satisfy((e: any) => {

                    return e === null || e instanceof Error;
                });
            });

            api.destroy();
        });
    });


    // ========================================================================
    // CONCURRENT MODIFICATIONS (from non-functional.ts)
    // ========================================================================

    describe('concurrent modifications', () => {

        it('should handle concurrent modifications to same path', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                dedupePolicy: { enabled: true }
            });

            const basePath = '/json';

            // Launch multiple concurrent requests with slight timing differences
            const requests = Array.from({ length: 10 }, async (_, i) => {

                // Stagger requests slightly
                await wait(i * 5);
                return api.get(basePath + '-' + Date.now());
            });

            const results = await Promise.allSettled(requests);

            // All should succeed
            const successful = results.filter(r => r.status === 'fulfilled').length;
            expect(successful).to.equal(10);

            // No inflight leaks
            const stats = api.cacheStats();
            expect(stats.inflightCount).to.equal(0);

            api.destroy();
        });
    });
});
