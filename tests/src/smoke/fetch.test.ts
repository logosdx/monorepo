const ns = () => (window as any).LogosDx.Fetch;

describe('smoke: @logosdx/fetch', () => {

    beforeAll(async () => {

        await (window as any).__loadBundle('fetch');
    });

    it('namespace is loaded', () => {

        expect(ns()).toBeDefined();
    });

    it('instantiates FetchEngine with base config', () => {

        const engine = new (ns().FetchEngine)({ baseUrl: 'https://api.example.com' });

        expect(engine).toBeDefined();
        expect(typeof engine.get).toBe('function');
        expect(typeof engine.post).toBe('function');
        expect(typeof engine.destroy).toBe('function');

        engine.destroy();
    });

    it('headers manager supports set and has', () => {

        const engine = new (ns().FetchEngine)({ baseUrl: 'https://api.example.com' });

        engine.headers.set('Authorization', 'Bearer token123');
        expect(engine.headers.has('Authorization')).toBe(true);
        expect(engine.headers.defaults.Authorization).toBe('Bearer token123');

        engine.destroy();
    });

    it('params manager supports set and has', () => {

        const engine = new (ns().FetchEngine)({ baseUrl: 'https://api.example.com' });

        engine.params.set('page', '1');
        expect(engine.params.has('page')).toBe(true);
        expect(engine.params.defaults.page).toBe('1');

        engine.destroy();
    });

    it('subscribes to events via on()', () => {

        const engine = new (ns().FetchEngine)({ baseUrl: 'https://api.example.com' });

        const cleanup = engine.on('request', () => { /* no-op */ });

        expect(typeof cleanup).toBe('function');
        cleanup();

        engine.destroy();
    });

    it('state supports set and get', () => {

        const engine = new (ns().FetchEngine)({
            baseUrl: 'https://api.example.com',
            state: { token: '' },
        });

        engine.state.set('token', 'abc');
        expect(engine.state.get().token).toBe('abc');

        engine.destroy();
    });

    it('FetchError construction and isFetchError guard', () => {

        const { FetchError, isFetchError } = ns();
        const err = new FetchError('request failed');

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('request failed');
        expect(isFetchError(err)).toBe(true);
        expect(isFetchError(new Error('generic'))).toBe(false);
    });

    it('instantiates CachePolicy', () => {

        const policy = new (ns().CachePolicy)({ ttl: 5000 });
        expect(policy).toBeDefined();
    });

    it('instantiates DedupePolicy', () => {

        const policy = new (ns().DedupePolicy)();
        expect(policy).toBeDefined();
    });

    it('instantiates RateLimitPolicy', () => {

        const policy = new (ns().RateLimitPolicy)({ limit: 10, interval: 1000 });
        expect(policy).toBeDefined();
    });
});
