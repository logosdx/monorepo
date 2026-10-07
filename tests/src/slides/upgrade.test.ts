import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { upgradeDeck } from '../../../packages/slides/src/upgrade.ts';

const tick = () => new Promise(r => setTimeout(r, 0));

const slideChildren = (el: Element) => Array.from(el.children).filter(
    (child) => child.localName === 'slide'
);

const label = (slide: Element) => {

    const name = slide.hasAttribute('data-implicit') ? 'implicit' : slide.id;
    const axis = slide.hasAttribute('horizontal') ? 'h'
        : slide.hasAttribute('vertical') ? 'v'
        : '?';

    return `${name}:${axis}`;
};

const layout = (root: Element) => slideChildren(root).map((column) => {

    const panels = slideChildren(column).map(label);

    return panels.length ? `${label(column)}(${panels.join(',')})` : label(column);
}).join(' ');

describe('slides: upgrade', () => {

    let host: HTMLDivElement;
    let warn: MockInstance<typeof console.warn>;
    let stop: (() => void) | undefined;

    const parse = (html: string) => {

        host.innerHTML = html;

        return host.querySelector('slides')!;
    };

    const warnedSlides = () => warn.mock.calls.map((call) => call[1].id);

    beforeEach(() => {

        host = document.createElement('div');
        document.body.appendChild(host);
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {

        stop?.();
        stop = undefined;
        host.remove();
    });

    describe('case 1: misplaced, explicit horizontal', () => {

        it('moves the slide and its following siblings after its column', () => {

            const root = parse(`<slides>
                <slide horizontal id="a"><p>one</slide>
                <slide horizontal id="b">two</slide>
                <slide horizontal id="c">three</slide>
            </slides>`);

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h b:h c:h');
            expect(warnedSlides()).toEqual(['b']);
        });

        it('leaves a panel with an unclosed <p> as a new column', () => {

            const root = parse(`<slides>
                <slide horizontal id="a"><slide vertical id="a1"><p>one</slide></slide>
                <slide horizontal id="b">two</slide>
            </slides>`);

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(a1:v) b:h');
            expect(warnedSlides()).toEqual(['b']);
        });
    });

    describe('case 2: misplaced, explicit vertical', () => {

        it('moves the slide into its column after the panel that contained it', () => {

            const root = parse(`<slides>
                <slide id="a">
                    <slide vertical id="a1"><p>one</slide>
                    <slide vertical id="a2">two</slide>
                    <slide vertical id="a3">three</slide>
                </slide>
            </slides>`);

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(a1:v,a2:v,a3:v)');
            expect(warnedSlides()).toEqual(['a2']);
        });

        it('repairs an unclosed <li> directly in a column, then wraps the list', () => {

            const root = parse(`<slides>
                <slide id="a"><ul><li>one</slide>
                <slide vertical id="a1">two</slide>
            </slides>`);

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(implicit:v,a1:v)');
            expect(root.querySelector('[data-implicit] > ul')).not.toBeNull();
            expect(warnedSlides()).toEqual(['a1']);
        });
    });

    describe('carrying stops at an explicit horizontal slide', () => {

        it('keeps a carried horizontal sibling a column', () => {

            const root = parse(
                '<slides><slide id="a"><slide vertical id="a1"><p>one</slide>' +
                '<slide vertical id="a2">two</slide></slide>' +
                '<slide horizontal id="b">three</slide></slides>'
            );

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(a1:v,a2:v) b:h');
            expect(warnedSlides()).toEqual(['a2', 'b']);
        });
    });

    describe('case 3: misplaced, no axis attribute', () => {

        it('moves the slide after its nearest slide ancestor (unclosed <p> in a column)', () => {

            const root = parse(`<slides>
                <slide id="a"><p>one</slide>
                <slide id="b">two</slide>
                <slide id="c">three</slide>
            </slides>`);

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h b:h c:h');
            expect(root.querySelector('#a > p')!.textContent!.trim()).toBe('one');
            expect(warnedSlides()).toEqual(['b']);
        });

        it('moves the slide after its nearest slide ancestor (unclosed <li> in a panel)', () => {

            const root = parse(`<slides>
                <slide id="a">
                    <slide id="a1"><ul><li>one</slide>
                    <slide id="a2">two</slide>
                </slide>
            </slides>`);

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(a1:v,a2:v)');
            expect(warnedSlides()).toEqual(['a2']);
        });

        it('repairs raw HTML parsed by DOMParser', () => {

            const doc = new DOMParser().parseFromString(
                '<slides><slide id="a"><p>one</slide><slide id="b">two</slide></slides>',
                'text/html'
            );
            const root = doc.querySelector('slides')!;

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h b:h');
            expect(warnedSlides()).toEqual(['b']);
        });
    });

    describe('case 4: slide directly inside a panel', () => {

        it('moves each nested slide after its panel, keeping their order', () => {

            const root = parse(`<slides>
                <slide id="a">
                    <slide id="a1">one<slide id="x">x</slide><slide id="y">y</slide></slide>
                    <slide id="a2">two</slide>
                </slide>
            </slides>`);

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(a1:v,x:v,y:v,a2:v)');
            expect(root.querySelector('#a1')!.textContent).toBe('one');
            expect(warnedSlides()).toEqual(['x', 'y']);
        });
    });

    describe('case 5: absent axis', () => {

        it('infers the axis from the parent and writes it back without warning', () => {

            const root = parse(`<slides>
                <slide id="a"><slide id="a1">one</slide></slide>
                <slide id="b">two</slide>
            </slides>`);

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(a1:v) b:h');
            expect(warn).not.toHaveBeenCalled();
        });
    });

    describe('case 6: axis contradicts position', () => {

        it('rewrites the attribute to match the position, one warning per slide', () => {

            const root = parse(`<slides>
                <slide vertical id="a"><slide horizontal id="a1">one</slide></slide>
            </slides>`);

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(a1:v)');
            expect(root.querySelector('#a')!.hasAttribute('vertical')).toBe(false);
            expect(root.querySelector('#a1')!.hasAttribute('horizontal')).toBe(false);
            expect(warnedSlides()).toEqual(['a', 'a1']);
        });
    });

    describe('case 7: loose content before the first panel', () => {

        it('wraps it into an implicit panel and leaves later content in place', () => {

            const root = parse(
                '<slides><slide id="a">intro <em>text</em>' +
                '<slide id="a1">p1</slide>between<slide id="a2">p2</slide>after' +
                '</slide></slides>'
            );

            stop = upgradeDeck(root);

            const column = root.querySelector('#a')!;
            const implicit = column.firstElementChild!;

            expect(layout(root)).toBe('a:h(implicit:v,a1:v,a2:v)');
            expect(implicit.innerHTML).toBe('intro <em>text</em>');
            expect(column.childNodes[2]!.textContent).toBe('between');
            expect(column.lastChild!.textContent).toBe('after');
        });

        it('does not wrap whitespace or comments', () => {

            const root = parse(`<slides>
                <slide id="a">
                    <!-- speaker cue -->
                    <slide id="a1">one</slide>
                </slide>
            </slides>`);

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(a1:v)');
        });

        it('does not wrap notes, which belong to the first panel instead', () => {

            const root = parse(
                '<slides><slide id="a"><notes>Intro</notes><slide id="a1">one</slide></slide></slides>'
            );

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(a1:v)');
        });

        it('does not wrap a nested <slides> it must leave untouched', () => {

            vi.spyOn(console, 'error').mockImplementation(() => {});
            const root = parse(
                '<slides><slide id="a"><slides id="n"></slides>' +
                '<slide id="a1">one</slide></slide></slides>'
            );

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h(a1:v)');
            expect(root.querySelector('#n')!.parentElement!.id).toBe('a');
        });

        it('does not wrap a column that has no panels', () => {

            const root = parse('<slides><slide id="a">just content</slide></slides>');

            stop = upgradeDeck(root);

            expect(layout(root)).toBe('a:h');
            expect(root.querySelector('[data-implicit]')).toBeNull();
        });
    });

    describe('later and extra decks', () => {

        it('upgrades slides added to the root after the first pass', async () => {

            const root = parse('<slides><slide id="a">one</slide></slides>');

            stop = upgradeDeck(root);
            root.insertAdjacentHTML('beforeend', '<slide vertical id="b">two</slide>');
            await tick();

            expect(layout(root)).toBe('a:h b:h');
            expect(warnedSlides()).toEqual(['b']);
        });

        it('leaves a <slides> nested in the root untouched, slides included', () => {

            const error = vi.spyOn(console, 'error').mockImplementation(() => {});
            const root = parse(
                '<slides><slide id="a">one</slide>' +
                '<slides id="n"><slide id="x"><p>x<slide id="y">y</slide></slide></slides>' +
                '</slides>'
            );
            const nested = root.querySelector('#n')!;
            const before = nested.outerHTML;

            stop = upgradeDeck(root);

            expect(error).toHaveBeenCalledTimes(1);
            expect(error.mock.calls[0]![1]).toBe(nested);
            expect(nested.outerHTML).toBe(before);
            expect(layout(root)).toBe('a:h');
            expect(warn).not.toHaveBeenCalled();
        });

        it('does not carry a second <slides> opened inside an unclosed <p>', () => {

            const error = vi.spyOn(console, 'error').mockImplementation(() => {});
            const root = parse(
                '<slides><slide id="a"><p>one</slide><slide id="b">two</slide></slides>' +
                '<slides id="n"><slide id="x">x</slide></slides>'
            );
            const nested = host.querySelector('#n')!;
            const before = nested.outerHTML;

            stop = upgradeDeck(root);

            expect(nested.parentElement!.localName).toBe('p');
            expect(nested.outerHTML).toBe(before);
            expect(error.mock.calls[0]![1]).toBe(nested);
            expect(layout(root)).toBe('a:h b:h');
            expect(warnedSlides()).toEqual(['b']);
        });

        it('logs console.error for a second <slides> and leaves it untouched', () => {

            const error = vi.spyOn(console, 'error').mockImplementation(() => {});
            const root = parse(
                '<slides><slide id="a">one</slide></slides>' +
                '<slides><slide id="b">two</slide></slides>'
            );
            const extra = host.querySelectorAll('slides')[1]!;
            const before = extra.outerHTML;

            stop = upgradeDeck(root);

            expect(error).toHaveBeenCalledTimes(1);
            expect(error.mock.calls[0]![1]).toBe(extra);
            expect(extra.outerHTML).toBe(before);
            expect(layout(root)).toBe('a:h');
        });
    });
});
