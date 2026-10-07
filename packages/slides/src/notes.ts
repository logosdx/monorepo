import { attemptSync } from '@logosdx/utils';

import { isSlide, NOTES, SLIDE } from './upgrade.ts';

/** Indices are 0-based. */
export interface NotesState {
    slide: Element;
    next: Element | null;
    column: number;
    columns: number;
    panel: number;
    panels: number;
    fragment: number;
    fragments: number;
}

export interface NotesClock {
    /** Milliseconds since the notes first opened. */
    elapsed: number;
    /** Epoch milliseconds. */
    now: number;
}

const POPUP_NAME = 'lx-notes';
const POPUP_FEATURES = 'popup,width=960,height=640';
const VIEW_ID = 'lx-notes-view';

const SIDE = `#${VIEW_ID} > aside`;

// Child combinators keep these rules off the cloned preview, which may reuse the same ids.
const VIEW_CSS = `
    body { margin: 0; background: #111; color: #eee; font: 22px/1.5 system-ui, sans-serif; }
    #${VIEW_ID} {
        display: grid; grid-template-columns: 3fr 2fr; gap: 24px;
        box-sizing: border-box; height: 100vh; padding: 24px;
    }
    #${VIEW_ID} > #notes { overflow: auto; font-size: 28px; }
    ${SIDE} { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
    ${SIDE} > #position { margin: 0; color: #aaa; }
    ${SIDE} > #clocks {
        display: flex; justify-content: space-between;
        font-size: 40px; font-variant-numeric: tabular-nums;
    }
    ${SIDE} > #clocks > #time { color: #aaa; }
    ${SIDE} > h2 { margin: 0; font-size: 16px; text-transform: uppercase; color: #aaa; }
    ${SIDE} > #next {
        flex: 1; overflow: hidden; padding: 16px; border-radius: 4px;
        background: #fff; color: #111; font-size: 14px;
    }
    ${SIDE} > #next > * { display: block; }
`;

/** The slide each popup document last showed, so a same-slide redraw keeps the notes' scroll. */
const drawnSlide = new WeakMap<Document, Element>();

/**
 * A `<notes>` placed directly in a column belongs to the panel before it, so
 * authors can keep notes outside the slide markup they describe. Notes ahead
 * of a column's first panel belong to that first panel.
 *
 * @example
 *
 *     notesOf(panel).map((note) => note.innerHTML).join('');
 */
export function notesOf(panel: Element): Element[] {

    const own = Array.from(panel.querySelectorAll(NOTES));

    if (!isSlide(panel.parentElement)) return own;

    const leading: Element[] = [];
    let before = panel.previousElementSibling;

    while (before && before.localName !== SLIDE) {

        if (before.localName === NOTES) leading.unshift(before);

        before = before.previousElementSibling;
    }

    if (!before) own.unshift(...leading);

    let sibling = panel.nextElementSibling;

    while (sibling && sibling.localName !== SLIDE) {

        if (sibling.localName === NOTES) own.push(sibling);

        sibling = sibling.nextElementSibling;
    }

    return own;
}

function createIn(doc: Document, tag: string, id?: string, text?: string): HTMLElement {

    const el = doc.createElement(tag);

    if (id) el.id = id;
    if (text) el.textContent = text;

    return el;
}

function positionText({ column, columns, panel, panels, fragment, fragments }: NotesState) {

    const parts = [`Column ${column + 1} of ${columns}`, `Slide ${panel + 1} of ${panels}`];

    if (fragments) parts.push(`Step ${fragment} of ${fragments}`);

    return parts.join(' · ');
}

function previewOf(doc: Document, next: Element | null): Node {

    if (!next) return doc.createTextNode('End of deck');

    const preview = doc.importNode(next, true);

    preview.querySelectorAll(NOTES).forEach((note) => note.remove());
    preview.removeAttribute('active');

    // A preview must not play sound or load pages behind the presenter's back.
    preview.querySelectorAll('video, audio, iframe').forEach((embed) => {

        // Cloning queued a media load that reads its sources later; detaching
        // alone does not cancel it, removing the sources first does.
        embed.removeAttribute('src');
        embed.replaceChildren();
        embed.replaceWith(createIn(doc, 'span', undefined, `[${embed.localName}]`));
    });

    return preview;
}

/**
 * Updates only the clocks, so a ticking second does not reset the notes'
 * scroll position.
 */
export function writeClock(doc: Document, { elapsed, now }: NotesClock): void {

    const elapsedEl = doc.querySelector(`${SIDE} > #clocks > #elapsed`);
    const timeEl = doc.querySelector(`${SIDE} > #clocks > #time`);

    if (elapsedEl) elapsedEl.textContent = new Date(elapsed).toISOString().slice(11, 19);
    if (timeEl) {

        timeEl.textContent = new Date(now).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

function buildView(doc: Document, state: NotesState): HTMLElement {

    const notes = notesOf(state.slide);
    const view = createIn(doc, 'main', VIEW_ID);
    const notesEl = createIn(doc, 'section', 'notes');
    const clocks = createIn(doc, 'p', 'clocks');
    const next = createIn(doc, 'div', 'next');

    if (notes.length) notesEl.innerHTML = notes.map((note) => note.innerHTML).join('');
    else notesEl.textContent = 'No notes for this slide.';

    clocks.append(createIn(doc, 'span', 'elapsed'), createIn(doc, 'span', 'time'));
    next.append(previewOf(doc, state.next));

    const aside = createIn(doc, 'aside');

    aside.append(
        createIn(doc, 'p', 'position', positionText(state)),
        clocks,
        createIn(doc, 'h2', undefined, 'Next'),
        next
    );
    view.append(notesEl, aside);

    return view;
}

/**
 * The popup has no code or stylesheet of its own, so a new slide replaces
 * the whole view and its styles. The same slide again updates only its
 * position and preview, leaving the notes where the presenter scrolled them.
 *
 * @example
 *
 *     renderNotes(popup.document, state, { elapsed: 0, now: Date.now() });
 */
export function renderNotes(doc: Document, state: NotesState, clock: NotesClock): void {

    const position = doc.querySelector(`${SIDE} > #position`);
    const next = doc.querySelector(`${SIDE} > #next`);

    if (position && next && drawnSlide.get(doc) === state.slide) {

        position.textContent = positionText(state);
        next.replaceChildren(previewOf(doc, state.next));
    }
    else {

        doc.title = 'Speaker notes';
        doc.head.replaceChildren(createIn(doc, 'style', undefined, VIEW_CSS));
        doc.body.replaceChildren(buildView(doc, state));
    }

    drawnSlide.set(doc, state.slide);
    writeClock(doc, clock);
}

/**
 * Null once the popup is closed or reloaded: Chromium's reloaded
 * `about:blank` is cross-origin to the deck, WebKit's is empty.
 */
export function notesDocument(pop: Pick<Window, 'closed' | 'document'>): Document | null {

    if (pop.closed) return null;

    const [doc] = attemptSync(() => pop.document);

    return doc?.getElementById(VIEW_ID) ? doc : null;
}

/**
 * Nothing runs in the popup, so a reload leaves it blank and reopening is
 * the recovery. See docs/design/slides.md, *Speaker notes*.
 */
export class NotesWindow {

    #read: () => NotesState | null;
    #pop: Window | null = null;
    #connected = false;
    #started: number | null = null;
    #ticker: ReturnType<typeof setInterval> | undefined;

    /** @param read the deck's current state, or null before any panel is active */
    constructor(read: () => NotesState | null) {

        this.#read = read;
    }

    /** Opens the popup, or replaces one that disconnected, and writes the current view. */
    open(): void {

        const state = this.#read();

        if (!state) return;

        if (this.#pop && this.#writable()) {

            this.#pop.focus();
            this.draw();

            return;
        }

        this.close();
        this.#started ??= Date.now();

        const pop = this.#openWritable(state) ?? this.#openWritable(state);

        if (!pop) {

            console.warn('@logosdx/slides: the notes popup was blocked or cannot be written to');

            return;
        }

        this.#pop = pop;
        this.#connected = true;
        this.#ticker = setInterval(() => this.#tick(), 1000);
    }

    /** Rewrites the view while connected; a popup found gone is marked disconnected. */
    draw(): void {

        const doc = this.#writable();
        const state = this.#read();

        if (doc && state) renderNotes(doc, state, this.#clock());
    }

    /** Closes the popup and stops its clock; the elapsed time keeps counting for a reopen. */
    close(): void {

        clearInterval(this.#ticker);
        this.#pop?.close();
        this.#pop = null;
        this.#connected = false;
    }

    /**
     * A popup left open across a deck reload comes back from `window.open`
     * cross-origin; closing it lets the caller open once more in the same keypress.
     */
    #openWritable(state: NotesState): Window | null {

        const pop = window.open('', POPUP_NAME, POPUP_FEATURES);

        if (!pop) return null;

        const [, err] = attemptSync(() => renderNotes(pop.document, state, this.#clock()));

        if (!err) return pop;

        pop.close();

        return null;
    }

    #writable(): Document | null {

        if (!this.#pop || !this.#connected) return null;

        const doc = notesDocument(this.#pop);

        if (!doc) {

            this.#connected = false;
            clearInterval(this.#ticker);
        }

        return doc;
    }

    #tick(): void {

        const doc = this.#writable();

        if (doc) writeClock(doc, this.#clock());
    }

    #clock(): NotesClock {

        const now = Date.now();

        return { elapsed: now - (this.#started ?? now), now };
    }
}
