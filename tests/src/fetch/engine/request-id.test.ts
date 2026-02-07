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


describe('@logosdx/fetch: request ID', async () => {

    const { testUrl, callStub } = await makeTestStubs(4141);

    it('generates a default requestId on every request', async () => {

        const events: any[] = [];
        const api = new FetchEngine({ baseUrl: testUrl });

        api.on('before-request', (data) => events.push(data));

        await api.get('/json');

        expect(events).to.have.length(1);
        expect(events[0].requestId).to.be.a('string');
        expect(events[0].requestId.length).to.be.greaterThan(0);

        api.destroy();
        await wait(10);
    });

    it('generates unique requestIds for different requests', async () => {

        const ids: string[] = [];
        const api = new FetchEngine({ baseUrl: testUrl });

        api.on('before-request', (data: any) => ids.push(data.requestId));

        await api.get('/json');
        await api.get('/json');
        await api.get('/json');

        expect(ids).to.have.length(3);
        expect(new Set(ids).size).to.equal(3);

        api.destroy();
        await wait(10);
    });

    it('uses custom generateRequestId when provided', async () => {

        let callCount = 0;

        const api = new FetchEngine({
            baseUrl: testUrl,
            generateRequestId: () => {

                callCount++;
                return `custom-${callCount}`;
            }
        } as any);

        const events: any[] = [];
        api.on('before-request', (data) => events.push(data));

        await api.get('/json');

        expect(callCount).to.equal(1);
        expect(events[0].requestId).to.equal('custom-1');

        api.destroy();
        await wait(10);
    });

    it('threads the same requestId through before-request and after-request', async () => {

        const beforeIds: string[] = [];
        const afterIds: string[] = [];
        const api = new FetchEngine({ baseUrl: testUrl });

        api.on('before-request', (data: any) => beforeIds.push(data.requestId));
        api.on('after-request', (data: any) => afterIds.push(data.requestId));

        await api.get('/json');

        expect(beforeIds).to.have.length(1);
        expect(afterIds).to.have.length(1);
        expect(beforeIds[0]).to.equal(afterIds[0]);

        api.destroy();
        await wait(10);
    });

    it('threads the same requestId through before-request and error events', async () => {

        const beforeIds: string[] = [];
        const errorIds: string[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: false
        });

        api.on('before-request', (data: any) => beforeIds.push(data.requestId));
        api.on('error', (data: any) => errorIds.push(data.requestId));

        const [, err] = await attempt(() => api.get('/fail'));

        expect(err).to.be.instanceOf(FetchError);
        expect(beforeIds).to.have.length(1);
        expect(errorIds).to.have.length(1);
        expect(beforeIds[0]).to.equal(errorIds[0]);

        api.destroy();
        await wait(10);
    });

    it('preserves the same requestId across retry events', async () => {

        const ids = new Set<string>();

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: { maxAttempts: 2, baseDelay: 10 }
        });

        api.on('before-request', (data: any) => ids.add(data.requestId));
        api.on('retry', (data: any) => ids.add(data.requestId));
        api.on('error', (data: any) => ids.add(data.requestId));

        const [, err] = await attempt(() => api.get('/fail'));

        expect(err).to.be.instanceOf(FetchError);
        expect(ids.size).to.equal(1);

        api.destroy();
        await wait(10);
    });

    it('includes requestId in cache events', async () => {

        const cacheEvents: any[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: {
                rules: [{ match: /.*/, ttl: 5000 }]
            }
        });

        api.on('cache-miss', (data: any) => cacheEvents.push(data));
        api.on('cache-set', (data: any) => cacheEvents.push(data));
        api.on('cache-hit', (data: any) => cacheEvents.push(data));

        await api.get('/json');
        await api.get('/json');

        // First request: cache-miss + cache-set
        // Second request: cache-hit
        expect(cacheEvents.length).to.be.greaterThanOrEqual(2);

        for (const event of cacheEvents) {

            expect(event.requestId).to.be.a('string');
        }

        api.destroy();
        await wait(10);
    });

    it('includes requestId in dedupe events', async () => {

        const dedupeEvents: any[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        api.on('dedupe-start', (data: any) => dedupeEvents.push(data));
        api.on('dedupe-join', (data: any) => dedupeEvents.push(data));

        await Promise.all([
            api.get('/slow-success/100'),
            api.get('/slow-success/100')
        ]);

        expect(dedupeEvents.length).to.be.greaterThanOrEqual(1);

        for (const event of dedupeEvents) {

            expect(event.requestId).to.be.a('string');
        }

        api.destroy();
        await wait(10);
    });

    it('sets requestId on FetchError instances', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            retry: false
        });

        const [, err] = await attempt(() => api.get('/fail'));

        expect(err).to.be.instanceOf(FetchError);
        expect((err as any).requestId).to.be.a('string');

        api.destroy();
        await wait(10);
    });

    it('sends requestId as header when requestIdHeader is configured', async () => {

        const events: any[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            requestIdHeader: 'X-Request-Id'
        });

        api.on('before-request', (data) => events.push(data));

        await api.get('/json');

        expect(events).to.have.length(1);

        const sentHeader = callStub.firstCall.args[0].headers['x-request-id'];
        expect(sentHeader).to.equal(events[0].requestId);

        api.destroy();
        await wait(10);
    });

    it('does not send header when requestIdHeader is not configured', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        await api.get('/json');

        const headers = callStub.firstCall.args[0].headers;
        expect(headers['x-request-id']).to.be.undefined;

        api.destroy();
        await wait(10);
    });

    it('uses custom generateRequestId value in the header', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            generateRequestId: () => 'trace-abc-123',
            requestIdHeader: 'X-Trace-Id'
        } as any);

        await api.get('/json');

        const sentHeader = callStub.firstCall.args[0].headers['x-trace-id'];
        expect(sentHeader).to.equal('trace-abc-123');

        api.destroy();
        await wait(10);
    });

    it('uses per-request requestId when provided', async () => {

        const events: any[] = [];
        const api = new FetchEngine({ baseUrl: testUrl });

        api.on('before-request', (data) => events.push(data));

        await api.get('/json', { requestId: 'external-trace-xyz' });

        expect(events).to.have.length(1);
        expect(events[0].requestId).to.equal('external-trace-xyz');

        api.destroy();
        await wait(10);
    });

    it('per-request requestId overrides generateRequestId', async () => {

        const events: any[] = [];

        const api = new FetchEngine({
            baseUrl: testUrl,
            generateRequestId: () => 'engine-generated-id'
        } as any);

        api.on('before-request', (data) => events.push(data));

        await api.get('/json', { requestId: 'per-request-override' });

        expect(events).to.have.length(1);
        expect(events[0].requestId).to.equal('per-request-override');

        api.destroy();
        await wait(10);
    });

    it('per-request requestId flows into requestIdHeader', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            requestIdHeader: 'X-Request-Id'
        });

        await api.get('/json', { requestId: 'upstream-trace-id' });

        const sentHeader = callStub.firstCall.args[0].headers['x-request-id'];
        expect(sentHeader).to.equal('upstream-trace-id');

        api.destroy();
        await wait(10);
    });

    it('falls back to generated ID when per-request requestId is not provided', async () => {

        const events: any[] = [];
        const api = new FetchEngine({ baseUrl: testUrl });

        api.on('before-request', (data) => events.push(data));

        await api.get('/json');

        expect(events).to.have.length(1);
        expect(events[0].requestId).to.be.a('string');
        expect(events[0].requestId).to.not.equal('');

        api.destroy();
        await wait(10);
    });

    it('gives deduped joiners their own requestId', async () => {

        let startId: string | undefined;
        let joinId: string | undefined;

        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        api.on('dedupe-start', (data: any) => { startId = data.requestId; });
        api.on('dedupe-join', (data: any) => { joinId = data.requestId; });

        await Promise.all([
            api.get('/slow-success/100'),
            api.get('/slow-success/100')
        ]);

        expect(startId).to.be.a('string');
        expect(joinId).to.be.a('string');
        expect(startId).to.not.equal(joinId);

        api.destroy();
        await wait(10);
    });
});
