import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../packages/fetch/src/index.ts';
import { createFetchContext } from '../../../packages/react/src/index.ts';
import type { FetchFailure } from '../../../packages/react/src/index.ts';
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

        it('auto-fetches on mount and resolves with data', async () => {

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
            expect(result.current.loading).to.be.true;
            expect(result.current.data).to.be.null;
            expect(result.current.failure).to.be.null;

            await flush();

            // Resolved — data is unwrapped T, failure stays null on success
            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.deep.equal({ users: ['alice', 'bob'] });
            expect(result.current.failure).to.be.null;

            unmount();
            engine.destroy();
        });

        it('sets failure with kind "http" on a non-2xx response', async () => {

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

            const failure: FetchFailure<unknown> | null = result.current.failure;

            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.be.null;
            expect(failure).to.not.be.null;
            expect(failure!.kind).to.equal('http');

            if (failure!.kind === 'http') {

                expect(failure!.response.status).to.equal(404);
                expect(failure!.response.data).to.deep.equal({ message: 'Not found' });
            }

            unmount();
            engine.destroy();
        });

        it('sets failure with kind "transport" when the request cannot reach the server', async () => {

            globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get('/missing');
            });

            await flush();

            const failure: FetchFailure<unknown> | null = result.current.failure;

            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.be.null;
            expect(failure).to.not.be.null;
            expect(failure!.kind).to.equal('transport');

            if (failure!.kind === 'transport') {

                expect(failure!.error.isConnectionLost()).to.be.true;
            }

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
            expect(result.current.cancel).to.be.a('function');
            expect(result.current.loading).to.be.true;

            // Cancel should not throw
            act(() => { result.current.cancel(); });

            await flush();

            // State stays loading — abort guard prevents updates
            expect(result.current.loading).to.be.true;
            expect(result.current.data).to.be.null;

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

        it('refetch() re-triggers the query', async () => {

            let callCount = 0;

            globalThis.fetch = vi.fn().mockImplementation(() => {

                callCount++;
                return Promise.resolve(jsonResponse({ count: callCount }));
            });

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get<{ count: number }>('/counter');
            });

            await flush();

            expect(result.current.data).to.deep.equal({ count: 1 });

            // Trigger refetch
            act(() => { result.current.refetch(); });

            await flush();

            expect(result.current.data).to.deep.equal({ count: 2 });
            expect(globalThis.fetch).toHaveBeenCalledTimes(2);

            unmount();
            engine.destroy();
        });

    });

    describe('mutation hooks', () => {

        it('post() starts idle until mutate is called', () => {

            globalThis.fetch = vi.fn();

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post('/comments');
            });

            expect(result.current.mutate).to.be.a('function');
            expect(result.current.cancel).to.be.a('function');
            expect(result.current.reset).to.be.a('function');
            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.be.null;
            expect(result.current.failure).to.be.null;
            expect(result.current.called).to.be.false;

            // fetch should NOT have been called
            expect(globalThis.fetch).not.toHaveBeenCalled();

            unmount();
            engine.destroy();
        });

        it('mutate fires the request and resolves', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ id: 1, text: 'Hello' }, 201)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post<{ id: number; text: string }>('/comments');
            });

            act(() => { result.current.mutate({ text: 'Hello' }); });

            await flush();

            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.deep.equal({ id: 1, text: 'Hello' });
            expect(result.current.failure).to.be.null;
            expect(result.current.called).to.be.true;

            unmount();
            engine.destroy();
        });

        it('mutate() returns Promise<T> that resolves with data', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ id: 42, name: 'Created' }, 201)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let promiseResult: unknown;

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post<{ id: number; name: string }>('/items');
            });

            await act(async () => {

                promiseResult = await result.current.mutate({ name: 'Created' });
            });

            expect(promiseResult).to.deep.equal({ id: 42, name: 'Created' });

            unmount();
            engine.destroy();
        });

        it('mutate() resolves undefined on a non-2xx response — failure surfaces via the failure state', async () => {

            // Preserves the original intent (server error surfaces to the
            // caller): mutate() never rejects now, so the proof moves from a
            // caught exception to the resolved value + `failure` state.
            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ message: 'Bad request' }, 400)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post('/items');
            });

            let mutateResult: unknown;

            await act(async () => {

                mutateResult = await result.current.mutate({ invalid: true });
            });

            expect(mutateResult).to.be.undefined;

            const failure: FetchFailure<unknown> | null = result.current.failure;

            expect(failure).to.not.be.null;
            expect(failure!.kind).to.equal('http');

            if (failure!.kind === 'http') {

                expect(failure!.response.status).to.equal(400);
            }

            unmount();
            engine.destroy();
        });

        it('mutation sets failure state on failure', async () => {

            // Preserves the original intent (server error surfaces to the
            // caller, hook state reflects it): mutate() never rejects, so
            // there is nothing to catch — await it directly.
            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ message: 'Validation failed' }, 422)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post('/comments');
            });

            await act(async () => { await result.current.mutate({ text: '' }); });

            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.be.null;
            expect(result.current.failure).to.not.be.null;
            expect(result.current.failure!.kind).to.equal('http');

            if (result.current.failure!.kind === 'http') {

                expect(result.current.failure!.response.status).to.equal(422);
            }

            expect(result.current.called).to.be.true;

            unmount();
            engine.destroy();
        });

        it('called tracks mutation invocation', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ ok: true })
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post('/action');
            });

            expect(result.current.called).to.be.false;

            act(() => { result.current.mutate(); });

            expect(result.current.called).to.be.true;

            await flush();

            expect(result.current.called).to.be.true;

            unmount();
            engine.destroy();
        });

        it('reset() clears mutation state', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ id: 1 }, 201)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post<{ id: number }>('/items');
            });

            act(() => { result.current.mutate({ name: 'test' }); });

            await flush();

            expect(result.current.data).to.deep.equal({ id: 1 });
            expect(result.current.called).to.be.true;

            // Reset clears everything
            act(() => { result.current.reset(); });

            expect(result.current.data).to.be.null;
            expect(result.current.failure).to.be.null;
            expect(result.current.loading).to.be.false;
            expect(result.current.called).to.be.false;

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

            act(() => { result.current.mutate(); });

            await flush();

            expect(result.current.loading).to.be.false;
            expect(result.current.failure).to.be.null;

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

            act(() => { result.current.mutate({ text: 'Updated' }); });

            await flush();

            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.deep.equal({ id: 1, text: 'Updated' });

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

            act(() => { result.current.mutate({ text: 'Patched' }); });

            await flush();

            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.deep.equal({ id: 1, text: 'Patched' });

            unmount();
            engine.destroy();
        });

        it('mutate() sets failure with kind "transport" when the request cannot reach the server', async () => {

            globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post<{ id: number }>('/items');
            });

            let mutateResult: unknown;

            await act(async () => {

                mutateResult = await result.current.mutate({ name: 'new' });
            });

            expect(mutateResult).to.be.undefined;

            const failure: FetchFailure<{ id: number }> | null = result.current.failure;

            expect(failure).to.not.be.null;
            expect(failure!.kind).to.equal('transport');

            if (failure!.kind === 'transport') {

                expect(failure!.error.isConnectionLost()).to.be.true;
            }

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
