import type { Cleanup, SignalOptions } from './types.ts';

interface ObserveOptions extends SignalOptions {
    root?: Element;
}

/**
 * Auto-bind behaviors to elements matching a CSS selector, both existing
 * and dynamically added in the future via MutationObserver.
 *
 * Returns a cleanup function that disconnects the observer and runs all
 * per-element cleanups returned by the handler.
 *
 * @example
 *
 *     const stop = observe('[data-tooltip]', (el) => {
 *         const tip = new Tooltip(el);
 *         return () => tip.destroy();
 *     });
 *
 *     stop(); // disconnects observer + destroys all tooltips
 */
export function observe(
    selector: string,
    handler: (el: Element) => Cleanup | void,
    opts?: ObserveOptions
): Cleanup {

    const root = opts?.root ?? document.body;
    const handled = new WeakSet<Element>();
    const cleanups: Cleanup[] = [];

    function processElement(el: Element): void {

        if (handled.has(el)) return;
        handled.add(el);

        const cleanup = handler(el);
        if (cleanup) cleanups.push(cleanup);
    }

    for (const el of Array.from(root.querySelectorAll(selector))) {

        processElement(el);
    }

    const observer = new MutationObserver((mutations) => {

        for (const mutation of mutations) {

            for (const node of Array.from(mutation.addedNodes)) {

                if (!(node instanceof Element)) continue;

                if (node.matches(selector)) {

                    processElement(node);
                }

                for (const el of Array.from(node.querySelectorAll(selector))) {

                    processElement(el);
                }
            }
        }
    });

    observer.observe(root, { childList: true, subtree: true });

    function stop(): void {

        observer.disconnect();
        for (const cleanup of cleanups) cleanup();
        cleanups.length = 0;
    }

    if (opts?.signal) {

        opts.signal.addEventListener('abort', stop, { once: true });
    }

    return stop;
}
