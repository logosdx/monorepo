import { afterEach, beforeEach, vi, type Mock } from 'vitest';

interface Watcher {
    callback: IntersectionObserverCallback;
    observer: IntersectionObserver;
}

/**
 * jsdom has neither `IntersectionObserver` nor `scrollIntoView`, so tests report the panel
 * under the deck's center by hand. Registers its own hooks; the root must be `#deck`.
 */
export function stubDeckLayout() {

    const watchers = new Map<Element, Watcher>();
    const scrollIntoView: Mock<
        (this: Element, arg?: boolean | ScrollIntoViewOptions) => void
    > = vi.fn();

    const byId = (id: string) => {

        const el = document.getElementById(id);

        if (!el) throw new Error(`#${id} not in fixture`);

        return el;
    };

    const root = () => byId('deck');
    const shownIds = () => scrollIntoView.mock.contexts.map((el) => el.id);
    const activeIds = () => Array.from(root().querySelectorAll('[active]')).map((el) => el.id);

    const intersect = (slide: string | Element, isIntersecting: boolean) => {

        const target = typeof slide === 'string' ? byId(slide) : slide;
        const watcher = watchers.get(target);
        const entry: IntersectionObserverEntry = {
            target,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: new DOMRect(),
            intersectionRect: new DOMRect(),
            rootBounds: null,
            time: 0
        };

        if (!watcher) throw new Error(`#${target.id} is not watched`);

        watcher.callback([entry], watcher.observer);
    };

    const arrive = (to: string, from: string) => {

        intersect(to, true);
        intersect(from, false);
    };

    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

    const pressKey = (key: string, target: EventTarget = document.body, shiftKey = false) => {

        target.dispatchEvent(new KeyboardEvent('keydown', {
            key,
            shiftKey,
            bubbles: true,
            cancelable: true
        }));
    };

    const clearHash = () => history.replaceState(null, '', location.pathname);

    beforeEach(() => {

        watchers.clear();
        scrollIntoView.mockClear();
        Element.prototype.scrollIntoView = scrollIntoView;
        clearHash();

        vi.stubGlobal('IntersectionObserver', vi.fn(function (
            this: IntersectionObserver,
            callback: IntersectionObserverCallback
        ) {

            const observer = this;

            Object.assign(this, {
                observe: (el: Element) => watchers.set(el, { callback, observer }),
                disconnect: () => {

                    for (const [el, watcher] of watchers) {

                        if (watcher.callback === callback) watchers.delete(el);
                    }
                }
            });
        }));
    });

    afterEach(() => {

        document.body.innerHTML = '';
        clearHash();
        vi.unstubAllGlobals();
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    });

    return {
        watchers,
        scrollIntoView,
        byId,
        root,
        shownIds,
        activeIds,
        intersect,
        arrive,
        tick,
        pressKey
    };
}
