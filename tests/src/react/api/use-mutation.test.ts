import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';

import { FetchEngine } from '../../../../packages/fetch/src/index.ts';
import { ObserverEngine } from '../../../../packages/observer/src/index.ts';
import { useMutation } from '../../../../packages/react/src/api/use-mutation.ts';
import { renderHook, flush } from '../_helpers.ts';

const jsonResponse = (data: unknown, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { 'content-type': 'application/json' } }
);

const originalFetch = globalThis.fetch;

describe('@logosdx/react api: useMutation', () => {

    afterEach(() => {

        globalThis.fetch = originalFetch;
    });

    it('starts idle — loading false, data null, called false', () => {

        globalThis.fetch = vi.fn();

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'post', '/users')
        );

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(result.current.error).to.be.null;
        expect(result.current.called).to.be.false;
        expect(result.current.mutate).to.be.a('function');
        expect(result.current.reset).to.be.a('function');
        expect(result.current.cancel).to.be.a('function');

        expect(globalThis.fetch).not.toHaveBeenCalled();

        unmount();
        engine.destroy();
    });

    it('mutate() fires request and resolves with data', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1, name: 'Alice' }, 201)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number; name: string }>(engine, 'post', '/users')
        );

        let resolved: any;
        act(() => {
            resolved = result.current.mutate({ name: 'Alice' });
        });

        await flush();

        const returnedData = await resolved;
        expect(returnedData).to.deep.equal({ id: 1, name: 'Alice' });

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.deep.equal({ id: 1, name: 'Alice' });
        expect(result.current.error).to.be.null;
        expect(result.current.called).to.be.true;

        unmount();
        engine.destroy();
    });

    it('sets error state on failure', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ message: 'Validation failed' }, 422)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'post', '/users')
        );

        act(() => { result.current.mutate({ name: '' }); });

        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.data).to.be.null;
        expect(result.current.error).to.not.be.null;
        expect(result.current.error!.status).to.equal(422);
        expect(result.current.called).to.be.true;

        unmount();
        engine.destroy();
    });

    it('reset() clears state back to idle', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'post', '/users')
        );

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(result.current.called).to.be.true;
        expect(result.current.data).to.not.be.null;

        act(() => { result.current.reset(); });

        expect(result.current.data).to.be.null;
        expect(result.current.error).to.be.null;
        expect(result.current.called).to.be.false;
        expect(result.current.loading).to.be.false;

        unmount();
        engine.destroy();
    });

    it('emitOnSuccess emits event on observer after success (string form)', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1, name: 'Alice' }, 201)
        );

        interface Events { 'users.created': { id: number; name: string } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const handler = vi.fn();

        observer.on('users.created', handler);

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number; name: string }, any, any, Events>(
                engine, 'post', '/users',
                { emitOnSuccess: 'users.created' },
                observer
            )
        );

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0]![0]).to.deep.equal({ id: 1, name: 'Alice' });

        unmount();
        engine.destroy();
    });

    it('emitOnSuccess emits event with custom payload transform', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1, name: 'Alice' }, 201)
        );

        interface Events { 'audit.log': { action: string } }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const handler = vi.fn();

        observer.on('audit.log', handler);

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number; name: string }, any, any, Events>(
                engine, 'post', '/users',
                {
                    emitOnSuccess: {
                        event: 'audit.log',
                        payload: () => ({ action: 'create' }),
                    },
                },
                observer
            )
        );

        act(() => { result.current.mutate({ name: 'Alice' }); });
        await flush();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0]![0]).to.deep.equal({ action: 'create' });

        unmount();
        engine.destroy();
    });

    it('emitOnSuccess supports array of events', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1 }, 201)
        );

        interface Events {
            'users.created': { id: number };
            'dashboard.refresh': { id: number };
        }

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });
        const observer = new ObserverEngine<Events>();
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        observer.on('users.created', handler1);
        observer.on('dashboard.refresh', handler2);

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number }, any, any, Events>(
                engine, 'post', '/users',
                { emitOnSuccess: ['users.created', 'dashboard.refresh'] },
                observer
            )
        );

        act(() => { result.current.mutate({}); });
        await flush();

        expect(handler1).toHaveBeenCalledOnce();
        expect(handler2).toHaveBeenCalledOnce();

        unmount();
        engine.destroy();
    });

    it('del method works as mutation', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({}));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'delete', '/users/1')
        );

        act(() => { result.current.mutate(); });
        await flush();

        expect(result.current.loading).to.be.false;
        expect(result.current.error).to.be.null;
        expect(result.current.called).to.be.true;

        unmount();
        engine.destroy();
    });

    it('put method works as mutation', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1, name: 'Updated' })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number; name: string }>(engine, 'put', '/users/1')
        );

        act(() => { result.current.mutate({ name: 'Updated' }); });
        await flush();

        expect(result.current.data).to.deep.equal({ id: 1, name: 'Updated' });

        unmount();
        engine.destroy();
    });

    it('patch method works as mutation', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(
            jsonResponse({ id: 1, name: 'Patched' })
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation<{ id: number; name: string }>(engine, 'patch', '/users/1')
        );

        act(() => { result.current.mutate({ name: 'Patched' }); });
        await flush();

        expect(result.current.data).to.deep.equal({ id: 1, name: 'Patched' });

        unmount();
        engine.destroy();
    });

    it('cancel() aborts the in-flight mutation', async () => {

        globalThis.fetch = vi.fn().mockImplementation(
            () => new Promise(() => {})
        );

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'post', '/users')
        );

        act(() => { result.current.mutate({ name: 'Alice' }); });
        act(() => { result.current.cancel(); });

        await flush();

        unmount();
        engine.destroy();
    });

    it('defaults config is passed to engine', async () => {

        globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

        const engine = new FetchEngine({ baseUrl: 'https://api.test', retry: false });

        const { result, unmount } = renderHook(() =>
            useMutation(engine, 'post', '/with-headers', {
                defaults: { headers: { 'X-Custom': 'value' } },
            })
        );

        act(() => { result.current.mutate({}); });
        await flush();

        const [, options] = (globalThis.fetch as any).mock.calls[0];
        expect(options.headers['X-Custom']).to.equal('value');

        unmount();
        engine.destroy();
    });
});
