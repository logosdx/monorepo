import { describe, it, expect, afterEach, vi } from 'vitest';
import {
    NotesWindow,
    notesDocument,
    notesOf,
    renderNotes,
    writeClock,
    type NotesState
} from '../../../packages/slides/src/notes.ts';
import { upgradeDeck } from '../../../packages/slides/src/upgrade.ts';

const DECK_HTML = `
    <slides>
        <slide horizontal id="c0">
            <slide vertical id="p0">first<notes id="own">Own <b>note</b></notes></slide>
            <notes id="loose0">Loose after p0</notes>
            <p>between</p>
            <notes id="loose1">Second loose</notes>
            <slide vertical id="p1">second <p fragment>step</p><notes>p1 note</notes></slide>
        </slide>
        <slide horizontal id="c1">solo<notes id="solo">Column note</notes></slide>
    </slides>
`;

const byId = (id: string) => document.getElementById(id)!;

const stateFor = (slide: Element, overrides: Partial<NotesState> = {}): NotesState => ({
    slide,
    next: null,
    column: 0,
    columns: 2,
    panel: 0,
    panels: 2,
    fragment: 0,
    fragments: 0,
    ...overrides
});

const blankDocument = () => document.implementation.createHTMLDocument('');

describe('slides: notes', () => {

    afterEach(() => {

        document.body.innerHTML = '';
    });

    describe('notesOf', () => {

        it('gives a panel its own notes and the loose notes up to the next panel', () => {

            document.body.innerHTML = DECK_HTML;

            expect(notesOf(byId('p0')).map((el) => el.id)).toEqual(['own', 'loose0', 'loose1']);
        });

        it('leaves loose notes before a panel to the panel before it', () => {

            document.body.innerHTML = DECK_HTML;

            expect(notesOf(byId('p1')).map((el) => el.textContent)).toEqual(['p1 note']);
        });

        it('gives notes before a column\'s first panel to that panel', () => {

            document.body.innerHTML = `
                <slides><slide horizontal id="c">
                    <notes id="lead">Lead</notes>
                    <slide vertical id="first">one<notes id="own">Own</notes></slide>
                    <slide vertical id="second">two</slide>
                </slide></slides>
            `;

            expect(notesOf(byId('first')).map((el) => el.id)).toEqual(['lead', 'own']);
            expect(notesOf(byId('second'))).toEqual([]);
        });

        it('gives leading notes to the panel wrapped around loose content after them', () => {

            document.body.innerHTML = `
                <slides id="deck"><slide horizontal>
                    <notes id="lead">Lead</notes>
                    <h2>Chapter</h2>
                    <slide vertical id="first">one</slide>
                </slide></slides>
            `;

            const stop = upgradeDeck(byId('deck'));
            const implicit = document.querySelector('[data-implicit]')!;

            stop();

            expect(implicit.textContent?.trim()).toBe('Chapter');
            expect(notesOf(implicit).map((el) => el.id)).toEqual(['lead']);
            expect(notesOf(byId('first'))).toEqual([]);
        });

        it('gives a column that is its own panel every note inside it', () => {

            document.body.innerHTML = DECK_HTML;

            expect(notesOf(byId('c1')).map((el) => el.id)).toEqual(['solo']);
        });

        it('returns nothing for a panel without notes', () => {

            document.body.innerHTML = '<slides><slide horizontal id="x">plain</slide></slides>';

            expect(notesOf(byId('x'))).toEqual([]);
        });
    });

    describe('renderNotes', () => {

        it('writes the notes markup, so authored emphasis survives', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();

            renderNotes(doc, stateFor(byId('p0')), { elapsed: 0, now: Date.now() });

            expect(doc.getElementById('notes')!.innerHTML)
                .toBe('Own <b>note</b>Loose after p0Second loose');
        });

        it('previews the next panel without its notes and leaves the deck untouched', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();

            renderNotes(doc, stateFor(byId('p0'), { next: byId('p1') }), {
                elapsed: 0,
                now: Date.now()
            });

            const preview = doc.getElementById('next')!;

            expect(preview.textContent).toContain('second');
            expect(preview.querySelector('notes')).toBeNull();
            expect(preview.firstElementChild!.ownerDocument).toBe(doc);
            expect(byId('p1').querySelector('notes')).not.toBeNull();
        });

        it('says the deck ends when there is no next panel', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();

            renderNotes(doc, stateFor(byId('c1')), { elapsed: 0, now: Date.now() });

            expect(doc.getElementById('next')!.textContent).toBe('End of deck');
        });

        it('says so when a panel has no notes, so a blank pane is never ambiguous', () => {

            document.body.innerHTML = '<slides><slide horizontal id="x">plain</slide></slides>';
            const doc = blankDocument();

            renderNotes(doc, stateFor(byId('x')), { elapsed: 0, now: Date.now() });

            expect(doc.getElementById('notes')!.textContent).toBe('No notes for this slide.');
        });

        it('writes the position 1-based, with the step only for a panel with fragments', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();
            const clock = { elapsed: 0, now: Date.now() };

            renderNotes(doc, stateFor(byId('p0')), clock);

            expect(doc.getElementById('position')!.textContent)
                .toBe('Column 1 of 2 · Slide 1 of 2');

            renderNotes(doc, stateFor(byId('p1'), { panel: 1, fragment: 1, fragments: 1 }), clock);

            expect(doc.getElementById('position')!.textContent)
                .toBe('Column 1 of 2 · Slide 2 of 2 · Step 1 of 1');
        });

        it('writes elapsed and wall-clock time', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();
            const now = Date.now();
            const time = new Date(now).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            renderNotes(doc, stateFor(byId('p0')), { elapsed: 3_723_000, now });

            expect(doc.getElementById('elapsed')!.textContent).toBe('01:02:03');
            expect(doc.getElementById('time')!.textContent).toBe(time);
        });

        it('styles the view itself, since the popup has no stylesheet of its own', () => {

            const doc = blankDocument();

            document.body.innerHTML = DECK_HTML;
            renderNotes(doc, stateFor(byId('p0')), { elapsed: 0, now: Date.now() });
            renderNotes(doc, stateFor(byId('p0')), { elapsed: 0, now: Date.now() });

            expect(doc.head.querySelectorAll('style')).toHaveLength(1);
            expect(doc.body.children).toHaveLength(1);
        });

        it('keeps the notes in place when the same slide redraws, so the scroll holds', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();
            const clock = { elapsed: 0, now: Date.now() };
            const p1 = byId('p1');

            renderNotes(doc, stateFor(p1, { panel: 1, fragments: 1 }), clock);
            const notes = doc.getElementById('notes');

            renderNotes(doc, stateFor(p1, { panel: 1, fragment: 1, fragments: 1 }), clock);

            expect(doc.getElementById('notes')).toBe(notes);
            expect(doc.getElementById('position')!.textContent).toContain('Step 1 of 1');

            renderNotes(doc, stateFor(byId('p0')), clock);

            expect(doc.getElementById('notes')).not.toBe(notes);
            expect(doc.getElementById('notes')!.textContent).toContain('Own note');
        });

        it('redraws its own position, preview, and clocks when the notes reuse their ids', () => {

            document.body.innerHTML = `
                <slides><slide horizontal id="here">here<notes>
                    <p id="position">Stand left</p><p id="next">Then click</p>
                    <p id="time">Two minutes here</p><p id="elapsed">Pause</p>
                </notes></slide><slide horizontal id="after">after</slide></slides>
            `;
            const doc = blankDocument();
            const clock = { elapsed: 0, now: Date.now() };
            const here = byId('here');

            renderNotes(doc, stateFor(here), clock);
            renderNotes(doc, stateFor(here, { next: byId('after'), column: 1 }), clock);

            const notes = doc.getElementById('notes')!;
            const aside = doc.querySelector('aside')!;

            expect(notes.textContent).toContain('Stand left');
            expect(notes.textContent).toContain('Then click');
            expect(aside.firstElementChild!.textContent).toContain('Column 2 of 2');
            expect(aside.lastElementChild!.textContent).toContain('after');
            expect(notes.textContent).toContain('Two minutes here');
            expect(notes.textContent).toContain('Pause');
            expect(aside.querySelector('p > span')!.textContent).toBe('00:00:00');
        });

        it('replaces media and iframes in the preview, so nothing plays or loads', () => {

            document.body.innerHTML = `
                <slides><slide horizontal id="here">here</slide><slide horizontal id="media">
                    <video autoplay src="talk.mp4"></video>
                    <audio autoplay><source src="intro.mp3"></audio>
                    <iframe src="https://example.com"></iframe>
                </slide></slides>
            `;
            const doc = blankDocument();

            renderNotes(doc, stateFor(byId('here'), { next: byId('media') }), {
                elapsed: 0,
                now: Date.now()
            });

            const preview = doc.getElementById('next')!;

            expect(preview.querySelector('video, audio, iframe, source')).toBeNull();
            expect(preview.textContent).toMatch(/\[video\][\s\S]*\[audio\][\s\S]*\[iframe\]/);
            expect(byId('media').querySelector('video')!.hasAttribute('autoplay')).toBe(true);
        });
    });

    describe('writeClock', () => {

        it('updates the clocks without rebuilding the view', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();

            renderNotes(doc, stateFor(byId('p0')), { elapsed: 0, now: Date.now() });
            const notes = doc.getElementById('notes');

            writeClock(doc, { elapsed: 61_000, now: Date.now() });

            expect(doc.getElementById('elapsed')!.textContent).toBe('00:01:01');
            expect(doc.getElementById('notes')).toBe(notes);
        });
    });

    describe('notesDocument', () => {

        const written = () => {

            const doc = blankDocument();

            document.body.innerHTML = DECK_HTML;
            renderNotes(doc, stateFor(byId('p0')), { elapsed: 0, now: Date.now() });

            return doc;
        };

        it('returns the document of an open popup holding the view', () => {

            const doc = written();

            expect(notesDocument({ closed: false, document: doc })).toBe(doc);
        });

        it('treats a closed popup as disconnected', () => {

            expect(notesDocument({ closed: true, document: written() })).toBeNull();
        });

        it('treats a popup reloaded empty as disconnected', () => {

            expect(notesDocument({ closed: false, document: blankDocument() })).toBeNull();
        });

        it('treats a popup gone cross-origin as disconnected without throwing', () => {

            const crossOrigin = {
                closed: false,
                get document(): Document {

                    throw new DOMException('Blocked a frame', 'SecurityError');
                }
            };

            expect(notesDocument(crossOrigin)).toBeNull();
        });
    });

    describe('NotesWindow', () => {

        /** A same-origin window from an iframe, with `closed` and `close` under test control. */
        const fakePopup = (options: { crossOrigin?: boolean } = {}) => {

            const iframe = document.createElement('iframe');

            document.body.append(iframe);

            const win = iframe.contentWindow!;
            const state = { closed: false };
            const close = vi.fn(() => {

                state.closed = true;
            });
            const focus = vi.fn();
            const popup = new Proxy(win, {
                get(target, key) {

                    if (key === 'closed') return state.closed;
                    if (key === 'close') return close;
                    if (key === 'focus') return focus;

                    if (key === 'document' && options.crossOrigin) {

                        throw new DOMException('Blocked a frame', 'SecurityError');
                    }

                    return Reflect.get(target, key);
                }
            });

            return { popup, close, focus, state, doc: iframe.contentDocument! };
        };

        const shown = (doc: Document, id: string) => doc.getElementById(id)?.textContent;

        let current: NotesState;
        let notes: NotesWindow;

        const setup = () => {

            document.body.innerHTML = DECK_HTML;
            current = stateFor(byId('p0'), { next: byId('p1') });
            notes = new NotesWindow(() => current);
        };

        afterEach(() => {

            notes?.close();
            vi.useRealTimers();
        });

        it('reuses a connected window on a second open and redraws it', () => {

            setup();
            const first = fakePopup();
            const open = vi.spyOn(window, 'open').mockReturnValue(first.popup);

            notes.open();
            current = stateFor(byId('p1'), { panel: 1 });
            notes.open();

            expect(open).toHaveBeenCalledTimes(1);
            expect(first.focus).toHaveBeenCalledTimes(1);
            expect(shown(first.doc, 'notes')).toBe('p1 note');
        });

        it('replaces a window closed since the last tick instead of focusing it', () => {

            setup();
            const stale = fakePopup();
            const fresh = fakePopup();
            const open = vi.spyOn(window, 'open')
                .mockReturnValueOnce(stale.popup)
                .mockReturnValueOnce(fresh.popup);

            notes.open();
            stale.state.closed = true;
            notes.open();

            expect(open).toHaveBeenCalledTimes(2);
            expect(stale.focus).not.toHaveBeenCalled();
            expect(shown(fresh.doc, 'notes')).toContain('Own note');
        });

        it('opens again in the same call when the first window is cross-origin', () => {

            setup();
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const leftover = fakePopup({ crossOrigin: true });
            const fresh = fakePopup();

            vi.spyOn(window, 'open')
                .mockReturnValueOnce(leftover.popup)
                .mockReturnValueOnce(fresh.popup);

            notes.open();

            expect(leftover.close).toHaveBeenCalled();
            expect(shown(fresh.doc, 'notes')).toContain('Own note');
            expect(warn).not.toHaveBeenCalled();
        });

        it('warns once when the retry cannot be written to either', () => {

            setup();
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            vi.spyOn(window, 'open')
                .mockReturnValueOnce(fakePopup({ crossOrigin: true }).popup)
                .mockReturnValueOnce(fakePopup({ crossOrigin: true }).popup);

            notes.open();

            expect(warn).toHaveBeenCalledTimes(1);
        });

        it('stops the clock once the window is found disconnected', () => {

            vi.useFakeTimers();
            setup();
            const popup = fakePopup();

            vi.spyOn(window, 'open').mockReturnValue(popup.popup);
            notes.open();

            expect(vi.getTimerCount()).toBe(1);

            popup.doc.body.replaceChildren();
            vi.advanceTimersByTime(1000);

            expect(vi.getTimerCount()).toBe(0);
        });

        it('stops the clock and closes the window on close()', () => {

            vi.useFakeTimers();
            setup();
            const popup = fakePopup();

            vi.spyOn(window, 'open').mockReturnValue(popup.popup);
            notes.open();
            notes.close();

            expect(vi.getTimerCount()).toBe(0);
            expect(popup.close).toHaveBeenCalled();
        });
    });
});
