import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { data } from '../../../packages/dom/src/data.ts';

describe('@logosdx/dom: data', () => {

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

        it('should set a single data attribute on an element', () => {

            data(el, { userId: '123' });
            expect(el.dataset.userId).toBe('123');
        });

        it('should set multiple data attributes on an element', () => {

            data(el, { userId: '123', role: 'admin' });
            expect(el.dataset.userId).toBe('123');
            expect(el.dataset.role).toBe('admin');
        });

        it('should set data attributes on multiple elements', () => {

            data([el, el2], { userId: '123' });
            expect(el.dataset.userId).toBe('123');
            expect(el2.dataset.userId).toBe('123');
        });

        it('should handle empty props object', () => {

            data(el, {});
            expect(Object.keys(el.dataset)).toHaveLength(0);
        });
    });

    describe('get', () => {

        it('should get a single data attribute value', () => {

            el.dataset.userId = '123';
            const value = data(el, 'userId');
            expect(value).toBe('123');
        });

        it('should return undefined for unset data attribute', () => {

            const value = data(el, 'userId');
            expect(value).toBeUndefined();
        });

        it('should get multiple data attribute values as a record', () => {

            el.dataset.userId = '123';
            el.dataset.role = 'admin';
            const values = data(el, ['userId', 'role']);
            expect(values).toEqual({ userId: '123', role: 'admin' });
        });

        it('should return undefined for unset keys in multi-get', () => {

            el.dataset.userId = '123';
            const values = data(el, ['userId', 'role']);
            expect(values).toEqual({ userId: '123', role: undefined });
        });
    });

    describe('remove', () => {

        it('should remove a single data attribute', () => {

            el.dataset.userId = '123';
            data.remove(el, 'userId');
            expect(el.dataset.userId).toBeUndefined();
        });

        it('should remove data attributes from multiple elements', () => {

            el.dataset.userId = '123';
            el2.dataset.userId = '456';
            data.remove([el, el2], 'userId');
            expect(el.dataset.userId).toBeUndefined();
            expect(el2.dataset.userId).toBeUndefined();
        });

        it('should handle removing non-existent data attribute', () => {

            data.remove(el, 'nonExistent');
            expect(el.dataset.nonExistent).toBeUndefined();
        });
    });
});
