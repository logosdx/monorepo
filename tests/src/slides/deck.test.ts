import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Deck } from '../../../packages/slides/src/index.ts';
import { stubDeckLayout } from './_helpers.ts';

const DECK_HTML = `
    <slides id="deck">
        <slide id="c0">loose<slide id="p0">first</slide></slide>
        <slide id="c1">second</slide>
    </slides>
`;

const NAV_HTML = `
    <slides id="deck">
        <slide id="a"><slide id="a0">a0</slide><span id="between">mid</span><slide id="a1">a1 <em id="inner">x</em></slide><span id="tail">end</span></slide>
        <slide id="b">b</slide>
        <slide id="c"><slide id="c0">c0</slide></slide>
    </slides>
    <p id="outside">not a slide</p>
`;

describe('slides: Deck', () => {

    let deck: Deck | undefined;

    const {
        watchers,
        scrollIntoView,
        byId,
        root,
        shownIds,
        activeIds,
        intersect,
        tick,
        pressKey
    } = stubDeckLayout();

    beforeEach(() => {

        document.body.innerHTML = DECK_HTML;
    });

    afterEach(() => {

        deck?.destroy();
        deck = undefined;
    });

    describe('construction', () => {

        it('defaults to the first <slides> and upgrades it', () => {

            deck = new Deck();

            expect(root().hasAttribute('data-ready')).toBe(true);
            expect(document.getElementById('c0')!.hasAttribute('horizontal')).toBe(true);
            expect(document.querySelector('#c0 > [data-implicit]')).not.toBeNull();
        });

        it('uses the explicit root over the first <slides>', () => {

            const error = vi.spyOn(console, 'error').mockImplementation(() => {});

            document.body.insertAdjacentHTML('afterbegin', '<slides id="decoy"></slides>');
            const decoy = document.getElementById('decoy')!;

            deck = new Deck(root());

            expect(root().hasAttribute('data-ready')).toBe(true);
            expect(decoy.hasAttribute('data-ready')).toBe(false);
            expect(error).toHaveBeenCalledWith(expect.any(String), decoy);
        });

        it('rejects a root that is not a <slides> element', () => {

            expect(() => new Deck(document.body)).toThrow(/<slides>/);
        });

        it('throws when the document has no <slides>', () => {

            document.body.innerHTML = '';

            expect(() => new Deck()).toThrow(/<slides>/);
        });

        it('throws when another Deck is live', () => {

            deck = new Deck();

            expect(() => new Deck()).toThrow(/already/);
        });

        it('constructs again after destroy()', () => {

            new Deck().destroy();
            deck = new Deck();

            expect(root().hasAttribute('data-ready')).toBe(true);
        });
    });

    describe('destroy', () => {

        it('removes data-ready and keeps repairs', () => {

            new Deck().destroy();

            expect(root().hasAttribute('data-ready')).toBe(false);
            expect(document.querySelector('#c0 > [data-implicit]')).not.toBeNull();
        });

        it('does not release a newer Deck when called twice', () => {

            const stale = new Deck();

            stale.destroy();
            deck = new Deck();
            stale.destroy();

            expect(root().hasAttribute('data-ready')).toBe(true);
            expect(() => new Deck()).toThrow(/already/);
        });
    });

    describe('deck:ready', () => {

        it('fires once, after construction returns, with the first panel', async () => {

            const ready = vi.fn();

            deck = new Deck();
            deck.on('deck:ready', ready);

            expect(ready).not.toHaveBeenCalled();

            await Promise.resolve();

            expect(ready).toHaveBeenCalledTimes(1);
            expect(ready.mock.calls[0]![0]).toEqual({
                slide: document.querySelector('#c0 > [data-implicit]')
            });
        });

        it('stops delivering after the on() cleanup runs', async () => {

            const ready = vi.fn();

            deck = new Deck();
            deck.on('deck:ready', ready)();
            await Promise.resolve();

            expect(ready).not.toHaveBeenCalled();
        });

        it('does not fire when destroy() runs before it', async () => {

            const ready = vi.fn();

            deck = new Deck();
            deck.on('deck:ready', ready);
            deck.destroy();
            await Promise.resolve();

            expect(ready).not.toHaveBeenCalled();
        });

        it('does not fire for a deck with no slides', async () => {

            const ready = vi.fn();

            document.body.innerHTML = '<slides></slides>';
            deck = new Deck();
            deck.on('deck:ready', ready);
            await Promise.resolve();

            expect(ready).not.toHaveBeenCalled();
        });

        it('uses a column as the panel when it has no vertical children', async () => {

            const ready = vi.fn();

            document.body.innerHTML = '<slides><slide id="only">one</slide></slides>';
            deck = new Deck();
            deck.on('deck:ready', ready);
            await Promise.resolve();

            expect(ready.mock.calls[0]![0].slide).toBe(document.getElementById('only'));
        });
    });

    describe('active tracking', () => {

        beforeEach(() => {

            document.body.innerHTML = NAV_HTML;
        });

        it('marks the first panel active before deck:ready fires', async () => {

            const ready = vi.fn();

            deck = new Deck();
            deck.on('deck:ready', ready);

            expect(activeIds()).toEqual(['a0']);

            await Promise.resolve();

            expect(ready.mock.calls[0]![0]).toEqual({ slide: byId('a0') });
        });

        it('fires slide:leave then slide:enter once when another panel takes the center', () => {

            const events: unknown[] = [];

            deck = new Deck();
            deck.on('slide:leave', (change) => events.push(['leave', change]));
            deck.on('slide:enter', (change) => events.push(['enter', change]));

            intersect('b', true);
            intersect('a0', false);

            expect(activeIds()).toEqual(['b']);
            expect(events).toEqual([
                ['leave', { slide: byId('a0'), column: 0, panel: 0 }],
                ['enter', { slide: byId('b'), column: 1, panel: 0 }]
            ]);
        });

        it('keeps the active panel while it still holds the center', () => {

            const enter = vi.fn();

            deck = new Deck();
            deck.on('slide:enter', enter);

            intersect('a0', true);
            intersect('a1', true);

            expect(activeIds()).toEqual(['a0']);
            expect(enter).not.toHaveBeenCalled();

            intersect('a1', false);

            expect(activeIds()).toEqual(['a0']);
        });

        it('settles on the panel left holding the center after a brief overlap', () => {

            deck = new Deck();

            intersect('a1', true);
            intersect('a0', false);
            intersect('a0', true);
            intersect('a1', false);

            expect(activeIds()).toEqual(['a0']);
        });

        it('skips panels crossed on the way to a navigation target', () => {

            const enter = vi.fn();

            deck = new Deck();
            deck.on('slide:enter', enter);
            deck.goTo('c0');

            intersect('b', true);
            intersect('a0', false);

            expect(activeIds()).toEqual(['a0']);

            intersect('c0', true);
            intersect('b', false);

            expect(activeIds()).toEqual(['c0']);
            expect(enter).toHaveBeenCalledTimes(1);
        });

        it.each(['wheel', 'touchstart', 'pointerdown'])(
            'lets %s on the deck interrupt a move and activate the panel in the center',
            (type) => {

                deck = new Deck();
                deck.goTo('c0');

                intersect('b', true);
                intersect('a0', false);
                root().dispatchEvent(new Event(type, { bubbles: true }));

                expect(activeIds()).toEqual(['b']);
            }
        );

        it('tracks a panel added after construction when the reader scrolls onto it', async () => {

            deck = new Deck();
            root().insertAdjacentHTML('beforeend', '<slide id="d"><slide id="d0">d0</slide></slide>');
            await tick();

            intersect('d0', true);
            intersect('a0', false);

            expect(activeIds()).toEqual(['d0']);
        });

        it('moves to a panel added after construction', async () => {

            deck = new Deck();
            root().insertAdjacentHTML('beforeend', '<slide id="d">d</slide>');
            await tick();

            deck.goTo('d');
            intersect('d', true);
            intersect('a0', false);

            expect(shownIds()).toEqual(['d']);
            expect(activeIds()).toEqual(['d']);
        });

        it('activates the first panel to appear in an empty deck and fires deck:ready once', async () => {

            const ready = vi.fn();

            document.body.innerHTML = '<slides id="deck"></slides>';
            deck = new Deck();
            deck.on('deck:ready', ready);
            await tick();

            expect(ready).not.toHaveBeenCalled();

            root().insertAdjacentHTML('beforeend', '<slide id="x">x</slide>');
            await tick();
            root().insertAdjacentHTML('beforeend', '<slide id="y">y</slide>');
            await tick();

            expect(activeIds()).toEqual(['x']);
            expect(ready).toHaveBeenCalledTimes(1);
            expect(ready.mock.calls[0]![0]).toEqual({ slide: byId('x') });
        });

        it('never activates a single-panel column once it gains panels', async () => {

            deck = new Deck();
            byId('b').insertAdjacentHTML('beforeend', '<slide id="b0">b0</slide>');
            await tick();

            intersect('b', true);
            intersect('a0', false);

            expect(activeIds()).toEqual(['a0']);

            intersect('b0', true);

            expect(activeIds()).toEqual(['b0']);
        });

        it('skips slide:leave for an active panel removed from the document', () => {

            const leave = vi.fn();
            const enter = vi.fn();

            deck = new Deck();
            deck.on('slide:leave', leave);
            deck.on('slide:enter', enter);

            const removed = byId('a0');

            removed.remove();

            expect(() => {

                intersect(removed, false);
                intersect('a1', true);
            }).not.toThrow();
            expect(leave).not.toHaveBeenCalled();
            expect(enter.mock.calls[0]![0]).toEqual({ slide: byId('a1'), column: 0, panel: 0 });
        });

        describe('stalled move', () => {

            const STILL_FRAMES = 10;

            let enter: Mock<(change: Deck.SlideChange) => void>;

            const advance = (count: number) => {

                for (let i = 0; i < count; i++) vi.advanceTimersToNextFrame();
            };

            const scrollLeft = () => vi.spyOn(root(), 'scrollLeft', 'get');

            beforeEach(() => {

                vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
                enter = vi.fn();
                deck = new Deck();
                deck.on('slide:enter', enter);
                deck.goTo('b');
                intersect('a1', true);
                intersect('a0', false);
            });

            afterEach(() => {

                vi.useRealTimers();
            });

            it('releases to the center panel once the scrollers hold still for the window', () => {

                const push = vi.spyOn(history, 'pushState');

                scrollLeft()
                    .mockReturnValueOnce(100)
                    .mockReturnValueOnce(200)
                    .mockReturnValue(300);

                advance(2 + STILL_FRAMES);

                expect(activeIds()).toEqual(['a0']);

                advance(1);

                expect(activeIds()).toEqual(['a1']);
                expect(enter).toHaveBeenCalledTimes(1);
                expect(push).toHaveBeenCalledTimes(1);
            });

            it('releases a move that never moved after the same window', () => {

                advance(STILL_FRAMES);

                expect(activeIds()).toEqual(['a0']);

                advance(1);

                expect(activeIds()).toEqual(['a1']);
            });

            it('keeps a move that keeps moving, and the next key steps from its target', () => {

                let left = 0;

                scrollLeft().mockImplementation(() => left += 10);
                advance(3 * STILL_FRAMES);

                expect(activeIds()).toEqual(['a0']);

                pressKey('PageDown');

                expect(shownIds()).toEqual(['b', 'c0']);
            });

            it('keeps a move that stalls for less than the window, then moves', () => {

                let reads = 0;

                scrollLeft().mockImplementation(() => (reads++ < STILL_FRAMES ? 0 : reads));
                advance(3 * STILL_FRAMES);

                expect(activeIds()).toEqual(['a0']);
                expect(enter).not.toHaveBeenCalled();
            });

            it('restarts the window on one loop when a new move replaces it', () => {

                advance(STILL_FRAMES - 1);
                deck!.goTo('c0');

                expect(vi.getTimerCount()).toBeLessThanOrEqual(1);

                advance(STILL_FRAMES);

                expect(activeIds()).toEqual(['a0']);
                expect(vi.getTimerCount()).toBeLessThanOrEqual(1);

                advance(1);

                expect(activeIds()).toEqual(['a1']);
            });

            it('stops watching once the target arrives', () => {

                intersect('b', true);
                intersect('a1', false);
                advance(1);

                expect(activeIds()).toEqual(['b']);
                expect(vi.getTimerCount()).toBe(0);
            });

            it('stops watching without activating anything after destroy()', () => {

                deck!.destroy();
                advance(1);

                expect(enter).not.toHaveBeenCalled();
                expect(vi.getTimerCount()).toBe(0);
            });

            it('settles on the center panel one frame after the target leaves the deck', () => {

                byId('b').remove();
                advance(1);

                expect(activeIds()).toEqual(['a1']);
            });

            it('follows a hand-off to the first panel a target column gains', async () => {

                byId('b').textContent = '';
                deck!.goTo('b');
                byId('b').insertAdjacentHTML('beforeend', '<slide id="b0">b0</slide>');
                await tick();

                advance(STILL_FRAMES + 1);

                expect(activeIds()).toEqual(['a1']);
                expect(vi.getTimerCount()).toBe(0);
            });

            it('ignores scrollend', () => {

                root().dispatchEvent(new Event('scrollend'));
                byId('c').dispatchEvent(new Event('scrollend'));

                expect(activeIds()).toEqual(['a0']);
                expect(enter).not.toHaveBeenCalled();
            });
        });

        it('hands a move to a single-panel column on to the first panel it gains', async () => {

            byId('b').textContent = '';
            deck = new Deck();
            deck.goTo('b');
            byId('b').insertAdjacentHTML(
                'beforeend',
                '<slide id="b0"><p fragment revealed id="bf">b0</p></slide>'
            );
            await tick();

            intersect('b0', true);
            intersect('a0', false);

            expect(activeIds()).toEqual(['b0']);
            expect(byId('bf').hasAttribute('revealed')).toBe(false);

            pressKey('PageUp');

            expect(shownIds()).toEqual(['b', 'a1']);
        });

        it('hands a move whose target is removed on to its column\'s first panel', () => {

            const enter = vi.fn();

            byId('c').insertAdjacentHTML('beforeend', '<slide id="c1">c1</slide>');
            deck = new Deck();
            deck.on('slide:enter', enter);
            deck.goTo('c1');
            byId('c1').remove();

            intersect('b', true);
            intersect('a0', false);

            expect(activeIds()).toEqual(['a0']);
            expect(enter).not.toHaveBeenCalled();

            intersect('c0', true);
            intersect('b', false);

            expect(activeIds()).toEqual(['c0']);
            expect(enter).toHaveBeenCalledTimes(1);
        });

        it('ends a move handed off to the panel already active without any event', () => {

            const events = vi.fn();

            byId('a0').insertAdjacentHTML(
                'beforeend',
                '<p fragment id="f1">one</p><p fragment id="f2">two</p>'
            );
            deck = new Deck();
            deck.next();

            for (const name of ['slide:leave', 'slide:enter', 'fragment:show', 'fragment:hide']) {

                deck.on(name as keyof Deck.EventMap, events);
            }

            deck.goTo('a1');
            byId('a1').remove();
            intersect('a0', true);

            expect(activeIds()).toEqual(['a0']);
            expect(byId('f1').hasAttribute('revealed')).toBe(true);
            expect(byId('f2').hasAttribute('revealed')).toBe(false);
            expect(events).not.toHaveBeenCalled();
        });

        it('hands a move to a column left without panels, as its own panel', () => {

            deck = new Deck();
            deck.goTo('c0');
            byId('c0').remove();

            intersect('b', true);
            intersect('a0', false);

            expect(activeIds()).toEqual(['a0']);

            intersect('c', true);
            intersect('b', false);

            expect(activeIds()).toEqual(['c']);
        });

        it('releases a move whose target column is removed before it arrives', () => {

            deck = new Deck();
            deck.goTo('c0');
            byId('c').remove();

            intersect('b', true);
            intersect('a0', false);

            expect(activeIds()).toEqual(['b']);
        });

        it('drops active and stops tracking on destroy()', () => {

            deck = new Deck();
            deck.destroy();

            expect(activeIds()).toEqual([]);
            expect(watchers.size).toBe(0);
        });
    });

    describe('navigation', () => {

        beforeEach(() => {

            document.body.innerHTML = NAV_HTML;
            deck = new Deck();
        });

        it('next() walks panels in reading order, crossing into the next column', () => {

            deck!.next();
            intersect('a1', true);
            intersect('a0', false);
            deck!.next();

            expect(shownIds()).toEqual(['a1', 'b']);
        });

        it('steps from the pending target when pressed again before arriving', () => {

            deck!.next();
            deck!.next();
            deck!.nextColumn();

            expect(shownIds()).toEqual(['a1', 'b', 'c0']);
        });

        it('prev() is a no-op at the first panel and next() at the last', () => {

            deck!.prev();
            intersect('c0', true);
            intersect('a0', false);
            deck!.next();

            expect(scrollIntoView).not.toHaveBeenCalled();
        });

        it('nextColumn() and prevColumn() land on the first panel, no-op past the ends', () => {

            deck!.prevColumn();
            intersect('c0', true);
            intersect('a0', false);
            deck!.nextColumn();

            expect(scrollIntoView).not.toHaveBeenCalled();

            intersect('a1', true);
            intersect('c0', false);
            deck!.nextColumn();
            intersect('b', true);
            intersect('a1', false);
            deck!.prevColumn();

            expect(shownIds()).toEqual(['b', 'a0']);
        });

        it('goTo() resolves an id to the panel containing that element', () => {

            deck!.goTo('inner');
            deck!.goTo('c');
            deck!.goTo('b');

            expect(shownIds()).toEqual(['a1', 'c0', 'b']);
        });

        it('goTo() resolves an element between panels to the panel before it', () => {

            deck!.goTo('between');
            deck!.goTo('tail');

            expect(shownIds()).toEqual(['a0', 'a1']);
        });

        it('goTo() moves to a position', () => {

            deck!.goTo({ column: 0, panel: 1 });
            deck!.goTo({ column: 1, panel: 0 });

            expect(shownIds()).toEqual(['a1', 'b']);
        });

        it.each<[string, Deck.Target]>([
            ['an unknown id', 'missing'],
            ['an id outside the deck', 'outside'],
            ['a column past the end', { column: 3, panel: 0 }],
            ['a panel past the end', { column: 1, panel: 1 }],
            ['a negative index', { column: -1, panel: 0 }],
            ['a fractional index', { column: 0.5, panel: 0 }]
        ])('goTo() throws on %s', (_, target) => {

            expect(() => deck!.goTo(target)).toThrow(/@logosdx\/slides/);
            expect(scrollIntoView).not.toHaveBeenCalled();
        });
    });

    describe('keys and overlays', () => {

        const overlay = (name: string) => document.querySelector(`[data-slides-overlay="${name}"]`);

        beforeEach(() => {

            document.body.innerHTML = NAV_HTML;
            deck = new Deck();
        });

        it('runs the mapped action and claims the key from the browser', () => {

            const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });

            document.dispatchEvent(event);

            expect(shownIds()).toEqual(['b']);
            expect(event.defaultPrevented).toBe(true);
        });

        it('leaves keys typed into a guarded control alone', () => {

            document.body.insertAdjacentHTML('beforeend', '<input id="field">');
            pressKey('ArrowRight', byId('field'));

            expect(scrollIntoView).not.toHaveBeenCalled();
        });

        it('toggles the help overlay, which says S reopens notes', () => {

            pressKey('?');

            const notesRow = Array.from(overlay('help')!.querySelectorAll('tr'))
                .find((row) => row.querySelector('kbd')?.textContent === 'S');

            expect(notesRow?.textContent).toMatch(/reopen/);

            pressKey('?');

            expect(overlay('help')).toBeNull();
        });

        it('closes help before unblanking on Escape', () => {

            pressKey('.');
            pressKey('?');
            pressKey('Escape');

            expect(overlay('help')).toBeNull();
            expect(overlay('blank')).not.toBeNull();

            pressKey('Escape');

            expect(overlay('blank')).toBeNull();
        });

        it('removes overlays and ignores keys after destroy()', () => {

            pressKey('b');
            pressKey('?');
            deck!.destroy();
            pressKey('ArrowRight');
            pressKey('.');

            expect(overlay('help')).toBeNull();
            expect(overlay('blank')).toBeNull();
            expect(scrollIntoView).not.toHaveBeenCalled();
        });
    });

    describe('ESM import', () => {

        it.each([
            ['with a <slides>', DECK_HTML],
            ['without a <slides>', '<main>page</main>']
        ])('creates no deck, attaches no listeners, and mutates no DOM %s', async (_, html) => {

            document.body.innerHTML = html;

            const before = document.documentElement.outerHTML;
            const docListen = vi.spyOn(document, 'addEventListener');
            const winListen = vi.spyOn(window, 'addEventListener');

            vi.resetModules();
            const fresh = await import('../../../packages/slides/src/index.ts');

            expect(document.documentElement.outerHTML).toBe(before);
            expect(docListen).not.toHaveBeenCalled();
            expect(winListen).not.toHaveBeenCalled();
            expect(fresh.Deck).toBeTypeOf('function');
        });
    });
});
