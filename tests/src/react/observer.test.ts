import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';

import { ObserverEngine } from '../../../packages/observer/src/index.ts';
import { createObserverContext } from '../../../packages/react/src/index.ts';
import { renderHook } from './_helpers.ts';


interface TestEvents {
    'user.login': { userId: string };
    'user.logout': { userId: string };
    'notification': { message: string };
}

describe('@logosdx/react: observer', () => {

    it('createObserverContext returns [Provider, useHook] tuple', () => {

        const engine = new ObserverEngine<TestEvents>();
        const result = createObserverContext(engine as any);

        expect(result).to.be.an('array').with.lengthOf(2);
        expect(result[0]).to.be.a('function');
        expect(result[1]).to.be.a('function');
    });

    it('useHook returns the expected API shape', () => {

        const engine = new ObserverEngine<TestEvents>();
        const [, useObserver] = createObserverContext(engine as any);

        const { result } = renderHook(() => useObserver());

        expect(result.current.on).to.be.a('function');
        expect(result.current.once).to.be.a('function');
        expect(result.current.oncePromise).to.be.a('function');
        expect(result.current.emitFactory).to.be.a('function');
        expect(result.current.emit).to.be.a('function');
        expect(result.current.instance).to.equal(engine);
    });

    it('on() subscribes to events and receives data', () => {

        const engine = new ObserverEngine<TestEvents>();
        const [, useObserver] = createObserverContext(engine as any);
        const handler = vi.fn();

        renderHook(() => {

            const { on } = useObserver();
            on('user.login', handler);
        });

        act(() => { engine.emit('user.login', { userId: '123' }); });

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0]![0]).to.deep.equal({ userId: '123' });
    });

    it('on() cleans up subscription on unmount', () => {

        const engine = new ObserverEngine<TestEvents>();
        const [, useObserver] = createObserverContext(engine as any);
        const handler = vi.fn();

        const { unmount } = renderHook(() => {

            const { on } = useObserver();
            on('user.login', handler);
        });

        unmount();
        engine.emit('user.login', { userId: '456' });

        expect(handler).not.toHaveBeenCalled();
    });

    it('on() re-subscribes when callback identity changes', () => {

        const engine = new ObserverEngine<TestEvents>();
        const [, useObserver] = createObserverContext(engine as any);
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        let active = handler1;

        const { rerender } = renderHook(() => {

            const { on } = useObserver();
            on('notification', active);
        });

        act(() => { engine.emit('notification', { message: 'first' }); });

        expect(handler1).toHaveBeenCalledOnce();
        expect(handler2).not.toHaveBeenCalled();

        active = handler2;
        rerender();

        act(() => { engine.emit('notification', { message: 'second' }); });

        expect(handler1).toHaveBeenCalledOnce();
        expect(handler2).toHaveBeenCalledOnce();
        expect(handler2.mock.calls[0]![0]).to.deep.equal({ message: 'second' });
    });

    it('once() fires callback only once', () => {

        const engine = new ObserverEngine<TestEvents>();
        const [, useObserver] = createObserverContext(engine as any);
        const handler = vi.fn();

        renderHook(() => {

            const { once } = useObserver();
            once('notification', handler);
        });

        act(() => { engine.emit('notification', { message: 'first' }); });
        act(() => { engine.emit('notification', { message: 'second' }); });

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0]![0]).to.deep.equal({ message: 'first' });
    });

    it('oncePromise() starts waiting and resolves with data', async () => {

        const engine = new ObserverEngine<TestEvents>();
        const [, useObserver] = createObserverContext(engine as any);

        const { result } = renderHook(() => {

            const { oncePromise } = useObserver();
            return oncePromise('notification');
        });

        expect(result.current[0]).to.be.true;
        expect(result.current[1]).to.be.null;

        await act(async () => {

            engine.emit('notification', { message: 'hello' });
        });

        expect(result.current[0]).to.be.false;
        expect(result.current[1]).to.deep.equal({ message: 'hello' });
    });

    it('oncePromise() cleans up on unmount', async () => {

        const engine = new ObserverEngine<TestEvents>();
        const [, useObserver] = createObserverContext(engine as any);

        const { result, unmount } = renderHook(() => {

            const { oncePromise } = useObserver();
            return oncePromise('notification');
        });

        expect(result.current[0]).to.be.true;

        unmount();

        // Emitting after unmount should not throw or update state
        engine.emit('notification', { message: 'too late' });

        expect(result.current[0]).to.be.true;
        expect(result.current[1]).to.be.null;
    });

    it('emitFactory() returns a stable emitter function', () => {

        const engine = new ObserverEngine<TestEvents>();
        const [, useObserver] = createObserverContext(engine as any);
        const handler = vi.fn();

        engine.on('user.logout', handler);

        const { result } = renderHook(() => {

            const { emitFactory } = useObserver();
            return emitFactory('user.logout');
        });

        act(() => { result.current({ userId: '789' }); });

        expect(handler.mock.calls[0]![0]).to.deep.equal({ userId: '789' });
    });

    it('emit() fires events directly', () => {

        const engine = new ObserverEngine<TestEvents>();
        const [, useObserver] = createObserverContext(engine as any);
        const handler = vi.fn();

        engine.on('notification', handler);

        const { result } = renderHook(() => useObserver());

        act(() => { result.current.emit('notification', { message: 'direct' }); });

        expect(handler.mock.calls[0]![0]).to.deep.equal({ message: 'direct' });
    });

    it('instance gives raw engine access', () => {

        const engine = new ObserverEngine<TestEvents>();
        const [, useObserver] = createObserverContext(engine as any);

        const { result } = renderHook(() => useObserver());

        expect(result.current.instance).to.equal(engine);
    });

    it('Provider wraps children with context', () => {

        const engine = new ObserverEngine<TestEvents>();
        const [Provider, useObserver] = createObserverContext(engine as any);

        const { result } = renderHook(
            () => useObserver(),
            Provider
        );

        expect(result.current.instance).to.equal(engine);
    });
});
