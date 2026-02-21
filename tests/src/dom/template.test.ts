import { describe, it, expect, afterEach, vi } from 'vitest';
import { DomCollection } from '../../../packages/dom/src/collection.ts';
import { create } from '../../../packages/dom/src/dom.ts';
import { TemplateStamper } from '../../../packages/dom/src/template.ts';

describe('@logosdx/dom: DomCollection.into', () => {

    afterEach(() => {

        document.body.innerHTML = '';
    });

    it('should append all elements into container', () => {

        const container = create('div');
        document.body.appendChild(container);

        const el1 = create('span', { text: 'one' });
        const el2 = create('span', { text: 'two' });
        const collection = new DomCollection([el1, el2]);

        const result = collection.into(container);

        expect(container.children.length).toBe(2);
        expect(container.children[0]).toBe(el1);
        expect(container.children[1]).toBe(el2);
        expect(result).toBe(collection);
    });

    it('should return this for chaining', () => {

        const container = create('div');
        const el = create('span');
        const collection = new DomCollection([el]);

        const result = collection.into(container);

        expect(result).toBe(collection);
    });
});

describe('@logosdx/dom: TemplateStamper', () => {

    afterEach(() => {

        document.body.innerHTML = '';
    });

    function createTemplate(id: string, html: string): HTMLTemplateElement {

        const tmpl = document.createElement('template');
        tmpl.id = id;
        tmpl.innerHTML = html;
        document.body.appendChild(tmpl);
        return tmpl;
    }

    describe('constructor', () => {

        it('should accept a CSS selector string', () => {

            createTemplate('t1', '<div class="card"><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t1');
            const result = stamper.stamp({});

            expect(result.length).toBe(1);
            expect(result.first!.classList.contains('card')).toBe(true);
        });

        it('should accept an HTMLTemplateElement directly', () => {

            const tmpl = createTemplate('t2', '<div class="card"></div>');
            const stamper = new TemplateStamper(tmpl);
            const result = stamper.stamp({});

            expect(result.length).toBe(1);
        });

        it('should throw if selector does not match a template', () => {

            expect(() => new TemplateStamper('#nonexistent')).toThrow();
        });
    });

    describe('stamp: single', () => {

        it('should set text via string shorthand', () => {

            createTemplate('t3', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t3');

            const result = stamper.stamp({ '.name': 'Alice' });

            expect(result.first!.querySelector('.name')!.textContent).toBe('Alice');
        });

        it('should set text via StampOptions object', () => {

            createTemplate('t4', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t4');

            const result = stamper.stamp({ '.name': { text: 'Bob' } });

            expect(result.first!.querySelector('.name')!.textContent).toBe('Bob');
        });

        it('should apply css from StampOptions', () => {

            createTemplate('t5', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t5');

            const result = stamper.stamp({ '.name': { css: { color: 'red' } } });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.style.color).toBe('red');
        });

        it('should apply class from StampOptions', () => {

            createTemplate('t6', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t6');

            const result = stamper.stamp({ '.name': { class: ['active'] } });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.classList.contains('active')).toBe(true);
        });

        it('should apply attrs from StampOptions', () => {

            createTemplate('t7', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t7');

            const result = stamper.stamp({ '.name': { attrs: { 'data-id': '1' } } });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.getAttribute('data-id')).toBe('1');
        });

        it('should apply data-* attributes from StampOptions', () => {

            createTemplate('t8', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t8');

            const result = stamper.stamp({ '.name': { data: { userId: '42' } } });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.dataset.userId).toBe('42');
        });

        it('should apply aria attributes from StampOptions', () => {

            createTemplate('t9', '<div><button class="btn"></button></div>');
            const stamper = new TemplateStamper('#t9');

            const result = stamper.stamp({ '.btn': { aria: { label: 'Submit' } } });
            const btn = result.first!.querySelector('.btn') as HTMLElement;

            expect(btn.getAttribute('aria-label')).toBe('Submit');
        });

        it('should bind event listeners from StampOptions', () => {

            createTemplate('t10', '<div><button class="btn">Click</button></div>');
            const stamper = new TemplateStamper('#t10');
            const handler = vi.fn();

            const result = stamper.stamp({ '.btn': { on: { click: handler } } });
            document.body.appendChild(result.first!);
            const btn = result.first!.querySelector('.btn') as HTMLElement;
            btn.click();

            expect(handler).toHaveBeenCalledOnce();
        });

        it('should skip selectors that do not match any element in clone', () => {

            createTemplate('t11', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t11');

            const result = stamper.stamp({ '.nonexistent': 'Hello', '.name': 'Alice' });

            expect(result.first!.querySelector('.name')!.textContent).toBe('Alice');
        });

        it('should handle templates with multiple root children', () => {

            createTemplate('t12', '<span>one</span><span>two</span>');
            const stamper = new TemplateStamper('#t12');

            const result = stamper.stamp({});

            expect(result.length).toBe(2);
        });
    });

    describe('stamp: base config merge', () => {

        it('should apply base config when stamp provides no override', () => {

            createTemplate('m1', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#m1', {
                map: { '.name': { css: { color: 'red' } } }
            });

            const result = stamper.stamp({ '.name': 'Alice' });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.textContent).toBe('Alice');
            expect(span.style.color).toBe('red');
        });

        it('should let stamp values override base values', () => {

            createTemplate('m2', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#m2', {
                map: { '.name': { text: 'Default' } }
            });

            const result = stamper.stamp({ '.name': 'Override' });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.textContent).toBe('Override');
        });

        it('should merge non-overlapping properties from both', () => {

            createTemplate('m3', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#m3', {
                map: { '.name': { css: { fontWeight: 'bold' }, class: ['base'] } }
            });

            const result = stamper.stamp({ '.name': { text: 'Alice', attrs: { 'data-id': '1' } } });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.textContent).toBe('Alice');
            expect(span.style.fontWeight).toBe('bold');
            expect(span.classList.contains('base')).toBe(true);
            expect(span.getAttribute('data-id')).toBe('1');
        });

        it('should apply base config selectors not present in stamp', () => {

            createTemplate('m4', '<div><span class="name"></span><span class="email"></span></div>');
            const stamper = new TemplateStamper('#m4', {
                map: {
                    '.name': { css: { fontWeight: 'bold' } },
                    '.email': { css: { color: 'gray' } }
                }
            });

            const result = stamper.stamp({ '.name': 'Alice' });
            const email = result.first!.querySelector('.email') as HTMLElement;

            expect(email.style.color).toBe('gray');
        });
    });

    describe('stamp: signal propagation', () => {

        it('should propagate signal to event listeners', () => {

            createTemplate('s1', '<div><button class="btn">Click</button></div>');
            const controller = new AbortController();
            const stamper = new TemplateStamper('#s1', { signal: controller.signal });
            const handler = vi.fn();

            const result = stamper.stamp({ '.btn': { on: { click: handler } } });
            document.body.appendChild(result.first!);
            const btn = result.first!.querySelector('.btn') as HTMLElement;

            btn.click();
            expect(handler).toHaveBeenCalledOnce();

            controller.abort();
            btn.click();
            expect(handler).toHaveBeenCalledOnce();
        });
    });

    describe('stamp: array (stamp many)', () => {

        it('should stamp multiple items from data array', () => {

            createTemplate('a1', '<div class="card"><span class="name"></span></div>');
            const stamper = new TemplateStamper('#a1');

            const users = [{ name: 'Alice' }, { name: 'Bob' }];
            const result = stamper.stamp(users, u => ({ '.name': u.name }));

            expect(result.length).toBe(2);
            expect(result.at(0)!.querySelector('.name')!.textContent).toBe('Alice');
            expect(result.at(1)!.querySelector('.name')!.textContent).toBe('Bob');
        });

        it('should apply base config to all stamped items', () => {

            createTemplate('a2', '<div class="card"><span class="name"></span></div>');
            const stamper = new TemplateStamper('#a2', {
                map: { '.name': { css: { fontWeight: 'bold' } } }
            });

            const users = [{ name: 'Alice' }, { name: 'Bob' }];
            const result = stamper.stamp(users, u => ({ '.name': u.name }));
            const span0 = result.at(0)!.querySelector('.name') as HTMLElement;
            const span1 = result.at(1)!.querySelector('.name') as HTMLElement;

            expect(span0.textContent).toBe('Alice');
            expect(span0.style.fontWeight).toBe('bold');
            expect(span1.textContent).toBe('Bob');
            expect(span1.style.fontWeight).toBe('bold');
        });

        it('should return empty collection for empty data array', () => {

            createTemplate('a3', '<div class="card"></div>');
            const stamper = new TemplateStamper('#a3');

            const result = stamper.stamp([], () => ({}));

            expect(result.length).toBe(0);
        });

        it('should chain .into() after array stamp', () => {

            createTemplate('a4', '<div class="card"><span class="name"></span></div>');
            const container = create('div');
            document.body.appendChild(container);

            const stamper = new TemplateStamper('#a4');
            const users = [{ name: 'Alice' }, { name: 'Bob' }];

            stamper.stamp(users, u => ({ '.name': u.name })).into(container);

            expect(container.children.length).toBe(2);
        });
    });
});
