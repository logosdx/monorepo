import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { aria } from '../../../packages/dom/src/aria.ts';

describe('@logosdx/dom: aria', () => {

    let el: HTMLElement;
    let el2: HTMLElement;

    beforeEach(() => {

        el = document.createElement('div');
        el2 = document.createElement('div');
        document.body.appendChild(el);
        document.body.appendChild(el2);
    });

    afterEach(() => {

        el.remove();
        el2.remove();
    });

    describe('set', () => {

        it('should set aria attributes with aria- prefix', () => {

            aria(el, { pressed: 'true', expanded: 'false' });
            expect(el.getAttribute('aria-pressed')).toBe('true');
            expect(el.getAttribute('aria-expanded')).toBe('false');
        });

        it('should set aria attributes on multiple elements', () => {

            aria([el, el2], { hidden: 'true' });
            expect(el.getAttribute('aria-hidden')).toBe('true');
            expect(el2.getAttribute('aria-hidden')).toBe('true');
        });
    });

    describe('get', () => {

        it('should get a single aria attribute', () => {

            el.setAttribute('aria-pressed', 'true');
            expect(aria(el, 'pressed')).toBe('true');
        });

        it('should get multiple aria attributes', () => {

            el.setAttribute('aria-pressed', 'true');
            el.setAttribute('aria-expanded', 'false');
            const result = aria(el, ['pressed', 'expanded']);
            expect(result).toEqual({ pressed: 'true', expanded: 'false' });
        });

        it('should return null for unset attribute', () => {

            expect(aria(el, 'pressed')).toBeNull();
        });
    });

    describe('remove', () => {

        it('should remove an aria attribute', () => {

            el.setAttribute('aria-pressed', 'true');
            aria.remove(el, 'pressed');
            expect(el.getAttribute('aria-pressed')).toBeNull();
        });

        it('should remove aria attribute from multiple elements', () => {

            el.setAttribute('aria-pressed', 'true');
            el2.setAttribute('aria-pressed', 'true');
            aria.remove([el, el2], 'pressed');
            expect(el.getAttribute('aria-pressed')).toBeNull();
            expect(el2.getAttribute('aria-pressed')).toBeNull();
        });
    });

    describe('role', () => {

        it('should set role attribute (not aria-role)', () => {

            aria.role(el, 'button');
            expect(el.getAttribute('role')).toBe('button');
            expect(el.getAttribute('aria-role')).toBeNull();
        });

        it('should get role attribute', () => {

            el.setAttribute('role', 'button');
            expect(aria.role(el)).toBe('button');
        });

        it('should return null when role is unset', () => {

            expect(aria.role(el)).toBeNull();
        });
    });

    describe('label', () => {

        it('should set aria-label', () => {

            aria.label(el, 'Submit form');
            expect(el.getAttribute('aria-label')).toBe('Submit form');
        });

        it('should get aria-label', () => {

            el.setAttribute('aria-label', 'Submit form');
            expect(aria.label(el)).toBe('Submit form');
        });
    });

    describe('hide / show', () => {

        it('should set aria-hidden="true"', () => {

            aria.hide(el);
            expect(el.getAttribute('aria-hidden')).toBe('true');
        });

        it('should hide multiple elements', () => {

            aria.hide([el, el2]);
            expect(el.getAttribute('aria-hidden')).toBe('true');
            expect(el2.getAttribute('aria-hidden')).toBe('true');
        });

        it('should remove aria-hidden', () => {

            el.setAttribute('aria-hidden', 'true');
            aria.show(el);
            expect(el.getAttribute('aria-hidden')).toBeNull();
        });

        it('should show multiple elements', () => {

            el.setAttribute('aria-hidden', 'true');
            el2.setAttribute('aria-hidden', 'true');
            aria.show([el, el2]);
            expect(el.getAttribute('aria-hidden')).toBeNull();
            expect(el2.getAttribute('aria-hidden')).toBeNull();
        });
    });

    describe('live', () => {

        it('should set aria-live', () => {

            aria.live(el, 'polite');
            expect(el.getAttribute('aria-live')).toBe('polite');
        });

        it('should set aria-live on multiple elements', () => {

            aria.live([el, el2], 'assertive');
            expect(el.getAttribute('aria-live')).toBe('assertive');
            expect(el2.getAttribute('aria-live')).toBe('assertive');
        });
    });
});
