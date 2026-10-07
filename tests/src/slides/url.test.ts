import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Deck } from '../../../packages/slides/src/index.ts';
import { formatHash, parseHash } from '../../../packages/slides/src/url.ts';
import { stubDeckLayout } from './_helpers.ts';

const DECK_HTML = `
    <slides id="deck">
        <slide id="a">
            <slide id="a0">a0</slide>
            <slide id="a1">
                a1 <em id="inner">x</em>
                <p fragment id="f0">f0</p>
                <p fragment id="f1">f1</p>
            </slide>
        </slide>
        <slide id="b">b</slide>
    </slides>
    <p id="outside">not a slide</p>
`;

describe('slides: url', () => {

    describe('parseHash', () => {

        it.each<[string, Deck.Target]>([
            ['#/2/1', { column: 2, panel: 1 }],
            ['#/0/0/0', { column: 0, panel: 0, fragment: 0 }],
            ['#/10/3/12', { column: 10, panel: 3, fragment: 12 }],
            ['#intro', 'intro'],
            ['#caf%C3%A9', 'café'],
            ['#100%', '100%']
        ])('reads %s', (hash, target) => {

            expect(parseHash(hash)).toEqual(target);
        });

        const unreadable = [
            '', '#', '#/', '#/1', '#/1/', '#/1/2/3/4', '#/a/0', '#/-1/0', '#/1.5/0', '#/1/0/x'
        ];

        it.each(unreadable)(
            'returns null for %j',
            (hash) => {

                expect(parseHash(hash)).toBeNull();
            }
        );
    });

    describe('formatHash', () => {

        it('writes the fragment segment only when given', () => {

            expect(formatHash({ column: 2, panel: 1 })).toBe('#/2/1');
            expect(formatHash({ column: 2, panel: 1, fragment: 0 })).toBe('#/2/1/0');
        });

        it('round-trips through parseHash', () => {

            const position: Deck.Position = { column: 3, panel: 0, fragment: 2 };

            expect(parseHash(formatHash(position))).toEqual(position);
        });
    });

    describe('deck sync', () => {

        let deck: Deck | undefined;

        const { root, shownIds, activeIds, arrive, tick } = stubDeckLayout();

        const revealedIds = () => (
            Array.from(root().querySelectorAll('[revealed]')).map((el) => el.id)
        );

        const navigate = async (hash: string) => {

            location.hash = hash;
            await tick();
        };

        beforeEach(() => {

            document.body.innerHTML = DECK_HTML;
        });

        afterEach(() => {

            deck?.destroy();
            deck = undefined;
        });

        describe('on load', () => {

            it.each([
                ['a positional hash', '#/0/1', ['f0', 'f1']],
                ['a fragment segment', '#/0/1/1', ['f0']],
                ['an id inside a panel', '#inner', ['f0', 'f1']]
            ])('lands on %s', (_, hash, revealed) => {

                history.replaceState(null, '', hash);
                deck = new Deck();

                expect(activeIds()).toEqual(['a1']);
                expect(shownIds()).toEqual(['a1']);
                expect(revealedIds()).toEqual(revealed);
            });

            it('fires deck:ready with the landing panel', async () => {

                const ready = vi.fn();

                history.replaceState(null, '', '#b');
                deck = new Deck();
                deck.on('deck:ready', ready);
                await Promise.resolve();

                expect(ready.mock.calls[0]![0]).toEqual({ slide: document.getElementById('b') });
            });

            it.each(['#missing', '#outside', '#'])('stays on the first panel for %j, silently', (
                hash
            ) => {

                const warn = vi.spyOn(console, 'warn');

                history.replaceState(null, '', hash);
                deck = new Deck();

                expect(activeIds()).toEqual(['a0']);
                expect(warn).not.toHaveBeenCalled();
            });

            const misses = ['#/9/0', '#/0/2', '#/0/1/3', '#/0/x'];

            it.each(misses)('warns and stays on the first panel for %s', (hash) => {

                const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

                history.replaceState(null, '', hash);
                deck = new Deck();

                expect(activeIds()).toEqual(['a0']);
                expect(warn).toHaveBeenCalledTimes(1);
                expect(warn.mock.calls[0]![0]).toContain(hash);
            });

            it('applies the hash when the first panel appears in a deck built empty', async () => {

                history.replaceState(null, '', '#/0/0/1');
                root().innerHTML = '';
                deck = new Deck();
                root().innerHTML = `
                    <slide id="x"><p fragment id="x0">0</p><p fragment id="x1">1</p></slide>
                `;
                await tick();

                expect(activeIds()).toEqual(['x']);
                expect(revealedIds()).toEqual(['x0']);
            });

            it('leaves the URL alone', () => {

                deck = new Deck();

                expect(location.hash).toBe('');
            });
        });

        describe('on hashchange', () => {

            it.each([
                ['a positional hash', '#/1/0', 'b'],
                ['an id inside a panel', '#inner', 'a1']
            ])('moves to %s', async (_, hash, panel) => {

                deck = new Deck();
                await navigate(hash);

                expect(shownIds()).toEqual([panel]);
            });

            it('reveals the fragment count of the hash', async () => {

                deck = new Deck();
                await navigate('#/0/1/1');

                expect(revealedIds()).toEqual(['f0']);
            });

            it('ignores an unmatched id silently', async () => {

                const warn = vi.spyOn(console, 'warn');

                deck = new Deck();
                await navigate('#missing');

                expect(shownIds()).toEqual([]);
                expect(warn).not.toHaveBeenCalled();
            });

            it.each(['#/2/0', '#/1/0/1', '#/x'])('warns and stays for %s', async (hash) => {

                const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

                deck = new Deck();
                await navigate(hash);

                expect(shownIds()).toEqual([]);
                expect(warn).toHaveBeenCalledTimes(1);
            });

            it('stays put on a bare #, silently', async () => {

                const warn = vi.spyOn(console, 'warn');

                deck = new Deck();
                await navigate('#/1/0');
                arrive('b', 'a0');
                await navigate('');

                expect(location.href.endsWith('#')).toBe(true);
                expect(shownIds()).toEqual(['b']);
                expect(activeIds()).toEqual(['b']);
                expect(warn).not.toHaveBeenCalled();
            });

            it('stops listening after destroy()', async () => {

                deck = new Deck();
                deck.destroy();
                await navigate('#/1/0');

                expect(shownIds()).toEqual([]);
            });
        });

        describe('writing', () => {

            it('pushes one entry per panel change, with fragments in the hash', () => {

                const before = history.length;

                deck = new Deck();
                arrive('a1', 'a0');

                expect(location.hash).toBe('#/0/1/0');

                arrive('b', 'a1');

                expect(location.hash).toBe('#/1/0');
                expect(history.length).toBe(before + 2);
            });

            it('replaces the entry on a fragment step', () => {

                deck = new Deck();
                arrive('a1', 'a0');

                const before = history.length;

                deck.next();

                expect(location.hash).toBe('#/0/1/1');
                expect(history.length).toBe(before);
            });

            it('adds no entry when the hash itself moved the deck', async () => {

                deck = new Deck();
                await navigate('#inner');

                const before = history.length;

                arrive('a1', 'a0');

                expect(location.hash).toBe('#/0/1/2');
                expect(history.length).toBe(before);
            });

            it('returns to the prior panel on back without adding an entry', async () => {

                deck = new Deck();
                arrive('b', 'a0');

                const before = history.length;

                history.back();
                await tick();
                await tick();

                expect(shownIds()).toEqual(['a0']);

                arrive('a0', 'b');

                expect(activeIds()).toEqual(['a0']);
                expect(history.length).toBe(before);
            });
        });
    });
});
