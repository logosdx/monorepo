import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../packages/fetch/src/index.ts';
import { createFetchContext } from '../../../packages/react/src/index.ts';
import { renderHook, flush } from './_helpers.ts';


const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react: fetch', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('createFetchContext returns [Provider, useHook] tuple', () => {

        const engine = new FetchEngine({ baseUrl: 'https://api.test' });
        const result = createFetchContext(engine);

        expect(result).to.be.an('array').with.lengthOf(2);
        expect(result[0]).to.be.a('function');
        expect(result[1]).to.be.a('function');

        engine.destroy();
    });

    it('useHook returns the expected API shape', () => {

        const engine = new FetchEngine({ baseUrl: 'https://api.test' });
        const [, useFetch] = createFetchContext(engine);

        const { result, unmount } = renderHook(() => useFetch());

        expect(result.current.get).to.be.a('function');
        expect(result.current.post).to.be.a('function');
        expect(result.current.put).to.be.a('function');
        expect(result.current.del).to.be.a('function');
        expect(result.current.patch).to.be.a('function');
        expect(result.current.instance).to.equal(engine);

        unmount();
        engine.destroy();
    });

    describe('get() queries', () => {

        it('auto-fetches on mount and resolves with response', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ users: ['alice', 'bob'] })
            );

            const engine = new FetchEngine<{ poop: true }>({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext<{ poop: true }>(engine);

            const { result, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get<{ users: string[] }>('/users');
            });

            // Initially loading
            expect(result.current[1]).to.be.true;
            expect(result.current[2]).to.be.null;
            expect(result.current[3]).to.be.null;

            await flush();

            // Resolved
            expect(result.current[1]).to.be.false;
            expect(result.current[2]).to.not.be.null;
            expect(result.current[2]!.data).to.deep.equal({ users: ['alice', 'bob'] });
            expect(result.current[3]).to.be.null;

            unmount();
            engine.destroy();
        });

        it('sets error state on failed request', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ message: 'Not found' }, 404)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get('/missing');
            });

            await flush();

            expect(result.current[1]).to.be.false;
            expect(result.current[2]).to.be.null;
            expect(result.current[3]).to.not.be.null;
            expect(result.current[3]!.status).to.equal(404);

            unmount();
            engine.destroy();
        });

        it('cancel() aborts the in-flight request', async () => {

            globalThis.fetch = vi.fn().mockImplementation(
                () => new Promise(() => {}) // never resolves
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get('/slow');
            });

            // Request is in-flight
            expect(result.current[0]).to.be.a('function');
            expect(result.current[1]).to.be.true;

            // Cancel should not throw
            act(() => { result.current[0](); });

            await flush();

            // State stays loading — abort guard prevents updates
            expect(result.current[1]).to.be.true;
            expect(result.current[2]).to.be.null;

            unmount();
            engine.destroy();
        });

        it('cleans up in-flight request on unmount', async () => {

            globalThis.fetch = vi.fn().mockImplementation(
                () => new Promise(() => {}) // never resolves
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { unmount } = renderHook(() => {

                const { get } = useFetch();
                return get('/hang');
            });

            // Should not throw or leave dangling state
            unmount();
            engine.destroy();
        });
    });

    describe('mutation hooks', () => {

        it('post() starts idle until triggered', () => {

            globalThis.fetch = vi.fn();

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post('/comments');
            });

            // [trigger, cancel, isLoading, response, error]
            expect(result.current[0]).to.be.a('function');  // trigger
            expect(result.current[1]).to.be.a('function');  // cancel
            expect(result.current[2]).to.be.false;          // isLoading
            expect(result.current[3]).to.be.null;           // response
            expect(result.current[4]).to.be.null;           // error

            // fetch should NOT have been called
            expect(globalThis.fetch).not.toHaveBeenCalled();

            unmount();
            engine.destroy();
        });

        it('trigger fires the request and resolves', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ id: 1, text: 'Hello' }, 201)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post<{ id: number; text: string }>('/comments');
            });

            act(() => { result.current[0]({ text: 'Hello' }); });

            await flush();

            expect(result.current[2]).to.be.false;
            expect(result.current[3]).to.not.be.null;
            expect(result.current[3]!.data).to.deep.equal({ id: 1, text: 'Hello' });
            expect(result.current[4]).to.be.null;

            unmount();
            engine.destroy();
        });

        it('mutation sets error state on failure', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ message: 'Validation failed' }, 422)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post('/comments');
            });

            act(() => { result.current[0]({ text: '' }); });

            await flush();

            expect(result.current[2]).to.be.false;
            expect(result.current[3]).to.be.null;
            expect(result.current[4]).to.not.be.null;
            expect(result.current[4]!.status).to.equal(422);

            unmount();
            engine.destroy();
        });

        it('del() works as a mutation', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({})
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { del } = useFetch();
                return del('/comments/1');
            });

            act(() => { result.current[0](); });

            await flush();

            expect(result.current[2]).to.be.false;
            expect(result.current[4]).to.be.null;

            unmount();
            engine.destroy();
        });

        it('put() works as a mutation', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ id: 1, text: 'Updated' })
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { put } = useFetch();
                return put<{ id: number; text: string }>('/comments/1');
            });

            act(() => { result.current[0]({ text: 'Updated' }); });

            await flush();

            expect(result.current[2]).to.be.false;
            expect(result.current[3]!.data).to.deep.equal({ id: 1, text: 'Updated' });

            unmount();
            engine.destroy();
        });

        it('patch() works as a mutation', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ id: 1, text: 'Patched' })
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { patch } = useFetch();
                return patch<{ id: number; text: string }>('/comments/1');
            });

            act(() => { result.current[0]({ text: 'Patched' }); });

            await flush();

            expect(result.current[2]).to.be.false;
            expect(result.current[3]!.data).to.deep.equal({ id: 1, text: 'Patched' });

            unmount();
            engine.destroy();
        });
    });

    it('instance gives raw engine access', () => {

        const engine = new FetchEngine({ baseUrl: 'https://api.test' });
        const [, useFetch] = createFetchContext(engine);

        const { result, unmount } = renderHook(() => useFetch());

        expect(result.current.instance).to.equal(engine);

        unmount();
        engine.destroy();
    });

    it('Provider wraps children with context', () => {

        const engine = new FetchEngine({ baseUrl: 'https://api.test' });
        const [Provider, useFetch] = createFetchContext(engine);

        const { result, unmount } = renderHook(
            () => useFetch(),
            Provider
        );

        expect(result.current.instance).to.equal(engine);

        unmount();
        engine.destroy();
    });
});
