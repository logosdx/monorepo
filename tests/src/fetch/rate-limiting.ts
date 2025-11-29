import {
    describe,
    it,
    expect
} from 'vitest'

import {
    FetchEngine,
} from '../../../packages/fetch/src/index.ts';

import {
    attempt,
    wait,
    RateLimitError,
    isRateLimitError
} from '../../../packages/utils/src/index.ts';

import { makeTestStubs } from './_helpers.ts';


describe('@logosdx/fetch: rate limiting', async () => {

    const { testUrl, callStub } = await makeTestStubs(4300);


    describe('basic configuration', () => {

        it('should enable rate limiting with boolean true', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: true
            });

            const acquireEvents: string[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data.path!);
            });

            await api.get('/json');

            expect(acquireEvents.length).to.equal(1);
            expect(acquireEvents[0]).to.equal('/json');

            api.destroy();
        });

        it('should disable rate limiting when rateLimitPolicy is false', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: false
            });

            const acquireEvents: string[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data.path!);
            });

            await api.get('/json');

            expect(acquireEvents.length).to.equal(0);

            api.destroy();
        });

        it('should disable rate limiting when rateLimitPolicy is not provided', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl
            });

            const acquireEvents: string[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data.path!);
            });

            await api.get('/json');

            expect(acquireEvents.length).to.equal(0);

            api.destroy();
        });

        it('should use default values when enabled with boolean true', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: true
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            await api.get('/json');

            // Default capacity should be 100
            expect(acquireEvents[0]!.capacity).to.equal(100);

            api.destroy();
        });

        it('should respect custom maxCalls and windowMs', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 5,
                    windowMs: 1000
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            await api.get('/json');

            expect(acquireEvents[0]!.capacity).to.equal(5);

            api.destroy();
        });
    });


    describe('token consumption', () => {

        it('should consume a token for each request', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 10,
                    windowMs: 60000,
                    // Use global serializer so all requests share one bucket
                    serializer: () => 'global'
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            // Make 3 requests - all share the same bucket due to global serializer
            await api.get('/json');
            await api.get('/json2');
            await api.get('/json3');

            expect(acquireEvents.length).to.equal(3);

            // Tokens should decrease each time (sharing same bucket)
            expect(acquireEvents[0]!.currentTokens).to.equal(9); // 10 - 1
            expect(acquireEvents[1]!.currentTokens).to.equal(8); // 10 - 2
            expect(acquireEvents[2]!.currentTokens).to.equal(7); // 10 - 3

            api.destroy();
        });

        it('should emit acquire event immediately when tokens available', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 10,
                    windowMs: 1000
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            await api.get('/json');

            // waitTimeMs should be 0 when tokens were immediately available
            expect(acquireEvents[0]!.waitTimeMs).to.equal(0);

            api.destroy();
        });
    });


    describe('rate limit enforcement', () => {

        it('should wait for token when rate limit is exceeded (waitForToken: true)', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 2,
                    windowMs: 200,  // 2 requests per 200ms = 100ms per token
                    waitForToken: true,
                    // Use global serializer so all requests share one bucket
                    serializer: () => 'global'
                }
            });

            const waitEvents: FetchEngine.RateLimitEventData[] = [];
            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-wait', (data) => {

                waitEvents.push(data);
            });

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            const startTime = Date.now();

            // Exhaust tokens (all go to same bucket)
            await api.get('/json');
            await api.get('/json2');

            // This should trigger a wait since bucket is exhausted
            await api.get('/json3');

            const elapsed = Date.now() - startTime;

            // Should have waited
            expect(waitEvents.length).to.equal(1);
            expect(acquireEvents.length).to.equal(3);

            // Elapsed time should be at least one token refill interval
            expect(elapsed).to.be.greaterThan(50);

            api.destroy();
        });

        it('should reject immediately when rate limit is exceeded (waitForToken: false)', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 2,
                    windowMs: 60000,  // Very long window to ensure no refill
                    waitForToken: false,
                    // Use global serializer so all requests share one bucket
                    serializer: () => 'global'
                }
            });

            const rejectEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-reject', (data) => {

                rejectEvents.push(data);
            });

            // Exhaust tokens (all go to same bucket)
            await api.get('/json');
            await api.get('/json2');

            // This should reject immediately
            const [, err] = await attempt(() => api.get('/json3'));

            expect(isRateLimitError(err)).to.be.true;
            expect(rejectEvents.length).to.equal(1);
            expect(rejectEvents[0]!.waitTimeMs).to.be.greaterThan(0);

            api.destroy();
        });

        it('should call onRateLimit callback when rate limited', async () => {

            const onRateLimitCalls: { path: string, waitTimeMs: number }[] = [];

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 2,
                    windowMs: 200,
                    waitForToken: true,
                    // Use global serializer so all requests share one bucket
                    serializer: () => 'global',
                    onRateLimit: async (ctx, waitTimeMs) => {

                        onRateLimitCalls.push({ path: ctx.path!, waitTimeMs });
                    }
                }
            });

            // Exhaust tokens (all go to same bucket)
            await api.get('/json');
            await api.get('/json2');

            // This should trigger the callback
            await api.get('/json3');

            expect(onRateLimitCalls.length).to.equal(1);
            expect(onRateLimitCalls[0]!.path).to.equal('/json3');
            expect(onRateLimitCalls[0]!.waitTimeMs).to.be.greaterThan(0);

            api.destroy();
        });
    });


    describe('bucket key generation', () => {

        it('should group requests by method+pathname by default', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 10,
                    windowMs: 60000
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            // Same path, different query params
            await api.get('/json', { params: { page: 1 } });
            await api.get('/json', { params: { page: 2 } });

            // Both should use the same bucket (key = 'GET|/json')
            expect(acquireEvents[0]!.key).to.equal('GET|/json');
            expect(acquireEvents[1]!.key).to.equal('GET|/json');

            // Tokens should be shared
            expect(acquireEvents[0]!.currentTokens).to.equal(9);
            expect(acquireEvents[1]!.currentTokens).to.equal(8);

            api.destroy();
        });

        it('should use separate buckets for different paths', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 5,
                    windowMs: 60000
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            // Different paths
            await api.get('/json');
            await api.get('/json2');

            // Should use different buckets
            expect(acquireEvents[0]!.key).to.equal('GET|/json');
            expect(acquireEvents[1]!.key).to.equal('GET|/json2');

            // Both should have full capacity - 1
            expect(acquireEvents[0]!.currentTokens).to.equal(4);
            expect(acquireEvents[1]!.currentTokens).to.equal(4);

            api.destroy();
        });

        it('should use separate buckets for different methods', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 5,
                    windowMs: 60000
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            // Same path, different methods
            await api.get('/json');
            await api.post('/json', {});

            // Should use different buckets
            expect(acquireEvents[0]!.key).to.equal('GET|/json');
            expect(acquireEvents[1]!.key).to.equal('POST|/json');

            api.destroy();
        });

        it('should support custom serializer for key generation', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 5,
                    windowMs: 60000,
                    serializer: () => 'global'  // All requests share one bucket
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            // Different paths should share the same bucket
            await api.get('/json');
            await api.get('/json2');
            await api.post('/json3', {});

            expect(acquireEvents[0]!.key).to.equal('global');
            expect(acquireEvents[1]!.key).to.equal('global');
            expect(acquireEvents[2]!.key).to.equal('global');

            // Tokens should be shared
            expect(acquireEvents[0]!.currentTokens).to.equal(4);
            expect(acquireEvents[1]!.currentTokens).to.equal(3);
            expect(acquireEvents[2]!.currentTokens).to.equal(2);

            api.destroy();
        });

        it('should support per-user rate limiting via custom serializer', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 5,
                    windowMs: 60000,
                    serializer: (ctx) => `user:${(ctx.headers as any)?.['X-User-ID'] ?? 'anonymous'}`
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            // Different users
            await api.get('/json', { headers: { 'X-User-ID': 'alice' } });
            await api.get('/json', { headers: { 'X-User-ID': 'bob' } });
            await api.get('/json', { headers: { 'X-User-ID': 'alice' } });

            expect(acquireEvents[0]!.key).to.equal('user:alice');
            expect(acquireEvents[1]!.key).to.equal('user:bob');
            expect(acquireEvents[2]!.key).to.equal('user:alice');

            // Alice's bucket: 5 -> 4 -> 3
            // Bob's bucket: 5 -> 4
            expect(acquireEvents[0]!.currentTokens).to.equal(4);  // Alice first
            expect(acquireEvents[1]!.currentTokens).to.equal(4);  // Bob first
            expect(acquireEvents[2]!.currentTokens).to.equal(3);  // Alice second

            api.destroy();
        });
    });


    describe('methods filtering', () => {

        it('should rate limit all methods by default', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: true
            });

            const acquireEvents: string[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data.method!);
            });

            await api.get('/json');
            await api.post('/json', {});
            await api.put('/json', {});
            await api.delete('/json');

            expect(acquireEvents).to.deep.equal(['GET', 'POST', 'PUT', 'DELETE']);

            api.destroy();
        });

        it('should respect custom methods configuration', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    methods: ['GET']  // Only rate limit GET
                }
            });

            const acquireEvents: string[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data.method!);
            });

            await api.get('/json');
            await api.post('/json', {});  // Should not be rate limited

            expect(acquireEvents).to.deep.equal(['GET']);

            api.destroy();
        });
    });


    describe('shouldRateLimit callback', () => {

        it('should bypass rate limiting when shouldRateLimit returns false', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 2,
                    windowMs: 60000,
                    waitForToken: false,
                    // Use global serializer so all requests share one bucket
                    serializer: () => 'global',
                    shouldRateLimit: (ctx) => !ctx.path?.includes('bypass')
                }
            });

            const acquireEvents: string[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data.path!);
            });

            // Exhaust tokens
            await api.get('/json');
            await api.get('/json2');

            // This should bypass rate limiting
            await api.get('/bypass');

            // Should not have triggered rate limit for bypass
            expect(acquireEvents).to.deep.equal(['/json', '/json2']);

            // This should fail because tokens are exhausted
            const [, err] = await attempt(() => api.get('/json3'));

            expect(isRateLimitError(err)).to.be.true;

            api.destroy();
        });
    });


    describe('rules', () => {

        it('should apply rate limit rules to specific paths', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 100,
                    windowMs: 60000,
                    rules: [
                        {
                            startsWith: '/api/search',
                            maxCalls: 2,
                            windowMs: 60000,
                            waitForToken: false,
                            // All search requests share one bucket
                            serializer: () => 'search'
                        }
                    ]
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            // Regular endpoint uses global limit (100)
            await api.get('/json');

            expect(acquireEvents[0]!.capacity).to.equal(100);

            // Search endpoint uses rule limit (2)
            await api.get('/api/search');
            await api.get('/api/search/query');

            expect(acquireEvents[1]!.capacity).to.equal(2);
            expect(acquireEvents[2]!.capacity).to.equal(2);

            // Third search request should be rejected (bucket is exhausted)
            const [, err] = await attempt(() => api.get('/api/search/foo'));

            expect(isRateLimitError(err)).to.be.true;

            api.destroy();
        });

        it('should disable rate limiting for specific routes via rules', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 10,
                    windowMs: 60000,
                    rules: [
                        {
                            startsWith: '/admin',
                            enabled: false  // Disable rate limiting for admin
                        }
                    ]
                }
            });

            const acquireEvents: string[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data.path!);
            });

            await api.get('/json');
            await api.get('/admin/users');

            // Only /json should trigger rate limiting
            expect(acquireEvents).to.deep.equal(['/json']);

            api.destroy();
        });

        it('should support rule-specific serializer', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 100,
                    windowMs: 60000,
                    rules: [
                        {
                            startsWith: '/api',
                            maxCalls: 10,
                            windowMs: 60000,
                            serializer: () => 'api-global'  // All API routes share one bucket
                        }
                    ]
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            await api.get('/api/users');
            await api.get('/api/posts');

            // Both API routes should share the same key
            expect(acquireEvents[0]!.key).to.equal('api-global');
            expect(acquireEvents[1]!.key).to.equal('api-global');

            // Tokens should be shared
            expect(acquireEvents[0]!.currentTokens).to.equal(9);
            expect(acquireEvents[1]!.currentTokens).to.equal(8);

            api.destroy();
        });

        it('should support rule-specific waitForToken', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 2,
                    windowMs: 60000,
                    waitForToken: true,  // Global: wait
                    rules: [
                        {
                            startsWith: '/critical',
                            waitForToken: false,  // Critical routes: reject immediately
                            // All critical requests share one bucket
                            serializer: () => 'critical'
                        }
                    ]
                }
            });

            const rejectEvents: string[] = [];

            api.on('fetch-ratelimit-reject', (data) => {

                rejectEvents.push(data.path!);
            });

            // Exhaust critical route tokens (all go to same bucket)
            await api.get('/critical/op1');
            await api.get('/critical/op2');

            // Third critical request should reject immediately
            const [, err] = await attempt(() => api.get('/critical/op3'));

            expect(isRateLimitError(err)).to.be.true;
            expect(rejectEvents).to.deep.equal(['/critical/op3']);

            api.destroy();
        });

        it('should support rule-specific methods', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 10,
                    windowMs: 60000,
                    rules: [
                        {
                            startsWith: '/api',
                            methods: ['POST', 'PUT', 'DELETE']  // Only limit mutating methods
                        }
                    ]
                }
            });

            const acquireEvents: string[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(`${data.method}:${data.path}`);
            });

            await api.get('/api/users');      // Should use global config
            await api.post('/api/users', {}); // Should use rule config
            await api.get('/json');           // Should use global config

            expect(acquireEvents).to.include('GET:/api/users');
            expect(acquireEvents).to.include('POST:/api/users');
            expect(acquireEvents).to.include('GET:/json');

            api.destroy();
        });

        it('should match rules using different match types', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 100,
                    windowMs: 60000,
                    rules: [
                        { is: '/exact', maxCalls: 1 },
                        { startsWith: '/prefix', maxCalls: 2 },
                        { endsWith: '/suffix', maxCalls: 3 },
                        { includes: 'middle', maxCalls: 4 },
                        { match: /^\/regex-\d+$/, maxCalls: 5 }
                    ]
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            await api.get('/exact');           // is
            await api.get('/prefix-route');    // startsWith
            await api.get('/route/suffix');    // endsWith
            await api.get('/has-middle-text'); // includes
            await api.get('/regex-123');       // match

            expect(acquireEvents[0]!.capacity).to.equal(1);
            expect(acquireEvents[1]!.capacity).to.equal(2);
            expect(acquireEvents[2]!.capacity).to.equal(3);
            expect(acquireEvents[3]!.capacity).to.equal(4);
            expect(acquireEvents[4]!.capacity).to.equal(5);

            api.destroy();
        });

        it('should use first matching rule (priority order)', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 100,
                    windowMs: 60000,
                    rules: [
                        { startsWith: '/api/v2', maxCalls: 50 },  // More specific first
                        { startsWith: '/api', maxCalls: 10 }     // Less specific second
                    ]
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            await api.get('/api/v2/users');  // Should match first rule
            await api.get('/api/v1/users');  // Should match second rule

            expect(acquireEvents[0]!.capacity).to.equal(50);
            expect(acquireEvents[1]!.capacity).to.equal(10);

            api.destroy();
        });
    });


    describe('memoization', () => {

        it('should memoize rule resolution for same method+path', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 100,
                    windowMs: 60000,
                    rules: [
                        { startsWith: '/api', maxCalls: 10 }
                    ]
                }
            });

            const acquireEvents: FetchEngine.RateLimitEventData[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                acquireEvents.push(data);
            });

            // Multiple requests to same path should use cached rule resolution
            await api.get('/api/users');
            await api.get('/api/users');
            await api.get('/api/users');

            // All should have the same capacity (from the rule)
            expect(acquireEvents[0]!.capacity).to.equal(10);
            expect(acquireEvents[1]!.capacity).to.equal(10);
            expect(acquireEvents[2]!.capacity).to.equal(10);

            api.destroy();
        });
    });


    describe('cleanup', () => {

        it('should clear rate limiters on destroy', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 10,
                    windowMs: 60000
                }
            });

            await api.get('/json');
            await api.get('/json2');

            // Destroy should clear internal state
            api.destroy();

            // Verify instance is destroyed
            expect(api.isDestroyed()).to.be.true;
        });
    });


    describe('integration with cache and deduplication', () => {

        it('should rate limit before cache check', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 10,
                    windowMs: 60000
                },
                cachePolicy: {
                    enabled: true,
                    ttl: 60000
                }
            });

            const rateLimitEvents: string[] = [];
            const cacheEvents: string[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                rateLimitEvents.push(data.path!);
            });

            api.on('fetch-cache-hit', (data) => {

                cacheEvents.push(data.path!);
            });

            api.on('fetch-cache-miss', (data) => {

                cacheEvents.push(`miss:${data.path}`);
            });

            // First request: rate limit -> cache miss -> fetch
            await api.get('/json');

            expect(rateLimitEvents).to.deep.equal(['/json']);
            expect(cacheEvents).to.deep.equal(['miss:/json']);

            // Second request: rate limit -> cache hit (no fetch)
            await api.get('/json');

            expect(rateLimitEvents).to.deep.equal(['/json', '/json']);
            expect(cacheEvents).to.include('/json');

            api.destroy();
        });

        it('should rate limit before deduplication check', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 10,
                    windowMs: 60000
                },
                dedupePolicy: true
            });

            const rateLimitEvents: string[] = [];
            const dedupeEvents: string[] = [];

            api.on('fetch-ratelimit-acquire', (data) => {

                rateLimitEvents.push(data.path!);
            });

            api.on('fetch-dedupe-start', (data) => {

                dedupeEvents.push(`start:${data.path}`);
            });

            api.on('fetch-dedupe-join', (data) => {

                dedupeEvents.push(`join:${data.path}`);
            });

            // Concurrent requests
            await Promise.all([
                api.get('/slow-success'),
                api.get('/slow-success'),
                api.get('/slow-success')
            ]);

            // All 3 requests should be rate limited
            expect(rateLimitEvents.length).to.equal(3);

            // But only 1 actual fetch (deduplication)
            expect(dedupeEvents.filter(e => e.startsWith('start:')).length).to.equal(1);
            expect(dedupeEvents.filter(e => e.startsWith('join:')).length).to.equal(2);

            api.destroy();
        });
    });


    describe('event data', () => {

        it('should include complete event data in rate limit events', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                rateLimitPolicy: {
                    enabled: true,
                    maxCalls: 10,
                    windowMs: 60000
                }
            });

            let eventData: FetchEngine.RateLimitEventData | null = null;

            api.on('fetch-ratelimit-acquire', (data) => {

                eventData = data;
            });

            await api.get('/json', {
                params: { page: 1 },
                headers: { 'X-Custom': 'value' }
            });

            expect(eventData).to.not.be.null;
            expect(eventData!.key).to.equal('GET|/json');
            expect(eventData!.currentTokens).to.equal(9);
            expect(eventData!.capacity).to.equal(10);
            expect(eventData!.waitTimeMs).to.equal(0);
            expect(eventData!.nextAvailable).to.be.instanceOf(Date);
            expect(eventData!.path).to.equal('/json');
            expect(eventData!.method).to.equal('GET');

            api.destroy();
        });
    });
});
