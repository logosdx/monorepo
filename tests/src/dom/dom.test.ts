import { describe, it, expect, afterEach, vi } from 'vitest';
import { create, append, prepend, remove, replace } from '../../../packages/dom/src/dom.ts';

describe('@logosdx/dom: create', () => {

    afterEach(() => {

        document.body.innerHTML = '';
    });

    it('should create an HTMLDivElement', () => {

        const el = create('div');
        expect(el).toBeInstanceOf(HTMLDivElement);
    });

    it('should set textContent when text is provided', () => {

        const el = create('div', { text: 'Hello' });
        expect(el.textContent).toBe('Hello');
    });

    it('should add classes from class array', () => {

        const el = create('div', { class: ['a', 'b'] });
        expect(el.classList.contains('a')).toBe(true);
        expect(el.classList.contains('b')).toBe(true);
    });

    it('should set inline styles via css option', () => {

        const el = create('div', { css: { color: 'red' } });
        expect(el.style.color).toBe('red');
    });

    it('should set custom properties via css option', () => {

        const el = create('div', { css: { '--theme': 'dark' } });
        expect(el.style.getPropertyValue('--theme')).toBe('dark');
    });

    it('should set attributes via attrs option', () => {

        const el = create('div', { attrs: { 'data-id': '1' } });
        expect(el.getAttribute('data-id')).toBe('1');
    });

    it('should append element and text node children', () => {

        const span = create('span', { text: 'child' });
        const el = create('div', { children: [span, 'text'] });

        expect(el.childNodes.length).toBe(2);
        expect(el.childNodes[0]).toBe(span);
        expect(el.childNodes[1]!.nodeType).toBe(Node.TEXT_NODE);
        expect(el.childNodes[1]!.textContent).toBe('text');
    });

    it('should wire event handlers via on option', () => {

        const handler = vi.fn();
        const el = create('div', { on: { click: handler } });

        document.body.appendChild(el);
        el.click();

        expect(handler).toHaveBeenCalledOnce();
    });

    it('should pass signal to event listeners', () => {

        const handler = vi.fn();
        const controller = new AbortController();
        const el = create('div', {
            on: { click: handler },
            signal: controller.signal
        });

        document.body.appendChild(el);
        el.click();
        expect(handler).toHaveBeenCalledOnce();

        controller.abort();
        el.click();
        expect(handler).toHaveBeenCalledOnce();
    });
});

describe('@logosdx/dom: append', () => {

    it('should append multiple children to parent', () => {

        const parent = create('div');
        const child1 = create('span');
        const child2 = create('span');

        append(parent, child1, child2);

        expect(parent.children.length).toBe(2);
        expect(parent.children[0]).toBe(child1);
        expect(parent.children[1]).toBe(child2);
    });
});

describe('@logosdx/dom: prepend', () => {

    it('should prepend child as first element', () => {

        const parent = create('div');
        const existing = create('span');
        const first = create('span');

        append(parent, existing);
        prepend(parent, first);

        expect(parent.children[0]).toBe(first);
        expect(parent.children[1]).toBe(existing);
    });
});

describe('@logosdx/dom: remove', () => {

    it('should remove element from DOM', () => {

        const el = create('div');
        document.body.appendChild(el);
        expect(document.body.contains(el)).toBe(true);

        remove(el);
        expect(document.body.contains(el)).toBe(false);
    });
});

describe('@logosdx/dom: replace', () => {

    it('should replace old element with new element', () => {

        const oldEl = create('div', { attrs: { id: 'old' } });
        const newEl = create('div', { attrs: { id: 'new' } });

        document.body.appendChild(oldEl);
        expect(document.body.contains(oldEl)).toBe(true);

        replace(oldEl, newEl);
        expect(document.body.contains(oldEl)).toBe(false);
        expect(document.body.contains(newEl)).toBe(true);
    });
});
