import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { attr } from '../../../packages/dom/src/attr.ts';

describe('@logosdx/dom: attr', () => {

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

        it('should set a single attribute on an element', () => {

            attr(el, { 'data-id': '123' });
            expect(el.getAttribute('data-id')).toBe('123');
        });

        it('should set multiple attributes on an element', () => {

            attr(el, { 'data-id': '123', role: 'button' });
            expect(el.getAttribute('data-id')).toBe('123');
            expect(el.getAttribute('role')).toBe('button');
        });

        it('should set attributes on multiple elements', () => {

            attr([el, el2], { role: 'button' });
            expect(el.getAttribute('role')).toBe('button');
            expect(el2.getAttribute('role')).toBe('button');
        });

        it('should handle empty attrs object', () => {

            attr(el, {});
            expect(el.attributes.length).toBe(0);
        });
    });

    describe('get', () => {

        it('should get a single attribute value as string', () => {

            el.setAttribute('role', 'button');
            const value = attr(el, 'role');
            expect(value).toBe('button');
        });

        it('should return null for an unset attribute', () => {

            const value = attr(el, 'role');
            expect(value).toBeNull();
        });

        it('should get multiple attribute values as a record', () => {

            el.setAttribute('role', 'button');
            el.setAttribute('data-id', '123');
            const values = attr(el, ['role', 'data-id']);
            expect(values).toEqual({ role: 'button', 'data-id': '123' });
        });

        it('should return null for unset attributes in a record', () => {

            el.setAttribute('role', 'button');
            const values = attr(el, ['role', 'data-id']);
            expect(values).toEqual({ role: 'button', 'data-id': null });
        });
    });

    describe('remove', () => {

        it('should remove a single attribute', () => {

            el.setAttribute('role', 'button');
            attr.remove(el, 'role');
            expect(el.hasAttribute('role')).toBe(false);
        });

        it('should remove multiple attributes', () => {

            el.setAttribute('role', 'button');
            el.setAttribute('data-id', '123');
            attr.remove(el, 'role', 'data-id');
            expect(el.hasAttribute('role')).toBe(false);
            expect(el.hasAttribute('data-id')).toBe(false);
        });

        it('should remove attributes from multiple elements', () => {

            el.setAttribute('role', 'button');
            el2.setAttribute('role', 'button');
            attr.remove([el, el2], 'role');
            expect(el.hasAttribute('role')).toBe(false);
            expect(el2.hasAttribute('role')).toBe(false);
        });

        it('should not throw when removing a non-existent attribute', () => {

            expect(() => attr.remove(el, 'role')).not.toThrow();
        });
    });

    describe('has', () => {

        it('should return true when the attribute exists', () => {

            el.setAttribute('disabled', '');
            expect(attr.has(el, 'disabled')).toBe(true);
        });

        it('should return false when the attribute does not exist', () => {

            expect(attr.has(el, 'disabled')).toBe(false);
        });
    });
});
