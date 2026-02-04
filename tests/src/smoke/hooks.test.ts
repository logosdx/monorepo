const ns = () => (window as any).LogosDx.Hooks;

describe('smoke: @logosdx/hooks', () => {

    beforeAll(async () => {

        await (window as any).__loadBundle('hooks');
    });

    it('namespace is loaded', () => {

        expect(ns()).toBeDefined();
    });

    it('instantiates HookEngine and registers hooks', () => {

        const engine = new (ns().HookEngine)();

        engine.register('beforeSave', 'afterSave');
        expect(engine).toBeDefined();
    });

    it('on() subscribes and emit() fires a hook', async () => {

        const engine = new (ns().HookEngine)();
        engine.register('onLoad');

        let called = false;
        engine.on('onLoad', {
            callback: async () => { called = true; },
        });

        await engine.emit('onLoad');
        expect(called).toBe(true);
    });

    it('once() fires exactly once', async () => {

        const engine = new (ns().HookEngine)();
        engine.register('init');

        let count = 0;
        engine.once('init', async () => { count++; });

        await engine.emit('init');
        await engine.emit('init');
        expect(count).toBe(1);
    });

    it('emit() provides context with args', async () => {

        const engine = new (ns().HookEngine)();
        engine.register('process');

        let receivedArgs: any = null;
        engine.on('process', {
            callback: async (ctx: any) => { receivedArgs = ctx.args; },
        });

        await engine.emit('process', 'hello', 42);
        expect(receivedArgs).toEqual(['hello', 42]);
    });

    it('context setResult() modifies the emit result', async () => {

        const engine = new (ns().HookEngine)();
        engine.register('transform');

        engine.on('transform', {
            callback: async (ctx: any) => { ctx.setResult('modified'); },
        });

        const result = await engine.emit('transform');
        expect(result.result).toBe('modified');
    });

    it('wrap() wraps a function with pre/post hooks', async () => {

        const engine = new (ns().HookEngine)();
        engine.register('beforeCall', 'afterCall');

        const order: string[] = [];

        engine.on('beforeCall', {
            callback: async () => { order.push('pre'); },
        });

        engine.on('afterCall', {
            callback: async () => { order.push('post'); },
        });

        const wrapped = engine.wrap(
            async (x: number) => {

                order.push('fn');
                return x * 2;
            },
            { pre: 'beforeCall', post: 'afterCall' },
        );

        const result = await wrapped(5);

        expect(result).toBe(10);
        expect(order).toEqual(['pre', 'fn', 'post']);
    });

    it('HookError and isHookError guard', () => {

        const { HookError, isHookError } = ns();
        const err = new HookError('hook failed');

        expect(err).toBeInstanceOf(Error);
        expect(isHookError(err)).toBe(true);
        expect(isHookError(new Error('generic'))).toBe(false);
    });
});
