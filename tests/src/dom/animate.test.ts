import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { animate } from '../../../packages/dom/src/animate.ts';

describe('@logosdx/dom: animate', () => {

    let el: HTMLDivElement;
    let mockAnimation: any;

    beforeEach(() => {

        el = document.createElement('div');
        document.body.appendChild(el);

        mockAnimation = {
            finished: Promise.resolve(),
            playState: 'running',
            cancel: vi.fn(),
            pause: vi.fn(),
            play: vi.fn(),
        };

        el.animate = vi.fn().mockReturnValue(mockAnimation);
    });

    afterEach(() => {

        el.remove();
        vi.restoreAllMocks();
    });

    it('calls el.animate with keyframes and options', () => {

        const keyframes = [{ opacity: '0' }, { opacity: '1' }];
        const options = { duration: 500, fill: 'forwards' as FillMode };

        const result = animate(el, keyframes, options);

        expect(el.animate).toHaveBeenCalledWith(keyframes, options);
        expect(result).toBe(mockAnimation);
    });

    it('accepts a number shorthand for options (duration)', () => {

        const keyframes = [{ opacity: '0' }, { opacity: '1' }];

        animate(el, keyframes, 200);

        expect(el.animate).toHaveBeenCalledWith(keyframes, 200);
    });

    it('animate.fadeIn(el) uses opacity 0→1 with default 300ms', () => {

        animate.fadeIn(el);

        expect(el.animate).toHaveBeenCalledWith(
            [{ opacity: '0' }, { opacity: '1' }],
            { duration: 300, fill: 'forwards' }
        );
    });

    it('animate.fadeIn(el, 500) uses custom duration', () => {

        animate.fadeIn(el, 500);

        expect(el.animate).toHaveBeenCalledWith(
            [{ opacity: '0' }, { opacity: '1' }],
            { duration: 500, fill: 'forwards' }
        );
    });

    it('animate.fadeOut(el) uses opacity 1→0 with default 300ms', () => {

        animate.fadeOut(el);

        expect(el.animate).toHaveBeenCalledWith(
            [{ opacity: '1' }, { opacity: '0' }],
            { duration: 300, fill: 'forwards' }
        );
    });

    it('animate.slideTo(el, { x, y }) translates with default 300ms', () => {

        animate.slideTo(el, { x: 10, y: 20 });

        expect(el.animate).toHaveBeenCalledWith(
            [{ transform: 'translate(10px, 20px)' }],
            { duration: 300, fill: 'forwards' }
        );
    });

    it('animate.slideTo(el, { x }) defaults y to 0', () => {

        animate.slideTo(el, { x: 5 });

        expect(el.animate).toHaveBeenCalledWith(
            [{ transform: 'translate(5px, 0px)' }],
            { duration: 300, fill: 'forwards' }
        );
    });

    it('returns finished animation-like object when reduced motion is preferred', () => {

        const originalMatchMedia = globalThis.matchMedia;
        globalThis.matchMedia = vi.fn().mockReturnValue({ matches: true });

        const result = animate(el, [{ opacity: '0' }, { opacity: '1' }], 300);

        expect(el.animate).not.toHaveBeenCalled();
        expect(result.playState).toBe('finished');
        expect(result.finished).toBeInstanceOf(Promise);
        expect(typeof result.cancel).toBe('function');
        expect(typeof result.pause).toBe('function');
        expect(typeof result.play).toBe('function');

        globalThis.matchMedia = originalMatchMedia;
    });
});
