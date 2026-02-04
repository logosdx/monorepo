const ns = () => (window as any).LogosDx.Kit;

// Helper to safely clear storage (handles empty storage case)
const safeClear = (storage: any) => {

    const keys = storage.keys();
    if (keys.length > 0) {
        storage.clear();
    }
};

describe('smoke: @logosdx/kit', () => {

    beforeAll(async () => {

        await (window as any).__loadBundle('kit');
    });

    it('namespace is loaded', () => {

        expect(ns()).toBeDefined();
    });

    it('appKit() creates a minimal kit with observer only', () => {

        const kit = ns().appKit({
            observer: {},
        });

        expect(kit.observer).toBeDefined();
        expect(typeof kit.observer.on).toBe('function');
        expect(typeof kit.observer.emit).toBe('function');
    });

    it('appKit() creates a full kit with all components', () => {

        const kit = ns().appKit({
            observer: {},
            storage: {
                implementation: localStorage,
                prefix: 'smoke-kit',
            },
            locales: {
                current: 'en',
                fallback: 'en',
                locales: {
                    en: { label: 'English', messages: { hello: 'Hi' } },
                },
            },
            stateMachine: {
                initial: { count: 0 },
                reducer: (val: any) => val,
            },
            fetch: {
                baseUrl: 'https://api.example.com',
            },
        });

        expect(kit.observer).toBeDefined();
        expect(kit.storage).toBeDefined();
        expect(kit.locale).toBeDefined();
        expect(kit.stateMachine).toBeDefined();
        expect(kit.fetch).toBeDefined();

        kit.fetch.destroy();
        safeClear(kit.storage);
    });

    it('kit observer can emit and receive events', () => {

        const kit = ns().appKit({ observer: {} });

        let received: any = null;
        kit.observer.on('smoke', (d: any) => { received = d; });
        kit.observer.emit('smoke', 'hello');

        expect(received).toBe('hello');
    });

    it('kit stateMachine dispatches and reads state', () => {

        const kit = ns().appKit({
            stateMachine: {
                initial: { value: 0 },
                reducer: (val: any) => val,
            },
        });

        kit.stateMachine.dispatch({ value: 42 });
        expect(kit.stateMachine.state()).toEqual({ value: 42 });
    });

    it('kit storage round-trips values', () => {

        const kit = ns().appKit({
            storage: {
                implementation: localStorage,
                prefix: 'smoke-kit-rt',
            },
        });

        kit.storage.set('key', 'val');
        expect(kit.storage.get('key')).toBe('val');

        safeClear(kit.storage);
    });
});
