import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { on, once, off, emit } from '../../../packages/dom/src/events.ts';

describe('@logosdx/dom: events', () => {

    let el: HTMLDivElement;
    let el2: HTMLDivElement;
    let parent: HTMLDivElement;
    let child: HTMLSpanElement;

    beforeEach(() => {

        el = document.createElement('div');
        el2 = document.createElement('div');
        parent = document.createElement('div');
        child = document.createElement('span');
        child.classList.add('child');
        parent.appendChild(child);
        document.body.appendChild(el);
        document.body.appendChild(el2);
        document.body.appendChild(parent);
    });

    afterEach(() => {

        el.remove();
        el2.remove();
        parent.remove();
    });

    describe('on', () => {

        it('should add a click handler that fires on click', () => {

            const handler = vi.fn();
            on(el, 'click', handler);
            el.click();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should add a handler to multiple elements', () => {

            const handler = vi.fn();
            on([el, el2], 'click', handler);
            el.click();
            el2.click();
            expect(handler).toHaveBeenCalledTimes(2);
        });

        it('should add a handler for multiple events', () => {

            const handler = vi.fn();
            on(el, ['mouseenter', 'mouseleave'], handler);
            el.dispatchEvent(new Event('mouseenter'));
            el.dispatchEvent(new Event('mouseleave'));
            expect(handler).toHaveBeenCalledTimes(2);
        });

        it('should pass capture option to addEventListener', () => {

            const handler = vi.fn();
            const spy = vi.spyOn(el, 'addEventListener');
            on(el, 'click', handler, { capture: true });
            expect(spy).toHaveBeenCalledWith(
                'click',
                expect.any(Function),
                expect.objectContaining({ capture: true })
            );
        });

        it('should remove listener when AbortController signal aborts', () => {

            const controller = new AbortController();
            const handler = vi.fn();
            on(el, 'click', handler, { signal: controller.signal });
            el.click();
            expect(handler).toHaveBeenCalledTimes(1);

            controller.abort();
            el.click();
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('once', () => {

        it('should fire exactly once', () => {

            const handler = vi.fn();
            once(el, 'click', handler);
            el.click();
            el.click();
            el.click();
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('off', () => {

        it('should remove a previously added listener', () => {

            const handler = vi.fn();
            on(el, 'click', handler);
            el.click();
            expect(handler).toHaveBeenCalledTimes(1);

            off(el, 'click', handler);
            el.click();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should remove listener from multiple elements', () => {

            const handler = vi.fn();
            on([el, el2], 'click', handler);
            el.click();
            el2.click();
            expect(handler).toHaveBeenCalledTimes(2);

            off([el, el2], 'click', handler);
            el.click();
            el2.click();
            expect(handler).toHaveBeenCalledTimes(2);
        });
    });

    describe('emit', () => {

        it('should dispatch a CustomEvent with detail', () => {

            const handler = vi.fn();
            el.addEventListener('widget:open', handler);
            emit(el, 'widget:open', { chatId: 123 });

            expect(handler).toHaveBeenCalledTimes(1);
            const event = handler.mock.calls[0][0] as CustomEvent;
            expect(event.detail).toEqual({ chatId: 123 });
            expect(event.bubbles).toBe(true);
        });

        it('should dispatch on multiple elements', () => {

            const handler1 = vi.fn();
            const handler2 = vi.fn();
            el.addEventListener('ping', handler1);
            el2.addEventListener('ping', handler2);
            emit([el, el2], 'ping');

            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });
    });

    describe('delegation', () => {

        it('should fire handler only when delegate selector matches', () => {

            const handler = vi.fn();
            on(parent, 'click', handler, { delegate: '.child' });

            child.click();
            expect(handler).toHaveBeenCalledTimes(1);

            parent.click();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should pass the matched delegated element to the handler', () => {

            const handler = vi.fn();
            on(parent, 'click', handler, { delegate: '.child' });

            child.click();
            const event = handler.mock.calls[0][0] as Event;
            expect(event.target).toBe(child);
        });
    });
});
