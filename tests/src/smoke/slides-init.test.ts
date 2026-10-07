const DECK = (attrs: string) => `
    <slides ${attrs}>
        <slide id="c0">one</slide>
        <slide id="c1">two</slide>
    </slides>
`;

const deck = () => document.querySelector('slides')!;

describe('smoke: @logosdx/slides auto-init', () => {

    afterEach(() => {

        deck().remove();
    });

    it('creates the deck for a <slides> when the bundle loads', async () => {

        document.body.insertAdjacentHTML('beforeend', DECK(''));

        await (window as any).__loadBundle('slides');

        expect(deck().hasAttribute('data-ready')).toBe(true);
        expect(document.getElementById('c0')!.hasAttribute('horizontal')).toBe(true);
        expect(() => new window.LogosDx.Slides.Deck()).toThrow(/already live/);
    });

    it('leaves a <slides manual> alone', async () => {

        document.body.insertAdjacentHTML('beforeend', DECK('manual'));

        await (window as any).__loadBundle('slides');

        expect(deck().hasAttribute('data-ready')).toBe(false);
        expect(document.getElementById('c0')!.hasAttribute('horizontal')).toBe(false);
    });
});
