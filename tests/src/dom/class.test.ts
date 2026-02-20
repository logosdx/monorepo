import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { classify } from '../../../packages/dom/src/class.ts';

describe('@logosdx/dom: class', () => {

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

    describe('add', () => {

        it('should add a single class', () => {

            classify.add(el, 'active');
            expect(el.classList.contains('active')).toBe(true);
        });

        it('should add multiple classes', () => {

            classify.add(el, 'active', 'highlighted');
            expect(el.classList.contains('active')).toBe(true);
            expect(el.classList.contains('highlighted')).toBe(true);
        });

        it('should add classes to multiple elements', () => {

            classify.add([el, el2], 'active');
            expect(el.classList.contains('active')).toBe(true);
            expect(el2.classList.contains('active')).toBe(true);
        });
    });

    describe('remove', () => {

        it('should remove a single class', () => {

            el.classList.add('active');
            classify.remove(el, 'active');
            expect(el.classList.contains('active')).toBe(false);
        });

        it('should remove multiple classes', () => {

            el.classList.add('active', 'highlighted');
            classify.remove(el, 'active', 'highlighted');
            expect(el.classList.contains('active')).toBe(false);
            expect(el.classList.contains('highlighted')).toBe(false);
        });
    });

    describe('toggle', () => {

        it('should toggle a class on', () => {

            classify.toggle(el, 'active');
            expect(el.classList.contains('active')).toBe(true);
        });

        it('should toggle a class off', () => {

            el.classList.add('active');
            classify.toggle(el, 'active');
            expect(el.classList.contains('active')).toBe(false);
        });

        it('should toggle on multiple elements', () => {

            el.classList.add('active');
            classify.toggle([el, el2], 'active');
            expect(el.classList.contains('active')).toBe(false);
            expect(el2.classList.contains('active')).toBe(true);
        });
    });

    describe('has', () => {

        it('should return true when element has the class', () => {

            el.classList.add('active');
            expect(classify.has(el, 'active')).toBe(true);
        });

        it('should return false when element does not have the class', () => {

            expect(classify.has(el, 'active')).toBe(false);
        });
    });

    describe('swap', () => {

        it('should swap first class for second', () => {

            el.classList.add('active');
            classify.swap(el, 'active', 'inactive');
            expect(el.classList.contains('active')).toBe(false);
            expect(el.classList.contains('inactive')).toBe(true);
        });

        it('should swap second class for first', () => {

            el.classList.add('inactive');
            classify.swap(el, 'active', 'inactive');
            expect(el.classList.contains('inactive')).toBe(false);
            expect(el.classList.contains('active')).toBe(true);
        });

        it('should do nothing when element has neither class', () => {

            classify.swap(el, 'active', 'inactive');
            expect(el.classList.contains('active')).toBe(false);
            expect(el.classList.contains('inactive')).toBe(false);
        });

        it('should swap on multiple elements', () => {

            el.classList.add('a');
            el2.classList.add('b');
            classify.swap([el, el2], 'a', 'b');
            expect(el.classList.contains('b')).toBe(true);
            expect(el.classList.contains('a')).toBe(false);
            expect(el2.classList.contains('a')).toBe(true);
            expect(el2.classList.contains('b')).toBe(false);
        });
    });
});
