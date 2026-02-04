import {
    describe,
    it,
    expect
} from 'vitest'

import {
    FetchEngine,
} from '../../../../packages/fetch/src/index.ts';

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
