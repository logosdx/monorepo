import {
    describe,
    it,
    expect
} from 'vitest'

import {
    FetchEngine,
} from '@logosdx/fetch';

import { FetchPromise } from '../../../../packages/fetch/src/engine/fetch-promise.ts';

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
                .to.deep.equal(['config', 'data', 'headers', 'request', 'status']);

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
