import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { animate } from '../../../packages/dom/src/animate.ts';

describe('@logosdx/dom: animate', () => {

    let el: HTMLDivElement;
    let el2: HTMLDivElement;
    let mockAnimation: any;

    beforeEach(() => {

        el = document.createElement('div');
        el2 = document.createElement('div');
        document.body.appendChild(el);
        document.body.appendChild(el2);

        mockAnimation = {
            finished: Promise.resolve(),
            playState: 'running',
            cancel: vi.fn(),
            pause: vi.fn(),
            play: vi.fn(),
        };

        el.animate = vi.fn().mockReturnValue(mockAnimation);
        el2.animate = vi.fn().mockReturnValue({ ...mockAnimation });
    });

    afterEach(() => {

        el.remove();
        el2.remove();
        vi.restoreAllMocks();
    });

    it('calls el.animate with keyframes and options', () => {

        const keyframes = [{ opacity: '0' }, { opacity: '1' }];
        const options = { duration: 500, fill: 'forwards' as FillMode };

        const result = animate(el, keyframes, options);

        expect(el.animate).toHaveBeenCalledWith(keyframes, options);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(mockAnimation);
    });

    it('accepts a number shorthand for options (duration)', () => {

        const keyframes = [{ opacity: '0' }, { opacity: '1' }];

        animate(el, keyframes, 200);

        expect(el.animate).toHaveBeenCalledWith(keyframes, 200);
    });

    it('animates multiple elements', () => {

        const keyframes = [{ opacity: '0' }, { opacity: '1' }];

        const result = animate([el, el2], keyframes, 300);

        expect(el.animate).toHaveBeenCalledWith(keyframes, 300);
        expect(el2.animate).toHaveBeenCalledWith(keyframes, 300);
        expect(result).toHaveLength(2);
    });

    it('animate.fadeIn(el) uses opacity 0→1 with default 300ms', () => {

        const result = animate.fadeIn(el);

        expect(el.animate).toHaveBeenCalledWith(
            [{ opacity: '0' }, { opacity: '1' }],
            { duration: 300, fill: 'forwards' }
        );
        expect(result).toHaveLength(1);
    });

    it('animate.fadeIn(el, 500) uses custom duration', () => {

        animate.fadeIn(el, 500);

        expect(el.animate).toHaveBeenCalledWith(
            [{ opacity: '0' }, { opacity: '1' }],
            { duration: 500, fill: 'forwards' }
        );
    });

    it('animate.fadeIn on multiple elements', () => {

        const result = animate.fadeIn([el, el2]);

        expect(el.animate).toHaveBeenCalledTimes(1);
        expect(el2.animate).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(2);
    });

    it('animate.fadeOut(el) uses opacity 1→0 with default 300ms', () => {

        animate.fadeOut(el);

        expect(el.animate).toHaveBeenCalledWith(
            [{ opacity: '1' }, { opacity: '0' }],
            { duration: 300, fill: 'forwards' }
        );
    });

    it('animate.fadeOut on multiple elements', () => {

        const result = animate.fadeOut([el, el2]);

        expect(el.animate).toHaveBeenCalledTimes(1);
        expect(el2.animate).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(2);
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

    it('animate.slideTo on multiple elements', () => {

        const result = animate.slideTo([el, el2], { x: 10 });

        expect(el.animate).toHaveBeenCalledTimes(1);
        expect(el2.animate).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(2);
    });

    it('returns finished animation-like objects when reduced motion is preferred', () => {

        const originalMatchMedia = globalThis.matchMedia;
        globalThis.matchMedia = vi.fn().mockReturnValue({ matches: true });

        const result = animate(el, [{ opacity: '0' }, { opacity: '1' }], 300);

        expect(el.animate).not.toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0].playState).toBe('finished');
        expect(result[0].finished).toBeInstanceOf(Promise);
        expect(typeof result[0].cancel).toBe('function');

        globalThis.matchMedia = originalMatchMedia;
    });

    it('returns one finished stub per element when reduced motion is preferred', () => {

        const originalMatchMedia = globalThis.matchMedia;
        globalThis.matchMedia = vi.fn().mockReturnValue({ matches: true });

        const result = animate([el, el2], [{ opacity: '0' }, { opacity: '1' }], 300);

        expect(result).toHaveLength(2);
        expect(result[0].playState).toBe('finished');
        expect(result[1].playState).toBe('finished');

        globalThis.matchMedia = originalMatchMedia;
    });
});
