import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { observe } from '../../../packages/dom/src/observe.ts';

const tick = () => new Promise(r => setTimeout(r, 0));

describe('@logosdx/dom: observe', () => {

    let root: HTMLDivElement;

    beforeEach(() => {

        root = document.createElement('div');
        document.body.appendChild(root);
    });

    afterEach(() => {

        root.remove();
    });

    it('should run handler on existing matching elements', () => {

        const el1 = document.createElement('div');
        el1.setAttribute('data-tooltip', 'hi');
        const el2 = document.createElement('div');
        el2.setAttribute('data-tooltip', 'bye');
        root.appendChild(el1);
        root.appendChild(el2);

        const handler = vi.fn();
        const stop = observe('[data-tooltip]', handler, { root });

        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledWith(el1);
        expect(handler).toHaveBeenCalledWith(el2);

        stop();
    });

    it('should run handler on dynamically added matching elements', async () => {

        const handler = vi.fn();
        const stop = observe('[data-tooltip]', handler, { root });

        const el = document.createElement('div');
        el.setAttribute('data-tooltip', 'dynamic');
        root.appendChild(el);

        await tick();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(el);

        stop();
    });

    it('should handle dynamically added nested matching elements', async () => {

        const handler = vi.fn();
        const stop = observe('[data-tooltip]', handler, { root });

        const wrapper = document.createElement('div');
        const nested = document.createElement('span');
        nested.setAttribute('data-tooltip', 'nested');
        wrapper.appendChild(nested);
        root.appendChild(wrapper);

        await tick();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(nested);

        stop();
    });

    it('should NOT run handler on non-matching elements', async () => {

        const handler = vi.fn();
        const stop = observe('[data-tooltip]', handler, { root });

        const el = document.createElement('div');
        el.setAttribute('data-other', 'nope');
        root.appendChild(el);

        await tick();

        expect(handler).toHaveBeenCalledTimes(0);

        stop();
    });

    it('should call cleanup functions on stop()', () => {

        const cleanup1 = vi.fn();
        const cleanup2 = vi.fn();
        const el1 = document.createElement('div');
        el1.setAttribute('data-tooltip', '1');
        const el2 = document.createElement('div');
        el2.setAttribute('data-tooltip', '2');
        root.appendChild(el1);
        root.appendChild(el2);

        let callCount = 0;
        const stop = observe('[data-tooltip]', () => {

            callCount++;
            return callCount === 1 ? cleanup1 : cleanup2;
        }, { root });

        expect(cleanup1).not.toHaveBeenCalled();
        expect(cleanup2).not.toHaveBeenCalled();

        stop();

        expect(cleanup1).toHaveBeenCalledTimes(1);
        expect(cleanup2).toHaveBeenCalledTimes(1);
    });

    it('should not double-process the same element', async () => {

        const el = document.createElement('div');
        el.setAttribute('data-tooltip', 'once');
        root.appendChild(el);

        const handler = vi.fn();
        const stop = observe('[data-tooltip]', handler, { root });

        expect(handler).toHaveBeenCalledTimes(1);

        // Remove and re-add the same element
        root.removeChild(el);
        root.appendChild(el);

        await tick();

        expect(handler).toHaveBeenCalledTimes(1);

        stop();
    });

    it('should scope observation to root element', async () => {

        const outside = document.createElement('div');
        outside.setAttribute('data-tooltip', 'outside');
        document.body.appendChild(outside);

        const handler = vi.fn();
        const stop = observe('[data-tooltip]', handler, { root });

        await tick();

        expect(handler).toHaveBeenCalledTimes(0);

        outside.remove();
        stop();
    });

    it('should stop when signal is aborted', async () => {

        const controller = new AbortController();
        const cleanup = vi.fn();

        const el = document.createElement('div');
        el.setAttribute('data-tooltip', 'sig');
        root.appendChild(el);

        const stop = observe('[data-tooltip]', () => cleanup, {
            root,
            signal: controller.signal,
        });

        controller.abort();

        expect(cleanup).toHaveBeenCalledTimes(1);

        // Should not process new elements after abort
        const el2 = document.createElement('div');
        el2.setAttribute('data-tooltip', 'after');
        root.appendChild(el2);

        await tick();

        // handler ran once for el, not for el2
        stop();
    });

    it('should disconnect observer on stop()', async () => {

        const handler = vi.fn();
        const stop = observe('[data-tooltip]', handler, { root });

        stop();

        const el = document.createElement('div');
        el.setAttribute('data-tooltip', 'late');
        root.appendChild(el);

        await tick();

        expect(handler).toHaveBeenCalledTimes(0);
    });

    it('should default root to document.body', async () => {

        const el = document.createElement('div');
        el.setAttribute('data-tooltip', 'body');
        document.body.appendChild(el);

        const handler = vi.fn();
        const stop = observe('[data-tooltip]', handler);

        expect(handler).toHaveBeenCalledWith(el);

        el.remove();
        stop();
    });
});
