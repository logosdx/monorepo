import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { watchVisibility, watchResize } from '../../../packages/dom/src/watch.ts';

describe('@logosdx/dom: watch', () => {

    let el: HTMLDivElement;

    beforeEach(() => {

        el = document.createElement('div');
        document.body.appendChild(el);
    });

    afterEach(() => {

        el.remove();
        vi.restoreAllMocks();
    });

    describe('watchVisibility', () => {

        let mockObserve: ReturnType<typeof vi.fn>;
        let mockDisconnect: ReturnType<typeof vi.fn>;
        let capturedCallback: Function;

        beforeEach(() => {

            mockObserve = vi.fn();
            mockDisconnect = vi.fn();

            vi.stubGlobal('IntersectionObserver', vi.fn(function (this: any, cb: Function) {

                capturedCallback = cb;
                this.observe = mockObserve;
                this.disconnect = mockDisconnect;
            }));
        });

        it('creates observer and observes the element', () => {

            watchVisibility(el, vi.fn());

            expect(mockObserve).toHaveBeenCalledWith(el);
        });

        it('forwards entries to the callback', () => {

            const cb = vi.fn();
            watchVisibility(el, cb);

            const entry = { isIntersecting: true } as IntersectionObserverEntry;
            capturedCallback([entry]);

            expect(cb).toHaveBeenCalledWith(entry);
        });

        it('passes observer options through', () => {

            watchVisibility(el, vi.fn(), {
                threshold: 0.5,
                rootMargin: '10px',
            });

            expect(IntersectionObserver).toHaveBeenCalledWith(
                expect.any(Function),
                { threshold: 0.5, rootMargin: '10px' },
            );
        });

        it('disconnects after isIntersecting when once is true', () => {

            watchVisibility(el, vi.fn(), { once: true });

            const entry = { isIntersecting: true } as IntersectionObserverEntry;
            capturedCallback([entry]);

            expect(mockDisconnect).toHaveBeenCalled();
        });

        it('does not disconnect for non-intersecting entry when once is true', () => {

            watchVisibility(el, vi.fn(), { once: true });

            const entry = { isIntersecting: false } as IntersectionObserverEntry;
            capturedCallback([entry]);

            expect(mockDisconnect).not.toHaveBeenCalled();
        });

        it('stop() disconnects the observer', () => {

            const stop = watchVisibility(el, vi.fn());
            stop();

            expect(mockDisconnect).toHaveBeenCalled();
        });

        it('signal abort disconnects the observer', () => {

            const controller = new AbortController();
            watchVisibility(el, vi.fn(), { signal: controller.signal });

            controller.abort();

            expect(mockDisconnect).toHaveBeenCalled();
        });
    });

    describe('watchResize', () => {

        let mockObserve: ReturnType<typeof vi.fn>;
        let mockDisconnect: ReturnType<typeof vi.fn>;
        let capturedCallback: Function;

        beforeEach(() => {

            mockObserve = vi.fn();
            mockDisconnect = vi.fn();

            vi.stubGlobal('ResizeObserver', vi.fn(function (this: any, cb: Function) {

                capturedCallback = cb;
                this.observe = mockObserve;
                this.disconnect = mockDisconnect;
            }));
        });

        it('creates observer and observes the element', () => {

            watchResize(el, vi.fn());

            expect(mockObserve).toHaveBeenCalledWith(el, undefined);
        });

        it('passes box option to observe', () => {

            watchResize(el, vi.fn(), { box: 'border-box' });

            expect(mockObserve).toHaveBeenCalledWith(el, { box: 'border-box' });
        });

        it('forwards entries to the callback', () => {

            const cb = vi.fn();
            watchResize(el, cb);

            const entry = { contentRect: { width: 100 } } as unknown as ResizeObserverEntry;
            capturedCallback([entry]);

            expect(cb).toHaveBeenCalledWith(entry);
        });

        it('stop() disconnects the observer', () => {

            const stop = watchResize(el, vi.fn());
            stop();

            expect(mockDisconnect).toHaveBeenCalled();
        });

        it('signal abort disconnects the observer', () => {

            const controller = new AbortController();
            watchResize(el, vi.fn(), { signal: controller.signal });

            controller.abort();

            expect(mockDisconnect).toHaveBeenCalled();
        });
    });
});
