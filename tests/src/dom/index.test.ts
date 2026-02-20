import { describe, it, expect } from 'vitest';
import {
    $, DomCollection,
    css, attr, classify, data, aria,
    on, once, off, emit,
    animate, observe, watchVisibility, watchResize,
    viewport, create, append, prepend, remove, replace
} from '../../../packages/dom/src/index.ts';

describe('@logosdx/dom: index', () => {

    it('$ returns a DomCollection', () => {

        const div = document.createElement('div');
        div.className = 'test-el';
        document.body.appendChild(div);

        const result = $('.test-el');
        expect(result).to.be.instanceOf(DomCollection);
        expect(result.length).to.equal(1);

        div.remove();
    });

    it('$ with context scopes selection', () => {

        const container = document.createElement('div');
        const child = document.createElement('span');
        child.className = 'inner';
        container.appendChild(child);
        document.body.appendChild(container);

        const outer = document.createElement('span');
        outer.className = 'inner';
        document.body.appendChild(outer);

        const result = $<HTMLSpanElement>('.inner', container);
        expect(result.length).to.equal(1);

        container.remove();
        outer.remove();
    });

    it('$ with signal option passes to collection', () => {

        const controller = new AbortController();
        const result = $('div', { signal: controller.signal });
        expect(result).to.be.instanceOf(DomCollection);
    });

    it('$.create returns DomCollection', () => {

        const result = $.create('div', { text: 'hello' });
        expect(result).to.be.instanceOf(DomCollection);
        expect(result.first?.textContent).to.equal('hello');
    });

    it('all standalone functions are exported', () => {

        expect(typeof css).to.equal('function');
        expect(typeof attr).to.equal('function');
        expect(typeof classify).to.equal('object');
        expect(typeof data).to.equal('function');
        expect(typeof aria).to.equal('function');
        expect(typeof on).to.equal('function');
        expect(typeof once).to.equal('function');
        expect(typeof off).to.equal('function');
        expect(typeof emit).to.equal('function');
        expect(typeof animate).to.equal('function');
        expect(typeof observe).to.equal('function');
        expect(typeof watchVisibility).to.equal('function');
        expect(typeof watchResize).to.equal('function');
        expect(typeof viewport).to.equal('object');
        expect(typeof create).to.equal('function');
        expect(typeof append).to.equal('function');
        expect(typeof prepend).to.equal('function');
        expect(typeof remove).to.equal('function');
        expect(typeof replace).to.equal('function');
    });
});
