import { describe, it, expect, afterEach, vi } from 'vitest';
import {
    NotesWindow,
    notesDocument,
    notesOf,
    renderNotes,
    titleOf,
    writeClock,
    type NotesCommand,
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
    outline: [['First', 'Second'], ['Solo']],
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

        it('lists every panel in a jump menu grouped by column, selecting the current one', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();

            renderNotes(doc, stateFor(byId('p1'), { panel: 1 }), { elapsed: 0, now: Date.now() });

            const menu = doc.querySelector<HTMLSelectElement>('aside > select')!;
            const groups = Array.from(menu.querySelectorAll('optgroup'));
            const options = Array.from(menu.querySelectorAll('option'));

            expect(groups.map((group) => group.label)).toEqual(['1. First', '2. Solo']);
            expect(options.map((option) => option.value)).toEqual(['0:0', '0:1', '1:0']);
            expect(options.map((option) => option.textContent))
                .toEqual(['1. First', '2. Second', '1. Solo']);
            expect(menu.value).toBe('0:1');
        });

        it('refreshes the jump menu on a same-slide redraw, so it never lags the deck', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();
            const clock = { elapsed: 0, now: Date.now() };

            renderNotes(doc, stateFor(byId('p0')), clock);
            renderNotes(
                doc,
                stateFor(byId('p0'), { outline: [['First', 'Second'], ['Solo'], ['New']] }),
                clock
            );

            expect(doc.querySelectorAll('aside > select option')).toHaveLength(4);
        });

        it('draws a button for each control, named by the deck action it triggers', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();

            renderNotes(doc, stateFor(byId('p0')), { elapsed: 0, now: Date.now() });

            const actions = Array.from(doc.querySelectorAll<HTMLElement>('aside button'))
                .map((button) => button.dataset.action);

            expect(actions).toEqual(['prevColumn', 'prev', 'next', 'nextColumn', 'blank']);
        });

        it('keeps media in the next-slide preview and the notes inside their panes', () => {

            document.body.innerHTML = DECK_HTML;
            const doc = blankDocument();

            renderNotes(doc, stateFor(byId('p0')), { elapsed: 0, now: Date.now() });

            const css = doc.head.querySelector('style')!.textContent!;

            expect(css).toMatch(/minmax\(0, 3fr\) minmax\(0, 2fr\)/);
            expect(css).toMatch(/#next :is\(img[^)]*\)[\s\S]*max-width: 100% !important/);
            expect(css).toMatch(/#notes :is\(img[^)]*\)/);
            expect(css).toMatch(/:is\(table, pre\) \{\s*display: block; overflow-x: auto/);
            expect(css).toMatch(/#next table \{ color: inherit; font-size: inherit; \}/);
        });
    });

    describe('titleOf', () => {

        const titled = (html: string) => {

            document.body.innerHTML = `<slides><slide horizontal id="x">${html}</slide></slides>`;

            return titleOf(byId('x'), 4);
        };

        it('uses the first heading', () => {

            expect(titled('<p>intro</p><h2>Revenue</h2><h3>Detail</h3>')).toBe('Revenue');
        });

        it('ignores headings inside notes', () => {

            expect(titled('<notes><h2>Private</h2></notes><p>Public text</p>')).toBe('Public text');
        });

        it('falls back to the start of the visible text, collapsed and trimmed', () => {

            expect(titled('<p>  Many   words\n here </p><notes>hidden</notes>'))
                .toBe('Many words here');
        });

        it('marks a clipped title with an ellipsis, headings included', () => {

            const clipped = titled(`<p>${'a'.repeat(100)}</p>`);

            expect(clipped).toHaveLength(48);
            expect(clipped.endsWith('…')).toBe(true);
            expect(titled(`<h2> ${'b '.repeat(60)}</h2>`)).toHaveLength(48);
        });

        it('reads text without cloning, which would start the panel\'s media loading', () => {

            const clone = vi.spyOn(Node.prototype, 'cloneNode');

            titled('<video src="talk.mp4"></video><p>Talk</p>');

            expect(clone).not.toHaveBeenCalled();
        });

        it('falls back to the slide number when there is no text', () => {

            expect(titled('<img src="x.png"><notes>only notes</notes>')).toBe('Slide 4');
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
        let commands: ReturnType<typeof vi.fn<(command: NotesCommand) => void>>;

        const setup = () => {

            document.body.innerHTML = DECK_HTML;
            current = stateFor(byId('p0'), { next: byId('p1') });
            commands = vi.fn<(command: NotesCommand) => void>();
            notes = new NotesWindow(() => current, commands);
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

        describe('control wiring', () => {

            const opened = () => {

                setup();
                const popup = fakePopup();

                vi.spyOn(window, 'open').mockReturnValue(popup.popup);
                notes.open();

                return popup;
            };

            const press = (doc: Document, key: string, target: Element = doc.body) => {

                const event = new doc.defaultView!.KeyboardEvent('keydown', {
                    key,
                    bubbles: true,
                    cancelable: true
                });

                target.dispatchEvent(event);

                return event;
            };

            it('turns a button click into its deck action and drops focus from it', () => {

                const { doc } = opened();
                const next = doc.querySelector<HTMLButtonElement>('button[data-action="next"]')!;

                next.focus();
                next.click();

                expect(commands).toHaveBeenCalledExactlyOnceWith('next');
                expect(doc.activeElement).not.toBe(next);
            });

            it('turns a jump-menu choice into a position', () => {

                const { doc } = opened();
                const menu = doc.querySelector('select')!;

                menu.value = '1:0';
                menu.dispatchEvent(new doc.defaultView!.Event('change', { bubbles: true }));

                expect(commands).toHaveBeenCalledExactlyOnceWith({ column: 1, panel: 0 });
            });

            it('maps navigation keys pressed in the window to deck actions', () => {

                const { doc } = opened();

                for (const key of ['ArrowRight', 'ArrowLeft', ' ', 'PageDown', 'Home', 'b']) {

                    expect(press(doc, key).defaultPrevented).toBe(true);
                }

                expect(commands.mock.calls.map(([command]) => command))
                    .toEqual(['nextColumn', 'prevColumn', 'next', 'nextPanel', 'first', 'blank']);
            });

            it('leaves Up, Down, and the window-only keys alone, so long notes still scroll', () => {

                const { doc } = opened();

                for (const key of ['ArrowDown', 'ArrowUp', 's', 'f', '?', 'x']) {

                    expect(press(doc, key).defaultPrevented).toBe(false);
                }

                expect(commands).not.toHaveBeenCalled();
            });

            it('leaves keys aimed at its own controls to the control', () => {

                const { doc } = opened();
                const button = doc.querySelector('button')!;

                expect(press(doc, ' ', button).defaultPrevented).toBe(false);
                expect(commands).not.toHaveBeenCalled();
            });

            it('leaves keys aimed at embedded controls in the notes to those controls', () => {

                const { doc } = opened();
                const video = doc.createElement('video');

                video.setAttribute('controls', '');
                doc.body.append(video);

                expect(press(doc, ' ', video).defaultPrevented).toBe(false);
                expect(commands).not.toHaveBeenCalled();
            });

            it('keeps a clicked link from navigating the popup away from its controls', () => {

                const { doc } = opened();
                const link = doc.createElement('a');

                link.setAttribute('href', 'https://example.com');
                doc.body.append(link);

                const click = new doc.defaultView!.MouseEvent('click', {
                    bubbles: true,
                    cancelable: true
                });

                link.dispatchEvent(click);

                expect(click.defaultPrevented).toBe(true);
            });

            it('does not read the deck while no popup is open', () => {

                setup();
                const read = vi.fn(() => current);

                new NotesWindow(read, commands).draw();

                expect(read).not.toHaveBeenCalled();
            });

            it('stops listening once closed', () => {

                const { doc } = opened();

                notes.close();
                doc.querySelector<HTMLButtonElement>('button[data-action="next"]')?.click();
                press(doc, ' ');

                expect(commands).not.toHaveBeenCalled();
            });

            it('keeps listening across redraws that rebuild the view', () => {

                const { doc } = opened();

                current = stateFor(byId('p1'), { panel: 1 });
                notes.draw();
                doc.querySelector<HTMLButtonElement>('button[data-action="prev"]')!.click();

                expect(commands).toHaveBeenCalledExactlyOnceWith('prev');
            });
        });
    });
});
