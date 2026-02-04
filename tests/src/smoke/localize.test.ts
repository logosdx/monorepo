const ns = () => (window as any).LogosDx.Localize;

describe('smoke: @logosdx/localize', () => {

    beforeAll(async () => {

        await (window as any).__loadBundle('localize');
    });

    it('namespace is loaded', () => {

        expect(ns()).toBeDefined();
    });

    it('instantiates LocaleManager with messages', () => {

        const manager = new (ns().LocaleManager)({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: { greeting: 'Hello' } },
                es: { code: 'es', text: 'Español', labels: { greeting: 'Hola' } },
            },
        });

        expect(manager).toBeDefined();
        expect(manager.current).toBe('en');
    });

    it('text() retrieves a message by key', () => {

        const manager = new (ns().LocaleManager)({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: { greeting: 'Hello' } },
            },
        });

        expect(manager.text('greeting')).toBe('Hello');
    });

    it('format() interpolates template variables', () => {

        const result = ns().format('Hello, {name}!', { name: 'World' });
        expect(result).toBe('Hello, World!');
    });

    it('changeTo() switches locale and updates messages', () => {

        const manager = new (ns().LocaleManager)({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: { greeting: 'Hello' } },
                es: { code: 'es', text: 'Español', labels: { greeting: 'Hola' } },
            },
        });

        expect(manager.text('greeting')).toBe('Hello');

        manager.changeTo('es');
        expect(manager.current).toBe('es');
        expect(manager.text('greeting')).toBe('Hola');
    });

    it('on() fires locale change events', () => {

        const manager = new (ns().LocaleManager)({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: { greeting: 'Hello' } },
                fr: { code: 'fr', text: 'Français', labels: { greeting: 'Bonjour' } },
            },
        });

        let newLocale: any = null;
        manager.on('locale-change', (e: any) => { newLocale = e.code; });

        manager.changeTo('fr');
        expect(newLocale).toBe('fr');
    });
});
