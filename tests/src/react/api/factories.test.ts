import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { ObserverEngine } from '../../../../packages/observer/src/index.ts';
import { createQuery } from '../../../../packages/react/src/api/create-query.ts';
import { createMutation } from '../../../../packages/react/src/api/create-mutation.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: createQuery', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('creates a reusable hook that auto-fetches', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ users: ['alice'] })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const useUsers = createQuery<{ users: string[] }>(engine, '/users');

        const { result, unmount } = renderHook(() => useUsers());

        await flush();

        expect(result.current.data).to.deep.equal({ users: ['alice'] });

        unmount();
        engine.destroy();
    });

    it('factory defaults are merged with call-time overrides', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const useItems = createQuery(engine, '/items', {
            defaults: { headers: { 'X-Default': 'yes' } },
        });

        const { result, unmount } = renderHook(() =>
            useItems({ reactive: { params: { page: 1 } } })
        );

        await flush();

        const [url, options] = (globalThis.fetch as any).mock.calls[0];
        expect(url.toString()).to.include('page=1');
        expect(options.headers['X-Default']).to.equal('yes');

        unmount();
        engine.destroy();
    });

    it('factory passes observer for invalidation', async () => {

        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ v: 1 }))
            .mockResolvedValueOnce(jsonResponse({ v: 2 }));

        interface Events { 'users.created': void }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();

        const useUsers = createQuery(engine, '/users', {
            invalidateOn: ['users.created'],
        }, observer);

        const { result, unmount } = renderHook(() => useUsers());

        await flush();
        expect(result.current.data).to.deep.equal({ v: 1 });

        observer.emit('users.created', undefined as any);
        await flush();
        expect(result.current.data).to.deep.equal({ v: 2 });

        unmount();
        engine.destroy();
    });
});

describe('@logosdx/react api: createMutation', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('creates a reusable mutation hook', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const useCreateUser = createMutation<{ id: number }>(engine, 'post', '/users');

        const { result, unmount } = renderHook(() => useCreateUser());

        expect(result.current.called).to.be.false;

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(result.current.data).to.deep.equal({ id: 1 });
        expect(result.current.called).to.be.true;

        unmount();
        engine.destroy();
    });

    it('factory passes observer and emitOnSuccess', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        interface Events { 'users.created': { id: number } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const handler = vi.fn();

        observer.on('users.created', handler);

        const useCreateUser = createMutation<{ id: number }, any, any, Events>(
            engine, 'post', '/users',
            { emitOnSuccess: 'users.created' },
            observer
        );

        const { result, unmount } = renderHook(() => useCreateUser());

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0]![0]).to.deep.equal({ id: 1 });

        unmount();
        engine.destroy();
    });
});
