import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { useQuery } from '../../../../packages/react/src/api/use-query.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: useQuery', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('auto-fetches on mount and returns data (not full response)', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ users: ['alice', 'bob'] })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery<{ users: string[] }>(engine, '/users')
        );

        expect(result.current.loading).to.be.true;
        expect(result.current.data).to.be.null;
        expect(result.current.error).to.be.null;

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.deep.equal({ users: ['alice', 'bob'] });
        expect(result.current.error).to.be.null;

        unmount();
        engine.destroy();
    });

    it('sets error state on failed request', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ message: 'Not found' }, 404)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/missing')
        );

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(result.current.error).to.not.be.null;
        expect(result.current.error!.status).to.equal(404);

        unmount();
        engine.destroy();
    });

    it('re-fetches when reactive config changes', async () => {

        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ page: 1 }))
            .mockResolvedValueOnce(jsonResponse({ page: 2 }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        let page = '1';

        const { result, rerender, unmount } = renderHook(() =>
            useQuery(engine, '/items', {
                reactive: { params: { page } },
            })
        );

        await flush();
        expect(result.current.data).to.deep.equal({ page: 1 });

        page = '2';
        rerender();
        await flush();

        expect(result.current.data).to.deep.equal({ page: 2 });
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        unmount();
        engine.destroy();
    });

    it('does not fetch when skip is true', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/skipped', { skip: true })
        );

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(globalThis.fetch).not.toHaveBeenCalled();

        unmount();
        engine.destroy();
    });

    it('merges defaults and reactive config', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { unmount } = renderHook(() =>
            useQuery(engine, '/with-config', {
                defaults: { headers: { 'X-Custom': 'value' } },
                reactive: { params: { page: '1' } },
            })
        );

        await flush();

        const [url, options] = (globalThis.fetch as any).mock.calls[0];
        expect(url.toString()).to.include('page=1');
        expect(options.headers['X-Custom']).to.equal('value');

        unmount();
        engine.destroy();
    });

    it('refetch() re-executes the query', async () => {

        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ count: 1 }))
            .mockResolvedValueOnce(jsonResponse({ count: 2 }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/counter')
        );

        await flush();
        expect(result.current.data).to.deep.equal({ count: 1 });

        act(() => { result.current.refetch(); });
        await flush();

        expect(result.current.data).to.deep.equal({ count: 2 });
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        unmount();
        engine.destroy();
    });

    it('cancel() aborts the in-flight request', async () => {

        globalThis.fetch = vi.fn().mockImplementation(
            () => new Promise(() => {})
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/slow')
        );

        expect(result.current.loading).to.be.true;

        act(() => { result.current.cancel(); });
        await flush();

        expect(result.current.loading).to.be.true;

        unmount();
        engine.destroy();
    });

    it('cleans up in-flight request on unmount', async () => {

        globalThis.fetch = vi.fn().mockImplementation(
            () => new Promise(() => {})
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { unmount } = renderHook(() =>
            useQuery(engine, '/hang')
        );

        unmount();
        engine.destroy();
    });
});
