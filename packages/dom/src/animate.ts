interface AnimateOptions extends KeyframeAnimationOptions {
    // standard Web Animations API options
}

function animate(
    el: HTMLElement,
    keyframes: Keyframe[] | PropertyIndexedKeyframes,
    options?: number | AnimateOptions
): Animation {

    const prefersReduced = typeof matchMedia !== 'undefined'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {

        const finished = Promise.resolve();
        return {
            finished,
            playState: 'finished',
            cancel: () => {},
            pause: () => {},
            play: () => {},
        } as unknown as Animation;
    }

    return el.animate(keyframes, options);
}

animate.fadeIn = function fadeIn(el: HTMLElement, duration = 300): Animation {

    return animate(
        el,
        [{ opacity: '0' }, { opacity: '1' }],
        { duration, fill: 'forwards' }
    );
};

animate.fadeOut = function fadeOut(el: HTMLElement, duration = 300): Animation {

    return animate(
        el,
        [{ opacity: '1' }, { opacity: '0' }],
        { duration, fill: 'forwards' }
    );
};

animate.slideTo = function slideTo(
    el: HTMLElement,
    to: { x?: number; y?: number },
    duration = 300
): Animation {

    const x = to.x ?? 0;
    const y = to.y ?? 0;

    return animate(
        el,
        [{ transform: `translate(${x}px, ${y}px)` }],
        { duration, fill: 'forwards' }
    );
};

export { animate };
export type { AnimateOptions };
