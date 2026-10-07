const NAMESPACES = {
    dom: 'Dom',
    fetch: 'Fetch',
    hooks: 'Hooks',
    localize: 'Localize',
    observer: 'Observer',
    react: 'React',
    slides: 'Slides',
    'state-machine': 'StateMachine',
    storage: 'Storage',
    utils: 'Utils',
};

/** Assigned on purpose by `@logosdx/utils` where the browser lacks them. */
const POLYFILLS = ['setImmediate', 'clearImmediate'];

/** A fresh global per bundle; a blob page keeps the origin `@logosdx/fetch` reads at load. */
async function blankFrame() {

    const frame = document.createElement('iframe');
    const page = new Blob(['<!doctype html><title>bundle</title>'], { type: 'text/html' });

    frame.src = URL.createObjectURL(page);
    document.body.append(frame);
    await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
    URL.revokeObjectURL(frame.src);

    const win = frame.contentWindow!;
    const errors: string[] = [];

    win.addEventListener('error', (event) => errors.push(event.message));

    const runScript = (code: string) => {

        const script = win.document.createElement('script');

        script.textContent = code;
        win.document.head.append(script);
    };

    return { win, errors, runScript };
}

describe('smoke: browser bundle scope', () => {

    afterEach(() => {

        document.querySelectorAll('iframe').forEach((frame) => frame.remove());
    });

    for (const [pkg, namespace] of Object.entries(NAMESPACES)) {

        it(`${pkg} declares no page global but LogosDx`, async () => {

            const { win, errors } = await blankFrame();
            const before = new Set([...Object.keys(win), ...POLYFILLS]);

            await (window as any).__loadBundle(pkg, win.document);

            expect(errors).toEqual([]);
            expect(Object.keys(win).filter((key) => !before.has(key))).toEqual(['LogosDx']);
        });

        it(`${pkg} is one assignment to its LogosDx namespace`, async () => {

            const source: string = await (window as any).__fetchPackageAsset(pkg, 'bundle.js');
            const prefix = new RegExp(
                String.raw`^this\.LogosDx\s*=\s*this\.LogosDx\s*\|\|\s*\{\};\s*` +
                String.raw`this\.LogosDx\.${namespace}\s*=`
            );
            const assigned = source
                .replace(prefix, '')
                .replace(/;?\s*\/\/# sourceMappingURL=\S+\s*$/, '');

            expect(source).toMatch(prefix);
            // Parses only if nothing follows the IIFE: a trailing `let`, `class`, or `;x` throws.
            expect(() => new Function(`return (${assigned}\n)`)).not.toThrow();
        });

        it(`${pkg} loads beside a page's own short globals`, async () => {

            const { win, errors, runScript } = await blankFrame();

            runScript('const s = 1; function h() { return "page"; }');

            await (window as any).__loadBundle(pkg, win.document);

            expect(errors).toEqual([]);
            const page = win as any;

            expect(page.LogosDx[namespace]).toBeDefined();
            expect(page.eval('s')).toBe(1);
            expect(page.h()).toBe('page');
        });
    }
});
