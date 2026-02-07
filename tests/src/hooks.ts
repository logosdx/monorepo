import {
    describe,
    it,
    expect,
    vi
} from 'vitest'

import { HookEngine, HookError, isHookError } from '@logosdx/hooks';
import { attempt } from '@logosdx/utils';

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

            // No type parameter - permissive mode
            const engine = new HookEngine();
            const callback = vi.fn();

            engine.on('anyHookName', callback);
            engine.on('anotherHook', callback);
            engine.on('yetAnother', callback);

            await engine.emit('anyHookName');
            await engine.emit('anotherHook', 'arg1', 'arg2');

            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('is strict when type parameter is provided', async () => {

            interface StrictLifecycle {
                preRequest(url: string): Promise<void>;
                postRequest(url: string, response: Response): Promise<void>;
            }

            const engine = new HookEngine<StrictLifecycle>();
            const callback = vi.fn();

            // These work because they're defined in the interface
            engine.on('preRequest', callback);
            engine.on('postRequest', callback);

            await engine.emit('preRequest', 'https://example.com');

            expect(callback).toHaveBeenCalledOnce();

            // TypeScript would error on: engine.on('undefinedHook', callback)
            // But we can't test compile-time errors at runtime
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

            // Before registration - permissive
            engine.on('anyHook', async () => {});

            engine.clear();
            engine.register('allowedHook');

            // After registration - strict
            expect(() => engine.on('unregisteredHook', async () => {})).to.throw(/not registered/);
        });

        it('allows registered hooks', async () => {

            const engine = new HookEngine();
            const callback = vi.fn();

            engine.register('myHook');
            engine.on('myHook', callback);

            await engine.emit('myHook');

            expect(callback).toHaveBeenCalledOnce();
        });

        it('throws on unregistered hook in on()', () => {

            const engine = new HookEngine();
            engine.register('validHook');

            expect(() => engine.on('invalidHook', async () => {})).to.throw(
                /Hook "invalidHook" is not registered/
            );
        });

        it('throws on unregistered hook in emit()', async () => {

            const engine = new HookEngine();
            engine.register('validHook');

            await expect(engine.emit('invalidHook')).rejects.toThrow(
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

            expect(() => engine.on('preRequset', async () => {})).to.throw(
                /Registered hooks: preRequest, postRequest, rateLimit/
            );
        });

        it('clear() resets to permissive mode', async () => {

            const engine = new HookEngine();
            engine.register('strictHook');

            expect(() => engine.on('unregistered', async () => {})).to.throw();

            engine.clear();

            // Back to permissive
            engine.on('anyHook', async () => {});
            await engine.emit('anyHook');
        });
    });

    describe('wrap() runtime validation', () => {

        it('throws when neither pre nor post provided', () => {

            const engine = new HookEngine();

            // Cast to bypass TypeScript - test runtime validation
            expect(() => engine.wrap(
                async () => 'result',
                {} as any
            )).to.throw(/requires at least one of "pre" or "post"/);
        });

        it('validates pre hook is registered', () => {

            const engine = new HookEngine();
            engine.register('validPre');

            expect(() => engine.wrap(
                async () => 'result',
                { pre: 'invalidPre' }
            )).to.throw(/not registered/);
        });

        it('validates post hook is registered', () => {

            const engine = new HookEngine();
            engine.register('validPost');

            expect(() => engine.wrap(
                async () => 'result',
                { post: 'invalidPost' }
            )).to.throw(/not registered/);
        });

        it('validates both pre and post hooks are registered', () => {

            const engine = new HookEngine();
            engine.register('validPre', 'validPost');

            // This should work
            const wrapped = engine.wrap(
                async (x: number) => x * 2,
                { pre: 'validPre', post: 'validPost' }
            );

            expect(wrapped).to.be.a('function');
        });
    });

    describe('engine.on()', () => {

        it('registers a hook callback', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const callback = vi.fn();

            engine.on('test', callback);

            await engine.emit('test');

            expect(callback).toHaveBeenCalledOnce();
        });

        it('returns a cleanup function', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const callback = vi.fn();

            const cleanup = engine.on('test', callback);

            await engine.emit('test');
            expect(callback).toHaveBeenCalledOnce();

            cleanup();

            await engine.emit('test');
            expect(callback).toHaveBeenCalledOnce(); // Still 1, not called again
        });

        it('accepts options object with callback', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const callback = vi.fn();

            engine.on('test', { callback });

            await engine.emit('test');

            expect(callback).toHaveBeenCalledOnce();
        });

        it('rejects invalid name', () => {

            // Permissive mode - any string hook name works
            const engine = new HookEngine();

            expect(() => engine.on(null as any, async () => {})).to.throw();
            expect(() => engine.on(123 as any, async () => {})).to.throw();
        });

        it('rejects invalid callback', () => {

            // Permissive mode - any string hook name works
            const engine = new HookEngine();

            expect(() => engine.on('test', null as any)).to.throw();
            expect(() => engine.on('test', 'notAFunction' as any)).to.throw();
            expect(() => engine.on('test', {} as any)).to.throw();
            expect(() => engine.on('test', { callback: null } as any)).to.throw();
        });

        it('does not duplicate callbacks added more than once', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const callback = vi.fn();

            engine.on('test', callback);
            engine.on('test', callback);
            engine.on('test', callback);

            await engine.emit('test');

            expect(callback).toHaveBeenCalledOnce();
        });

        it('runs callbacks in insertion order', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const order: number[] = [];

            engine.on('test', async () => { order.push(1); });
            engine.on('test', async () => { order.push(2); });
            engine.on('test', async () => { order.push(3); });

            await engine.emit('test');

            expect(order).to.deep.equal([1, 2, 3]);
        });
    });

    describe('engine.emit()', () => {

        it('returns EmitResult with args', async () => {

            interface Lifecycle {
                test(a: string, b: number): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();

            const result = await engine.emit('test', 'hello', 42);

            expect(result.args).to.deep.equal(['hello', 42]);
            expect(result.earlyReturn).to.be.false;
            expect(result.result).to.be.undefined;
        });

        it('returns EmitResult when no callbacks registered', async () => {

            interface Lifecycle {
                test(a: string): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();

            const result = await engine.emit('test', 'value');

            expect(result.args).to.deep.equal(['value']);
            expect(result.earlyReturn).to.be.false;
        });

        it('passes context to callbacks', async () => {

            interface Lifecycle {
                test(url: string): Promise<string>;
            }

            const engine = new HookEngine<Lifecycle>();
            let receivedContext: any;

            engine.on('test', async (ctx) => {

                receivedContext = ctx;
            });

            await engine.emit('test', 'https://example.com');

            expect(receivedContext).to.have.property('args').that.deep.equals(['https://example.com']);
            expect(receivedContext).to.have.property('setArgs').that.is.a('function');
            expect(receivedContext).to.have.property('setResult').that.is.a('function');
            expect(receivedContext).to.have.property('returnEarly').that.is.a('function');
            expect(receivedContext).to.have.property('fail').that.is.a('function');
            expect(receivedContext).to.have.property('removeHook').that.is.a('function');
        });
    });

    describe('context.setArgs()', () => {

        it('modifies args for subsequent callbacks', async () => {

            interface Lifecycle {
                test(value: string): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const secondCallback = vi.fn();

            engine.on('test', async (ctx) => {

                ctx.setArgs(['modified']);
            });

            engine.on('test', secondCallback);

            await engine.emit('test', 'original');

            const receivedCtx = secondCallback.mock.calls[0]![0];
            expect(receivedCtx.args).to.deep.equal(['modified']);
        });

        it('returns modified args in EmitResult', async () => {

            interface Lifecycle {
                test(value: string): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('test', async (ctx) => {

                ctx.setArgs(['modified']);
            });

            const result = await engine.emit('test', 'original');

            expect(result.args).to.deep.equal(['modified']);
        });

        it('rejects non-array args', async () => {

            interface Lifecycle {
                test(value: string): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('test', async (ctx) => {

                ctx.setArgs('not an array' as any);
            });

            const [, err] = await attempt(() => engine.emit('test', 'value'));

            expect(err).to.be.instanceOf(Error);
        });
    });

    describe('context.setResult()', () => {

        it('sets result in EmitResult', async () => {

            interface Lifecycle {
                test(): Promise<string>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('test', async (ctx) => {

                ctx.setResult('my result');
            });

            const result = await engine.emit('test');

            expect(result.result).to.equal('my result');
        });

        it('subsequent callbacks can read and modify result', async () => {

            interface Lifecycle {
                test(): Promise<number>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('test', async (ctx) => {

                ctx.setResult(10);
            });

            engine.on('test', async (ctx) => {

                ctx.setResult((ctx.result ?? 0) * 2);
            });

            const result = await engine.emit('test');

            expect(result.result).to.equal(20);
        });
    });

    describe('context.returnEarly()', () => {

        it('stops processing remaining callbacks', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const firstCallback = vi.fn(async (ctx) => ctx.returnEarly());
            const secondCallback = vi.fn();

            engine.on('test', firstCallback);
            engine.on('test', secondCallback);

            await engine.emit('test');

            expect(firstCallback).toHaveBeenCalledOnce();
            expect(secondCallback).not.toHaveBeenCalled();
        });

        it('sets earlyReturn flag in EmitResult', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('test', async (ctx) => {

                ctx.returnEarly();
            });

            const result = await engine.emit('test');

            expect(result.earlyReturn).to.be.true;
        });

        it('preserves result set before returnEarly', async () => {

            interface Lifecycle {
                test(): Promise<string>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('test', async (ctx) => {

                ctx.setResult('cached value');
                ctx.returnEarly();
            });

            const result = await engine.emit('test');

            expect(result.result).to.equal('cached value');
            expect(result.earlyReturn).to.be.true;
        });
    });

    describe('context.fail()', () => {

        it('throws HookError by default', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('test', async (ctx) => {

                ctx.fail('Validation failed');
            });

            const [, err] = await attempt(() => engine.emit('test'));

            expect(isHookError(err)).to.be.true;
            expect(err).to.have.property('message').that.includes('Validation failed');
        });

        it('sets hookName on HookError', async () => {

            interface Lifecycle {
                validate(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('validate', async (ctx) => {

                ctx.fail('Invalid');
            });

            const [, err] = await attempt(() => engine.emit('validate'));

            expect(isHookError(err)).to.be.true;
            expect(err).to.have.property('hookName', 'validate');
        });

        it('stops processing remaining callbacks', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const secondCallback = vi.fn();

            engine.on('test', async (ctx) => {

                ctx.fail('Stop here');
            });

            engine.on('test', secondCallback);

            await attempt(() => engine.emit('test'));

            expect(secondCallback).not.toHaveBeenCalled();
        });
    });

    describe('context.removeHook()', () => {

        it('removes the callback from future emissions', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            let callCount = 0;

            engine.on('test', async (ctx) => {

                callCount++;

                if (callCount >= 2) {
                    ctx.removeHook();
                }
            });

            await engine.emit('test');
            await engine.emit('test');
            await engine.emit('test');
            await engine.emit('test');

            expect(callCount).to.equal(2);
        });

        it('removes only the current callback', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const firstFn = vi.fn();
            const selfRemovingFn = vi.fn(async (ctx) => ctx.removeHook());
            const lastFn = vi.fn();

            engine.on('test', firstFn);
            engine.on('test', selfRemovingFn);
            engine.on('test', lastFn);

            await engine.emit('test');

            expect(firstFn).toHaveBeenCalledOnce();
            expect(selfRemovingFn).toHaveBeenCalledOnce();
            expect(lastFn).toHaveBeenCalledOnce();

            firstFn.mockReset();
            selfRemovingFn.mockReset();
            lastFn.mockReset();

            await engine.emit('test');

            expect(firstFn).toHaveBeenCalledOnce();
            expect(selfRemovingFn).not.toHaveBeenCalled();
            expect(lastFn).toHaveBeenCalledOnce();
        });
    });

    describe('once option', () => {

        it('removes callback after first execution', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const callback = vi.fn();

            engine.on('test', {
                callback,
                once: true
            });

            await engine.emit('test');
            await engine.emit('test');
            await engine.emit('test');

            expect(callback).toHaveBeenCalledOnce();
        });
    });

    describe('ignoreOnFail option', () => {

        it('swallows errors from callback', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const afterCallback = vi.fn();

            engine.on('test', {
                callback: async () => { throw new Error('Should be ignored'); },
                ignoreOnFail: true
            });

            engine.on('test', afterCallback);

            const [, err] = await attempt(() => engine.emit('test'));

            expect(err).to.be.null;
            expect(afterCallback).toHaveBeenCalledOnce();
        });

        it('swallows ctx.fail() errors', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const afterCallback = vi.fn();

            engine.on('test', {
                callback: async (ctx) => { ctx.fail('Should be ignored'); },
                ignoreOnFail: true
            });

            engine.on('test', afterCallback);

            const [, err] = await attempt(() => engine.emit('test'));

            expect(err).to.be.null;
            expect(afterCallback).toHaveBeenCalledOnce();
        });
    });

    describe('error handling', () => {

        it('propagates user-thrown errors as-is (not wrapped in HookError)', async () => {

            class CustomError extends Error {
                code = 'CUSTOM';
            }

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('test', async () => {

                throw new CustomError('Custom error');
            });

            const [, err] = await attempt(() => engine.emit('test'));

            expect(err).to.be.instanceOf(CustomError);
            expect(isHookError(err)).to.be.false;
            expect((err as CustomError).code).to.equal('CUSTOM');
        });

        it('stops at first error without ignoreOnFail', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const secondCallback = vi.fn();

            engine.on('test', async () => {

                throw new Error('First error');
            });

            engine.on('test', secondCallback);

            await attempt(() => engine.emit('test'));

            expect(secondCallback).not.toHaveBeenCalled();
        });
    });

    describe('custom handleFail', () => {

        it('uses Error constructor with single argument', async () => {

            class CustomError extends Error {
                name = 'CustomError';
            }

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle, [string]>({
                handleFail: CustomError
            });

            engine.on('test', async (ctx) => {

                ctx.fail('Custom message');
            });

            const [, err] = await attempt(() => engine.emit('test'));

            expect(err).to.be.instanceOf(CustomError);
            expect(err).to.have.property('message', 'Custom message');
        });

        it('uses Error constructor with multiple arguments (Firebase-style)', async () => {

            // Simulates Firebase HttpsError: new HttpsError(code, message, details?)
            class HttpsError extends Error {

                code: string;
                details?: object | undefined;

                constructor(code: string, message: string, details?: object | undefined) {

                    super(message);
                    this.code = code;
                    this.details = details;
                }
            }

            interface Lifecycle {
                validate(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle, [string, string, object?]>({
                handleFail: HttpsError
            });

            engine.on('validate', async (ctx) => {

                ctx.fail('failed-precondition', 'Email is required', { field: 'email' });
            });

            const [, err] = await attempt(() => engine.emit('validate'));

            expect(err).to.be.instanceOf(HttpsError);
            expect(err).to.have.property('code', 'failed-precondition');
            expect(err).to.have.property('message', 'Email is required');
            expect(err).to.have.property('details').that.deep.equals({ field: 'email' });
        });

        it('uses custom function that throws', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle, [string, number]>({
                handleFail: (message: string, code: number): never => {

                    const error = new Error(message);
                    (error as any).code = code;
                    throw error;
                }
            });

            engine.on('test', async (ctx) => {

                ctx.fail('Error message', 500);
            });

            const [, err] = await attempt(() => engine.emit('test'));

            expect(err).to.have.property('message', 'Error message');
            expect(err).to.have.property('code', 500);
        });

        it('passes all arguments to handleFail function', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const receivedArgs: unknown[] = [];

            const engine = new HookEngine<Lifecycle, [string, object, number]>({
                handleFail: (message: string, data: object, code: number): never => {

                    receivedArgs.push(message, data, code);
                    throw new Error('fail');
                }
            });

            engine.on('test', async (ctx) => {

                ctx.fail('message', { data: true }, 123);
            });

            await attempt(() => engine.emit('test'));

            expect(receivedArgs).to.deep.equal(['message', { data: true }, 123]);
        });

        it('default handleFail accepts string only', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            // No FailArgs specified - defaults to [string]
            const engine = new HookEngine<Lifecycle>();

            engine.on('test', async (ctx) => {

                // This should only accept a string
                ctx.fail('Just a message');
            });

            const [, err] = await attempt(() => engine.emit('test'));

            expect(err).to.have.property('message', 'Just a message');
        });
    });

    describe('engine.clear()', () => {

        it('removes all hooks', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const callback = vi.fn();

            engine.on('test', callback);

            await engine.emit('test');
            expect(callback).toHaveBeenCalledOnce();

            engine.clear();

            await engine.emit('test');
            expect(callback).toHaveBeenCalledOnce(); // Still 1
        });

        it('allows re-registration after clear', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            engine.on('test', callback1);
            engine.clear();
            engine.on('test', callback2);

            await engine.emit('test');

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledOnce();
        });
    });

    describe('isHookError()', () => {

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

    describe('engine.once()', () => {

        it('is sugar for on() with once: true', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const callback = vi.fn();

            engine.once('test', callback);

            await engine.emit('test');
            await engine.emit('test');
            await engine.emit('test');

            expect(callback).toHaveBeenCalledOnce();
        });

        it('returns cleanup function', async () => {

            interface Lifecycle {
                test(): Promise<void>;
            }

            const engine = new HookEngine<Lifecycle>();
            const callback = vi.fn();

            const cleanup = engine.once('test', callback);
            cleanup();

            await engine.emit('test');

            expect(callback).not.toHaveBeenCalled();
        });

        it('receives full context', async () => {

            interface Lifecycle {
                test(value: string): Promise<string>;
            }

            const engine = new HookEngine<Lifecycle>();
            let receivedContext: any;

            engine.once('test', async (ctx) => {

                receivedContext = ctx;
                ctx.setResult('modified');
            });

            const result = await engine.emit('test', 'original');

            expect(receivedContext.args).to.deep.equal(['original']);
            expect(result.result).to.equal('modified');
        });
    });

    describe('engine.wrap()', () => {

        it('wraps a function with pre hook', async () => {

            interface Lifecycle {
                preProcess(value: number): Promise<number>;
            }

            const engine = new HookEngine<Lifecycle>();
            const preCallback = vi.fn();

            engine.on('preProcess', preCallback);

            const wrapped = engine.wrap(
                async (value: number) => value * 2,
                { pre: 'preProcess' }
            );

            const result = await wrapped(5);

            expect(result).to.equal(10);
            expect(preCallback).toHaveBeenCalledOnce();
        });

        it('wraps a function with post hook', async () => {

            interface Lifecycle {
                postProcess(result: number, value: number): Promise<number>;
            }

            const engine = new HookEngine<Lifecycle>();
            const postCallback = vi.fn();

            engine.on('postProcess', postCallback);

            const wrapped = engine.wrap(
                async (value: number) => value * 2,
                { post: 'postProcess' }
            );

            const result = await wrapped(5);

            expect(result).to.equal(10);
            expect(postCallback).toHaveBeenCalledOnce();
        });

        it('pre hook can modify arguments', async () => {

            interface Lifecycle {
                preAdd(a: number, b: number): Promise<number>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('preAdd', async (ctx) => {

                const [a, b] = ctx.args;
                ctx.setArgs([a * 10, b * 10]);
            });

            const wrapped = engine.wrap(
                async (a: number, b: number) => a + b,
                { pre: 'preAdd' }
            );

            const result = await wrapped(2, 3);

            expect(result).to.equal(50); // (2*10) + (3*10)
        });

        it('pre hook can return early with cached result', async () => {

            interface Lifecycle {
                preGet(key: string): Promise<string>;
            }

            const engine = new HookEngine<Lifecycle>();
            const cache = new Map([['foo', 'cached-foo']]);
            const actualFn = vi.fn(async (key: string) => `fetched-${key}`);

            engine.on('preGet', async (ctx) => {

                const [key] = ctx.args;
                const cached = cache.get(key);

                if (cached) {
                    ctx.setResult(cached);
                    ctx.returnEarly();
                }
            });

            const wrapped = engine.wrap(actualFn, { pre: 'preGet' });

            const cachedResult = await wrapped('foo');
            expect(cachedResult).to.equal('cached-foo');
            expect(actualFn).not.toHaveBeenCalled();

            const freshResult = await wrapped('bar');
            expect(freshResult).to.equal('fetched-bar');
            expect(actualFn).toHaveBeenCalledOnce();
        });

        it('post hook can modify result', async () => {

            interface Lifecycle {
                postDouble(result: number, input: number): Promise<number>;
            }

            const engine = new HookEngine<Lifecycle>();

            engine.on('postDouble', async (ctx) => {

                const [result] = ctx.args;
                ctx.setResult(result * 2);
            });

            const wrapped = engine.wrap(
                async (input: number) => input + 1,
                { post: 'postDouble' }
            );

            const result = await wrapped(5);

            expect(result).to.equal(12); // (5 + 1) * 2
        });

        it('works with both pre and post hooks', async () => {

            interface Lifecycle {
                preTransform(value: string): Promise<string>;
                postTransform(result: string, value: string): Promise<string>;
            }

            const engine = new HookEngine<Lifecycle>();
            const callOrder: string[] = [];

            engine.on('preTransform', async (ctx) => {

                callOrder.push('pre');
                const [value] = ctx.args;
                ctx.setArgs([value.toUpperCase()]);
            });

            engine.on('postTransform', async (ctx) => {

                callOrder.push('post');
                const [result] = ctx.args;
                ctx.setResult(`[${result}]`);
            });

            const wrapped = engine.wrap(
                async (value: string) => `processed:${value}`,
                { pre: 'preTransform', post: 'postTransform' }
            );

            const result = await wrapped('hello');

            expect(callOrder).to.deep.equal(['pre', 'post']);
            expect(result).to.equal('[processed:HELLO]');
        });

        it('pre hook early return skips function and post hook receives early result', async () => {

            interface Lifecycle {
                preFetch(url: string): Promise<string>;
                postFetch(result: string, url: string): Promise<string>;
            }

            const engine = new HookEngine<Lifecycle>();
            const fetchFn = vi.fn(async (url: string) => `fetched:${url}`);
            const postCallback = vi.fn();

            engine.on('preFetch', async (ctx) => {

                ctx.setResult('cached-result');
                ctx.returnEarly();
            });

            engine.on('postFetch', postCallback);

            const wrapped = engine.wrap(fetchFn, { pre: 'preFetch', post: 'postFetch' });

            const result = await wrapped('https://example.com');

            expect(result).to.equal('cached-result');
            expect(fetchFn).not.toHaveBeenCalled();
            expect(postCallback).not.toHaveBeenCalled();
        });

        it('passes result and args to post hook', async () => {

            interface Lifecycle {
                postLog(result: number, a: number, b: number): Promise<number>;
            }

            const engine = new HookEngine<Lifecycle>();
            let receivedArgs: unknown[] = [];

            engine.on('postLog', async (ctx) => {

                receivedArgs = [...ctx.args];
            });

            const wrapped = engine.wrap(
                async (a: number, b: number) => a + b,
                { post: 'postLog' }
            );

            await wrapped(3, 7);

            expect(receivedArgs).to.deep.equal([10, 3, 7]); // [result, ...originalArgs]
        });

        it('works with only pre hook', async () => {

            const engine = new HookEngine();

            const wrapped = engine.wrap(
                async (value: number) => value * 2,
                { pre: 'preProcess' }
            );

            const result = await wrapped(5);

            expect(result).to.equal(10);
        });

        it('works with only post hook', async () => {

            const engine = new HookEngine();

            const wrapped = engine.wrap(
                async (value: number) => value * 2,
                { post: 'postProcess' }
            );

            const result = await wrapped(5);

            expect(result).to.equal(10);
        });
    });

    describe('real-world patterns', () => {

        it('implements caching pattern', async () => {

            interface FetchLifecycle {
                cacheCheck(url: string): Promise<string | null>;
            }

            const engine = new HookEngine<FetchLifecycle>();
            const cache = new Map([['cached-url', 'cached-data']]);

            engine.on('cacheCheck', async (ctx) => {

                const [url] = ctx.args;
                const cached = cache.get(url);

                if (cached) {
                    ctx.setResult(cached);
                    ctx.returnEarly();
                }
            });

            const cachedResult = await engine.emit('cacheCheck', 'cached-url');
            expect(cachedResult.result).to.equal('cached-data');
            expect(cachedResult.earlyReturn).to.be.true;

            const missResult = await engine.emit('cacheCheck', 'not-cached');
            expect(missResult.result).to.be.undefined;
            expect(missResult.earlyReturn).to.be.false;
        });

        it('implements validation pattern', async () => {

            interface UserLifecycle {
                validate(data: { email?: string }): Promise<void>;
            }

            const engine = new HookEngine<UserLifecycle>();

            engine.on('validate', async (ctx) => {

                const [data] = ctx.args;

                if (!data.email) {
                    ctx.fail('Email is required');
                }
            });

            const [, err] = await attempt(() => engine.emit('validate', {}));

            expect(isHookError(err)).to.be.true;
            expect(err?.message).to.include('Email is required');

            const [result] = await attempt(() => engine.emit('validate', { email: 'test@example.com' }));

            expect(result).to.have.property('earlyReturn', false);
        });

        it('implements rate limiting pattern', async () => {

            interface ApiLifecycle {
                rateLimit(retryAfter: number, attempt: number): Promise<void>;
            }

            const engine = new HookEngine<ApiLifecycle>();
            const delays: number[] = [];

            engine.on('rateLimit', async (ctx) => {

                const [retryAfter, attempt] = ctx.args;

                if (attempt > 3) {
                    ctx.fail('Max retries exceeded');
                }

                delays.push(retryAfter);
            });

            await engine.emit('rateLimit', 100, 1);
            await engine.emit('rateLimit', 200, 2);
            await engine.emit('rateLimit', 300, 3);

            const [, err] = await attempt(() => engine.emit('rateLimit', 400, 4));

            expect(delays).to.deep.equal([100, 200, 300]);
            expect(isHookError(err)).to.be.true;
        });

        it('implements analytics pattern with ignoreOnFail', async () => {

            interface AppLifecycle {
                action(name: string): Promise<void>;
            }

            const engine = new HookEngine<AppLifecycle>();
            const tracked: string[] = [];
            const importantCallback = vi.fn();

            engine.on('action', {
                callback: async (ctx) => {

                    const [name] = ctx.args;

                    if (name === 'fail') {
                        throw new Error('Analytics failed');
                    }

                    tracked.push(name);
                },
                ignoreOnFail: true
            });

            engine.on('action', importantCallback);

            await engine.emit('action', 'click');
            await engine.emit('action', 'fail');
            await engine.emit('action', 'scroll');

            expect(tracked).to.deep.equal(['click', 'scroll']);
            expect(importantCallback).toHaveBeenCalledTimes(3);
        });
    });
});
