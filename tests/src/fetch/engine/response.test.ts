import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll
} from 'vitest'

import Hapi from '@hapi/hapi';

import {
    FetchEngine,
    FetchError,
} from '@logosdx/fetch';

import { attempt } from '@logosdx/utils';

import { FetchPromise } from '../../../../packages/fetch/src/engine/fetch-promise.ts';

import { getSetCookieHeaders } from '../../../../packages/fetch/src/plugins/cookies/response-headers.ts';

import { makeTestStubs } from '../_helpers.ts';


describe('FetchEngine: response structure validation', async () => {

    const { testUrl } = await makeTestStubs(4134);

    it('should validate response structure consistency across features', async () => {

        // Cross-checks that all features return consistent FetchResponse structure
        const configs = [
            { name: 'plain', config: {} },
            { name: 'cache', config: { cachePolicy: true } },
            { name: 'dedupe', config: { dedupePolicy: true } },
            { name: 'both', config: { cachePolicy: true, dedupePolicy: true } }
        ];

        for (const { name, config } of configs) {

            const api = new FetchEngine({
                baseUrl: testUrl,
                ...config
            });

            const path = `/test-structure-${name}-${Date.now()}`;
            const response = await api.get(path);

            // Validate FetchResponse structure
            expect(response.data, `${name}: data should exist`).to.exist;
            expect(response.status, `${name}: status should exist`).to.be.a('number');
            expect(response.headers, `${name}: headers should exist`).to.be.an('object');
            expect(response.request, `${name}: request should exist`).to.be.instanceOf(Request);
            expect(response.config, `${name}: config should exist`).to.be.an('object');

            // Validate all keys present
            const keys = Object.keys(response).sort();
            expect(keys, `${name}: should have all FetchResponse keys`)
                .to.deep.equal(['config', 'data', 'headers', 'ok', 'request', 'status']);

            api.destroy();
        }
    });

    it('should produce consistent results with retry on vs off (successful request)', async () => {

        // Cross-checks that retry doesn't alter results for successful requests
        const apiWithRetry = new FetchEngine({
            baseUrl: testUrl,
            retry: { maxAttempts: 3 }
        });

        const apiWithoutRetry = new FetchEngine({
            baseUrl: testUrl,
            retry: false
        });

        const path = `/test-retry-${Date.now()}`;

        const r1 = await apiWithRetry.get(path);
        const r2 = await apiWithoutRetry.get(path);

        // Results should be identical
        expect(r1.data, 'data should be equal').to.deep.equal(r2.data);
        expect(r1.status, 'status should be equal').to.equal(r2.status);

        apiWithRetry.destroy();
        apiWithoutRetry.destroy();
    });
});


describe('FetchEngine: directive-based response parsing', async () => {

    const { testUrl } = await makeTestStubs(4135);

    it('should parse as JSON when .json() directive is used', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        const promise = api.get('/json') as unknown as FetchPromise;
        const result = await promise.json();

        expect(result.data).to.deep.equal({ ok: true });
        expect(result.status).to.equal(200);

        api.destroy();
    });

    it('should parse as text when .text() directive is used', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        const promise = api.get('/json') as unknown as FetchPromise;
        const result = await promise.text();

        expect(result.data).to.be.a('string');
        expect(JSON.parse(result.data as string)).to.deep.equal({ ok: true });
        expect(result.status).to.equal(200);

        api.destroy();
    });

    it('should return raw Response when .raw() directive is used', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        const promise = api.get('/json') as unknown as FetchPromise;
        const result = await promise.raw();

        expect(result.data).to.be.instanceOf(Response);
        expect(result.status).to.equal(200);

        api.destroy();
    });

    it('should still auto-parse without a directive (backwards compatible)', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        const result = await api.get('/json');

        expect(result.data).to.deep.equal({ ok: true });
        expect(result.status).to.equal(200);

        api.destroy();
    });

    it('should support abort on FetchPromise returned by executor', async () => {

        const api = new FetchEngine({ baseUrl: testUrl });

        const promise = api.get('/json') as unknown as FetchPromise;

        expect(promise.abort).to.be.a('function');
        expect(promise.isAborted).to.equal(false);
        expect(promise.isFinished).to.equal(false);

        const result = await promise;
        expect(promise.isFinished).to.equal(true);
        expect(result.data).to.deep.equal({ ok: true });

        api.destroy();
    });
});


describe('FetchEngine: set-cookie preservation on response.headers', () => {

    let server: Hapi.Server;
    let baseUrl: string;

    beforeAll(async () => {

        server = Hapi.server({ port: 0, host: 'localhost' });

        server.route({
            method: 'GET',
            path: '/multi-cookie',
            handler: (_req, h) => {

                return h.response('ok')
                    .header('Set-Cookie', 'a=1; Path=/')
                    .header('Set-Cookie', 'b=2; Path=/', { append: true })
                    .header('Set-Cookie', 'c=3; Path=/', { append: true });
            },
        });

        server.route({
            method: 'GET',
            path: '/one-cookie',
            handler: (_req, h) => {

                return h.response('ok').header('Set-Cookie', 'only=1; Path=/');
            },
        });

        server.route({
            method: 'GET',
            path: '/no-cookie',
            handler: () => 'ok',
        });

        await server.start();
        baseUrl = server.info.uri;
    });

    afterAll(async () => {

        await server.stop();
    });

    it('preserves multiple Set-Cookie headers as string[]', async () => {

        const api = new FetchEngine({ baseUrl });
        const res = await api.get('/multi-cookie');

        // Use the reader rather than indexing into `res.headers` with a cast:
        // the reader accepts `unknown`, so passing `res.headers` is type-safe.
        const cookies = getSetCookieHeaders(res.headers);

        expect(cookies).toHaveLength(3);
        expect(cookies).toContain('a=1; Path=/');
        expect(cookies).toContain('b=2; Path=/');
        expect(cookies).toContain('c=3; Path=/');

        api.destroy();
    });

    it('preserves a single Set-Cookie header as string[] of length 1', async () => {

        const api = new FetchEngine({ baseUrl });
        const res = await api.get('/one-cookie');

        const cookies = getSetCookieHeaders(res.headers);

        expect(cookies).toEqual(['only=1; Path=/']);

        api.destroy();
    });

    it('reader returns [] when the server sends no Set-Cookie header', async () => {

        const api = new FetchEngine({ baseUrl });
        const res = await api.get('/no-cookie');

        expect(getSetCookieHeaders(res.headers)).toEqual([]);

        api.destroy();
    });

    it('does not clobber other headers when copying', async () => {

        const api = new FetchEngine({ baseUrl });
        const res = await api.get('/multi-cookie');

        // Other expected headers (Hapi sets content-type and others) must survive.
        // Use Reflect.get to avoid asserting on the generic-constrained type.
        expect(typeof Reflect.get(res.headers ?? {}, 'content-type')).toBe('string');

        api.destroy();
    });
});


describe('FetchEngine: resolve-on-response contract', () => {

    let server: Hapi.Server;
    let baseUrl: string;

    beforeAll(async () => {

        server = Hapi.server({ port: 0, host: 'localhost' });

        server.route({
            method: 'GET',
            path: '/error-400',
            handler: (_req, h) => h.response({ error: 'bad request', code: 400 }).code(400),
        });

        server.route({
            method: 'GET',
            path: '/error-500',
            handler: (_req, h) => h.response({ error: 'server error', code: 500 }).code(500),
        });

        // Echoes back whatever status code is requested, for range-boundary checks.
        server.route({
            method: 'GET',
            path: '/status/{code}',
            handler: (req, h) => h.response({ code: req.params.code }).code(Number(req.params.code)),
        });

        // Malformed JSON with a non-2xx status: the body format must never
        // mask the status — parse falls back to the raw text instead.
        server.route({
            method: 'GET',
            path: '/bad-json-500',
            handler: (_req, h) => h.response('not valid json{')
                .code(500)
                .header('content-type', 'application/json'),
        });

        // Malformed JSON with a 2xx status: the contract IS broken here, so
        // this still raises a FetchError with step 'parse'.
        server.route({
            method: 'GET',
            path: '/bad-json-200',
            handler: (_req, h) => h.response('not valid json{')
                .code(200)
                .header('content-type', 'application/json'),
        });

        await server.start();
        baseUrl = server.info.uri;
    });

    afterAll(async () => {

        await server.stop();
    });

    it('resolves a non-2xx response with ok:false, real status, response headers, and parsed data', async () => {

        const api = new FetchEngine({ baseUrl });

        const response = await api.get('/error-400');

        expect(response.ok).to.equal(false);
        expect(response.status).to.equal(400);
        expect(response.headers['content-type']).to.contain('application/json');
        expect(response.data).to.deep.equal({ error: 'bad request', code: 400 });

        api.destroy();
    });

    it('falls back to raw text in data when a non-2xx body fails to parse', async () => {

        const api = new FetchEngine({ baseUrl });

        const response = await api.get('/bad-json-500');

        expect(response.ok).to.equal(false);
        expect(response.status).to.equal(500);
        expect(response.data).to.equal('not valid json{');

        api.destroy();
    });

    it('raises a FetchError with step "parse" when a 2xx body fails to parse', async () => {

        const api = new FetchEngine({ baseUrl });

        const [res, err] = await attempt(() => api.get('/bad-json-200'));

        expect(res).to.not.exist;
        expect(err).to.exist;
        expect(err).to.be.instanceOf(FetchError);
        expect((err as FetchError).step).to.equal('parse');

        api.destroy();
    });

    it('emits "response" + "response-4xx"/"response-5xx" and never "error" for a resolved non-2xx response', async () => {

        const api = new FetchEngine({ baseUrl });

        const events: string[] = [];

        api.on('error', () => events.push('error'));
        api.on('response', () => events.push('response'));
        api.on('response-4xx', () => events.push('response-4xx'));
        api.on('response-5xx', () => events.push('response-5xx'));

        await api.get('/error-400');
        await api.get('/error-500');

        expect(events).to.deep.equal(['response', 'response-4xx', 'response', 'response-5xx']);

        api.destroy();
    });

    it('classifies status range boundaries: 399 fires neither range event, 400/499/500/599 fire their range, 600 fires neither', async () => {

        const api = new FetchEngine({ baseUrl });

        const boundaries: Array<{ status: number, range: 'response-4xx' | 'response-5xx' | null }> = [
            { status: 399, range: null },
            { status: 400, range: 'response-4xx' },
            { status: 499, range: 'response-4xx' },
            { status: 500, range: 'response-5xx' },
            { status: 599, range: 'response-5xx' },
            { status: 600, range: null },
        ];

        for (const { status, range } of boundaries) {

            const events: string[] = [];

            const off4xx = api.on('response-4xx', () => events.push('response-4xx'));
            const off5xx = api.on('response-5xx', () => events.push('response-5xx'));

            const response = await api.get(`/status/${status}`);

            off4xx();
            off5xx();

            expect(response.status, `status ${status}`).to.equal(status);
            expect(events, `status ${status} range events`).to.deep.equal(range ? [range] : []);
        }

        api.destroy();
    });
});


describe('FetchEngine: requestId is stable across retried attempts', async () => {

    const { testUrl } = await makeTestStubs(4136);

    it('keeps the same requestId on every diagnostic event across attempts', async () => {

        const api = new FetchEngine({
            baseUrl: testUrl,
            attemptTimeout: 20,
            retry: { maxAttempts: 3, baseDelay: 5 }
        });

        const requestIds = new Set<string>();

        api.on('before-request', (data: any) => requestIds.add(data.requestId));
        api.on('abort', (data: any) => requestIds.add(data.requestId));

        // /wait resolves after 1000ms — attemptTimeout (20ms) aborts every
        // attempt, forcing all 3 retries before the request finally fails.
        const [res, err] = await attempt(() => api.get('/wait'));

        expect(res).to.not.exist;
        expect(err).to.exist;
        expect(requestIds.size).to.equal(1);

        api.destroy();
    });
});
