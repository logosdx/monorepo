import { toArray } from './helpers.ts';
import type { OneOrMany } from './types.ts';

interface AnimateOptions extends KeyframeAnimationOptions {
    // standard Web Animations API options
}

/**
 * Animate one or more elements using the Web Animations API.
 * Automatically respects `prefers-reduced-motion`.
 *
 * @example
 *     animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
 *     animate([el1, el2], [{ opacity: 0 }, { opacity: 1 }], 300);
 */
function animate(
    els: OneOrMany<HTMLElement>,
    keyframes: Keyframe[] | PropertyIndexedKeyframes,
    options?: number | AnimateOptions
): Animation[] {

    const prefersReduced = typeof matchMedia !== 'undefined'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const elements = toArray(els);

    if (prefersReduced) {

        return elements.map(() => ({
            finished: Promise.resolve(),
            playState: 'finished',
            cancel: () => {},
            pause: () => {},
            play: () => {},
        } as unknown as Animation));
    }

    return elements.map(el => el.animate(keyframes, options));
}

/**
 * Fade in one or more elements from opacity 0 to 1.
 *
 * @example
 *     animate.fadeIn(el);
 *     animate.fadeIn([el1, el2], 500);
 */
animate.fadeIn = function fadeIn(els: OneOrMany<HTMLElement>, duration = 300): Animation[] {

    return animate(
        els,
        [{ opacity: '0' }, { opacity: '1' }],
        { duration, fill: 'forwards' }
    );
};

/**
 * Fade out one or more elements from opacity 1 to 0.
 *
 * @example
 *     animate.fadeOut(el);
 *     animate.fadeOut([el1, el2], 500);
 */
animate.fadeOut = function fadeOut(els: OneOrMany<HTMLElement>, duration = 300): Animation[] {

    return animate(
        els,
        [{ opacity: '1' }, { opacity: '0' }],
        { duration, fill: 'forwards' }
    );
};

/**
 * Slide one or more elements to a position via CSS transform.
 *
 * @example
 *     animate.slideTo(el, { x: 10, y: -20 }, 300);
 */
animate.slideTo = function slideTo(
    els: OneOrMany<HTMLElement>,
    to: { x?: number; y?: number },
    duration = 300
): Animation[] {

    const x = to.x ?? 0;
    const y = to.y ?? 0;

    return animate(
        els,
        [{ transform: `translate(${x}px, ${y}px)` }],
        { duration, fill: 'forwards' }
    );
};

export { animate };
export type { AnimateOptions };
