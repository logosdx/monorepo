import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { ObserverEngine } from '../../../../packages/observer/src/index.ts';
import { createApiHooks } from '../../../../packages/react/src/api/create-api-hooks.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: createApiHooks', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('returns all hook functions', () => {

        const engine = new FetchEngine({ baseUrl: 'https://api.test' });
        const hooks = createApiHooks(engine);

        expect(hooks.useQuery).to.be.a('function');
        expect(hooks.useMutation).to.be.a('function');
        expect(hooks.useAsync).to.be.a('function');
        expect(hooks.createQuery).to.be.a('function');
        expect(hooks.createMutation).to.be.a('function');

        engine.destroy();
    });

    it('useQuery is pre-bound to engine', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ users: ['alice'] })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const { useQuery } = createApiHooks(engine);

        const { result, unmount } = renderHook(() =>
            useQuery<{ users: string[] }>('/users')
        );

        await flush();
        expect(result.current.data).to.deep.equal({ users: ['alice'] });

        unmount();
        engine.destroy();
    });

    it('useMutation is pre-bound to engine', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const { useMutation } = createApiHooks(engine);

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number }>('post', '/users')
        );

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(result.current.data).to.deep.equal({ id: 1 });

        unmount();
        engine.destroy();
    });

    it('useAsync is available from binding', async () => {

        const fn = vi.fn().mockResolvedValue({ ok: true });

        const engine = new FetchEngine({ baseUrl: 'https://api.test' });
        const { useAsync } = createApiHooks(engine);

        const { result, unmount } = renderHook(() =>
            useAsync(fn, [])
        );

        await flush();
        expect(result.current.data).to.deep.equal({ ok: true });

        unmount();
        engine.destroy();
    });

    it('createQuery is pre-bound to engine and observer', async () => {

        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ v: 1 }))
            .mockResolvedValueOnce(jsonResponse({ v: 2 }));

        interface Events { 'users.created': void }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const { createQuery } = createApiHooks(engine, observer);

        const useUsers = createQuery<{ v: number }>('/users', {
            invalidateOn: ['users.created'],
        });

        const { result, unmount } = renderHook(() => useUsers());

        await flush();
        expect(result.current.data).to.deep.equal({ v: 1 });

        observer.emit('users.created', undefined as any);
        await flush();
        expect(result.current.data).to.deep.equal({ v: 2 });

        unmount();
        engine.destroy();
    });

    it('createMutation is pre-bound with emitOnSuccess through observer', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        interface Events { 'users.created': { id: number } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const handler = vi.fn();

        observer.on('users.created', handler);

        const { createMutation } = createApiHooks(engine, observer);

        const useCreateUser = createMutation<{ id: number }>('post', '/users', {
            emitOnSuccess: 'users.created',
        });

        const { result, unmount } = renderHook(() => useCreateUser());

        act(() => { result.current.mutate({}); });
        await flush();

        expect(handler).toHaveBeenCalledOnce();

        unmount();
        engine.destroy();
    });

    it('full integration: mutation emits, query invalidates', async () => {

        let callCount = 0;
        globalThis.fetch = vi.fn().mockImplementation((url: URL, opts: RequestInit) => {

            if (opts.method === 'GET') {
                return Promise.resolve(jsonResponse({ count: ++callCount }));
            }
            return Promise.resolve(jsonResponse({ id: 1 }, 201));
        });

        interface Events { 'users.created': { id: number } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();

        const { useQuery, useMutation } = createApiHooks(engine, observer);

        const { result, unmount } = renderHook(() => ({
            query: useQuery<{ count: number }>('/users', {
                invalidateOn: ['users.created'],
            }),
            mutation: useMutation<{ id: number }>('post', '/users', {
                emitOnSuccess: 'users.created',
            }),
        }));

        await flush();
        expect(result.current.query.data).to.deep.equal({ count: 1 });

        act(() => { result.current.mutation.mutate({ name: 'Alice' }); });
        await flush();
        await flush();

        expect(result.current.query.data).to.deep.equal({ count: 2 });

        unmount();
        engine.destroy();
    });
});
