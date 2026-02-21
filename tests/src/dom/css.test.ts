import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { css } from '../../../packages/dom/src/css.ts';

describe('@logosdx/dom: css', () => {

    let el: HTMLDivElement;
    let el2: HTMLDivElement;

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

        it('should set a single standard CSS property', () => {

            css(el, { color: 'red' });
            expect(el.style.color).toBe('red');
        });

        it('should set multiple standard CSS properties', () => {

            css(el, { color: 'red', fontSize: '16px' });
            expect(el.style.color).toBe('red');
            expect(el.style.fontSize).toBe('16px');
        });

        it('should set properties on multiple elements', () => {

            css([el, el2], { color: 'blue' });
            expect(el.style.color).toBe('blue');
            expect(el2.style.color).toBe('blue');
        });

        it('should set CSS custom properties', () => {

            css(el, { '--theme': 'dark' });
            expect(el.style.getPropertyValue('--theme')).toBe('dark');
        });

        it('should handle empty props object', () => {

            css(el, {});
            expect(el.style.cssText).toBe('');
        });
    });

    describe('get', () => {

        it('should get a single property value as string', () => {

            el.style.color = 'red';
            const value = css(el, 'color');
            expect(value).toBe('red');
        });

        it('should get multiple property values as a record', () => {

            el.style.color = 'red';
            el.style.fontSize = '16px';
            const values = css(el, ['color', 'fontSize']);
            expect(values).toEqual({ color: 'red', fontSize: '16px' });
        });

        it('should get a custom property value', () => {

            el.style.setProperty('--theme', 'dark');
            const value = css(el, '--theme');
            expect(value).toBe('dark');
        });

        it('should return empty string for unset property', () => {

            const value = css(el, 'color');
            expect(value).toBe('');
        });
    });

    describe('remove', () => {

        it('should remove a standard property', () => {

            el.style.color = 'red';
            css.remove(el, 'color');
            expect(el.style.color).toBe('');
        });

        it('should remove multiple standard properties', () => {

            el.style.color = 'red';
            el.style.fontSize = '16px';
            css.remove(el, ['color', 'fontSize']);
            expect(el.style.color).toBe('');
            expect(el.style.fontSize).toBe('');
        });

        it('should remove multiple properties from multiple elements', () => {

            el.style.color = 'red';
            el.style.fontSize = '16px';
            el2.style.color = 'blue';
            el2.style.fontSize = '18px';
            css.remove([el, el2], ['color', 'fontSize']);
            expect(el.style.color).toBe('');
            expect(el.style.fontSize).toBe('');
            expect(el2.style.color).toBe('');
            expect(el2.style.fontSize).toBe('');
        });

        it('should remove a custom property', () => {

            el.style.setProperty('--theme', 'dark');
            css.remove(el, '--theme');
            expect(el.style.getPropertyValue('--theme')).toBe('');
        });

        it('should remove properties from multiple elements', () => {

            el.style.color = 'red';
            el2.style.color = 'red';
            css.remove([el, el2], 'color');
            expect(el.style.color).toBe('');
            expect(el2.style.color).toBe('');
        });
    });
});
