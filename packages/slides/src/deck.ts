import { observe, on, watchVisibility } from '@logosdx/dom';
import { ObserverEngine } from '@logosdx/observer';
import { assert, attempt } from '@logosdx/utils';

import './types.ts';
import {
    fragmentsOf,
    revealedCount,
    revealFragments,
    stepFragment,
    type FragmentNotify
} from './fragments.ts';
import { isGuardedTarget, keyAction, type KeyAction } from './keys.ts';
import { NotesWindow, type NotesState } from './notes.ts';
import { createOverlay, type OverlayName } from './overlays.ts';
import { DECK, SLIDE, slideChildren, upgradeDeck } from './upgrade.ts';
import { formatHash, parseHash } from './url.ts';

/** A fifth of the previous view stays on screen so the reader keeps their place. */
const SCROLL_STEP = 0.8;

/** Sub-pixel layout leaves a snapped panel edge a fraction off the column edge. */
const EDGE_TOLERANCE = 1;

/** A panel and how many of its fragments to show on arrival. */
interface Landing {
    panel: Element;
    reveal: number;
}

/** `location.hash` reads '' both with no `#` and with a bare `#`, which mean different things. */
const currentHash = () => location.hash || (location.href.endsWith('#') ? '#' : '');

/** Margin over measured smooth-scroll stalls; see docs/design/slides.md. */
const STILL_FRAMES = 10;

const panelsOf = (column: Element): [Element, ...Element[]] => {

    const [first, ...rest] = slideChildren(column);

    return first ? [first, ...rest] : [column];
};

function overflowPast(panel: Element, column: Element, direction: 1 | -1): number {

    if (panel === column) {

        return direction > 0
            ? column.scrollHeight - column.clientHeight - column.scrollTop
            : column.scrollTop;
    }

    const view = column.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();

    return direction > 0 ? rect.bottom - view.bottom : view.top - rect.top;
}

/**
 * Coordinates the single `<slides>` deck in a document. One deck owns the
 * viewport, the keys, and the URL hash, so only one `Deck` may be live at
 * a time. Importing this module never creates one.
 *
 * @example
 *
 *     const deck = new Deck();
 *
 *     deck.on('deck:ready', ({ slide }) => console.log('starting at', slide));
 *
 *     // later, before building a new deck
 *     deck.destroy();
 */
export class Deck {

    static #live: Deck | null = null;

    #root: Element;
    #events = new ObserverEngine<Deck.EventMap>();
    #bindings = new AbortController();
    #stopUpgrade: () => void;
    #destroyed = false;
    #active: Element | null = null;
    #moveTarget: Element | null = null;
    #moveColumn: Element | null = null;
    #watching = false;
    #stillFrames = 0;
    #lastOffsets: [left: number, top: number] | null = null;
    #centered = new Set<Element>();
    #overlays = new Map<OverlayName, HTMLElement>();
    #notes = new NotesWindow(() => this.#notesState());
    #notify: FragmentNotify = (event, change) => this.#events.emit(event, change);

    #actions: Record<KeyAction, () => void> = {
        nextColumn: () => this.nextColumn(),
        prevColumn: () => this.prevColumn(),
        down: () => this.#scrollOrStep(1),
        up: () => this.#scrollOrStep(-1),
        next: () => this.next(),
        prev: () => this.prev(),
        nextPanel: () => this.#stepPanel(1),
        prevPanel: () => this.#stepPanel(-1),
        first: () => this.#show(this.#panels().at(0)),
        last: () => this.#show(this.#panels().at(-1)),
        notes: () => this.#notes.open(),
        fullscreen: () => void this.#toggleFullscreen(),
        blank: () => this.#toggleOverlay('blank'),
        help: () => this.#toggleOverlay('help'),
        dismiss: () => this.#dismiss()
    };

    /**
     * @param root the `<slides>` element; defaults to the first in the document
     * @throws when another `Deck` is live, no `<slides>` exists, or `root`
     * is not a `<slides>` element
     */
    constructor(root?: Element) {

        const deckRoot = root ?? document.querySelector(DECK);
        const { signal } = this.#bindings;

        assert(!Deck.#live, '@logosdx/slides: a Deck is already live; destroy() it first');

        if (!deckRoot) {

            throw new Error('@logosdx/slides: no <slides> element in the document');
        }

        assert(deckRoot.localName === DECK, '@logosdx/slides: root must be a <slides> element');

        this.#root = deckRoot;
        this.#stopUpgrade = upgradeDeck(deckRoot);

        observe(SLIDE, (slide) => this.#watch(slide), { root: deckRoot, signal });
        on(deckRoot.ownerDocument, 'keydown', (event) => this.#onKey(event), { signal });
        on(deckRoot, ['wheel', 'touchstart', 'pointerdown'], () => this.#releaseMove(), {
            signal,
            passive: true
        });
        on(window, 'hashchange', () => this.#onHashChange(), { signal });

        deckRoot.setAttribute('data-ready', '');
        Deck.#live = this;
    }

    /**
     * Advances one step: the panel's next fragment, else the next panel in
     * reading order, crossing into the next column after a column's last
     * panel. No-op at the end.
     *
     * @example
     *
     *     clicker.addEventListener('click', () => deck.next());
     */
    next(): void {

        this.#step(1);
    }

    /**
     * Retreats one step; the mirror of `next()`, re-hiding the last revealed
     * fragment before leaving the panel. No-op at the start.
     *
     * @example
     *
     *     backButton.addEventListener('click', () => deck.prev());
     */
    prev(): void {

        this.#step(-1);
    }

    /**
     * Moves to the first panel of the next column, skipping the rest of the
     * current one. No-op on the last column.
     *
     * @example
     *
     *     skipSection.addEventListener('click', () => deck.nextColumn());
     */
    nextColumn(): void {

        this.#stepColumn(1);
    }

    /**
     * Moves to the first panel of the previous column. No-op on the first.
     *
     * @example
     *
     *     backSection.addEventListener('click', () => deck.prevColumn());
     */
    prevColumn(): void {

        this.#stepColumn(-1);
    }

    /**
     * Moves to a panel with all its fragments shown, or `fragment` of them.
     * An id resolves to the panel containing that element, so a link can
     * target a heading or figure inside a slide.
     *
     * @throws when the id matches nothing in the deck or the position or
     * fragment count is out of range
     *
     * @example
     *
     *     deck.goTo('pricing-table');
     *     deck.goTo({ column: 2, panel: 0, fragment: 1 });
     */
    goTo(target: Deck.Target): void {

        const landing = this.#landingFor(target);

        if (!landing) {

            throw typeof target === 'string'
                ? new Error(`@logosdx/slides: no slide contains #${target}`)
                : new RangeError(`@logosdx/slides: no slide at ${formatHash(target)}`);
        }

        const isFragmentStep = typeof target !== 'string' && target.fragment !== undefined;

        this.#show(landing.panel, landing.reveal, isFragmentStep ? this.#notify : undefined);
    }

    /**
     * Subscribes to a deck event. Subscribe right after construction to
     * receive `deck:ready`, which fires asynchronously.
     *
     * @returns cleanup that stops delivery
     *
     * @example
     *
     *     const stop = deck.on('slide:enter', ({ column, panel }) => {
     *         progress.textContent = `${column + 1}.${panel + 1}`;
     *     });
     *
     *     stop();
     */
    on<E extends Deck.Event>(event: E, listener: Deck.Listener<E>): () => void {

        return this.#events.on(event, listener);
    }

    /**
     * Removes listeners, key bindings, overlays, `active`, and `data-ready`,
     * closes the notes popup, and releases the singleton. Repairs and
     * implicit panels stay in place.
     */
    destroy(): void {

        if (this.#destroyed) return;

        this.#destroyed = true;
        this.#bindings.abort();
        this.#stopUpgrade();
        this.#events.clear();

        for (const overlay of this.#overlays.values()) overlay.remove();

        this.#overlays.clear();
        this.#notes.close();
        this.#active?.removeAttribute('active');
        this.#active = null;
        this.#moveTarget = null;
        this.#moveColumn = null;
        this.#centered.clear();
        this.#root.removeAttribute('data-ready');
        Deck.#live = null;
    }

    #columns(): Element[] {

        return slideChildren(this.#root);
    }

    #panels(): Element[] {

        return this.#columns().flatMap(panelsOf);
    }

    #columnOf(panel: Element): Element {

        const parent = panel.parentElement;

        return parent && parent !== this.#root ? parent : panel;
    }

    #positionOf(panel: Element): Deck.SlideChange {

        const column = this.#columnOf(panel);

        return {
            slide: panel,
            column: this.#columns().indexOf(column),
            panel: panelsOf(column).indexOf(panel)
        };
    }

    #panelContaining(id: string): Element | null {

        const element = this.#root.ownerDocument.getElementById(id);
        const column = element && this.#columns().find((col) => col.contains(element));

        if (!element || !column) return null;

        const panels = panelsOf(column);
        const precedes = (panel: Element) => (
            !!(panel.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
        );

        return panels.find((panel) => panel.contains(element)) ??
            panels.findLast(precedes) ??
            panels[0];
    }

    #panelAt({ column, panel }: Deck.Position): Element | null {

        const columnEl = this.#columns()[column];

        return (columnEl && panelsOf(columnEl)[panel]) ?? null;
    }

    #landingFor(target: Deck.Target): Landing | null {

        if (typeof target === 'string') {

            const panel = this.#panelContaining(target);

            return panel && { panel, reveal: Infinity };
        }

        const panel = this.#panelAt(target);
        const { fragment } = target;

        if (!panel) return null;

        const inRange = fragment === undefined || (
            Number.isInteger(fragment) && fragment >= 0 && fragment <= fragmentsOf(panel).length
        );

        return inRange ? { panel, reveal: fragment ?? Infinity } : null;
    }

    /** An empty hash is the deck's start, so browser back can return to it. */
    #hashLanding(hash: string): Landing | null {

        if (!hash) {

            const first = this.#panels()[0];

            return first ? { panel: first, reveal: 0 } : null;
        }

        const target = parseHash(hash);

        return target === null ? null : this.#landingFor(target);
    }

    /** A positional hash that misses is a broken link; an unmatched id may be any anchor. */
    #readHash(): Landing | null {

        const hash = currentHash();
        const landing = this.#hashLanding(hash);

        if (!landing && hash.startsWith('#/')) {

            console.warn(`@logosdx/slides: no slide at ${hash}`);
        }

        return landing;
    }

    /** Arrives without smooth scrolling so a deep link does not animate across the deck. */
    #land(): void {

        const landing = currentHash() ? this.#readHash() : null;
        const panel = landing?.panel ?? this.#active;

        if (!panel) return;

        if (landing) {

            this.#active?.removeAttribute('active');
            panel.setAttribute('active', '');
            this.#active = panel;
            panel.scrollIntoView({ block: 'start', inline: 'start', behavior: 'instant' });
        }

        revealFragments(panel, landing?.reveal ?? 0);
        this.#notes.draw();
    }

    #onHashChange(): void {

        const landing = this.#readHash();

        if (landing) this.#show(landing.panel, landing.reveal);
    }

    #writeHash(panel: Element, method: 'pushState' | 'replaceState'): void {

        const { column, panel: index } = this.#positionOf(panel);
        const position = { column, panel: index };
        const hash = fragmentsOf(panel).length
            ? formatHash({ ...position, fragment: revealedCount(panel) })
            : formatHash(position);

        history[method](null, '', hash);
    }

    /**
     * The CSS `scroll-behavior` decides smoothness, reduced motion included. A move enters
     * its target at once so fragments are set as it scrolls in; `reveal` overrides direction.
     *
     * @param notify given only when changing the active panel's count is a fragment step
     */
    #show(panel: Element | undefined, reveal?: number, notify?: FragmentNotify): void {

        if (!panel) return;

        if (panel !== this.#active) {

            this.#moveTarget = panel;
            this.#moveColumn = this.#columnOf(panel);
            this.#stillFrames = 0;
            this.#lastOffsets = null;
            this.#enter(panel, reveal);
            this.#watchMove();
        }
        else {

            this.#moveTarget = null;

            if (reveal !== undefined) {

                revealFragments(panel, reveal, notify);
                this.#writeHash(panel, 'replaceState');
                this.#notes.draw();
            }
        }

        panel.scrollIntoView({ block: 'start', inline: 'start' });
    }

    #enter(panel: Element, reveal?: number): void {

        const panels = this.#panels();
        const from = this.#active ? panels.indexOf(this.#active) : -1;
        const forwards = panels.indexOf(panel) > from;

        revealFragments(panel, reveal ?? (forwards ? 0 : Infinity));
    }

    /** Where the deck is going, so a second key press mid-scroll steps on from there. */
    #origin(): Element | null {

        return this.#resolveMoveTarget() ?? this.#active;
    }

    /**
     * Slides can change mid-move: a target that is no longer a panel hands off
     * to its column's first panel, and a target whose column left the deck is dropped.
     * A hand-off to the active panel ends the move where it is.
     */
    #resolveMoveTarget(): Element | null {

        const target = this.#moveTarget;

        if (!target || this.#panels().includes(target)) return target;

        const column = this.#moveColumn;
        const handoff = column && this.#columns().includes(column) ? panelsOf(column)[0] : null;

        if (handoff === this.#active) {

            this.#moveTarget = null;

            return null;
        }

        if (handoff) this.#enter(handoff);

        this.#moveTarget = handoff;

        return handoff;
    }

    #step(direction: 1 | -1): void {

        const origin = this.#origin();

        if (!origin) return;

        if (!stepFragment(origin, direction, this.#notify)) {

            this.#stepPanel(direction);

            return;
        }

        // A pending move writes its own entry and redraws the notes when it arrives.
        if (origin !== this.#active) return;

        this.#writeHash(origin, 'replaceState');
        this.#notes.draw();
    }

    #stepPanel(direction: 1 | -1): void {

        const panels = this.#panels();
        const origin = this.#origin();

        if (!origin) return;

        this.#show(panels[panels.indexOf(origin) + direction]);
    }

    #stepColumn(direction: 1 | -1): void {

        const columns = this.#columns();
        const origin = this.#origin();

        if (!origin) return;

        const column = columns[columns.indexOf(this.#columnOf(origin)) + direction];

        if (column) this.#show(panelsOf(column)[0]);
    }

    #scrollOrStep(direction: 1 | -1): void {

        const origin = this.#origin();

        if (!origin) return;

        const column = this.#columnOf(origin);
        const overflow = origin === this.#active ? overflowPast(origin, column, direction) : 0;

        if (overflow > EDGE_TOLERANCE) {

            const distance = Math.min(overflow, column.clientHeight * SCROLL_STEP);

            column.scrollBy({ top: direction * distance });

            return;
        }

        const panels = panelsOf(column);

        this.#show(panels[panels.indexOf(origin) + direction]);
    }

    /** Every slide is watched because a column stops or starts being a panel as slides come and go. */
    #watch(slide: Element): void {

        // Shrinking the root to the deck's center point picks the panel
        // being presented, however tall it is.
        watchVisibility(slide, (entry) => this.#track(entry), {
            root: this.#root,
            rootMargin: '-50%',
            signal: this.#bindings.signal
        });

        if (this.#active || !this.#panels().includes(slide)) return;

        this.#active = slide;
        slide.setAttribute('active', '');
        this.#land();

        // Deferred so `deck.on()` after `new Deck()` hears it; destroy() may run first.
        queueMicrotask(() => {

            if (this.#active) this.#events.emit('deck:ready', { slide: this.#active });
        });
    }

    #track(entry: IntersectionObserverEntry): void {

        if (entry.isIntersecting) this.#centered.add(entry.target);
        else this.#centered.delete(entry.target);

        this.#settle();
    }

    /**
     * A move scrolls past other panels, so only its target may activate. Otherwise
     * the active panel holds until it leaves the center, which two can share mid-scroll.
     */
    #settle(): void {

        const panels = this.#panels();
        const centered = [...this.#centered].filter((slide) => panels.includes(slide));

        const target = this.#resolveMoveTarget();

        if (target) {

            if (!centered.includes(target)) return;

            this.#activate(target);
            this.#moveTarget = null;

            return;
        }

        const [center] = centered;

        if (!center || (this.#active && centered.includes(this.#active))) return;

        this.#enter(center);
        this.#activate(center);
    }

    #watchMove(): void {

        if (this.#watching) return;

        this.#watching = true;
        requestAnimationFrame(() => this.#tick());
    }

    /**
     * Focus, find-in-page, an author `scrollTo`, or a scrollbar drag can stop a move short,
     * so a move whose scrollers hold still with its target off center lets go.
     */
    #tick(): void {

        if (this.#destroyed) {

            this.#watching = false;

            return;
        }

        const hadTarget = this.#moveTarget !== null;
        const target = this.#resolveMoveTarget();

        if (!target) {

            this.#watching = false;

            if (hadTarget) this.#settle();

            return;
        }

        const offsets: [number, number] = [
            this.#root.scrollLeft,
            this.#columnOf(target).scrollTop
        ];
        const last = this.#lastOffsets;

        if (last && last[0] === offsets[0] && last[1] === offsets[1]) {

            this.#stillFrames++;
        }
        else {

            this.#lastOffsets = offsets;
            this.#stillFrames = 0;
        }

        if (this.#stillFrames < STILL_FRAMES) {

            requestAnimationFrame(() => this.#tick());

            return;
        }

        this.#watching = false;

        if (!this.#centered.has(target)) this.#moveTarget = null;

        this.#settle();
    }

    /** The reader took over the scroll, so the move's target may never arrive. */
    #releaseMove(): void {

        this.#moveTarget = null;
        this.#settle();
    }

    #activate(panel: Element): void {

        const previous = this.#active;

        if (previous && this.#panels().includes(previous)) {

            this.#events.emit('slide:leave', this.#positionOf(previous));
        }

        previous?.removeAttribute('active');
        panel.setAttribute('active', '');
        this.#active = panel;

        // A hash that already names this panel (browser back, an anchor click) owns the entry.
        this.#writeHash(panel, this.#hashLanding(currentHash())?.panel === panel
            ? 'replaceState'
            : 'pushState');
        this.#notes.draw();
        this.#events.emit('slide:enter', this.#positionOf(panel));
    }

    #notesState(): NotesState | null {

        const slide = this.#active;

        if (!slide) return null;

        const panels = this.#panels();
        const { column, panel } = this.#positionOf(slide);

        return {
            slide,
            next: panels[panels.indexOf(slide) + 1] ?? null,
            column,
            columns: this.#columns().length,
            panel,
            panels: panelsOf(this.#columnOf(slide)).length,
            fragment: revealedCount(slide),
            fragments: fragmentsOf(slide).length
        };
    }

    #onKey(event: Event): void {

        if (!(event instanceof KeyboardEvent) || event.defaultPrevented) return;
        if (isGuardedTarget(event.target)) return;

        const action = keyAction(event);

        if (!action) return;

        event.preventDefault();
        this.#actions[action]();
    }

    #toggleOverlay(name: OverlayName): void {

        const open = this.#overlays.get(name);

        if (open) {

            open.remove();
            this.#overlays.delete(name);

            return;
        }

        const overlay = createOverlay(name);

        this.#root.ownerDocument.body.append(overlay);
        this.#overlays.set(name, overlay);
    }

    #dismiss(): void {

        if (this.#overlays.has('help')) this.#toggleOverlay('help');
        else if (this.#overlays.has('blank')) this.#toggleOverlay('blank');
    }

    /** The whole document goes fullscreen so the overlays in `<body>` stay visible. */
    async #toggleFullscreen(): Promise<void> {

        const doc = this.#root.ownerDocument;

        const [, err] = await attempt(() => (
            doc.fullscreenElement
                ? doc.exitFullscreen()
                : doc.documentElement.requestFullscreen()
        ));

        if (err) console.warn('@logosdx/slides: fullscreen toggle failed', err);
    }
}
