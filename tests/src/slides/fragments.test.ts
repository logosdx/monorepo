import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Deck } from '../../../packages/slides/src/index.ts';
import { stubDeckLayout } from './_helpers.ts';

const DECK_HTML = `
    <slides id="deck">
        <slide id="a">no fragments</slide>
        <slide id="b">
            <p fragment id="b0">one</p>
            <p fragment id="b1">two</p>
            <p fragment id="b2">three</p>
        </slide>
        <slide id="c"><p fragment id="c0">only</p></slide>
        <slide id="d">no fragments</slide>
    </slides>
`;

describe('slides: fragments', () => {

    let deck: Deck | undefined;

    const { byId, root, shownIds, activeIds, arrive, pressKey } = stubDeckLayout();

    const revealedIds = () => Array.from(root().querySelectorAll('[revealed]')).map((el) => el.id);

    const start = () => {

        deck = new Deck();

        return deck;
    };

    beforeEach(() => {

        document.body.innerHTML = DECK_HTML;
    });

    afterEach(() => {

        deck?.destroy();
        deck = undefined;
    });

    describe('entering a panel', () => {

        it('forwards hides every fragment before the move arrives', () => {

            byId('b0').setAttribute('revealed', '');
            byId('b2').setAttribute('revealed', '');

            start().next();

            expect(shownIds()).toEqual(['b']);
            expect(revealedIds()).toEqual([]);
        });

        it('backwards reveals every fragment', () => {

            start().goTo('d');
            arrive('d', 'a');
            deck!.prev();

            expect(revealedIds()).toEqual(['c0']);
        });

        it('applies to a reader scrolling, not only to navigation', () => {

            start();
            arrive('d', 'a');
            arrive('b', 'd');

            expect(activeIds()).toEqual(['b']);
            expect(revealedIds()).toEqual(['b0', 'b1', 'b2']);

            byId('c0').setAttribute('revealed', '');
            arrive('c', 'b');

            expect(revealedIds()).toEqual(['b0', 'b1', 'b2']);
            expect(shownIds()).toEqual([]);
        });
    });

    describe('stepping', () => {

        it('reveals one fragment per next() and moves on after the last', () => {

            start().next();
            arrive('b', 'a');

            deck!.next();
            expect(revealedIds()).toEqual(['b0']);

            deck!.next();
            deck!.next();
            expect(revealedIds()).toEqual(['b0', 'b1', 'b2']);
            expect(shownIds()).toEqual(['b']);

            deck!.next();
            expect(shownIds()).toEqual(['b', 'c']);
        });

        it('re-hides the last revealed fragment per prev() and moves back after the first', () => {

            start().goTo({ column: 1, panel: 0, fragment: 2 });
            arrive('b', 'a');

            deck!.prev();
            expect(revealedIds()).toEqual(['b0']);

            deck!.prev();
            expect(revealedIds()).toEqual([]);
            expect(shownIds()).toEqual(['b']);

            deck!.prev();
            expect(shownIds()).toEqual(['b', 'a']);
        });

        it('takes a single fragment from hidden to shown and back in one step each', () => {

            start().goTo('c');
            arrive('c', 'a');
            deck!.prev();

            expect(revealedIds()).toEqual([]);
            expect(shownIds()).toEqual(['c']);

            deck!.next();
            expect(revealedIds()).toEqual(['c0']);

            deck!.next();
            expect(shownIds()).toEqual(['c', 'd']);
        });

        it('steps the fragments of a pending move target', () => {

            start().next();
            deck!.next();

            expect(revealedIds()).toEqual(['b0']);
            expect(shownIds()).toEqual(['b']);
        });

        it('steps fragments on Space and Shift+Space', () => {

            start().next();
            arrive('b', 'a');

            pressKey(' ');
            pressKey(' ');
            pressKey(' ', document.body, true);

            expect(revealedIds()).toEqual(['b0']);
        });

        it.each([
            ['PageDown', 'c'],
            ['PageUp', 'a'],
            ['ArrowRight', 'c'],
            ['ArrowLeft', 'a']
        ])('%s skips the fragment steps left in the panel', (key, target) => {

            start().next();
            arrive('b', 'a');
            deck!.next();

            pressKey(key);

            expect(revealedIds()).toEqual(['b0']);
            expect(shownIds()).toEqual(['b', target]);
        });
    });

    describe('goTo()', () => {

        it('reveals the given count, or all when omitted', () => {

            start().goTo({ column: 1, panel: 0, fragment: 1 });

            expect(revealedIds()).toEqual(['b0']);

            deck!.goTo({ column: 2, panel: 0 });

            expect(revealedIds()).toEqual(['b0', 'c0']);
        });

        it('sets the count on the active panel, which stays active', () => {

            start().goTo('b');
            arrive('b', 'a');
            deck!.goTo({ column: 1, panel: 0, fragment: 0 });

            expect(revealedIds()).toEqual([]);
            expect(activeIds()).toEqual(['b']);
        });

        it.each([4, -1, 1.5])('throws on a fragment count of %s', (fragment) => {

            expect(() => start().goTo({ column: 1, panel: 0, fragment }))
                .toThrow(/@logosdx\/slides/);
            expect(shownIds()).toEqual([]);
        });
    });

    describe('first activation', () => {

        const REVEALED_HTML = `
            <slides id="deck">
                <slide id="a">
                    <p fragment revealed id="a0">x</p>
                    <p fragment revealed id="a1">y</p>
                </slide>
                <slide id="b">b</slide>
            </slides>
        `;

        beforeEach(() => {

            document.body.innerHTML = REVEALED_HTML;
        });

        it.each([
            ['no hash', '', []],
            ['a positional hash', '#/0/0', ['a0', 'a1']],
            ['an id hash', '#a1', ['a0', 'a1']],
            ['a fragment segment', '#/0/0/1', ['a0']],
            ['an unmatched id', '#missing', []],
            ['an out-of-range position', '#/5/0', []],
            ['an out-of-range fragment', '#/0/0/3', []],
            ['a malformed hash', '#/0/x', []],
            ['a bare #', '#', []]
        ])('with %s reveals %j', (_, hash, revealed) => {

            vi.spyOn(console, 'warn').mockImplementation(() => {});
            history.replaceState(null, '', hash || location.pathname);

            start();

            expect(activeIds()).toEqual(['a']);
            expect(revealedIds()).toEqual(revealed);
        });
    });

    describe('events', () => {

        type Change = [string, string, string, number];

        const record = (target: Deck) => {

            const changes: Change[] = [];

            for (const name of ['fragment:show', 'fragment:hide'] as const) {

                target.on(name, ({ slide, fragment, index }) => {

                    changes.push([name, slide.id, fragment.id, index]);
                });
            }

            return changes;
        };

        it('fire once per fragment step with the panel, fragment, and index', () => {

            const changes = record(start());

            deck!.next();
            arrive('b', 'a');
            deck!.next();
            deck!.next();
            deck!.prev();

            expect(changes).toEqual([
                ['fragment:show', 'b', 'b0', 0],
                ['fragment:show', 'b', 'b1', 1],
                ['fragment:hide', 'b', 'b1', 1]
            ]);
        });

        it('fire for a goTo() fragment count on the active panel', () => {

            start().goTo('b');
            arrive('b', 'a');

            const changes = record(deck!);

            deck!.goTo({ column: 1, panel: 0, fragment: 1 });
            deck!.goTo({ column: 1, panel: 0 });

            expect(changes).toEqual([
                ['fragment:hide', 'b', 'b1', 1],
                ['fragment:hide', 'b', 'b2', 2]
            ]);
        });

        it('stay silent when entering a panel resets its fragments', () => {

            byId('b0').setAttribute('revealed', '');

            const changes = record(start());

            arrive('b', 'a');
            arrive('c', 'b');
            arrive('b', 'c');

            expect(revealedIds()).toEqual(['b0', 'b1', 'b2']);
            expect(changes).toEqual([]);
        });

        it('stay silent for a move that never arrives', () => {

            byId('b0').setAttribute('revealed', '');

            const changes = record(start());

            deck!.next();
            root().dispatchEvent(new Event('wheel'));

            expect(revealedIds()).toEqual([]);
            expect(activeIds()).toEqual(['a']);
            expect(changes).toEqual([]);
        });
    });
});
