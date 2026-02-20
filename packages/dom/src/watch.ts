import type { Cleanup, SignalOptions } from './types.ts';

interface VisibilityOptions extends SignalOptions {
    threshold?: number | number[];
    root?: Element | null;
    rootMargin?: string;
    once?: boolean;
}

interface ResizeOptions extends SignalOptions {
    box?: ResizeObserverBoxOptions;
}

/**
 * Observes an element's visibility via IntersectionObserver.
 *
 * Returns a cleanup function that disconnects the observer.
 *
 * @example
 *
 *     const stop = watchVisibility(img, (entry) => {
 *
 *         if (entry.isIntersecting) loadImage(img);
 *     }, { threshold: 0.5, once: true });
 */
export function watchVisibility(
    el: Element,
    cb: (entry: IntersectionObserverEntry) => void,
    opts?: VisibilityOptions
): Cleanup {

    const { signal, once, ...observerOpts } = opts ?? {};

    const observer = new IntersectionObserver((entries) => {

        for (const entry of entries) {

            cb(entry);

            if (once && entry.isIntersecting) {

                observer.disconnect();
                return;
            }
        }
    }, observerOpts);

    observer.observe(el);

    function stop(): void {

        observer.disconnect();
    }

    if (signal) {

        signal.addEventListener('abort', stop, { once: true });
    }

    return stop;
}

/**
 * Observes an element's size via ResizeObserver.
 *
 * Returns a cleanup function that disconnects the observer.
 *
 * @example
 *
 *     const stop = watchResize(panel, (entry) => {
 *
 *         const { width } = entry.contentRect;
 *         if (width < 400) compact(panel);
 *     });
 */
export function watchResize(
    el: Element,
    cb: (entry: ResizeObserverEntry) => void,
    opts?: ResizeOptions
): Cleanup {

    const observer = new ResizeObserver((entries) => {

        for (const entry of entries) {

            cb(entry);
        }
    });

    observer.observe(el, opts?.box ? { box: opts.box } : undefined);

    function stop(): void {

        observer.disconnect();
    }

    if (opts?.signal) {

        opts.signal.addEventListener('abort', stop, { once: true });
    }

    return stop;
}
