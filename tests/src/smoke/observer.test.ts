const ns = () => (window as any).LogosDx.Observer;

describe('smoke: @logosdx/observer', () => {

    beforeAll(async () => {

        await (window as any).__loadBundle('observer');
    });

    it('namespace is loaded', () => {

        expect(ns()).toBeDefined();
    });

    it('instantiates ObserverEngine and subscribes to events', () => {

        const obs = new (ns().ObserverEngine)();
        let received: any = null;

        obs.on('test-event', (data: any) => { received = data; });
        obs.emit('test-event', { value: 42 });

        expect(received).toEqual({ value: 42 });
    });

    it('unsubscribe prevents further callbacks', () => {

        const obs = new (ns().ObserverEngine)();
        let count = 0;

        const cleanup = obs.on('ping', () => { count++; });
        obs.emit('ping');
        expect(count).toBe(1);

        cleanup();
        obs.emit('ping');
        expect(count).toBe(1);
    });

    it('once() fires exactly once', () => {

        const obs = new (ns().ObserverEngine)();
        let count = 0;

        obs.once('single', () => { count++; });
        obs.emit('single');
        obs.emit('single');

        expect(count).toBe(1);
    });

    it('regex pattern matching triggers on matching events', () => {

        const obs = new (ns().ObserverEngine)();
        const matched: string[] = [];

        obs.on(/^user:/, (rgx: any) => { matched.push(rgx.data); });
        obs.emit('user:login', 'alice');
        obs.emit('user:logout', 'bob');
        obs.emit('system:boot', 'nope');

        expect(matched).toEqual(['alice', 'bob']);
    });

    it('event data propagation passes data to listeners', () => {

        const obs = new (ns().ObserverEngine)();
        const results: any[] = [];

        obs.on('data', (d: any) => results.push(d));
        obs.emit('data', 'first');
        obs.emit('data', 'second');

        expect(results).toEqual(['first', 'second']);
    });

    it('EventQueue is created via queue()', () => {

        const obs = new (ns().ObserverEngine)();
        const processed: any[] = [];

        const q = obs.queue('job', (data: any) => {

            processed.push(data);
        }, { name: 'smoke-queue', concurrency: 1 });

        // Queue was created without error
        expect(q).toBeDefined();
    });
});
