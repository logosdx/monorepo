import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DomCollection } from '../../../packages/dom/src/collection.ts';

describe('@logosdx/dom: DomCollection', () => {

    let el1: HTMLDivElement;
    let el2: HTMLDivElement;
    let el3: HTMLDivElement;
    let col: DomCollection<HTMLDivElement>;

    beforeEach(() => {

        el1 = document.createElement('div');
        el2 = document.createElement('div');
        el3 = document.createElement('div');
        document.body.appendChild(el1);
        document.body.appendChild(el2);
        document.body.appendChild(el3);
        col = new DomCollection([el1, el2, el3]);
    });

    afterEach(() => {

        el1.remove();
        el2.remove();
        el3.remove();
    });

    describe('construction & properties', () => {

        it('should expose elements array', () => {

            expect(col.elements).toEqual([el1, el2, el3]);
        });

        it('should expose length', () => {

            expect(col.length).toBe(3);
        });

        it('should expose first element', () => {

            expect(col.first).toBe(el1);
        });

        it('should return undefined for first on empty collection', () => {

            const empty = new DomCollection<HTMLDivElement>([]);
            expect(empty.first).toBeUndefined();
        });

        it('should return element at index via at()', () => {

            expect(col.at(0)).toBe(el1);
            expect(col.at(2)).toBe(el3);
            expect(col.at(5)).toBeUndefined();
        });
    });

    describe('iteration', () => {

        it('should iterate with each() and return this', () => {

            const visited: HTMLDivElement[] = [];
            const result = col.each(el => visited.push(el));

            expect(visited).toEqual([el1, el2, el3]);
            expect(result).toBe(col);
        });

        it('should map elements', () => {

            el1.textContent = 'a';
            el2.textContent = 'b';
            el3.textContent = 'c';

            expect(col.map(el => el.textContent)).toEqual(['a', 'b', 'c']);
        });

        it('should filter into a new DomCollection', () => {

            el1.classList.add('keep');
            el3.classList.add('keep');

            const filtered = col.filter(el => el.classList.contains('keep'));

            expect(filtered).toBeInstanceOf(DomCollection);
            expect(filtered.elements).toEqual([el1, el3]);
            expect(filtered).not.toBe(col);
        });

        it('should be iterable with for...of', () => {

            const visited: HTMLDivElement[] = [];

            for (const el of col) {

                visited.push(el);
            }

            expect(visited).toEqual([el1, el2, el3]);
        });
    });

    describe('css', () => {

        it('should set CSS on all elements and return this', () => {

            const result = col.css({ color: 'red' });

            expect(result).toBe(col);
            expect(el1.style.color).toBe('red');
            expect(el2.style.color).toBe('red');
            expect(el3.style.color).toBe('red');
        });

        it('should get CSS from first element', () => {

            el1.style.color = 'blue';
            el2.style.color = 'green';

            expect(col.css('color')).toBe('blue');
        });

        it('should get multiple CSS props from first element', () => {

            el1.style.color = 'blue';
            el1.style.fontSize = '14px';

            const result = col.css(['color', 'fontSize']);

            expect(result).toEqual({ color: 'blue', fontSize: '14px' });
        });

        it('should return undefined for get on empty collection', () => {

            const empty = new DomCollection<HTMLDivElement>([]);
            expect(empty.css('color')).toBeUndefined();
        });

        it('should remove CSS via css.remove and return this', () => {

            col.css({ color: 'red' });
            const result = col.css.remove('color');

            expect(result).toBe(col);
            expect(el1.style.color).toBe('');
        });
    });

    describe('attr', () => {

        it('should set attributes on all elements and return this', () => {

            const result = col.attr({ role: 'button' });

            expect(result).toBe(col);
            expect(el1.getAttribute('role')).toBe('button');
            expect(el2.getAttribute('role')).toBe('button');
        });

        it('should get attribute from first element', () => {

            el1.setAttribute('role', 'button');
            expect(col.attr('role')).toBe('button');
        });

        it('should get multiple attributes from first element', () => {

            el1.setAttribute('role', 'button');
            el1.setAttribute('id', 'test');

            expect(col.attr(['role', 'id'])).toEqual({ role: 'button', id: 'test' });
        });

        it('should remove attributes via attr.remove and return this', () => {

            col.attr({ role: 'button' });
            const result = col.attr.remove('role');

            expect(result).toBe(col);
            expect(el1.getAttribute('role')).toBeNull();
        });

        it('should check has attribute via attr.has', () => {

            el1.setAttribute('disabled', '');
            expect(col.attr.has('disabled')).toBe(true);
            expect(col.attr.has('hidden')).toBe(false);
        });
    });

    describe('class', () => {

        it('should add class and return this', () => {

            const result = col.class.add('active');

            expect(result).toBe(col);
            expect(el1.classList.contains('active')).toBe(true);
            expect(el2.classList.contains('active')).toBe(true);
        });

        it('should remove class and return this', () => {

            el1.classList.add('active');
            el2.classList.add('active');

            const result = col.class.remove('active');

            expect(result).toBe(col);
            expect(el1.classList.contains('active')).toBe(false);
        });

        it('should toggle class and return this', () => {

            el1.classList.add('active');

            const result = col.class.toggle('active');

            expect(result).toBe(col);
            expect(el1.classList.contains('active')).toBe(false);
            expect(el2.classList.contains('active')).toBe(true);
        });

        it('should check has class on first element', () => {

            el1.classList.add('active');
            expect(col.class.has('active')).toBe(true);
            expect(col.class.has('hidden')).toBe(false);
        });

        it('should swap classes and return this', () => {

            el1.classList.add('a');
            el2.classList.add('b');

            const result = col.class.swap('a', 'b');

            expect(result).toBe(col);
            expect(el1.classList.contains('b')).toBe(true);
            expect(el1.classList.contains('a')).toBe(false);
            expect(el2.classList.contains('a')).toBe(true);
            expect(el2.classList.contains('b')).toBe(false);
        });
    });

    describe('data', () => {

        it('should set data attributes and return this', () => {

            const result = col.data({ userId: '123' });

            expect(result).toBe(col);
            expect(el1.dataset.userId).toBe('123');
            expect(el2.dataset.userId).toBe('123');
        });

        it('should get data from first element', () => {

            el1.dataset.userId = '123';
            expect(col.data('userId')).toBe('123');
        });

        it('should get multiple data keys from first element', () => {

            el1.dataset.userId = '123';
            el1.dataset.role = 'admin';

            expect(col.data(['userId', 'role'])).toEqual({
                userId: '123',
                role: 'admin'
            });
        });

        it('should remove data via data.remove and return this', () => {

            col.data({ userId: '123' });
            const result = col.data.remove('userId');

            expect(result).toBe(col);
            expect(el1.dataset.userId).toBeUndefined();
        });
    });

    describe('aria', () => {

        it('should set aria attributes and return this', () => {

            const result = col.aria({ pressed: 'true' });

            expect(result).toBe(col);
            expect(el1.getAttribute('aria-pressed')).toBe('true');
            expect(el2.getAttribute('aria-pressed')).toBe('true');
        });

        it('should get aria from first element', () => {

            el1.setAttribute('aria-pressed', 'true');
            expect(col.aria('pressed')).toBe('true');
        });

        it('should get multiple aria attributes', () => {

            el1.setAttribute('aria-pressed', 'true');
            el1.setAttribute('aria-expanded', 'false');

            expect(col.aria(['pressed', 'expanded'])).toEqual({
                pressed: 'true',
                expanded: 'false'
            });
        });

        it('should remove aria and return this', () => {

            col.aria({ pressed: 'true' });
            const result = col.aria.remove('pressed');

            expect(result).toBe(col);
            expect(el1.getAttribute('aria-pressed')).toBeNull();
        });

        it('should set and get role', () => {

            const result = col.aria.role('button');
            expect(result).toBe(col);
            expect(el1.getAttribute('role')).toBe('button');

            expect(col.aria.role()).toBe('button');
        });

        it('should set and get label', () => {

            const result = col.aria.label('Submit');
            expect(result).toBe(col);
            expect(el1.getAttribute('aria-label')).toBe('Submit');

            expect(col.aria.label()).toBe('Submit');
        });

        it('should hide and return this', () => {

            const result = col.aria.hide();

            expect(result).toBe(col);
            expect(el1.getAttribute('aria-hidden')).toBe('true');
            expect(el2.getAttribute('aria-hidden')).toBe('true');
        });

        it('should show and return this', () => {

            col.aria.hide();
            const result = col.aria.show();

            expect(result).toBe(col);
            expect(el1.getAttribute('aria-hidden')).toBeNull();
        });

        it('should set live and return this', () => {

            const result = col.aria.live('polite');

            expect(result).toBe(col);
            expect(el1.getAttribute('aria-live')).toBe('polite');
        });
    });

    describe('events', () => {

        it('should attach event with on() and return this', () => {

            const handler = vi.fn();
            const result = col.on('click', handler);

            expect(result).toBe(col);

            el1.click();
            el2.click();

            expect(handler).toHaveBeenCalledTimes(2);
        });

        it('should attach one-time event with once() and return this', () => {

            const handler = vi.fn();
            const result = col.once('click', handler);

            expect(result).toBe(col);

            el1.click();
            el1.click();

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should remove event with off() and return this', () => {

            const handler = vi.fn();
            col.on('click', handler);

            el1.click();
            expect(handler).toHaveBeenCalledTimes(1);

            const result = col.off('click', handler);
            expect(result).toBe(col);

            el1.click();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should emit custom event and return this', () => {

            const handler = vi.fn();
            el1.addEventListener('custom', handler);

            const result = col.emit('custom', { value: 42 });

            expect(result).toBe(col);
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('signal inheritance', () => {

        it('should auto-attach signal to on() when collection has one', () => {

            const controller = new AbortController();
            const signalCol = new DomCollection([el1], { signal: controller.signal });

            const handler = vi.fn();
            signalCol.on('click', handler);

            el1.click();
            expect(handler).toHaveBeenCalledTimes(1);

            controller.abort();
            el1.click();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should not override explicit signal in opts', () => {

            const colController = new AbortController();
            const optController = new AbortController();
            const signalCol = new DomCollection([el1], { signal: colController.signal });

            const handler = vi.fn();
            signalCol.on('click', handler, { signal: optController.signal });

            el1.click();
            expect(handler).toHaveBeenCalledTimes(1);

            optController.abort();
            el1.click();
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('animate', () => {

        it('should delegate animate to all elements', () => {

            (el1 as any).animate = vi.fn().mockReturnValue({} as Animation);
            (el2 as any).animate = vi.fn().mockReturnValue({} as Animation);
            (el3 as any).animate = vi.fn().mockReturnValue({} as Animation);

            const keyframes = [{ opacity: '0' }, { opacity: '1' }];
            col.animate(keyframes, { duration: 300 });

            expect((el1 as any).animate).toHaveBeenCalledOnce();
            expect((el2 as any).animate).toHaveBeenCalledOnce();
            expect((el3 as any).animate).toHaveBeenCalledOnce();
        });

        it('should delegate fadeIn to all elements', () => {

            (el1 as any).animate = vi.fn().mockReturnValue({} as Animation);
            (el2 as any).animate = vi.fn().mockReturnValue({} as Animation);
            (el3 as any).animate = vi.fn().mockReturnValue({} as Animation);

            col.animate.fadeIn(300);

            expect((el1 as any).animate).toHaveBeenCalledOnce();
            expect((el2 as any).animate).toHaveBeenCalledOnce();
            expect((el3 as any).animate).toHaveBeenCalledOnce();
        });

        it('should delegate fadeOut to all elements', () => {

            (el1 as any).animate = vi.fn().mockReturnValue({} as Animation);
            (el2 as any).animate = vi.fn().mockReturnValue({} as Animation);
            (el3 as any).animate = vi.fn().mockReturnValue({} as Animation);

            col.animate.fadeOut(300);

            expect((el1 as any).animate).toHaveBeenCalledOnce();
            expect((el2 as any).animate).toHaveBeenCalledOnce();
            expect((el3 as any).animate).toHaveBeenCalledOnce();
        });

        it('should delegate slideTo to all elements', () => {

            (el1 as any).animate = vi.fn().mockReturnValue({} as Animation);
            (el2 as any).animate = vi.fn().mockReturnValue({} as Animation);
            (el3 as any).animate = vi.fn().mockReturnValue({} as Animation);

            col.animate.slideTo({ x: 10, y: 20 }, 300);

            expect((el1 as any).animate).toHaveBeenCalledOnce();
            expect((el2 as any).animate).toHaveBeenCalledOnce();
            expect((el3 as any).animate).toHaveBeenCalledOnce();
        });
    });
});
