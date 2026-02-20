const ns = () => (window as any).LogosDx.Dom;

describe('smoke: @logosdx/dom', () => {

    beforeAll(async () => {

        await (window as any).__loadBundle('dom');
    });

    it('namespace is loaded', () => {

        expect(ns()).toBeDefined();
    });

    it('$() queries elements from the DOM', () => {

        const div = document.createElement('div');
        div.className = 'smoke-test-query';
        document.body.appendChild(div);

        const result = ns().$('.smoke-test-query');
        expect(result.length).toBe(1);
        expect(result.first).toBe(div);

        div.remove();
    });

    it('css() sets and gets styles', () => {

        const el = document.createElement('div');
        document.body.appendChild(el);

        ns().css(el, { color: 'red' });
        const color = ns().css(el, 'color');
        expect(color).toBe('red');

        el.remove();
    });

    it('attr() sets and gets attributes', () => {

        const el = document.createElement('div');
        document.body.appendChild(el);

        ns().attr(el, { 'data-smoke': 'test' });
        const val = ns().attr(el, 'data-smoke');
        expect(val).toBe('test');

        el.remove();
    });

    it('on() attaches and fires event listeners', () => {

        const el = document.createElement('button');
        document.body.appendChild(el);

        let clicked = false;
        ns().on(el, 'click', () => { clicked = true; });

        el.click();
        expect(clicked).toBe(true);

        el.remove();
    });
});
