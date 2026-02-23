import {
    describe,
    it,
    expect,
    vi
} from 'vitest';

import {
    HookEngine,
    HookError,
    isHookError,
    HookContext,
    HookScope
} from '../../packages/hooks/src/index.ts';

import { attempt, attemptSync } from '../../packages/utils/src/index.ts';

describe('@logosdx/hooks', () => {

    describe('HookEngine instantiation', () => {

        it('instantiates with no options', () => {

            const engine = new HookEngine();
            expect(engine).to.be.instanceOf(HookEngine);
        });

        it('instantiates with custom handleFail', () => {

            class CustomError extends Error {}

            const engine = new HookEngine({
                handleFail: CustomError
            });

            expect(engine).to.be.instanceOf(HookEngine);
        });

        it('is permissive by default (accepts any hook name)', async () => {

            const engine = new HookEngine();
            const callback = vi.fn();

            engine.add('anyHookName', callback);
            engine.add('anotherHook', callback);

            await engine.run('anyHookName');
            await engine.run('anotherHook', 'arg1', 'arg2');

            expect(callback).toHaveBeenCalledTimes(2);
        });
    });

    describe('engine.register()', () => {

        it('returns this for chaining', () => {

            const engine = new HookEngine();
            const result = engine.register('hook1', 'hook2');

            expect(result).to.equal(engine);
        });

        it('requires at least one hook name', () => {

            const engine = new HookEngine();

            expect(() => engine.register()).to.throw();
        });

        it('enables strict mode after first registration', async () => {

            const engine = new HookEngine();

            engine.add('anyHook', () => {});

            engine.clear();
            engine.register('allowedHook');

            expect(() => engine.add('unregisteredHook', () => {})).to.throw(/not registered/);
        });

        it('allows registered hooks', async () => {

            const engine = new HookEngine();
            const callback = vi.fn();

            engine.register('myHook');
            engine.add('myHook', callback);

            await engine.run('myHook');

            expect(callback).toHaveBeenCalledOnce();
        });

        it('throws on unregistered hook in add()', () => {

            const engine = new HookEngine();
            engine.register('validHook');

            expect(() => engine.add('invalidHook', () => {})).to.throw(
                /Hook "invalidHook" is not registered/
            );
        });

        it('throws on unregistered hook in run()', async () => {

            const engine = new HookEngine();
            engine.register('validHook');

            await expect(engine.run('invalidHook')).rejects.toThrow(
                /Hook "invalidHook" is not registered/
            );
        });

        it('throws on unregistered hook in runSync()', () => {

            const engine = new HookEngine();
            engine.register('validHook');

            expect(() => engine.runSync('invalidHook')).to.throw(
                /Hook "invalidHook" is not registered/
            );
        });

        it('throws on unregistered hook in wrap()', () => {

            const engine = new HookEngine();
            engine.register('preValid');

            expect(() => engine.wrap(
                async () => 'result',
                { pre: 'preInvalid' }
            )).to.throw(/Hook "preInvalid" is not registered/);
        });

        it('shows registered hooks in error message', () => {

            const engine = new HookEngine();
            engine.register('preRequest', 'postRequest', 'rateLimit');

            expect(() => engine.add('preRequset', () => {})).to.throw(
                /Registered hooks: preRequest, postRequest, rateLimit/
            );
        });

        it('clear() resets to permissive mode', async () => {

            const engine = new HookEngine();
            engine.register('strictHook');

            expect(() => engine.add('unregistered', () => {})).to.throw();

            engine.clear();

            engine.add('anyHook', () => {});
            await engine.run('anyHook');
        });
    });

    describe('engine.add()', () => {

        it('returns unsubscribe function', async () => {

            const engine = new HookEngine();
            const callback = vi.fn();

            const unsub = engine.add('test', callback);

            await engine.run('test');
            expect(callback).toHaveBeenCalledOnce();

            unsub();

            await engine.run('test');
            expect(callback).toHaveBeenCalledOnce();
        });

        it('rejects invalid name', () => {

            const engine = new HookEngine();

            expect(() => engine.add(null as any, () => {})).to.throw();
            expect(() => engine.add(123 as any, () => {})).to.throw();
        });

        it('rejects invalid callback', () => {

            const engine = new HookEngine();

            expect(() => engine.add('test', null as any)).to.throw();
            expect(() => engine.add('test', 'notAFunction' as any)).to.throw();
        });

        it('supports priority ordering', async () => {

            const engine = new HookEngine();
            const order: number[] = [];

            engine.add('test', () => { order.push(2); }, { priority: 0 });
            engine.add('test', () => { order.push(1); }, { priority: -10 });
            engine.add('test', () => { order.push(3); }, { priority: 10 });

            await engine.run('test');

            expect(order).to.deep.equal([1, 2, 3]);
        });

        it('maintains insertion order for same priority', async () => {

            const engine = new HookEngine();
            const order: number[] = [];

            engine.add('test', () => { order.push(1); });
            engine.add('test', () => { order.push(2); });
            engine.add('test', () => { order.push(3); });

            await engine.run('test');

            expect(order).to.deep.equal([1, 2, 3]);
        });

        it('supports times option', async () => {

            const engine = new HookEngine();
            const callback = vi.fn();

            engine.add('test', callback, { times: 3 });

            await engine.run('test');
            await engine.run('test');
            await engine.run('test');
            await engine.run('test');
            await engine.run('test');

            expect(callback).toHaveBeenCalledTimes(3);
        });

        it('supports once option', async () => {

            const engine = new HookEngine();
            const callback = vi.fn();

            engine.add('test', callback, { once: true });

            await engine.run('test');
            await engine.run('test');
            await engine.run('test');

            expect(callback).toHaveBeenCalledOnce();
        });

        it('supports ignoreOnFail option', async () => {

            const engine = new HookEngine();
            const afterCallback = vi.fn();

            engine.add('test', () => { throw new Error('Should be ignored'); }, { ignoreOnFail: true });
            engine.add('test', afterCallback);

            const [, err] = await attempt(() => engine.run('test'));

            expect(err).to.be.null;
            expect(afterCallback).toHaveBeenCalledOnce();
        });

        it('ignoreOnFail swallows ctx.fail() errors', async () => {

            const engine = new HookEngine();
            const afterCallback = vi.fn();

            engine.add('test', ((_ctx: any) => { _ctx.fail('Ignored'); }) as any, { ignoreOnFail: true });
            engine.add('test', afterCallback);

            const [, err] = await attempt(() => engine.run('test'));

            expect(err).to.be.null;
            expect(afterCallback).toHaveBeenCalledOnce();
        });
    });

    describe('engine.run()', () => {

        it('runs callbacks in priority order', async () => {

            const engine = new HookEngine();
            const order: string[] = [];

            engine.add('test', () => { order.push('user'); }, { priority: 0 });
            engine.add('test', () => { order.push('plugin'); }, { priority: -20 });
            engine.add('test', () => { order.push('late'); }, { priority: 10 });

            await engine.run('test');

            expect(order).to.deep.equal(['plugin', 'user', 'late']);
        });

        it('passes spread args + ctx as last param', async () => {

            const engine = new HookEngine();
            let receivedArgs: unknown[] = [];

            engine.add('test', (...args: any[]) => {

                receivedArgs = args;
            });

            await engine.run('test', 'hello', 42);

            expect(receivedArgs.length).to.equal(3);
            expect(receivedArgs[0]).to.equal('hello');
            expect(receivedArgs[1]).to.equal(42);
            expect(receivedArgs[2]).to.be.instanceOf(HookContext);
        });

        it('ctx.args() replaces args for downstream', async () => {

            const engine = new HookEngine();
            let secondReceivedArgs: unknown[] = [];

            engine.add('test', ((_value: string, ctx: any) => {

                ctx.args('modified');
            }) as any);

            engine.add('test', (...args: any[]) => {

                secondReceivedArgs = args.slice(0, -1);
            });

            await engine.run('test', 'original');

            expect(secondReceivedArgs).to.deep.equal(['modified']);
        });

        it('ctx.args() without return continues chain', async () => {

            const engine = new HookEngine();
            const order: number[] = [];

            engine.add('test', ((_value: string, ctx: any) => {

                ctx.args('modified');
                order.push(1);
            }) as any);

            engine.add('test', () => {

                order.push(2);
            });

            await engine.run('test', 'original');

            expect(order).to.deep.equal([1, 2]);
        });

        it('return ctx.args() stops chain', async () => {

            const engine = new HookEngine();
            const secondCallback = vi.fn();

            engine.add('test', ((_value: string, ctx: any) => {

                return ctx.args('modified');
            }) as any);

            engine.add('test', secondCallback);

            const result = await engine.run('test', 'original');

            expect(secondCallback).not.toHaveBeenCalled();
            expect(result.args).to.deep.equal(['modified']);
            expect(result.returned).to.be.true;
        });

        it('ctx.returns() short-circuits with result', async () => {

            const engine = new HookEngine();
            const secondCallback = vi.fn();

            engine.add('test', ((_value: string, ctx: any) => {

                return ctx.returns('cached');
            }) as any);

            engine.add('test', secondCallback);

            const result = await engine.run('test', 'original');

            expect(secondCallback).not.toHaveBeenCalled();
            expect(result.result).to.equal('cached');
            expect(result.returned).to.be.true;
        });

        it('ctx.fail() throws', async () => {

            const engine = new HookEngine();

            engine.add('test', ((_value: string, ctx: any) => {

                ctx.fail('Validation failed');
            }) as any);

            const [, err] = await attempt(() => engine.run('test', 'value'));

            expect(isHookError(err)).to.be.true;
            expect(err).to.have.property('message').that.includes('Validation failed');
        });

        it('ctx.fail() sets hookName on HookError', async () => {

            const engine = new HookEngine();

            engine.add('validate', ((_ctx: any) => {

                _ctx.fail('Invalid');
            }) as any);

            const [, err] = await attempt(() => engine.run('validate'));

            expect(isHookError(err)).to.be.true;
            expect(err).to.have.property('hookName', 'validate');
        });

        it('ctx.removeHook() self-removes', async () => {

            const engine = new HookEngine();
            let callCount = 0;

            engine.add('test', ((_ctx: any) => {

                callCount++;

                if (callCount >= 2) {

                    _ctx.removeHook();
                }
            }) as any);

            await engine.run('test');
            await engine.run('test');
            await engine.run('test');
            await engine.run('test');

            expect(callCount).to.equal(2);
        });

        it('ctx.removeHook() removes only the current callback', async () => {

            const engine = new HookEngine();
            const firstFn = vi.fn();
            const selfRemovingFn = vi.fn((_ctx: any) => _ctx.removeHook()) as any;
            const lastFn = vi.fn();

            engine.add('test', firstFn);
            engine.add('test', selfRemovingFn);
            engine.add('test', lastFn);

            await engine.run('test');

            expect(firstFn).toHaveBeenCalledOnce();
            expect(selfRemovingFn).toHaveBeenCalledOnce();
            expect(lastFn).toHaveBeenCalledOnce();

            firstFn.mockReset();
            selfRemovingFn.mockReset();
            lastFn.mockReset();

            await engine.run('test');

            expect(firstFn).toHaveBeenCalledOnce();
            expect(selfRemovingFn).not.toHaveBeenCalled();
            expect(lastFn).toHaveBeenCalledOnce();
        });

        it('RunOptions.append runs last', async () => {

            const engine = new HookEngine();
            const order: string[] = [];

            engine.add('test', () => { order.push('registered'); });

            await engine.run('test', { append: (() => { order.push('appended'); }) as any } as any);

            expect(order).to.deep.equal(['registered', 'appended']);
        });

        it('returns unchanged args when no hooks registered', async () => {

            const engine = new HookEngine();

            const result = await engine.run('test', 'hello', 42);

            expect(result.args).to.deep.equal(['hello', 42]);
            expect(result.returned).to.be.false;
            expect(result.result).to.be.undefined;
        });

        it('propagates user-thrown errors as-is', async () => {

            class CustomError extends Error {

                code = 'CUSTOM';
            }

            const engine = new HookEngine();

            engine.add('test', () => {

                throw new CustomError('Custom error');
            });

            const [, err] = await attempt(() => engine.run('test'));

            expect(err).to.be.instanceOf(CustomError);
            expect(isHookError(err)).to.be.false;
            expect((err as CustomError).code).to.equal('CUSTOM');
        });

        it('stops at first error without ignoreOnFail', async () => {

            const engine = new HookEngine();
            const secondCallback = vi.fn();

            engine.add('test', () => {

                throw new Error('First error');
            });

            engine.add('test', secondCallback);

            await attempt(() => engine.run('test'));

            expect(secondCallback).not.toHaveBeenCalled();
        });
    });

    describe('engine.runSync()', () => {

        it('runs callbacks synchronously', () => {

            const engine = new HookEngine();
            const order: number[] = [];

            engine.add('test', () => { order.push(1); });
            engine.add('test', () => { order.push(2); });

            const result = engine.runSync('test');

            expect(order).to.deep.equal([1, 2]);
            expect(result.returned).to.be.false;
        });

        it('spread args + ctx', () => {

            const engine = new HookEngine();
            let received: unknown[] = [];

            engine.add('test', (...args: any[]) => {

                received = args;
            });

            engine.runSync('test', 'hello', 42);

            expect(received.length).to.equal(3);
            expect(received[0]).to.equal('hello');
            expect(received[1]).to.equal(42);
            expect(received[2]).to.be.instanceOf(HookContext);
        });

        it('ctx.args() replaces args', () => {

            const engine = new HookEngine();
            let secondArgs: unknown[] = [];

            engine.add('test', ((_value: string, ctx: any) => {

                ctx.args('modified');
            }) as any);

            engine.add('test', (...args: any[]) => {

                secondArgs = args.slice(0, -1);
            });

            engine.runSync('test', 'original');

            expect(secondArgs).to.deep.equal(['modified']);
        });

        it('return ctx.args() stops chain', () => {

            const engine = new HookEngine();
            const second = vi.fn();

            engine.add('test', ((_val: string, ctx: any) => {

                return ctx.args('modified');
            }) as any);

            engine.add('test', second);

            const result = engine.runSync('test', 'original');

            expect(second).not.toHaveBeenCalled();
            expect(result.args).to.deep.equal(['modified']);
            expect(result.returned).to.be.true;
        });

        it('ctx.returns() short-circuits', () => {

            const engine = new HookEngine();
            const second = vi.fn();

            engine.add('test', ((_val: string, ctx: any) => {

                return ctx.returns('cached');
            }) as any);

            engine.add('test', second);

            const result = engine.runSync('test', 'original');

            expect(second).not.toHaveBeenCalled();
            expect(result.result).to.equal('cached');
            expect(result.returned).to.be.true;
        });

        it('ctx.fail() throws', () => {

            const engine = new HookEngine();

            engine.add('test', ((_ctx: any) => {

                _ctx.fail('Failed');
            }) as any);

            const [, err] = attemptSync(() => engine.runSync('test'));

            expect(isHookError(err)).to.be.true;
        });

        it('supports priority ordering', () => {

            const engine = new HookEngine();
            const order: number[] = [];

            engine.add('test', () => { order.push(2); }, { priority: 0 });
            engine.add('test', () => { order.push(1); }, { priority: -10 });
            engine.add('test', () => { order.push(3); }, { priority: 10 });

            engine.runSync('test');

            expect(order).to.deep.equal([1, 2, 3]);
        });

        it('supports times option', () => {

            const engine = new HookEngine();
            const callback = vi.fn();

            engine.add('test', callback, { times: 2 });

            engine.runSync('test');
            engine.runSync('test');
            engine.runSync('test');

            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('supports ignoreOnFail option', () => {

            const engine = new HookEngine();
            const afterCallback = vi.fn();

            engine.add('test', () => { throw new Error('Ignored'); }, { ignoreOnFail: true });
            engine.add('test', afterCallback);

            const [, err] = attemptSync(() => engine.runSync('test'));

            expect(err).to.be.null;
            expect(afterCallback).toHaveBeenCalledOnce();
        });
    });

    describe('engine.wrap()', () => {

        it('wraps with pre hook only', async () => {

            const engine = new HookEngine();
            const preCallback = vi.fn();

            engine.add('preProcess', preCallback);

            const wrapped = engine.wrap(
                async (value: number) => value * 2,
                { pre: 'preProcess' }
            );

            const result = await wrapped(5);

            expect(result).to.equal(10);
            expect(preCallback).toHaveBeenCalledOnce();
        });

        it('wraps with post hook only', async () => {

            const engine = new HookEngine();
            const postCallback = vi.fn();

            engine.add('postProcess', postCallback);

            const wrapped = engine.wrap(
                async (value: number) => value * 2,
                { post: 'postProcess' }
            );

            const result = await wrapped(5);

            expect(result).to.equal(10);
            expect(postCallback).toHaveBeenCalledOnce();
        });

        it('pre hook can modify arguments', async () => {

            const engine = new HookEngine();

            engine.add('preAdd', ((a: number, b: number, ctx: any) => {

                ctx.args(a * 10, b * 10);
            }) as any);

            const wrapped = engine.wrap(
                async (a: number, b: number) => a + b,
                { pre: 'preAdd' }
            );

            const result = await wrapped(2, 3);

            expect(result).to.equal(50);
        });

        it('early return from pre skips fn', async () => {

            const engine = new HookEngine();
            const cache = new Map([['foo', 'cached-foo']]);
            const actualFn = vi.fn(async (key: string) => `fetched-${key}`);

            engine.add('preGet', ((key: string, ctx: any) => {

                const cached = cache.get(key);

                if (cached) return ctx.returns(cached);
            }) as any);

            const wrapped = engine.wrap(actualFn, { pre: 'preGet' });

            const cachedResult = await wrapped('foo');
            expect(cachedResult).to.equal('cached-foo');
            expect(actualFn).not.toHaveBeenCalled();

            const freshResult = await wrapped('bar');
            expect(freshResult).to.equal('fetched-bar');
            expect(actualFn).toHaveBeenCalledOnce();
        });

        it('post hook can transform result', async () => {

            const engine = new HookEngine();

            engine.add('postDouble', ((result: number, _input: number, ctx: any) => {

                return ctx.returns(result * 2);
            }) as any);

            const wrapped = engine.wrap(
                async (input: number) => input + 1,
                { post: 'postDouble' }
            );

            const result = await wrapped(5);

            expect(result).to.equal(12);
        });

        it('works with both pre and post hooks', async () => {

            const engine = new HookEngine();
            const callOrder: string[] = [];

            engine.add('preTransform', ((value: string, ctx: any) => {

                callOrder.push('pre');
                ctx.args(value.toUpperCase());
            }) as any);

            engine.add('postTransform', ((result: string, _value: string, ctx: any) => {

                callOrder.push('post');
                return ctx.returns(`[${result}]`);
            }) as any);

            const wrapped = engine.wrap(
                async (value: string) => `processed:${value}`,
                { pre: 'preTransform', post: 'postTransform' }
            );

            const result = await wrapped('hello');

            expect(callOrder).to.deep.equal(['pre', 'post']);
            expect(result).to.equal('[processed:HELLO]');
        });

        it('pre early return skips fn and post hook', async () => {

            const engine = new HookEngine();
            const fetchFn = vi.fn(async (url: string) => `fetched:${url}`);
            const postCallback = vi.fn();

            engine.add('preFetch', ((_url: string, ctx: any) => {

                return ctx.returns('cached-result');
            }) as any);

            engine.add('postFetch', postCallback);

            const wrapped = engine.wrap(fetchFn, { pre: 'preFetch', post: 'postFetch' });

            const result = await wrapped('https://example.com');

            expect(result).to.equal('cached-result');
            expect(fetchFn).not.toHaveBeenCalled();
            expect(postCallback).not.toHaveBeenCalled();
        });

        it('passes result and args to post hook', async () => {

            const engine = new HookEngine();
            let receivedArgs: unknown[] = [];

            engine.add('postLog', (...args: any[]) => {

                receivedArgs = args.slice(0, -1);
            });

            const wrapped = engine.wrap(
                async (a: number, b: number) => a + b,
                { post: 'postLog' }
            );

            await wrapped(3, 7);

            expect(receivedArgs).to.deep.equal([10, 3, 7]);
        });

        it('throws when neither pre nor post provided', () => {

            const engine = new HookEngine();

            expect(() => engine.wrap(
                async () => 'result',
                {} as any
            )).to.throw(/requires at least one of "pre" or "post"/);
        });
    });

    describe('engine.wrapSync()', () => {

        it('wraps with pre hook only', () => {

            const engine = new HookEngine();
            const preCallback = vi.fn();

            engine.add('preProcess', preCallback);

            const wrapped = engine.wrapSync(
                (value: number) => value * 2,
                { pre: 'preProcess' }
            );

            const result = wrapped(5);

            expect(result).to.equal(10);
            expect(preCallback).toHaveBeenCalledOnce();
        });

        it('wraps with post hook only', () => {

            const engine = new HookEngine();

            engine.add('postDouble', ((result: number, _input: number, ctx: any) => {

                return ctx.returns(result * 2);
            }) as any);

            const wrapped = engine.wrapSync(
                (input: number) => input + 1,
                { post: 'postDouble' }
            );

            const result = wrapped(5);

            expect(result).to.equal(12);
        });

        it('pre hook early return skips fn', () => {

            const engine = new HookEngine();
            const actualFn = vi.fn((key: string) => `computed-${key}`);

            engine.add('preGet', ((key: string, ctx: any) => {

                if (key === 'cached') return ctx.returns('from-cache');
            }) as any);

            const wrapped = engine.wrapSync(actualFn, { pre: 'preGet' });

            expect(wrapped('cached')).to.equal('from-cache');
            expect(actualFn).not.toHaveBeenCalled();

            expect(wrapped('fresh')).to.equal('computed-fresh');
            expect(actualFn).toHaveBeenCalledOnce();
        });

        it('pre hook can modify args', () => {

            const engine = new HookEngine();

            engine.add('preAdd', ((a: number, b: number, ctx: any) => {

                ctx.args(a * 10, b * 10);
            }) as any);

            const wrapped = engine.wrapSync(
                (a: number, b: number) => a + b,
                { pre: 'preAdd' }
            );

            expect(wrapped(2, 3)).to.equal(50);
        });

        it('throws when neither pre nor post provided', () => {

            const engine = new HookEngine();

            expect(() => engine.wrapSync(
                () => 'result',
                {} as any
            )).to.throw(/requires at least one of "pre" or "post"/);
        });
    });

    describe('engine.clear()', () => {

        it('removes all hooks', async () => {

            const engine = new HookEngine();
            const callback = vi.fn();

            engine.add('test', callback);

            await engine.run('test');
            expect(callback).toHaveBeenCalledOnce();

            engine.clear();

            await engine.run('test');
            expect(callback).toHaveBeenCalledOnce();
        });

        it('allows re-registration after clear', async () => {

            const engine = new HookEngine();
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            engine.add('test', callback1);
            engine.clear();
            engine.add('test', callback2);

            await engine.run('test');

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledOnce();
        });

        it('resets times tracking', async () => {

            const engine = new HookEngine();
            const callback = vi.fn();

            engine.add('test', callback, { times: 1 });
            await engine.run('test');
            expect(callback).toHaveBeenCalledOnce();

            engine.clear();

            engine.add('test', callback, { times: 1 });
            await engine.run('test');
            expect(callback).toHaveBeenCalledTimes(2);
        });
    });

    describe('HookError / isHookError', () => {

        it('returns true for HookError instances', () => {

            const error = new HookError('Test error');

            expect(isHookError(error)).to.be.true;
        });

        it('returns false for regular Error instances', () => {

            const error = new Error('Regular error');

            expect(isHookError(error)).to.be.false;
        });

        it('returns false for non-error values', () => {

            expect(isHookError(null)).to.be.false;
            expect(isHookError(undefined)).to.be.false;
            expect(isHookError('string')).to.be.false;
            expect(isHookError(123)).to.be.false;
            expect(isHookError({})).to.be.false;
        });
    });

    describe('custom handleFail', () => {

        it('uses Error constructor with single argument', async () => {

            class CustomError extends Error {

                name = 'CustomError';
            }

            const engine = new HookEngine<any, [string]>({
                handleFail: CustomError
            });

            engine.add('test', ((_ctx: any) => {

                _ctx.fail('Custom message');
            }) as any);

            const [, err] = await attempt(() => engine.run('test'));

            expect(err).to.be.instanceOf(CustomError);
            expect(err).to.have.property('message', 'Custom message');
        });

        it('uses Error constructor with multiple arguments (Firebase-style)', async () => {

            class HttpsError extends Error {

                code: string;
                details?: object | undefined;

                constructor(code: string, message: string, details?: object | undefined) {

                    super(message);
                    this.code = code;
                    this.details = details;
                }
            }

            const engine = new HookEngine<any, [string, string, object?]>({
                handleFail: HttpsError
            });

            engine.add('validate', ((_ctx: any) => {

                _ctx.fail('failed-precondition', 'Email is required', { field: 'email' });
            }) as any);

            const [, err] = await attempt(() => engine.run('validate'));

            expect(err).to.be.instanceOf(HttpsError);
            expect(err).to.have.property('code', 'failed-precondition');
            expect(err).to.have.property('message', 'Email is required');
            expect(err).to.have.property('details').that.deep.equals({ field: 'email' });
        });

        it('uses custom function that throws', async () => {

            const engine = new HookEngine<any, [string, number]>({
                handleFail: (message: string, code: number): never => {

                    const error = new Error(message);
                    (error as any).code = code;
                    throw error;
                }
            });

            engine.add('test', ((_ctx: any) => {

                _ctx.fail('Error message', 500);
            }) as any);

            const [, err] = await attempt(() => engine.run('test'));

            expect(err).to.have.property('message', 'Error message');
            expect(err).to.have.property('code', 500);
        });

        it('passes all arguments to handleFail function', async () => {

            const receivedArgs: unknown[] = [];

            const engine = new HookEngine<any, [string, object, number]>({
                handleFail: (message: string, data: object, code: number): never => {

                    receivedArgs.push(message, data, code);
                    throw new Error('fail');
                }
            });

            engine.add('test', ((_ctx: any) => {

                _ctx.fail('message', { data: true }, 123);
            }) as any);

            await attempt(() => engine.run('test'));

            expect(receivedArgs).to.deep.equal(['message', { data: true }, 123]);
        });
    });

    describe('real-world patterns', () => {

        it('caching with early return', async () => {

            const engine = new HookEngine();
            const cache = new Map([['cached-url', 'cached-data']]);

            engine.add('cacheCheck', ((url: string, ctx: any) => {

                const cached = cache.get(url);

                if (cached) return ctx.returns(cached);
            }) as any);

            const cachedResult = await engine.run('cacheCheck', 'cached-url');
            expect(cachedResult.result).to.equal('cached-data');
            expect(cachedResult.returned).to.be.true;

            const missResult = await engine.run('cacheCheck', 'not-cached');
            expect(missResult.result).to.be.undefined;
            expect(missResult.returned).to.be.false;
        });

        it('validation with fail', async () => {

            const engine = new HookEngine();

            engine.add('validate', ((data: { email?: string }, ctx: any) => {

                if (!data.email) ctx.fail('Email is required');
            }) as any);

            const [, err] = await attempt(() => engine.run('validate', {}));

            expect(isHookError(err)).to.be.true;
            expect(err?.message).to.include('Email is required');

            const [result] = await attempt(() => engine.run('validate', { email: 'test@example.com' }));

            expect(result).to.have.property('returned', false);
        });

        it('auth header injection', async () => {

            const engine = new HookEngine();

            engine.add('beforeRequest', ((url: string, opts: any, ctx: any) => {

                ctx.args(url, {
                    ...opts,
                    headers: { ...opts?.headers, Authorization: 'Bearer token123' }
                });
            }) as any);

            const result = await engine.run('beforeRequest', '/api/users', {});

            expect(result.args[1]).to.deep.equal({
                headers: { Authorization: 'Bearer token123' }
            });
        });

        it('composable hooks (multiple add calls)', async () => {

            const engine = new HookEngine();
            const callOrder: string[] = [];

            engine.add('beforeRequest', () => { callOrder.push('auth'); }, { priority: -10 });
            engine.add('beforeRequest', () => { callOrder.push('logging'); }, { priority: 10 });
            engine.add('beforeRequest', () => { callOrder.push('validation'); }, { priority: 0 });

            await engine.run('beforeRequest', '/api/data', {});

            expect(callOrder).to.deep.equal(['auth', 'validation', 'logging']);
        });

        it('analytics pattern with ignoreOnFail', async () => {

            const engine = new HookEngine();
            const tracked: string[] = [];
            const importantCallback = vi.fn();

            engine.add('action', ((name: string) => {

                if (name === 'fail') throw new Error('Analytics failed');
                tracked.push(name);
            }) as any, { ignoreOnFail: true });

            engine.add('action', importantCallback);

            await engine.run('action', 'click');
            await engine.run('action', 'fail');
            await engine.run('action', 'scroll');

            expect(tracked).to.deep.equal(['click', 'scroll']);
            expect(importantCallback).toHaveBeenCalledTimes(3);
        });
    });

    describe('HookScope', () => {

        it('provides get/set/has/delete for symbol keys', () => {

            const scope = new HookScope();
            const KEY = Symbol('test');

            expect(scope.has(KEY)).to.be.false;

            scope.set(KEY, 42);
            expect(scope.has(KEY)).to.be.true;
            expect(scope.get(KEY)).to.equal(42);

            scope.delete(KEY);
            expect(scope.has(KEY)).to.be.false;
            expect(scope.get(KEY)).to.be.undefined;
        });

        it('provides get/set/has/delete for string keys', () => {

            const scope = new HookScope();

            scope.set('serializedKey', 'GET|/users');
            expect(scope.get('serializedKey')).to.equal('GET|/users');
            expect(scope.has('serializedKey')).to.be.true;

            scope.delete('serializedKey');
            expect(scope.has('serializedKey')).to.be.false;
        });

        it('isolates symbol keys from string keys', () => {

            const scope = new HookScope();
            const KEY = Symbol('name');

            scope.set(KEY, 'symbol-value');
            scope.set('name', 'string-value');

            expect(scope.get(KEY)).to.equal('symbol-value');
            expect(scope.get('name')).to.equal('string-value');
        });

        it('is typed via generics on get', () => {

            const scope = new HookScope();
            const KEY = Symbol('state');

            scope.set(KEY, { key: 'abc', ttl: 60000 });
            const state = scope.get<{ key: string; ttl: number }>(KEY);

            expect(state?.key).to.equal('abc');
            expect(state?.ttl).to.equal(60000);
        });
    });

    describe('scope in run()', () => {

        it('creates a fresh scope when none is provided', async () => {

            const engine = new HookEngine();
            let capturedScope: HookScope | undefined;

            engine.add('test', ((_data: unknown, ctx: any) => {

                capturedScope = ctx.scope;
            }) as any);

            const result = await engine.run('test', 'data');

            expect(capturedScope).to.be.instanceOf(HookScope);
            expect(result.scope).to.equal(capturedScope);
        });

        it('uses provided scope from RunOptions', async () => {

            const engine = new HookEngine();
            const scope = new HookScope();
            scope.set('existing', true);

            let sawExisting = false;

            engine.add('test', ((_data: unknown, ctx: any) => {

                sawExisting = ctx.scope.get('existing') === true;
            }) as any);

            await engine.run('test', 'data', { scope });

            expect(sawExisting).to.be.true;
        });

        it('shares scope across callbacks in same run', async () => {

            const engine = new HookEngine();
            const KEY = Symbol('shared');

            engine.add('test', ((_data: unknown, ctx: any) => {

                ctx.scope.set(KEY, 'from-first');
            }) as any);

            engine.add('test', ((_data: unknown, ctx: any) => {

                ctx.scope.set('received', ctx.scope.get(KEY));
            }) as any);

            const result = await engine.run('test', 'data');

            expect(result.scope.get(KEY)).to.equal('from-first');
            expect(result.scope.get('received')).to.equal('from-first');
        });

        it('shares scope across separate run() calls via RunOptions', async () => {

            interface Lifecycle {
                before(data: string): void;
                after(result: number, data: string): void;
            }

            const engine = new HookEngine<Lifecycle>();
            const CACHE_KEY = Symbol('cache');

            engine.add('before', (_data, ctx) => {

                ctx.scope.set(CACHE_KEY, 'computed-key');
            });

            engine.add('after', (_result, _data, ctx) => {

                ctx.scope.set('afterSaw', ctx.scope.get(CACHE_KEY));
            });

            const scope = new HookScope();
            await engine.run('before', 'input', { scope });
            const post = await engine.run('after', 42, 'input', { scope });

            expect(post.scope.get(CACHE_KEY)).to.equal('computed-key');
            expect(post.scope.get('afterSaw')).to.equal('computed-key');
        });

        it('shares scope across different HookEngine instances', async () => {

            interface MainLifecycle {
                process(data: string): void;
            }

            interface PluginLifecycle {
                validate(data: string): void;
            }

            const mainEngine = new HookEngine<MainLifecycle>();
            const pluginEngine = new HookEngine<PluginLifecycle>();
            const PLUGIN_STATE = Symbol('plugin');

            pluginEngine.add('validate', (_data, ctx) => {

                ctx.scope.set(PLUGIN_STATE, 'validated');
            });

            mainEngine.add('process', async (_data, ctx) => {

                await pluginEngine.run('validate', 'test', { scope: ctx.scope });
            });

            const scope = new HookScope();
            const result = await mainEngine.run('process', 'input', { scope });

            expect(result.scope.get(PLUGIN_STATE)).to.equal('validated');
        });
    });

    describe('scope in runSync()', () => {

        it('creates a fresh scope when none is provided', () => {

            const engine = new HookEngine();
            let capturedScope: HookScope | undefined;

            engine.add('test', ((_data: unknown, ctx: any) => {

                capturedScope = ctx.scope;
            }) as any);

            const result = engine.runSync('test', 'data');

            expect(capturedScope).to.be.instanceOf(HookScope);
            expect(result.scope).to.equal(capturedScope);
        });

        it('uses provided scope from RunOptions', () => {

            const engine = new HookEngine();
            const scope = new HookScope();
            scope.set('pre-set', 123);

            let received: number | undefined;

            engine.add('test', ((_data: unknown, ctx: any) => {

                received = ctx.scope.get('pre-set');
            }) as any);

            engine.runSync('test', 'data', { scope });

            expect(received).to.equal(123);
        });

        it('supports append and scope together in RunOptions', () => {

            const engine = new HookEngine();
            const scope = new HookScope();
            const KEY = Symbol('test');
            const order: string[] = [];

            engine.add('test', ((_data: unknown, ctx: any) => {

                ctx.scope.set(KEY, 'main');
                order.push('main');
            }) as any);

            const result = engine.runSync('test', 'data', {
                scope,
                append: ((_data: unknown, ctx: any) => {

                    order.push('append:' + ctx.scope.get(KEY));
                }) as any
            });

            expect(order).to.deep.equal(['main', 'append:main']);
            expect(result.scope).to.equal(scope);
        });
    });
});
