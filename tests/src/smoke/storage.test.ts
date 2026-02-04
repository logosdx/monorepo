const ns = () => (window as any).LogosDx.Storage;

// Helper to safely clear storage (handles empty storage case)
const safeClear = (adapter: any) => {

    const keys = adapter.keys();
    if (keys.length > 0) {
        adapter.clear();
    }
};

describe('smoke: @logosdx/storage', () => {

    beforeAll(async () => {

        await (window as any).__loadBundle('storage');
    });

    let adapter: any;

    beforeEach(() => {

        adapter = new (ns().StorageAdapter)(localStorage, 'smoke-test');
        safeClear(adapter);
    });

    afterEach(() => {

        safeClear(adapter);
    });

    it('namespace is loaded', () => {

        expect(ns()).toBeDefined();
    });

    it('set() and get() round-trip a value', () => {

        adapter.set('name', 'Alice');
        expect(adapter.get('name')).toBe('Alice');
    });

    it('set() accepts an object of key-value pairs', () => {

        adapter.set({ name: 'Bob', age: 30 });
        expect(adapter.get('name')).toBe('Bob');
        expect(adapter.get('age')).toBe(30);
    });

    it('has() checks key existence', () => {

        adapter.set('exists', true);
        expect(adapter.has('exists')).toBe(true);
        expect(adapter.has('missing')).toBe(false);
    });

    it('rm() removes a key', () => {

        adapter.set('temp', 'value');
        expect(adapter.has('temp')).toBe(true);

        adapter.rm('temp');
        expect(adapter.has('temp')).toBe(false);
    });

    it('wrap() provides a key-scoped accessor', () => {

        const wrapped = adapter.wrap('count');
        wrapped.set(10);
        expect(wrapped.get()).toBe(10);

        wrapped.remove();
        expect(adapter.has('count')).toBe(false);
    });

    it('assign() merges partial values into a key', () => {

        adapter.set('config', { theme: 'dark', lang: 'en' });
        adapter.assign('config', { lang: 'es' });

        const config = adapter.get('config');
        expect(config.theme).toBe('dark');
        expect(config.lang).toBe('es');
    });

    it('on() fires storage-after-set event', () => {

        let eventKey: any = null;
        adapter.on('storage-after-set', (e: any) => { eventKey = e.key; });

        adapter.set('trigger', 'value');
        expect(eventKey).toBe('trigger');
    });

    it('clear() removes all values', () => {

        adapter.set({ a: 1, b: 2, c: 3 });
        adapter.clear();

        expect(adapter.has('a')).toBe(false);
        expect(adapter.has('b')).toBe(false);
        expect(adapter.has('c')).toBe(false);
    });
});
