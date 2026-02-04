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

        const results = ns().$('.smoke-test-query');
        expect(results).toHaveLength(1);
        expect(results[0]).toBe(div);

        div.remove();
    });

    it('html.css.set() and html.css.get() manipulate styles', () => {

        const el = document.createElement('div');
        document.body.appendChild(el);

        ns().html.css.set(el, { color: 'red' });
        const color = ns().html.css.get(el, 'color');

        // Browser returns computed color in RGB format
        expect(color).toBe('rgb(255, 0, 0)');

        el.remove();
    });

    it('html.attrs.set() and html.attrs.get() manipulate attributes', () => {

        const el = document.createElement('div');
        document.body.appendChild(el);

        ns().html.attrs.set(el, { 'data-smoke': 'test' });
        const val = ns().html.attrs.get(el, 'data-smoke');

        expect(val).toBe('test');

        el.remove();
    });

    it('html.events.on() attaches and fires event listeners', () => {

        const el = document.createElement('button');
        document.body.appendChild(el);

        let clicked = false;
        ns().html.events.on(el, 'click', () => { clicked = true; });

        el.click();
        expect(clicked).toBe(true);

        el.remove();
    });

    it('html.events.on() cleanup removes the listener', () => {

        const el = document.createElement('button');
        document.body.appendChild(el);

        let count = 0;
        const cleanup = ns().html.events.on(el, 'click', () => { count++; });

        el.click();
        expect(count).toBe(1);

        cleanup();
        el.click();
        expect(count).toBe(1);

        el.remove();
    });
});
