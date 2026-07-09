import { describe, it, expect } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../packages/fetch/src/index.ts';
import { createFetchContext } from '../../../packages/react/src/index.ts';
import type { FetchFailure } from '../../../packages/react/src/index.ts';
import { attempt } from '../../../packages/utils/src/index.ts';
import { renderHook } from './_helpers.ts';
import { makeTestStubs } from '../fetch/_helpers.ts';


/**
 * Flushes real network requests — gives localhost HTTP calls time to complete.
 * Unlike the mock-based `flush()`, this accounts for actual network round-trip.
 */
const flushReal = async () => {

    await act(async () => {

        await new Promise(r => setTimeout(r, 100));
    });
};


describe('@logosdx/react: fetch integration (real server)', async () => {

    const { testUrl, callStub } = await makeTestStubs(4200);

    describe('get() queries against real server', () => {

        it('auto-fetches on mount and returns unwrapped data', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get<{ ok: boolean }>('/json');
            });

            expect(result.current.loading).to.be.true;
            expect(result.current.data).to.be.null;

            await flushReal();

            // data is unwrapped T — not the full FetchResponse
            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.deep.equal({ ok: true });
            expect(result.current.failure).to.be.null;

            // Server was actually hit
            expect(callStub.callCount).to.be.greaterThanOrEqual(1);

            unmount();
            engine.destroy();
        });

        it('sets failure with kind "http" on server error response, carrying the full FetchResponse', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get('/fail');
            });

            await flushReal();

            const failure: FetchFailure<unknown> | null = result.current.failure;

            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.be.null;
            expect(failure).to.not.be.null;
            expect(failure!.kind).to.equal('http');

            if (failure!.kind === 'http') {

                expect(failure!.response.status).to.equal(400);
                // Response headers stay accessible through the failure channel —
                // the capability moved here, it did not disappear.
                expect(failure!.response.headers['content-type']).to.include('application/json');
            }

            unmount();
            engine.destroy();
        });

        it('sets failure with kind "transport" when the server is unreachable', async () => {

            // Unreachable-port idiom: appending a digit to a bound test port
            // yields an address nothing is listening on.
            const engine = new FetchEngine({ baseUrl: testUrl + 1, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get('/json');
            });

            await flushReal();

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

        it('refetch() re-triggers the query against the server', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get<{ ok: boolean }>('/json');
            });

            await flushReal();

            const callCountAfterMount = callStub.callCount;
            expect(result.current.data).to.deep.equal({ ok: true });

            // Trigger refetch
            act(() => { result.current.refetch(); });

            await flushReal();

            // Server was hit again with a second request
            expect(callStub.callCount).to.be.greaterThan(callCountAfterMount);
            expect(result.current.data).to.deep.equal({ ok: true });
            expect(result.current.loading).to.be.false;

            unmount();
            engine.destroy();
        });

        it('re-fetches when path changes', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            let queryPath = '/json';

            const { result, rerender, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get<{ ok: boolean; path?: string }>(queryPath);
            });

            await flushReal();

            expect(result.current.data).to.deep.equal({ ok: true });

            // Change path — useEffect key changes, triggers new fetch
            queryPath = '/users/42';
            rerender();

            await flushReal();

            // Catch-all route returns { ok: true, path: '/users/42' }
            expect(result.current.data).to.deep.equal({ ok: true, path: '/users/42' });

            unmount();
            engine.destroy();
        });

        it('cancel() aborts an in-flight request to the server', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get } = useFetch();
                return get('/slow-success/2000');
            });

            // Request is in-flight (2s server delay)
            expect(result.current.loading).to.be.true;

            // Cancel before it completes
            act(() => { result.current.cancel(); });

            await flushReal();

            // State stays loading — abort guard prevents state updates
            expect(result.current.loading).to.be.true;
            expect(result.current.data).to.be.null;

            unmount();
            engine.destroy();
        });
    });

    describe('mutation hooks against real server', () => {

        it('starts idle — no request until mutate() is called', () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const initialCallCount = callStub.callCount;

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post('/json');
            });

            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.be.null;
            expect(result.current.called).to.be.false;

            // No request was made to the server
            expect(callStub.callCount).to.equal(initialCallCount);

            unmount();
            engine.destroy();
        });

        it('mutate() fires POST to server and returns Promise<T>', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            let promiseResult: unknown;

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post<{ ok: boolean }>('/json');
            });

            await act(async () => {

                promiseResult = await result.current.mutate({ text: 'hello' });
            });

            // Promise resolved with unwrapped data
            expect(promiseResult).to.deep.equal({ ok: true });

            // State also updated consistently
            expect(result.current.data).to.deep.equal({ ok: true });
            expect(result.current.loading).to.be.false;
            expect(result.current.called).to.be.true;

            unmount();
            engine.destroy();
        });

        it('mutate() sets failure with kind "transport" when the server is unreachable', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl + 1, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post<{ ok: boolean }>('/json');
            });

            let mutateResult: unknown;

            await act(async () => {

                mutateResult = await result.current.mutate({});
            });

            expect(mutateResult).to.be.undefined;

            const failure: FetchFailure<{ ok: boolean }> | null = result.current.failure;

            expect(failure).to.not.be.null;
            expect(failure!.kind).to.equal('transport');

            if (failure!.kind === 'transport') {

                expect(failure!.error.isConnectionLost()).to.be.true;
            }

            unmount();
            engine.destroy();
        });

        it('called tracks whether mutate() has been invoked', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post('/json');
            });

            expect(result.current.called).to.be.false;

            act(() => { result.current.mutate(); });

            // called is true immediately after mutate()
            expect(result.current.called).to.be.true;

            await flushReal();

            // Still true after resolution
            expect(result.current.called).to.be.true;

            unmount();
            engine.destroy();
        });

        it('reset() clears all mutation state back to initial', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post<{ ok: boolean }>('/json');
            });

            act(() => { result.current.mutate(); });

            await flushReal();

            expect(result.current.data).to.deep.equal({ ok: true });
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

        it('can mutate again after reset()', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post<{ ok: boolean }>('/json');
            });

            // First mutation
            act(() => { result.current.mutate(); });
            await flushReal();
            expect(result.current.data).to.deep.equal({ ok: true });

            // Reset
            act(() => { result.current.reset(); });
            expect(result.current.data).to.be.null;
            expect(result.current.called).to.be.false;

            // Mutate again — should work the same
            act(() => { result.current.mutate(); });
            await flushReal();
            expect(result.current.data).to.deep.equal({ ok: true });
            expect(result.current.called).to.be.true;

            unmount();
            engine.destroy();
        });

        it('sets failure state on failed mutation', async () => {

            // Preserves the original intent (server error surfaces to the
            // caller, hook state reflects it): mutate() never rejects, so
            // there is nothing to catch — await it directly.
            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post('/fail');
            });

            await act(async () => { await result.current.mutate(); });

            expect(result.current.loading).to.be.false;
            expect(result.current.data).to.be.null;
            expect(result.current.failure).to.not.be.null;
            expect(result.current.failure!.kind).to.equal('http');

            if (result.current.failure!.kind === 'http') {

                expect(result.current.failure!.response.status).to.equal(400);
            }

            expect(result.current.called).to.be.true;

            unmount();
            engine.destroy();
        });

        it('mutate() resolves undefined on server error — failure surfaces via the failure state', async () => {

            // Preserves the original intent (server error surfaces to the
            // caller): mutate() never rejects now, so the proof moves from a
            // caught exception to the resolved value + `failure` state.
            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();
                return post('/fail');
            });

            let mutateResult: unknown;

            await act(async () => {

                mutateResult = await result.current.mutate();
            });

            expect(mutateResult).to.be.undefined;
            expect(result.current.failure).to.not.be.null;
            expect(result.current.failure!.kind).to.equal('http');

            if (result.current.failure!.kind === 'http') {

                expect(result.current.failure!.response.status).to.equal(400);
            }

            unmount();
            engine.destroy();
        });

        it('del() works as a mutation against the server', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { del } = useFetch();
                return del<{ ok: boolean }>('/json');
            });

            act(() => { result.current.mutate(); });

            await flushReal();

            expect(result.current.data).to.deep.equal({ ok: true });
            expect(result.current.failure).to.be.null;

            unmount();
            engine.destroy();
        });

        it('put() works as a mutation against the server', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { put } = useFetch();
                return put<{ ok: boolean }>('/json');
            });

            act(() => { result.current.mutate({ updated: true }); });

            await flushReal();

            expect(result.current.data).to.deep.equal({ ok: true });
            expect(result.current.failure).to.be.null;

            unmount();
            engine.destroy();
        });

        it('patch() works as a mutation against the server', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { patch } = useFetch();
                return patch<{ ok: boolean }>('/json');
            });

            act(() => { result.current.mutate({ partial: true }); });

            await flushReal();

            expect(result.current.data).to.deep.equal({ ok: true });
            expect(result.current.failure).to.be.null;

            unmount();
            engine.destroy();
        });
    });

    describe('documented patterns', () => {

        it('object destructuring with renaming works as documented', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { post } = useFetch();

                // Matches the docs example:
                // const { mutate: submit, loading: isSubmitting, data: result, failure: submitFailure } =
                //     post<Comment>('/comments');
                const { mutate: submit, loading: isSubmitting, data: comment, failure: submitFailure } =
                    post<{ ok: boolean }>('/json');

                return { submit, isSubmitting, comment, submitFailure };
            });

            expect(result.current.isSubmitting).to.be.false;
            expect(result.current.comment).to.be.null;

            act(() => { result.current.submit({ text: 'Hello' }); });

            await flushReal();

            expect(result.current.isSubmitting).to.be.false;
            expect(result.current.comment).to.deep.equal({ ok: true });
            expect(result.current.submitFailure).to.be.null;

            unmount();
            engine.destroy();
        });

        it('multiple hooks in same component work together', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get, post } = useFetch();
                const query = get<{ ok: boolean }>('/json');
                const mutation = post<{ ok: boolean }>('/json');
                return { query, mutation };
            });

            await flushReal();

            // Query auto-fetched
            expect(result.current.query.data).to.deep.equal({ ok: true });
            expect(result.current.query.loading).to.be.false;

            // Mutation still idle
            expect(result.current.mutation.loading).to.be.false;
            expect(result.current.mutation.called).to.be.false;

            // Fire mutation
            act(() => { result.current.mutation.mutate(); });

            await flushReal();

            // Both resolved
            expect(result.current.query.data).to.deep.equal({ ok: true });
            expect(result.current.mutation.data).to.deep.equal({ ok: true });
            expect(result.current.mutation.called).to.be.true;

            unmount();
            engine.destroy();
        });

        it('escape hatch gives raw engine for imperative calls', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => useFetch());

            // instance is the raw FetchEngine
            expect(result.current.instance).to.equal(engine);

            // Can use for imperative calls — the documented escape hatch
            const [res, err] = await attempt(
                () => result.current.instance.get<{ ok: boolean }>('/json')
            );

            expect(err).to.be.null;
            expect(res!.data).to.deep.equal({ ok: true });

            unmount();
            engine.destroy();
        });

        it('Provider wraps children and hooks access the correct engine', async () => {

            const engine = new FetchEngine({ baseUrl: testUrl, retry: false });
            const [Provider, useFetch] = createFetchContext(engine);

            const { result, unmount } = renderHook(() => {

                const { get, instance } = useFetch();
                const query = get<{ ok: boolean }>('/json');
                return { query, instance };
            }, Provider);

            await flushReal();

            expect(result.current.instance).to.equal(engine);
            expect(result.current.query.data).to.deep.equal({ ok: true });

            unmount();
            engine.destroy();
        });
    });
});
