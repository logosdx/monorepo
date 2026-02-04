import {
    describe,
    it,
    expect
} from 'vitest'

import {
    FetchError,
    FetchEngine,
} from '../../../../packages/fetch/src/index.ts';

import { attempt, attemptSync, wait } from '../../../../packages/utils/src/index.ts';
import { makeTestStubs } from '../_helpers.ts';


describe('FetchEngine: timeout boundaries', async () => {

    const { testUrl } = await makeTestStubs(4130);

    it('should handle 0ms timeout', async () => {

        // Immediate timeout edge case - use slow endpoint to ensure timeout fires first
        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Timeout of 0ms should immediately abort against slow endpoint
        const [, err] = await attempt(() => api.get('/slow-success/200', { timeout: 0 }));

        expect(err).to.exist;
        expect(err).to.be.instanceOf(FetchError);

        const fetchErr = err as FetchError;
        expect(fetchErr.aborted).to.be.true;

        api.destroy();
        await wait(10); // Let microtasks settle
    });

    it('should handle 1ms timeout', async () => {

        // Very short timeout - likely to fail on slow endpoint
        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Start a slow request (1000ms endpoint) with 1ms timeout
        const [, err] = await attempt(() => api.get('/wait', { timeout: 1 }));

        expect(err).to.exist;
        expect(err).to.be.instanceOf(FetchError);

        const fetchErr = err as FetchError;
        expect(fetchErr.aborted).to.be.true;
        expect(fetchErr.step).to.equal('fetch');

        api.destroy();
        await wait(10); // Let microtasks settle
    });

    it('should handle negative timeout values', async () => {

        // Negative timeout throws assertion error at request time (validation)
        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const [, err] = await attempt(() => api.get('/json', { timeout: -1 }));

        expect(err).to.exist;
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.include('non-negative');

        api.destroy();
    });

    it('should handle Infinity timeout', async () => {

        // Infinity is coerced by Node.js to 1ms (see TimeoutOverflowWarning)
        // so the request effectively has a very short timeout
        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        // Use a slow endpoint so the 1ms timeout triggers an abort
        const [, err] = await attempt(() => api.get('/wait', { timeout: Infinity }));

        // Infinity causes immediate abort due to Node.js 32-bit overflow
        expect(err).to.exist;
        expect(err).to.be.instanceOf(FetchError);
        expect((err as FetchError).aborted).to.be.true;

        api.destroy();
        await wait(10); // Let microtasks settle
    });

    it('should handle NaN timeout', async () => {

        // NaN passes typeof check but fails >= 0 assertion
        const api = new FetchEngine({
            baseUrl: testUrl,
            dedupePolicy: true
        });

        const [, err] = await attempt(() => api.get('/json', { timeout: NaN }));

        expect(err).to.exist;
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.include('non-negative');

        api.destroy();
    });

    it('should handle empty string baseUrl with absolute path', async () => {

        // Edge case: empty baseUrl is NOT valid - FetchEngine requires baseUrl
        // This test verifies the validation error is thrown
        const [, err] = attemptSync(() => new FetchEngine({
            baseUrl: '',
            dedupePolicy: true
        }));

        expect(err).to.exist;
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.include('baseUrl');
    });
});
