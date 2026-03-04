import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { useAsync } from '../../../../packages/react/src/api/use-async.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: useAsync', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('auto-executes on mount and returns data', async () => {

        const fn = vi.fn().mockResolvedValue({ users: ['alice'] });

        const { result, unmount } = renderHook(() =>
            useAsync<{ users: string[] }>(fn, [])
        );

        expect(result.current.loading).to.be.true;

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.deep.equal({ users: ['alice'] });
        expect(result.current.error).to.be.null;

        unmount();
    });

    it('re-executes when deps change', async () => {

        const fn = vi.fn()
            .mockResolvedValueOnce({ page: 1 })
            .mockResolvedValueOnce({ page: 2 });

        let page = 1;

        const { result, rerender, unmount } = renderHook(() =>
            useAsync(fn, [page])
        );

        await flush();
        expect(result.current.data).to.deep.equal({ page: 1 });

        page = 2;
        rerender();
        await flush();

        expect(result.current.data).to.deep.equal({ page: 2 });
        expect(fn).toHaveBeenCalledTimes(2);

        unmount();
    });

    it('does not execute when skip is true', async () => {

        const fn = vi.fn().mockResolvedValue({ ok: true });

        const { result, unmount } = renderHook(() =>
            useAsync(fn, [], { skip: true })
        );

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(fn).not.toHaveBeenCalled();

        unmount();
    });

    it('sets error state on rejection', async () => {

        const err = new Error('boom');
        const fn = vi.fn().mockRejectedValue(err);

        const { result, unmount } = renderHook(() =>
            useAsync(fn, [])
        );

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(result.current.error).to.equal(err);

        unmount();
    });

    it('unwraps FetchResponse when fn returns one', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ name: 'Alice' })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useAsync<{ name: string }>(
                () => engine.get<{ name: string }>('/user'),
                [],
            )
        );

        await flush();

        expect(result.current.data).to.deep.equal({ name: 'Alice' });

        unmount();
        engine.destroy();
    });

    it('refetch() re-executes the function', async () => {

        const fn = vi.fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 2 });

        const { result, unmount } = renderHook(() =>
            useAsync(fn, [])
        );

        await flush();
        expect(result.current.data).to.deep.equal({ count: 1 });

        act(() => { result.current.refetch(); });
        await flush();

        expect(result.current.data).to.deep.equal({ count: 2 });
        expect(fn).toHaveBeenCalledTimes(2);

        unmount();
    });
});
