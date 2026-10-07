/// <reference types="@vitest/browser-playwright" />

import type { MockInstance } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { attemptSync } from '../../../packages/utils/src/index.ts';
import type { Deck } from '../../../packages/slides/src/index.ts';

const VIEWPORT = { width: 800, height: 600 };

const DECK_HTML = `
    <slides>
        <slide horizontal id="c0">
            <slide vertical>Title</slide>
        </slide>
        <slide horizontal id="c1">
            <slide vertical id="p0">Short</slide>
            <slide vertical id="p1"><div id="tall">Tall</div></slide>
            <slide vertical id="p2">
                <p fragment id="frag">Step</p>
                <notes id="notes">Say this</notes>
            </slide>
        </slide>
    </slides>
`;

const byId = (id: string) => {

    const el = document.getElementById(id);

    if (!el) throw new Error(`#${id} not in fixture`);

    return el;
};

const deck = () => {

    const el = document.querySelector('slides');

    if (!el) throw new Error('<slides> not in fixture');

    return el;
};

const emulateReducedMotion = (value: 'reduce' | '') => cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value }]
});

const activeIds = () => Array.from(deck().querySelectorAll('[active]')).map((el) => el.id);

const isAligned = (id: string) => {

    const panel = byId(id).getBoundingClientRect();
    const view = deck().getBoundingClientRect();

    return Math.abs(panel.top - view.top) < 1 && Math.abs(panel.left - view.left) < 1;
};

const arriveAt = async (id: string) => {

    await expect.poll(() => activeIds(), { timeout: 5000 }).toEqual([id]);
    await expect.poll(() => isAligned(id), { timeout: 5000 }).toBe(true);
};

let stylesheet: HTMLStyleElement;

beforeAll(async () => {

    await page.viewport(VIEWPORT.width, VIEWPORT.height);
    stylesheet = await (window as any).__loadStylesheet('slides', 'slides.css');
    await (window as any).__loadBundle('slides');
});

afterEach(() => {

    vi.restoreAllMocks();
    history.replaceState(null, '', location.pathname + location.search);
});

afterAll(() => {

    stylesheet?.remove();
});

describe('smoke: @logosdx/slides CSS only', () => {

    const panelHeight = VIEWPORT.height;

    beforeEach(() => {

        document.body.insertAdjacentHTML('beforeend', DECK_HTML);
        byId('tall').style.height = `${panelHeight * 3}px`;
    });

    afterEach(() => {

        deck().remove();
    });

    it('fills the viewport height with the deck', () => {

        expect(deck().getBoundingClientRect().height).toBe(VIEWPORT.height);
        expect(byId('c1').clientHeight).toBe(VIEWPORT.height);
    });

    it('snaps mandatory on both axes and stops at every slide', () => {

        const deckStyle = getComputedStyle(deck());
        const columnStyle = getComputedStyle(byId('c1'));
        const panelStyle = getComputedStyle(byId('p1'));

        expect(deckStyle.scrollSnapType).toBe('x mandatory');
        expect(columnStyle.scrollSnapType).toBe('y mandatory');
        expect(columnStyle.scrollSnapStop).toBe('always');
        expect(panelStyle.scrollSnapStop).toBe('always');
    });

    it('lets a reader rest mid-way through a panel taller than the viewport', async () => {

        const column = byId('c1');
        const offPanelBoundary = panelHeight * 2.5;

        expect(byId('p1').offsetHeight).toBeGreaterThan(panelHeight);

        column.scrollTo({ top: offPanelBoundary, behavior: 'instant' });
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        expect(column.scrollTop).toBe(offPanelBoundary);
    });

    it('settles a column straddling two panels on a panel edge', async () => {

        const column = byId('c1');
        const nextPanelStartEdge = byId('p2').offsetTop - column.offsetTop;
        const tallPanelEndEdge = nextPanelStartEdge - panelHeight;
        const straddle = nextPanelStartEdge - panelHeight / 2;

        column.scrollTo({ top: straddle, behavior: 'instant' });

        await expect.poll(() => column.scrollTop)
            .toSatisfy((top: number) => top === tallPanelEndEdge || top === nextPanelStartEdge);
    });

    it('settles the deck straddling two columns on a column edge', async () => {

        const straddle = VIEWPORT.width * 0.6;

        deck().scrollTo({ left: straddle, behavior: 'instant' });

        await expect.poll(() => deck().scrollLeft)
            .toSatisfy((left: number) => left === 0 || left === VIEWPORT.width);
    });

    it('drops smooth scrolling on the deck and columns under reduced motion', async () => {

        expect(getComputedStyle(deck()).scrollBehavior).toBe('smooth');

        await emulateReducedMotion('reduce');

        try {

            expect(getComputedStyle(deck()).scrollBehavior).toBe('auto');
            expect(getComputedStyle(byId('c1')).scrollBehavior).toBe('auto');
        }
        finally {

            await emulateReducedMotion('');
        }
    });

    it('shows fragments and hides notes without JS', () => {

        expect(getComputedStyle(byId('frag')).visibility).toBe('visible');
        expect(getComputedStyle(byId('notes')).display).toBe('none');
    });

    it('hides unrevealed fragments only once the deck is marked ready', () => {

        const fragment = byId('frag');

        deck().setAttribute('data-ready', '');
        expect(getComputedStyle(fragment).visibility).toBe('hidden');

        fragment.setAttribute('revealed', '');
        expect(getComputedStyle(fragment).visibility).toBe('visible');
    });
});

const NAV_HTML = `
    <slides manual>
        <slide horizontal id="c0">
            <slide vertical id="t0">Title <button id="b0">Demo</button></slide>
        </slide>
        <slide horizontal id="c1">
            <slide vertical id="p0">Short</slide>
            <slide vertical id="p1"><div id="tall">Tall</div></slide>
            <slide vertical id="p2">End</slide>
        </slide>
        <slide horizontal id="c2">Last</slide>
    </slides>
`;

describe('smoke: @logosdx/slides navigation', () => {

    let slides: Deck;
    let readySlide: Promise<Element>;

    const overlay = (name: string) => document.querySelector(`[data-slides-overlay="${name}"]`);

    beforeEach(async () => {

        document.body.insertAdjacentHTML('beforeend', NAV_HTML);
        byId('tall').style.height = `${VIEWPORT.height * 3}px`;
        slides = new window.LogosDx.Slides.Deck();
        readySlide = new Promise((resolve) => {

            slides.on('deck:ready', ({ slide }) => resolve(slide));
        });
        await readySlide;
    });

    afterEach(() => {

        slides?.destroy();
        deck().remove();
    });

    describe('active tracking', () => {

        it('marks exactly one panel active from deck:ready on', async () => {

            expect(await readySlide).toBe(byId('t0'));
            expect(activeIds()).toEqual(['t0']);

            await userEvent.keyboard('{ArrowRight}');
            await arriveAt('p0');

            expect(activeIds()).toEqual(['p0']);
        });

        it('fires slide:leave then slide:enter once per change', async () => {

            const events: [string, string, number, number][] = [];

            for (const name of ['slide:leave', 'slide:enter'] as const) {

                slides.on(name, ({ slide, column, panel }) => {

                    events.push([name, slide.id, column, panel]);
                });
            }

            slides.nextColumn();
            await arriveAt('p0');
            slides.next();
            await arriveAt('p1');

            expect(events).toEqual([
                ['slide:leave', 't0', 0, 0],
                ['slide:enter', 'p0', 1, 0],
                ['slide:leave', 'p0', 1, 0],
                ['slide:enter', 'p1', 1, 1]
            ]);
        });

        it('stops delivery after the on() cleanup runs', async () => {

            const stopped = vi.fn();

            slides.on('slide:enter', stopped)();
            slides.nextColumn();
            await arriveAt('p0');

            expect(stopped).not.toHaveBeenCalled();
        });
    });

    describe('keys', () => {

        it('→ and ← land on the first panel of the neighboring column', async () => {

            await userEvent.keyboard('{ArrowRight}');
            await arriveAt('p0');

            slides.goTo('p2');
            await arriveAt('p2');

            await userEvent.keyboard('{ArrowRight}');
            await arriveAt('c2');

            await userEvent.keyboard('{ArrowLeft}');
            await arriveAt('p0');

            await userEvent.keyboard('{ArrowLeft}');
            await arriveAt('t0');
        });

        it('Space and Shift+Space step forward and back across columns', async () => {

            await userEvent.keyboard(' ');
            await arriveAt('p0');

            await userEvent.keyboard(' ');
            await arriveAt('p1');

            await userEvent.keyboard('{Shift>} {/Shift}');
            await arriveAt('p0');

            await userEvent.keyboard('{Shift>} {/Shift}');
            await arriveAt('t0');
        });

        it('PageDown and PageUp follow reading order across columns', async () => {

            await userEvent.keyboard('{PageDown}');
            await arriveAt('p0');

            slides.goTo('p2');
            await arriveAt('p2');

            await userEvent.keyboard('{PageDown}');
            await arriveAt('c2');

            await userEvent.keyboard('{PageUp}');
            await arriveAt('p2');
        });

        it('Home and End jump to the first and last panel', async () => {

            await userEvent.keyboard('{End}');
            await arriveAt('c2');

            await userEvent.keyboard('{Home}');
            await arriveAt('t0');
        });

        it('↓ and ↑ scroll a tall panel and move only at its edge', async () => {

            const column = byId('c1');
            const panel = byId('p1');
            const hasMoreBelow = () => (
                panel.getBoundingClientRect().bottom > column.getBoundingClientRect().bottom + 1
            );

            slides.goTo('p1');
            await arriveAt('p1');

            // Instant scrolls let each check read the position a key press left.
            await emulateReducedMotion('reduce');

            try {

                const panelTop = column.scrollTop;

                await userEvent.keyboard('{ArrowDown}');

                expect(column.scrollTop).toBeGreaterThan(panelTop);
                expect(activeIds()).toEqual(['p1']);

                await userEvent.keyboard('{ArrowUp}');

                expect(column.scrollTop).toBe(panelTop);
                expect(activeIds()).toEqual(['p1']);

                await userEvent.keyboard('{ArrowUp}');
                await arriveAt('p0');

                await userEvent.keyboard('{ArrowDown}');
                await arriveAt('p1');

                let scrolls = 0;

                while (hasMoreBelow()) {

                    const before = column.scrollTop;

                    await userEvent.keyboard('{ArrowDown}');
                    scrolls++;

                    expect(column.scrollTop).toBeGreaterThan(before);
                    expect(activeIds()).toEqual(['p1']);
                }

                expect(scrolls).toBeGreaterThan(1);

                await userEvent.keyboard('{ArrowDown}');
                await arriveAt('p2');
            }
            finally {

                await emulateReducedMotion('');
            }
        });

        it('↓ and ↑ do nothing at the column\'s last and first panel edge', async () => {

            const changes: string[] = [];

            slides.goTo('p2');
            await arriveAt('p2');
            slides.on('slide:enter', ({ slide }) => changes.push(slide.id));

            await userEvent.keyboard('{ArrowDown}');
            await userEvent.keyboard('{ArrowLeft}');
            await arriveAt('t0');
            await userEvent.keyboard('{ArrowUp}');
            await userEvent.keyboard('{ArrowRight}');
            await arriveAt('p0');

            expect(changes).toEqual(['t0', 'p0']);
        });

        it('. and B toggle the blank screen, Esc unblanks', async () => {

            await userEvent.keyboard('.');

            expect(document.elementFromPoint(VIEWPORT.width / 2, VIEWPORT.height / 2))
                .toBe(overlay('blank'));

            await userEvent.keyboard('b');
            expect(overlay('blank')).toBeNull();

            await userEvent.keyboard('B');
            expect(overlay('blank')).not.toBeNull();

            await userEvent.keyboard('{Escape}');
            expect(overlay('blank')).toBeNull();
        });

        it('? toggles the help overlay, Esc closes it', async () => {

            await userEvent.keyboard('?');
            expect(overlay('help')?.textContent).toContain('reopen');

            await userEvent.keyboard('?');
            expect(overlay('help')).toBeNull();

            await userEvent.keyboard('?');
            await userEvent.keyboard('{Escape}');
            expect(overlay('help')).toBeNull();
        });
    });

    describe('interrupted moves', () => {

        const enters: string[] = [];

        /** Past the deck's 10-frame stillness window, so a stalled move has been let go. */
        const pastStillWindow = async () => {

            for (let i = 0; i < 15; i++) await new Promise(requestAnimationFrame);
        };

        const moving = () => expect
            .poll(() => deck().scrollLeft, { timeout: 5000 })
            .toBeGreaterThan(0);

        const centerPanelId = () => document
            .elementFromPoint(VIEWPORT.width / 2, VIEWPORT.height / 2)
            ?.closest('slide')?.id;

        beforeEach(() => {

            enters.length = 0;
            slides.on('slide:enter', ({ slide }) => enters.push(slide.id));
        });

        it('lets a late ← leg never release the → move that follows', async () => {

            for (let i = 0; i < 10; i++) {

                slides.goTo('p2');
                await arriveAt('p2');
                enters.length = 0;

                await userEvent.keyboard('{ArrowLeft}');
                // Sweeps the gap between the keys across the ← move's whole flight.
                await new Promise((resolve) => setTimeout(resolve, 30 + i * 30));
                await userEvent.keyboard('{ArrowRight}');
                await arriveAt('p0');

                expect([['p0'], ['t0', 'p0']]).toContainEqual(enters);
            }
        }, 60_000);

        it('fires no enter for panels a two-leg move crosses', async () => {

            slides.goTo('p2');
            await arriveAt('p2');
            slides.goTo('t0');
            await arriveAt('t0');
            enters.length = 0;

            slides.nextColumn();
            await arriveAt('p0');
            await pastStillWindow();

            expect(enters).toEqual(['p0']);
        });

        it('lets go of a move a focus scroll pulls back to the start', async () => {

            slides.nextColumn();
            await moving();
            byId('b0').focus();
            await expect.poll(() => isAligned('t0'), { timeout: 5000 }).toBe(true);
            await pastStillWindow();
            byId('b0').blur();

            expect(activeIds()).toEqual(['t0']);

            await userEvent.keyboard('{ArrowRight}');
            await arriveAt('p0');

            expect(enters).toEqual(['p0']);
        });

        it('lets go of a move a focus in the same task cancels', async () => {

            slides.nextColumn();
            byId('b0').focus();
            await pastStillWindow();
            byId('b0').blur();
            await userEvent.keyboard('{ArrowRight}');
            await arriveAt('p0');
        });

        it('activates the center panel when a move loses its column leg', async () => {

            const column = byId('c1');

            slides.goTo('p2');
            await arriveAt('p2');
            slides.goTo('t0');
            await arriveAt('t0');

            slides.nextColumn();
            await moving();
            column.scrollTo({ top: column.scrollTop, behavior: 'instant' });

            await expect.poll(() => deck().scrollLeft, { timeout: 5000 }).toBe(VIEWPORT.width);
            await expect.poll(() => activeIds(), { timeout: 5000 }).toEqual([centerPanelId()]);

            await userEvent.keyboard('{ArrowRight}');
            await arriveAt('c2');
        });

        it('stays on the start panel when an author scroll returns there mid-move', async () => {

            slides.nextColumn();
            await moving();
            deck().scrollTo({ left: 0, behavior: 'instant' });
            await pastStillWindow();

            expect(activeIds()).toEqual(['t0']);
            expect(enters).toEqual([]);

            await userEvent.keyboard('{ArrowRight}');
            await arriveAt('p0');
        });

        it('activates where an author scroll stops a move short', async () => {

            slides.goTo('c2');
            await moving();
            deck().scrollTo({ left: VIEWPORT.width, behavior: 'smooth' });

            await expect.poll(() => activeIds(), { timeout: 5000 }).toEqual(['p0']);

            await userEvent.keyboard('{ArrowRight}');
            await arriveAt('c2');
        });

        it('enters once under reduced motion', async () => {

            await emulateReducedMotion('reduce');

            try {

                slides.nextColumn();
                await arriveAt('p0');
                await pastStillWindow();

                expect(enters).toEqual(['p0']);
            }
            finally {

                await emulateReducedMotion('');
            }
        });
    });

    it('jumps without smooth scrolling under reduced motion', async () => {

        await emulateReducedMotion('reduce');

        try {

            slides.nextColumn();

            expect(deck().scrollLeft).toBe(VIEWPORT.width);
        }
        finally {

            await emulateReducedMotion('');
        }
    });
});

const FRAGMENT_HTML = `
    <slides manual>
        <slide horizontal id="c0">
            <slide vertical id="t0">Title</slide>
        </slide>
        <slide horizontal id="c1">
            <slide vertical id="f">
                <p fragment id="f0">One</p>
                <p fragment id="f1">Two</p>
            </slide>
            <slide vertical id="e">End</slide>
        </slide>
    </slides>
`;

describe('smoke: @logosdx/slides fragments and URL', () => {

    let slides: Deck | undefined;

    const shown = (id: string) => getComputedStyle(byId(id)).visibility === 'visible';

    const start = async () => {

        slides = new window.LogosDx.Slides.Deck();
        await new Promise((resolve) => slides!.on('deck:ready', resolve));
    };

    beforeEach(() => {

        document.body.insertAdjacentHTML('beforeend', FRAGMENT_HTML);
    });

    afterEach(() => {

        slides?.destroy();
        slides = undefined;
        deck().remove();
    });

    it('reveals fragments one Space at a time and writes each step to the hash', async () => {

        await start();

        await userEvent.keyboard(' ');
        await arriveAt('f');

        expect(location.hash).toBe('#/1/0/0');
        expect([shown('f0'), shown('f1')]).toEqual([false, false]);

        const push = vi.spyOn(history, 'pushState');

        await userEvent.keyboard(' ');

        expect(location.hash).toBe('#/1/0/1');
        expect([shown('f0'), shown('f1')]).toEqual([true, false]);

        await userEvent.keyboard(' ');

        expect(location.hash).toBe('#/1/0/2');
        expect(shown('f1')).toBe(true);
        expect(push).not.toHaveBeenCalled();

        await userEvent.keyboard(' ');
        await arriveAt('e');

        expect(location.hash).toBe('#/1/1');
        expect(push).toHaveBeenCalledTimes(1);
    });

    it('returns to the prior panel on back and forward without adding entries', async () => {

        await start();

        slides!.next();
        await arriveAt('f');
        slides!.next();
        slides!.next();
        slides!.next();
        await arriveAt('e');

        const push = vi.spyOn(history, 'pushState');

        history.back();
        await arriveAt('f');

        expect(location.hash).toBe('#/1/0/2');
        expect(shown('f1')).toBe(true);

        history.forward();
        await arriveAt('e');

        expect(location.hash).toBe('#/1/1');
        expect(push).not.toHaveBeenCalled();
    });

    it('deep-links to a panel and fragment count on load', async () => {

        history.replaceState(null, '', '#/1/0/1');

        await start();

        expect(activeIds()).toEqual(['f']);
        expect(isAligned('f')).toBe(true);
        expect([shown('f0'), shown('f1')]).toEqual([true, false]);
    });
});

const NOTES_HTML = `
    <slides manual>
        <slide horizontal id="c0">
            <slide vertical id="t0">Title<notes>Open strong</notes></slide>
        </slide>
        <slide horizontal id="c1">
            <slide vertical id="f">
                <p fragment id="f0">One</p>
                <p fragment id="f1">Two</p>
                <notes>Reveal slowly</notes>
            </slide>
            <slide vertical id="e">End</slide>
        </slide>
    </slides>
`;

describe('smoke: @logosdx/slides speaker notes', () => {

    let slides: Deck;
    let open: MockInstance<typeof window.open>;

    const popup = (call: number) => {

        const pop = open.mock.results[call]?.value;

        if (!pop) throw new Error(`window.open call ${call} returned no window`);

        return pop;
    };

    const shownIn = (pop: Window, id: string) => pop.document.getElementById(id)?.textContent;

    const openNotes = async () => {

        await userEvent.keyboard('s');

        return popup(open.mock.calls.length - 1);
    };

    beforeEach(async () => {

        document.body.insertAdjacentHTML('beforeend', NOTES_HTML);
        open = vi.spyOn(window, 'open');
        slides = new window.LogosDx.Slides.Deck();
        await new Promise((resolve) => slides.on('deck:ready', resolve));
    });

    afterEach(() => {

        slides.destroy();
        deck().remove();
    });

    it('opens lx-notes on S with notes, next preview, position, and clocks', async () => {

        const pop = await openNotes();

        expect(open).toHaveBeenCalledWith('', 'lx-notes', expect.stringMatching(/^popup,/));
        expect(shownIn(pop, 'notes')).toBe('Open strong');
        expect(shownIn(pop, 'next')).toContain('One');
        expect(shownIn(pop, 'next')).not.toContain('Reveal slowly');
        expect(shownIn(pop, 'position')).toBe('Column 1 of 2 · Slide 1 of 1');
        expect(shownIn(pop, 'elapsed')).toBe('00:00:00');
        expect(shownIn(pop, 'time')).not.toBe('');

        await expect.poll(() => shownIn(pop, 'elapsed'), { timeout: 3000 }).toBe('00:00:01');
    });

    it('redraws on navigation and on each fragment step', async () => {

        const pop = await openNotes();

        await userEvent.keyboard(' ');
        await arriveAt('f');

        await expect.poll(() => shownIn(pop, 'notes')).toBe('Reveal slowly');
        expect(shownIn(pop, 'position')).toBe('Column 2 of 2 · Slide 1 of 2 · Step 0 of 2');
        expect(shownIn(pop, 'next')).toContain('End');

        await userEvent.keyboard(' ');

        expect(shownIn(pop, 'position')).toBe('Column 2 of 2 · Slide 1 of 2 · Step 1 of 2');
    });

    it('redraws when goTo or the hash changes the count without fragment events', async () => {

        const pop = await openNotes();
        const fragmentEvents = vi.fn();

        slides.next();
        await arriveAt('f');
        slides.on('fragment:show', fragmentEvents);

        slides.goTo({ column: 1, panel: 0 });

        expect(shownIn(pop, 'position')).toBe('Column 2 of 2 · Slide 1 of 2 · Step 2 of 2');

        location.hash = '#/1/0/1';

        await expect.poll(() => shownIn(pop, 'position'))
            .toBe('Column 2 of 2 · Slide 1 of 2 · Step 1 of 2');
        expect(fragmentEvents).not.toHaveBeenCalled();
    });

    it('stops writing to a reloaded popup without throwing, and S reopens it', async () => {

        const stale = await openNotes();
        const errors = vi.fn();

        window.addEventListener('error', errors);

        stale.location.reload();
        await expect.poll(() => attemptSync(() => shownIn(stale, 'notes'))[0] ?? null)
            .toBeNull();

        slides.next();
        await arriveAt('f');
        // Long enough for one clock tick to reach the stale popup.
        await new Promise((resolve) => setTimeout(resolve, 1200));

        expect(attemptSync(() => stale.document.getElementById('notes'))[0] ?? null).toBeNull();

        const fresh = await openNotes();

        window.removeEventListener('error', errors);

        expect(errors).not.toHaveBeenCalled();
        await expect.poll(() => stale.closed).toBe(true);
        expect(shownIn(fresh, 'notes')).toBe('Reveal slowly');
        expect(shownIn(fresh, 'position')).toBe('Column 2 of 2 · Slide 1 of 2 · Step 0 of 2');

        await userEvent.keyboard(' ');

        expect(shownIn(fresh, 'position')).toBe('Column 2 of 2 · Slide 1 of 2 · Step 1 of 2');
    });

    it('destroy() unbinds keys, clears active and overlays, and closes the popup', async () => {

        const pop = await openNotes();

        await userEvent.keyboard('?');
        await userEvent.keyboard('b');
        slides.destroy();

        await userEvent.keyboard('{ArrowRight}');
        await userEvent.keyboard('?');

        expect(activeIds()).toEqual([]);
        expect(deck().scrollLeft).toBe(0);
        expect(document.querySelector('[data-slides-overlay]')).toBeNull();
        await expect.poll(() => pop.closed).toBe(true);
    });
});
