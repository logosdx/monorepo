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


describe('@logosdx/react: fetch render efficiency', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    describe('get() renders', () => {

        it('mount + resolve settles in exactly 2 renders', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ ok: true })
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { get } = useFetch();
                return get<{ ok: boolean }>('/users');
            });

            // After mount: 1 render (loading=true)
            // useEffect fires, setLoading(true) is a no-op (same value) — no extra render
            expect(renderCount).to.equal(1);
            expect(result.current.loading).to.be.true;

            await flush();

            // After resolve: .then() batches setLoading+setData+setResponse+setError — 1 render
            expect(renderCount).to.equal(2);
            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.deep.equal({ ok: true });

            unmount();
            engine.destroy();
        });

        it('error path also settles in exactly 2 renders', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ message: 'fail' }, 500)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { get } = useFetch();
                return get('/fail');
            });

            expect(renderCount).to.equal(1);

            await flush();

            expect(renderCount).to.equal(2);
            expect(result.current.error).to.not.be.null;

            unmount();
            engine.destroy();
        });

        it('refetch() adds at most 3 renders (state change + loading + resolve)', async () => {

            let callCount = 0;

            globalThis.fetch = vi.fn().mockImplementation(() => {

                callCount++;
                return Promise.resolve(jsonResponse({ n: callCount }));
            });

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { get } = useFetch();
                return get<{ n: number }>('/data');
            });

            await flush();

            const afterInitial = renderCount; // 2

            act(() => { result.current.refetch(); });

            await flush();

            // refetch: setRefetchCount → render, useEffect setLoading(true) → render, resolve → render
            const refetchRenders = renderCount - afterInitial;
            expect(refetchRenders).to.be.lessThanOrEqual(3);
            expect(result.current.data).to.deep.equal({ n: 2 });

            unmount();
            engine.destroy();
        });

        it('cancel() does not trigger any additional renders', async () => {

            globalThis.fetch = vi.fn().mockImplementation(
                () => new Promise(() => {}) // never resolves
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { get } = useFetch();
                return get('/slow');
            });

            const afterMount = renderCount;

            // cancel() just aborts — no setState calls
            act(() => { result.current.cancel(); });

            await flush();

            expect(renderCount).to.equal(afterMount);

            unmount();
            engine.destroy();
        });

        it('stable options with same content do not trigger re-fetch', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ ok: true })
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            // Options object is recreated each render — but same content
            const { rerender, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get('/data', { params: { page: '1' } });
            });

            await flush();

            const fetchCountAfterMount = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

            // Force re-render with new options object (same JSON key)
            rerender();

            await flush();

            // No new fetch — key serialized to the same string
            expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).to.equal(fetchCountAfterMount);

            unmount();
            engine.destroy();
        });

        it('path change triggers exactly one new fetch', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ ok: true })
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let queryPath = '/first';

            const { rerender, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get(queryPath);
            });

            await flush();

            const fetchCountAfterMount = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

            queryPath = '/second';
            rerender();

            await flush();

            // Exactly one new fetch for the path change
            const newFetches = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length - fetchCountAfterMount;
            expect(newFetches).to.equal(1);

            unmount();
            engine.destroy();
        });
    });

    describe('mutation renders', () => {

        it('mount is exactly 1 render (idle state)', () => {

            globalThis.fetch = vi.fn();

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { unmount } = renderHook(() => {

                renderCount++;
                const { post } = useFetch();
                return post('/items');
            });

            // No useEffect, no fetch — just the initial render
            expect(renderCount).to.equal(1);

            unmount();
            engine.destroy();
        });

        it('mutate() + resolve adds exactly 2 renders (firing + resolved)', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ id: 1 })
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { post } = useFetch();
                return post<{ id: number }>('/items');
            });

            const afterMount = renderCount; // 1

            act(() => { result.current.mutate({ name: 'test' }); });

            await flush();

            // 1 render for setCalled+setLoading (batched), 1 for resolved setState (batched)
            const mutateRenders = renderCount - afterMount;
            expect(mutateRenders).to.equal(2);
            expect(result.current.data).to.deep.equal({ id: 1 });

            unmount();
            engine.destroy();
        });

        it('mutate() error path adds at most 2 renders', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ message: 'bad' }, 400)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { post } = useFetch();
                return post('/items');
            });

            const afterMount = renderCount; // 1

            await act(async () => {

                try { await result.current.mutate(); }
                catch { /* expected */ }
            });

            // async act may batch firing + error resolution into 1 render
            const mutateRenders = renderCount - afterMount;
            expect(mutateRenders).to.be.lessThanOrEqual(2);
            expect(mutateRenders).to.be.greaterThanOrEqual(1);

            unmount();
            engine.destroy();
        });

        it('reset() adds exactly 1 render', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ id: 1 })
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { post } = useFetch();
                return post<{ id: number }>('/items');
            });

            act(() => { result.current.mutate(); });

            await flush();

            const afterMutate = renderCount;

            // reset() batches 5 setState calls into 1 render
            act(() => { result.current.reset(); });

            expect(renderCount - afterMutate).to.equal(1);
            expect(result.current.data).to.be.null;
            expect(result.current.called).to.be.false;

            unmount();
            engine.destroy();
        });

        it('calling mutate() twice does not leak renders', async () => {

            let callCount = 0;

            globalThis.fetch = vi.fn().mockImplementation(() => {

                callCount++;
                return Promise.resolve(jsonResponse({ n: callCount }));
            });

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { post } = useFetch();
                return post<{ n: number }>('/items');
            });

            // First mutation cycle
            act(() => { result.current.mutate(); });
            await flush();

            const afterFirst = renderCount;

            // Second mutation — same pattern, same bounded renders
            act(() => { result.current.mutate(); });
            await flush();

            const secondRenders = renderCount - afterFirst;
            expect(secondRenders).to.equal(2); // firing + resolved
            expect(result.current.data).to.deep.equal({ n: 2 });

            unmount();
            engine.destroy();
        });
    });

    describe('combined operations', () => {

        it('get + post in same component does not double-render on mount', async () => {

            globalThis.fetch = vi.fn().mockImplementation(
                () => Promise.resolve(jsonResponse({ ok: true }))
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { get, post } = useFetch();
                return {
                    query: get<{ ok: boolean }>('/data'),
                    mutation: post<{ ok: boolean }>('/data'),
                };
            });

            // Both hooks share the same component — 1 initial render
            expect(renderCount).to.equal(1);
            expect(result.current.query.loading).to.be.true;
            expect(result.current.mutation.loading).to.be.false;

            await flush();

            // Only the query caused a state update → 1 more render
            expect(renderCount).to.equal(2);
            expect(result.current.query.data).to.deep.equal({ ok: true });

            unmount();
            engine.destroy();
        });

        it('query resolve + mutation fire do not interfere', async () => {

            // Each call needs a fresh Response (body can only be consumed once)
            globalThis.fetch = vi.fn().mockImplementation(
                () => Promise.resolve(jsonResponse({ ok: true }))
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { get, post } = useFetch();
                return {
                    query: get<{ ok: boolean }>('/data'),
                    mutation: post<{ ok: boolean }>('/data'),
                };
            });

            await flush();

            const afterQueryResolve = renderCount; // 2

            // Fire mutation — should add exactly 2 renders (firing + resolved)
            act(() => { result.current.mutation.mutate(); });

            await flush();

            const mutationRenders = renderCount - afterQueryResolve;
            expect(mutationRenders).to.equal(2);

            // Query data unaffected
            expect(result.current.query.data).to.deep.equal({ ok: true });
            expect(result.current.mutation.data).to.deep.equal({ ok: true });

            unmount();
            engine.destroy();
        });

        it('reset after error does not cause cascading renders', async () => {

            globalThis.fetch = vi.fn().mockResolvedValue(
                jsonResponse({ message: 'fail' }, 400)
            );

            const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
            const [, useFetch] = createFetchContext(engine);

            let renderCount = 0;

            const { result, unmount } = renderHook(() => {

                renderCount++;
                const { post } = useFetch();
                return post('/items');
            });

            await act(async () => {

                try { await result.current.mutate(); }
                catch { /* expected */ }
            });

            const afterError = renderCount;

            // reset after error — should be 1 render, not cascading
            act(() => { result.current.reset(); });

            expect(renderCount - afterError).to.equal(1);
            expect(result.current.error).to.be.null;
            expect(result.current.called).to.be.false;

            unmount();
            engine.destroy();
        });
    });
});
