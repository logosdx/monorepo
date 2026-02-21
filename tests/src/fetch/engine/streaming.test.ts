import {
    describe,
    it,
    expect
} from 'vitest';

import {
    FetchEngine,
    FetchError,
} from '@logosdx/fetch';

import { attempt, wait } from '@logosdx/utils';
import { makeTestStubs } from '../_helpers.ts';


describe('@logosdx/fetch: streaming', async () => {

    const { testUrl, closeConnections } = await makeTestStubs(4142);

    it('stream GET returns raw Response as data', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        const result = await api.get('/json').raw();

        expect(result.data).to.be.instanceOf(Response);
        expect(result.status).to.equal(200);

        api.destroy();
        await wait(10);
    });

    it('provides readable stream via response.body.getReader()', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        const result = await api.get('/sse').raw();
        const response = result.data;

        expect(response.body).to.not.be.null;

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        const { done, value } = await reader.read();

        expect(done).to.be.false;

        const text = decoder.decode(value);

        expect(text.length).to.be.greaterThan(0);

        reader.releaseLock();
        api.destroy();
        closeConnections();
        await wait(10);
    });

    it('skips cache for stream requests', async () => {

        const cacheEvents: string[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: {
                rules: [{ match: /.*/, ttl: 5000 }]
            }
        });

        api.on('cache-hit', () => cacheEvents.push('hit'));
        api.on('cache-miss', () => cacheEvents.push('miss'));
        api.on('cache-set', () => cacheEvents.push('set'));

        await api.get('/json').raw();
        await api.get('/json').raw();

        expect(cacheEvents).to.have.length(0);

        api.destroy();
        await wait(10);
    });

    it('skips deduplication for stream requests', async () => {

        const dedupeEvents: string[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        api.on('dedupe-start', () => dedupeEvents.push('start'));
        api.on('dedupe-join', () => dedupeEvents.push('join'));

        const [r1, r2] = await Promise.all([
            api.get('/json').raw(),
            api.get('/json').raw()
        ]);

        // Each caller should get their own Response object
        expect(r1.data).to.not.equal(r2.data);
        expect(dedupeEvents).to.have.length(0);

        api.destroy();
        await wait(10);
    });

    it('fires before-request, after-request, and response events', async () => {

        const events: string[] = [];
        const api = new FetchEngine({ baseUrl: testUrl });

        api.on('before-request', () => events.push('before-request'));
        api.on('after-request', () => events.push('after-request'));
        api.on('response', () => events.push('response'));

        await api.get('/json').raw();

        expect(events).to.deep.equal(['before-request', 'after-request', 'response']);

        api.destroy();
        await wait(10);
    });

    it('respects AbortController for stream requests', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });
        const controller = new AbortController();

        // Abort before the request to guarantee fetch rejects
        controller.abort();

        const [, err] = await attempt(() => (
            api.get('/json', {
                abortController: controller
            }).raw()
        ));

        expect(err).to.be.instanceOf(FetchError);
        expect((err as FetchError).aborted).to.be.true;

        api.destroy();
        await wait(10);
    });

    it('returns non-ok responses without throwing', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: false
        });

        // Stream returns raw Response even for error status codes.
        // The consumer checks status themselves.
        const result = await api.get('/fail').raw();

        expect(result.data).to.be.instanceOf(Response);
        expect(result.status).to.equal(400);

        api.destroy();
        await wait(10);
    });

    it('stream POST sends payload correctly', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        const result = await api.post(
            '/json',
            { hello: 'world' }
        ).raw();

        expect(result.data).to.be.instanceOf(Response);
        expect(result.status).to.equal(200);

        api.destroy();
        await wait(10);
    });

    it('still respects rate limiting for stream requests', async () => {

        const rateLimitEvents: string[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            rateLimitPolicy: {
                maxCalls: 1,
                windowMs: 1000
            }
        });

        api.on('ratelimit-acquire', () => rateLimitEvents.push('acquire'));
        api.on('ratelimit-wait', () => rateLimitEvents.push('wait'));

        await api.get('/json').raw();

        expect(rateLimitEvents).to.include('acquire');

        api.destroy();
        await wait(10);
    });

    it('consumes SSE events from a stream', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        const result = await api.get('/sse/events?count=3').raw();
        const response = result.data;

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {

            const { done, value } = await reader.read();
            if (done) break;

            fullText += decoder.decode(value, { stream: true });

            // Break once we've received all expected events
            if (fullText.includes('event-2')) break;
        }

        reader.releaseLock();

        expect(fullText).to.include('event-0');
        expect(fullText).to.include('event-1');
        expect(fullText).to.include('event-2');

        api.destroy();
        closeConnections();
        await wait(10);
    });

    it('includes response headers on stream responses', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        const result = await api.get('/json').raw();

        expect(result.headers).to.be.an('object');
        expect(result.status).to.equal(200);

        api.destroy();
        await wait(10);
    });
});
