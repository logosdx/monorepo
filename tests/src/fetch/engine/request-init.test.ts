import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
} from 'vitest';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { makeTestStubs } from '../_helpers.ts';


describe('FetchEngine: RequestInit options', async () => {

    const { testUrl } = await makeTestStubs(4140);

    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {

        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {

        fetchSpy.mockRestore();
    });

    describe('instance-level RequestInit options', () => {

        it('should pass credentials option to fetch', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                credentials: 'include',
            });

            await api.get('/json');

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.credentials).to.equal('include');

            api.destroy();
        });

        it('should pass mode option to fetch', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                mode: 'cors',
            });

            await api.get('/json');

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.mode).to.equal('cors');

            api.destroy();
        });

        it('should pass cache option to fetch', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                cache: 'no-store',
            });

            await api.get('/json');

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.cache).to.equal('no-store');

            api.destroy();
        });

        it('should pass redirect option to fetch', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                redirect: 'manual',
            });

            await api.get('/json');

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.redirect).to.equal('manual');

            api.destroy();
        });

        it('should pass referrerPolicy option to fetch', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                referrerPolicy: 'no-referrer',
            });

            await api.get('/json');

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.referrerPolicy).to.equal('no-referrer');

            api.destroy();
        });

        it('should pass integrity option to fetch', async () => {

            // Mock fetch to avoid actual integrity validation
            const mockFetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                })
            );

            fetchSpy.mockImplementation(mockFetch);

            const api = new FetchEngine({
                baseUrl: testUrl,
                integrity: 'sha256-abc123',
            });

            await api.get('/json');

            expect(mockFetch).toHaveBeenCalledTimes(1);

            const [, init] = mockFetch.mock.calls[0];

            expect(init?.integrity).to.equal('sha256-abc123');

            api.destroy();
        });

        it('should pass keepalive option to fetch', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                keepalive: true,
            });

            await api.get('/json');

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.keepalive).to.equal(true);

            api.destroy();
        });

        it('should pass multiple RequestInit options to fetch', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                credentials: 'include',
                mode: 'cors',
                cache: 'no-cache',
                redirect: 'follow',
                referrerPolicy: 'strict-origin',
            });

            await api.get('/json');

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.credentials).to.equal('include');
            expect(init?.mode).to.equal('cors');
            expect(init?.cache).to.equal('no-cache');
            expect(init?.redirect).to.equal('follow');
            expect(init?.referrerPolicy).to.equal('strict-origin');

            api.destroy();
        });
    });

    describe('per-request RequestInit overrides', () => {

        it('should allow per-request override of credentials', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                credentials: 'include',
            });

            await api.get('/json', { credentials: 'same-origin' });

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.credentials).to.equal('same-origin');

            api.destroy();
        });

        it('should allow per-request override of mode', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                mode: 'cors',
            });

            await api.get('/json', { mode: 'same-origin' });

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.mode).to.equal('same-origin');

            api.destroy();
        });

        it('should allow per-request override of cache', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                cache: 'default',
            });

            await api.get('/json', { cache: 'reload' });

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.cache).to.equal('reload');

            api.destroy();
        });

        it('should use instance default when per-request option not provided', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                credentials: 'include',
                mode: 'cors',
            });

            // Only override credentials, mode should stay as instance default
            await api.get('/json', { credentials: 'omit' });

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.credentials).to.equal('omit');
            expect(init?.mode).to.equal('cors');

            api.destroy();
        });

        it('should allow per-request options when no instance defaults', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
            });

            await api.get('/json', {
                credentials: 'include',
                cache: 'no-store',
            });

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.credentials).to.equal('include');
            expect(init?.cache).to.equal('no-store');

            api.destroy();
        });
    });

    describe('RequestInit options across HTTP methods', () => {

        it('should pass RequestInit options for POST requests', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                credentials: 'include',
            });

            await api.post('/json', { data: 'test' });

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.credentials).to.equal('include');
            expect(init?.method).to.equal('POST');

            api.destroy();
        });

        it('should pass RequestInit options for PUT requests', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                mode: 'cors',
            });

            await api.put('/json', { data: 'test' });

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.mode).to.equal('cors');
            expect(init?.method).to.equal('PUT');

            api.destroy();
        });

        it('should pass RequestInit options for DELETE requests', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                cache: 'no-cache',
            });

            await api.delete('/json');

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.cache).to.equal('no-cache');
            expect(init?.method).to.equal('DELETE');

            api.destroy();
        });
    });

    describe('RequestInit options with modifyConfig', () => {

        it('should allow modifyConfig to set RequestInit options', async () => {

            const api = new FetchEngine({
                baseUrl: testUrl,
                modifyConfig: (opts) => ({
                    ...opts,
                    credentials: 'include' as RequestCredentials,
                }),
            });

            await api.get('/json');

            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const [, init] = fetchSpy.mock.calls[0];

            expect(init?.credentials).to.equal('include');

            api.destroy();
        });
    });
});
