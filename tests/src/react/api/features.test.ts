import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { ObserverEngine } from '../../../../packages/observer/src/index.ts';
import { useQuery } from '../../../../packages/react/src/api/use-query.ts';
import { useAsync } from '../../../../packages/react/src/api/use-async.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

/**
 * Flushes pending microtasks under fake timers by advancing time by 0ms.
 */
const fakeFlush = async () => {

    await act(async () => {

        await vi.advanceTimersByTimeAsync(0);
    });
};

describe('@logosdx/react api: polling', () => {

    beforeEach(() => { vi.useFakeTimers(); });

    afterEach(() => {

        vi.useRealTimers();
        globalThis.fetch = originalFetch;
    });

    it('useQuery polls at the specified interval', async () => {

        let callCount = 0;

        globalThis.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve(jsonResponse({ count: ++callCount }))
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/metrics', { pollInterval: 5000 })
        );

        await fakeFlush();
        expect(result.current.data).to.deep.equal({ count: 1 });

        await vi.advanceTimersByTimeAsync(5000);
        await fakeFlush();
        expect(result.current.data).to.deep.equal({ count: 2 });

        await vi.advanceTimersByTimeAsync(5000);
        await fakeFlush();
        expect(result.current.data).to.deep.equal({ count: 3 });

        unmount();
        engine.destroy();
    });

    it('useQuery stops polling on unmount', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { unmount } = renderHook(() =>
            useQuery(engine, '/metrics', { pollInterval: 1000 })
        );

        await fakeFlush();
        unmount();

        const callsBefore = (globalThis.fetch as any).mock.calls.length;
        await vi.advanceTimersByTimeAsync(5000);
        const callsAfter = (globalThis.fetch as any).mock.calls.length;

        expect(callsAfter).to.equal(callsBefore);

        engine.destroy();
    });
});

describe('@logosdx/react api: observer invalidation', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('useQuery refetches when invalidateOn event fires', async () => {

        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ version: 1 }))
            .mockResolvedValueOnce(jsonResponse({ version: 2 }));

        interface Events { 'users.created': { id: number } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();

        const { result, unmount } = renderHook(() =>
            useQuery(engine, '/users', {
                invalidateOn: ['users.created'],
            }, observer)
        );

        await flush();
        expect(result.current.data).to.deep.equal({ version: 1 });

        observer.emit('users.created', { id: 1 });
        await flush();

        expect(result.current.data).to.deep.equal({ version: 2 });
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        unmount();
        engine.destroy();
    });

    it('useAsync refetches when invalidateOn event fires', async () => {

        const fn = vi.fn()
            .mockResolvedValueOnce({ version: 1 })
            .mockResolvedValueOnce({ version: 2 });

        interface Events { 'data.updated': void }

        const observer = new ObserverEngine<Events>();

        const { result, unmount } = renderHook(() =>
            useAsync(fn, [], {
                invalidateOn: ['data.updated'],
            }, observer)
        );

        await flush();
        expect(result.current.data).to.deep.equal({ version: 1 });

        observer.emit('data.updated', undefined as any);
        await flush();

        expect(result.current.data).to.deep.equal({ version: 2 });
        expect(fn).toHaveBeenCalledTimes(2);

        unmount();
    });

    it('cleans up observer subscriptions on unmount', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        interface Events { 'users.created': void }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();

        const { unmount } = renderHook(() =>
            useQuery(engine, '/users', {
                invalidateOn: ['users.created'],
            }, observer)
        );

        await flush();
        unmount();

        const callsBefore = (globalThis.fetch as any).mock.calls.length;
        observer.emit('users.created', undefined as any);
        await flush();
        const callsAfter = (globalThis.fetch as any).mock.calls.length;

        expect(callsAfter).to.equal(callsBefore);

        engine.destroy();
    });
});
