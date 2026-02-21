const ns = () => (window as any).LogosDx.Dom;

describe('smoke: @logosdx/dom', () => {

    beforeAll(async () => {

        await (window as any).__loadBundle('dom');
    });

    it('namespace is loaded', () => {

        expect(ns()).toBeDefined();
    });

    // --- $() Selector ---

    it('$() queries elements from the DOM', () => {

        const div = document.createElement('div');
        div.className = 'smoke-test-query';
        document.body.appendChild(div);

        const result = ns().$('.smoke-test-query');
        expect(result.length).toBe(1);
        expect(result.first).toBe(div);

        div.remove();
    });

    it('$() accepts container option for scoped queries', () => {

        const container = document.createElement('div');
        const inner = document.createElement('span');
        inner.className = 'scoped';
        container.appendChild(inner);
        document.body.appendChild(container);

        const outer = document.createElement('span');
        outer.className = 'scoped';
        document.body.appendChild(outer);

        const result = ns().$('.scoped', { container });
        expect(result.length).toBe(1);
        expect(result.first).toBe(inner);

        container.remove();
        outer.remove();
    });

    it('$() wraps an existing element', () => {

        const el = document.createElement('div');
        const result = ns().$(el);
        expect(result.length).toBe(1);
        expect(result.first).toBe(el);
    });

    it('$() wraps an array of elements', () => {

        const a = document.createElement('div');
        const b = document.createElement('div');
        const result = ns().$([a, b]);
        expect(result.length).toBe(2);
    });

    it('$.create() returns a DomCollection', () => {

        const result = ns().$.create('div', { text: 'hello' });
        expect(result.first.textContent).toBe('hello');
    });

    // --- CSS ---

    it('css() sets and gets styles', () => {

        const el = document.createElement('div');
        document.body.appendChild(el);

        ns().css(el, { color: 'red' });
        const color = ns().css(el, 'color');
        expect(color).toBe('red');

        el.remove();
    });

    it('css.remove() removes inline styles', () => {

        const el = document.createElement('div');
        document.body.appendChild(el);

        ns().css(el, { color: 'red', fontSize: '14px' });
        ns().css.remove(el, 'color');
        expect(ns().css(el, 'color')).toBe('');
        expect(ns().css(el, 'fontSize')).toBe('14px');

        el.remove();
    });

    // --- Attributes ---

    it('attr() sets and gets attributes', () => {

        const el = document.createElement('div');
        document.body.appendChild(el);

        ns().attr(el, { 'data-smoke': 'test' });
        const val = ns().attr(el, 'data-smoke');
        expect(val).toBe('test');

        el.remove();
    });

    it('attr.has() checks attribute existence', () => {

        const el = document.createElement('div');
        el.setAttribute('disabled', '');
        expect(ns().attr.has(el, 'disabled')).toBe(true);
        expect(ns().attr.has(el, 'hidden')).toBe(false);
    });

    // --- Classes ---

    it('classify.add() and classify.has()', () => {

        const el = document.createElement('div');
        ns().classify.add(el, 'active');
        expect(ns().classify.has(el, 'active')).toBe(true);
    });

    it('classify.toggle() toggles a class', () => {

        const el = document.createElement('div');
        ns().classify.toggle(el, 'on');
        expect(el.classList.contains('on')).toBe(true);
        ns().classify.toggle(el, 'on');
        expect(el.classList.contains('on')).toBe(false);
    });

    it('classify.swap() swaps one class for another', () => {

        const el = document.createElement('div');
        el.classList.add('old');
        ns().classify.swap(el, 'old', 'new');
        expect(el.classList.contains('old')).toBe(false);
        expect(el.classList.contains('new')).toBe(true);
    });

    // --- Data ---

    it('data() sets and gets dataset values', () => {

        const el = document.createElement('div');
        ns().data(el, { userId: '42' });
        expect(ns().data(el, 'userId')).toBe('42');
    });

    it('data.remove() removes a dataset key', () => {

        const el = document.createElement('div');
        ns().data(el, { key: 'val' });
        ns().data.remove(el, 'key');
        expect(ns().data(el, 'key')).toBeUndefined();
    });

    // --- Aria ---

    it('aria() sets and gets aria attributes with auto-prefix', () => {

        const el = document.createElement('div');
        ns().aria(el, { pressed: 'true', expanded: 'false' });
        expect(el.getAttribute('aria-pressed')).toBe('true');
        expect(ns().aria(el, 'expanded')).toBe('false');
    });

    it('aria.remove() removes multiple aria attributes', () => {

        const el = document.createElement('div');
        ns().aria(el, { pressed: 'true', expanded: 'false', hidden: 'true' });
        ns().aria.remove(el, 'pressed', 'expanded');
        expect(el.getAttribute('aria-pressed')).toBeNull();
        expect(el.getAttribute('aria-expanded')).toBeNull();
        expect(el.getAttribute('aria-hidden')).toBe('true');
    });

    it('aria.role() sets role (not aria-role)', () => {

        const el = document.createElement('div');
        ns().aria.role(el, 'button');
        expect(el.getAttribute('role')).toBe('button');
        expect(el.getAttribute('aria-role')).toBeNull();
    });

    it('aria.label() sets and gets aria-label', () => {

        const el = document.createElement('div');
        ns().aria.label(el, 'Submit');
        expect(ns().aria.label(el)).toBe('Submit');
    });

    it('aria.hide() and aria.show()', () => {

        const el = document.createElement('div');
        ns().aria.hide(el);
        expect(el.getAttribute('aria-hidden')).toBe('true');
        ns().aria.show(el);
        expect(el.getAttribute('aria-hidden')).toBeNull();
    });

    // --- Events ---

    it('on() attaches and fires event listeners', () => {

        const el = document.createElement('button');
        document.body.appendChild(el);

        let clicked = false;
        ns().on(el, 'click', () => { clicked = true; });

        el.click();
        expect(clicked).toBe(true);

        el.remove();
    });

    it('on() with signal removes listener on abort', () => {

        const el = document.createElement('button');
        document.body.appendChild(el);

        const controller = new AbortController();
        let count = 0;
        ns().on(el, 'click', () => { count++; }, { signal: controller.signal });

        el.click();
        expect(count).toBe(1);

        controller.abort();
        el.click();
        expect(count).toBe(1);

        el.remove();
    });

    it('once() fires exactly once', () => {

        const el = document.createElement('button');
        document.body.appendChild(el);

        let count = 0;
        ns().once(el, 'click', () => { count++; });

        el.click();
        el.click();
        expect(count).toBe(1);

        el.remove();
    });

    it('emit() dispatches CustomEvent with detail', () => {

        const el = document.createElement('div');
        document.body.appendChild(el);

        let detail: any;
        el.addEventListener('widget:open', (e: any) => { detail = e.detail; });
        ns().emit(el, 'widget:open', { chatId: 42 });

        expect(detail).toEqual({ chatId: 42 });

        el.remove();
    });

    it('on() delegation fires when child matches selector', () => {

        const parent = document.createElement('div');
        const child = document.createElement('span');
        child.className = 'target';
        parent.appendChild(child);
        document.body.appendChild(parent);

        let fired = false;
        ns().on(parent, 'click', () => { fired = true; }, { delegate: '.target' });

        child.click();
        expect(fired).toBe(true);

        parent.remove();
    });

    // --- DomCollection chaining ---

    it('DomCollection chains css, class, attr, aria', () => {

        const el = document.createElement('div');
        document.body.appendChild(el);

        const col = ns().$(el);
        col.css({ color: 'blue' })
            .class.add('active')
            .attr({ 'data-id': '1' })
            .aria({ label: 'test' });

        expect(el.style.color).toBe('blue');
        expect(el.classList.contains('active')).toBe(true);
        expect(el.getAttribute('data-id')).toBe('1');
        expect(el.getAttribute('aria-label')).toBe('test');

        el.remove();
    });

    it('DomCollection signal inheritance auto-cleans on abort', () => {

        const el = document.createElement('button');
        document.body.appendChild(el);
        const controller = new AbortController();

        const col = ns().$(el, { signal: controller.signal });
        let count = 0;
        col.on('click', () => { count++; });

        el.click();
        expect(count).toBe(1);

        controller.abort();
        el.click();
        expect(count).toBe(1);

        el.remove();
    });

    // --- Viewport ---

    it('viewport namespace has expected methods', () => {

        const v = ns().viewport;
        expect(typeof v.width).toBe('function');
        expect(typeof v.height).toBe('function');
        expect(typeof v.scrollX).toBe('function');
        expect(typeof v.scrollY).toBe('function');
        expect(typeof v.scrollProgress).toBe('function');
        expect(typeof v.pixelRatio).toBe('function');
        expect(typeof v.isAtTop).toBe('function');
        expect(typeof v.isAtBottom).toBe('function');
        expect(typeof v.scrollTo).toBe('function');
    });

    // --- DOM manipulation ---

    it('create() builds an element', () => {

        const el = ns().create('div', { text: 'smoke', class: ['test'] });
        expect(el.textContent).toBe('smoke');
        expect(el.classList.contains('test')).toBe(true);
    });

    it('append() and remove() manipulate the DOM', () => {

        const parent = document.createElement('div');
        document.body.appendChild(parent);
        const child = document.createElement('span');

        ns().append(parent, child);
        expect(parent.contains(child)).toBe(true);

        ns().remove(child);
        expect(parent.contains(child)).toBe(false);

        parent.remove();
    });

    // --- Animate ---

    it('animate exports are functions', () => {

        expect(typeof ns().animate).toBe('function');
        expect(typeof ns().animate.fadeIn).toBe('function');
        expect(typeof ns().animate.fadeOut).toBe('function');
        expect(typeof ns().animate.slideTo).toBe('function');
    });

    // --- Observers ---

    it('observe, watchVisibility, watchResize are exported', () => {

        expect(typeof ns().observe).toBe('function');
        expect(typeof ns().watchVisibility).toBe('function');
        expect(typeof ns().watchResize).toBe('function');
    });
});
