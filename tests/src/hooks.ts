import {
    describe,
    it,
    beforeEach,
    expect,
    vi
} from 'vitest'

import { HookEngine, HookError, isHookError } from '../../packages/hooks/src/index.ts';
import { attempt, noop } from '../../packages/utils/src/index.ts';

describe('@logosdx/hooks', () => {

    const startFn = vi.fn();
    const stopFn = vi.fn();
    const requestFn = vi.fn();
    const beforeFn = vi.fn();
    const afterFn = vi.fn();
    const errorFn = vi.fn();

    class TestApp {

        notAFunc = 'hello';
        start(...args: any[]) { return startFn(...args) }
        stop(...args: any[]) { return stopFn(...args) }
        request(...args: any[]) { return requestFn(...args) }
    };


    beforeEach(() => {

        vi.resetAllMocks();
    });

    it('instantiates', () => {

        new HookEngine();
    });

    it('runs the happy path', async () => {

        const app = new TestApp();
        const engine = new HookEngine<TestApp>;

        const wrapped = engine.make('start', app.start, { bindTo: app });

        app.start = wrapped;

        engine.extend('start', 'before', beforeFn);
        engine.extend('start', 'after', afterFn);

        // @ts-expect-error - testing invalid attribute type (only functions should be picke up)
        expect(() => engine.extend('notAFunc', 'before', noop)).to.throw();

        await app.start();

        expect(startFn).toHaveBeenCalledOnce();
        expect(beforeFn).toHaveBeenCalledOnce();
        expect(afterFn).toHaveBeenCalledOnce();
    });

    it('rejects invalid usage of extend', () => {

        // [name, extensionPoint, cbOrOpts]
        const badArgs = [
            [null],
            [1],
            ['nonexistentHook'],
            ['stop'],
            ['start'],
            ['start', 1],
            ['start', 'invalidExtensionPoint'],
            ['start', 'before', null],
            ['start', 'before', {}],
            ['start', 'before', { callback: null }],
        ] as unknown as Array<Parameters<HookEngine<TestApp>['extend']>>;

        const app = new TestApp();
        const engine = new HookEngine<TestApp>;

        engine.make('start', app.start, { bindTo: app });

        for (const args of badArgs) {
            expect(() => engine.extend(...args)).to.throw();
        }
    });

    it('rejects invalid usage of make', () => {

        // [name, cb, opts]
        const badArgs = [
            [null],
            [1],
            ['stop', null],
            ['stop', 'notAFunction'],
            ['stop', noop, 'notAnObject'],
            ['start', noop], // already registered
        ] as unknown as Array<Parameters<HookEngine<TestApp>['make']>>;

        const app = new TestApp();
        const engine = new HookEngine<TestApp>;

        engine.make('start', app.start, { bindTo: app });

        for (const args of badArgs) {
            expect(() => engine.make(...args)).to.throw();
        }
    });

    describe('engine.make()', () => {

        it('registers a hook and returns a wrapped function', async () => {

            const engine = new HookEngine<TestApp>();
            const app = new TestApp();

            const wrapped = engine.make('start', app.start, { bindTo: app });

            expect(wrapped).to.be.a('function');
            expect(wrapped).to.not.equal(app.start);

            // Should be able to extend after registration
            engine.extend('start', 'before', beforeFn);

            await wrapped();

            expect(beforeFn).toHaveBeenCalledOnce();
        });

        it('executes the original function', async () => {

            const engine = new HookEngine<TestApp>();
            const app = new TestApp();

            const wrapped = engine.make('start', app.start, { bindTo: app });

            await wrapped();

            expect(startFn).toHaveBeenCalledOnce();
        });

        it('returns the original function return value', async () => {

            const engine = new HookEngine<TestApp>();
            const app = new TestApp();
            const expectedResult = { success: true };

            startFn.mockReturnValue(expectedResult);

            const wrapped = engine.make('start', app.start, { bindTo: app });

            const result = await wrapped();

            expect(result).to.equal(expectedResult);
        });

        it('keeps the original function arguments', async () => {

            const engine = new HookEngine<TestApp>();
            const app = new TestApp();

            const wrapped = engine.make('start', app.start, { bindTo: app });

            await wrapped('arg1', 'arg2', 123);

            expect(startFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
        });

        it('binds the original function to the provided context', async () => {

            const contextCapture = vi.fn();

            class ContextClass {

                value = 42;

                async doWork() {

                    contextCapture(this.value);
                }
            }

            const instance = new ContextClass();
            const customEngine = new HookEngine<ContextClass>();

            const wrapped = customEngine.make('doWork', instance.doWork, { bindTo: instance });

            await wrapped();

            expect(contextCapture).toHaveBeenCalledWith(42);
        });

    });

    describe('hook extensions', () => {

        let app = new TestApp();
        let engine = new HookEngine<TestApp>;


        beforeEach(() => {

            vi.resetAllMocks();
            app = new TestApp();
            engine = new HookEngine<TestApp>;

            engine.wrap(app, 'start');
        });

        it('allows the addition of a before extension', async () => {

            engine.extend('start', 'before', beforeFn);

            await app.start();

            expect(beforeFn).toHaveBeenCalledOnce();
            expect(startFn).toHaveBeenCalledOnce();
            expect(beforeFn).toHaveBeenCalledBefore(startFn);

            const ctx = beforeFn.mock.calls[0]![0];

            expect(ctx).to.have.property('point', 'before');
            expect(ctx).to.have.property('args').that.is.an('array');

            expect(startFn).toHaveBeenCalledWith(...ctx.args);

        });

        it('allows the addition of an after extension', async () => {

            engine.extend('start', 'after', afterFn);

            await app.start();

            expect(afterFn).toHaveBeenCalledOnce();
            expect(startFn).toHaveBeenCalledOnce();

            expect(afterFn).toHaveBeenCalledAfter(startFn);

            const ctx = afterFn.mock.calls[0]![0];

            expect(ctx).to.have.property('point', 'after');
            expect(ctx).to.have.property('args').that.is.an('array');

            expect(startFn).toHaveBeenCalledWith(...ctx.args);
        });

        it('allows the addition of an error extension', async () => {

            engine.extend('start', 'error', errorFn);

            const error = new Error('Test error');

            startFn.mockImplementation(() => { throw error; });

            const [, err] = await attempt(() => app.start());

            expect(err).to.equal(error);

            expect(errorFn).toHaveBeenCalledOnce();
            expect(startFn).toHaveBeenCalledOnce();

            expect(errorFn).toHaveBeenCalledAfter(startFn);

            const ctx = errorFn.mock.calls[0]![0];

            expect(ctx).to.have.property('point', 'error');
            expect(ctx).to.have.property('args').that.is.an('array');
            expect(ctx).to.have.property('error', error);

            expect(startFn).toHaveBeenCalledWith(...ctx.args);
        });

        it('preserves execution order of extensions', async () => {

            engine.extend('start', 'before', beforeFn);
            engine.extend('start', 'after', afterFn);
            engine.extend('start', 'error', errorFn);

            await app.start();

            expect(beforeFn).toHaveBeenCalledBefore(startFn);
            expect(afterFn).toHaveBeenCalledAfter(startFn);
            expect(errorFn).not.toHaveBeenCalled();

            const error = new Error('Test error');

            beforeFn.mockReset();
            afterFn.mockReset();
            errorFn.mockReset();
            startFn.mockReset();

            startFn.mockImplementation(() => { throw error; });

            const [, err] = await attempt(() => app.start());

            expect(err).to.equal(error);

            expect(beforeFn).toHaveBeenCalledBefore(startFn);
            expect(errorFn).toHaveBeenCalledAfter(startFn);
            expect(afterFn).not.toHaveBeenCalled();
        });

        it('allows the addition of more than one extension per extension point', async () => {

            const anotherBeforeFn = vi.fn();
            const anotherAfterFn = vi.fn();
            const anotherErrorFn = vi.fn();

            engine.extend('start', 'before', beforeFn);
            engine.extend('start', 'before', anotherBeforeFn);

            engine.extend('start', 'after', afterFn);
            engine.extend('start', 'after', anotherAfterFn);

            engine.extend('start', 'error', errorFn);
            engine.extend('start', 'error', anotherErrorFn);

            expect(beforeFn).not.toHaveBeenCalled();
            expect(anotherBeforeFn).not.toHaveBeenCalled();
            expect(afterFn).not.toHaveBeenCalled();
            expect(anotherAfterFn).not.toHaveBeenCalled();
            expect(errorFn).not.toHaveBeenCalled();
            expect(anotherErrorFn).not.toHaveBeenCalled();

            await app.start();

            expect(beforeFn).toHaveBeenCalledOnce();
            expect(anotherBeforeFn).toHaveBeenCalledOnce();

            expect(beforeFn).toHaveBeenCalledBefore(anotherBeforeFn);
            expect(anotherBeforeFn).toHaveBeenCalledBefore(startFn);

            expect(afterFn).toHaveBeenCalledOnce();
            expect(anotherAfterFn).toHaveBeenCalledOnce();

            expect(afterFn).toHaveBeenCalledAfter(startFn);
            expect(anotherAfterFn).toHaveBeenCalledAfter(afterFn);

            const error = new Error('Test error');

            beforeFn.mockReset();
            anotherBeforeFn.mockReset();
            afterFn.mockReset();
            anotherAfterFn.mockReset();
            errorFn.mockReset();
            anotherErrorFn.mockReset();
            startFn.mockReset();

            startFn.mockImplementation(() => { throw error; });

            const [, err] = await attempt(() => app.start());

            expect(err).to.equal(error);

            expect(beforeFn).toHaveBeenCalledOnce();
            expect(anotherBeforeFn).toHaveBeenCalledOnce();

            expect(beforeFn).toHaveBeenCalledBefore(anotherBeforeFn);
            expect(anotherBeforeFn).toHaveBeenCalledBefore(startFn);

            expect(errorFn).toHaveBeenCalledOnce();
            expect(anotherErrorFn).toHaveBeenCalledOnce();

            expect(errorFn).toHaveBeenCalledAfter(startFn);
            expect(anotherErrorFn).toHaveBeenCalledAfter(errorFn);
        });

        it('allows the cleanup of an extension point', async () => {

            const cleanup = engine.extend('start', 'before', beforeFn);

            expect(beforeFn).not.toHaveBeenCalled();

            await app.start();

            expect(beforeFn).toHaveBeenCalledOnce();
            expect(startFn).toHaveBeenCalledOnce();

            cleanup();

            await app.start();

            expect(beforeFn).toHaveBeenCalledOnce();
            expect(startFn).toHaveBeenCalledTimes(2);
        });

        it('allows extensions to modify the original function arguments', async () => {

            const modifiedArgs = ['modified', 'args'];

            engine.extend('start', 'before', async (ctx) => {

                ctx.setArgs(modifiedArgs as any);
            });

            await app.start();

            expect(startFn).toHaveBeenCalledOnce();
            expect(startFn).toHaveBeenCalledWith(...modifiedArgs);
        });

        it('allows extensions to return early from the hook chain', async () => {

            const earlyResult = { early: true };

            engine.extend('start', 'before', async (ctx) => {

                ctx.setResult(earlyResult as any);
                ctx.returnEarly();
            });

            const result = await app.start();

            expect(startFn).not.toHaveBeenCalled();
            expect(result).to.equal(earlyResult);
        });

        it('doesnt duplicate extensions added more than once', async () => {

            engine.extend('start', 'before', beforeFn);
            engine.extend('start', 'before', beforeFn);
            engine.extend('start', 'before', beforeFn);

            await app.start();

            expect(beforeFn).toHaveBeenCalledOnce();
        });

        it('can run an extension only once when specified', async () => {

            engine.extend('start', 'before', {
                callback: beforeFn,
                once: true
            });

            await app.start();
            await app.start();
            await app.start();

            expect(beforeFn).toHaveBeenCalledOnce();
            expect(startFn).toHaveBeenCalledTimes(3);
        });

        it('captures and re-throws errors from the original function in error extensions', async () => {

            const originalError = new Error('Original function error');

            startFn.mockImplementation(() => { throw originalError; });

            engine.extend('start', 'error', errorFn);

            const [, err] = await attempt(() => app.start());

            expect(err).to.equal(originalError);
            expect(errorFn).toHaveBeenCalledOnce();

            const ctx = errorFn.mock.calls[0]![0];

            expect(ctx).to.have.property('error', originalError);
            expect(ctx).to.have.property('point', 'error');
        });

        it('captures and re-throws errors from before extensions', async () => {

            const beforeError = new Error('Before extension error');

            engine.extend('start', 'before', async () => {

                throw beforeError;
            });

            engine.extend('start', 'error', errorFn);

            const [, err] = await attempt(() => app.start());

            expect(err).to.equal(beforeError);
            expect(startFn).not.toHaveBeenCalled();
            expect(errorFn).not.toHaveBeenCalled();
        });

        it('captures and re-throws errors from after extensions', async () => {

            const afterError = new Error('After extension error');

            engine.extend('start', 'after', async () => {

                throw afterError;
            });

            engine.extend('start', 'error', errorFn);

            const [, err] = await attempt(() => app.start());

            expect(err).to.equal(afterError);
            expect(startFn).toHaveBeenCalledOnce();
            expect(errorFn).not.toHaveBeenCalled();
        });

        it('captures and re-throws errors from error extensions as well', async () => {

            const originalError = new Error('Original error');
            const errorExtensionError = new Error('Error extension error');

            startFn.mockImplementation(() => { throw originalError; });

            engine.extend('start', 'error', async () => {

                throw errorExtensionError;
            });

            const [, err] = await attempt(() => app.start());

            expect(err).to.equal(errorExtensionError);
        });

        it('ignores errors thrown by extension if specified', async () => {

            const extensionError = new Error('Extension error');

            engine.extend('start', 'before', {
                callback: async () => { throw extensionError; },
                ignoreOnFail: true
            });

            engine.extend('start', 'after', afterFn);

            const [, err] = await attempt(() => app.start());

            expect(err).to.be.null;
            expect(startFn).toHaveBeenCalledOnce();
            expect(afterFn).toHaveBeenCalledOnce();
        });

        it('captures results from original function', async () => {

            const originalResult = { data: 'test' };

            startFn.mockReturnValue(originalResult);

            engine.extend('start', 'after', afterFn);

            const result = await app.start();

            expect(result).to.equal(originalResult);

            const ctx = afterFn.mock.calls[0]![0];

            expect(ctx).to.have.property('results', originalResult);
        });

        it('captures results from before extensions when early return is used', async () => {

            const earlyResult = { early: 'result' };

            engine.extend('start', 'before', async (ctx) => {

                ctx.setResult(earlyResult as any);
                ctx.returnEarly();
            });

            const result = await app.start();

            expect(result).to.equal(earlyResult);
            expect(startFn).not.toHaveBeenCalled();
        });

        it('captures results from after extensions via setResult', async () => {

            const originalResult = { original: true };
            const modifiedResult = { modified: true };

            startFn.mockReturnValue(originalResult);

            engine.extend('start', 'after', async (ctx) => {

                expect(ctx.results).to.equal(originalResult);
                ctx.setResult(modifiedResult as any);
            });

            const result = await app.start();

            expect(result).to.equal(modifiedResult);
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

    describe('HookError properties via fail()', () => {

        let app: TestApp;
        let engine: HookEngine<TestApp>;

        beforeEach(() => {

            vi.resetAllMocks();
            app = new TestApp();
            engine = new HookEngine<TestApp>();
            engine.wrap(app, 'start');
        });

        it('sets hookName and extPoint when fail() is called in before', async () => {

            engine.extend('start', 'before', async (ctx) => {

                ctx.fail('Test failure');
            });

            const [, err] = await attempt(() => app.start());

            expect(isHookError(err)).to.be.true;
            expect(err).to.have.property('hookName', 'start');
            expect(err).to.have.property('extPoint', 'before');
            expect(err).to.have.property('message').that.includes('Test failure');
        });

        it('sets hookName and extPoint when fail() is called in after', async () => {

            engine.extend('start', 'after', async (ctx) => {

                ctx.fail('After failure');
            });

            const [, err] = await attempt(() => app.start());

            expect(isHookError(err)).to.be.true;
            expect(err).to.have.property('hookName', 'start');
            expect(err).to.have.property('extPoint', 'after');
        });

        it('sets hookName and extPoint when fail() is called in error', async () => {

            const originalError = new Error('Original');

            startFn.mockImplementation(() => { throw originalError; });

            engine.extend('start', 'error', async (ctx) => {

                ctx.fail('Error handler failure');
            });

            const [, err] = await attempt(() => app.start());

            expect(isHookError(err)).to.be.true;
            expect(err).to.have.property('hookName', 'start');
            expect(err).to.have.property('extPoint', 'error');
        });

        it('sets originalError when fail() is called with an Error', async () => {

            const originalError = new Error('Original error');

            engine.extend('start', 'before', async (ctx) => {

                ctx.fail(originalError);
            });

            const [, err] = await attempt(() => app.start());

            expect(isHookError(err)).to.be.true;
            expect(err).to.have.property('originalError', originalError);
        });

        it('does not set originalError when fail() is called with a string', async () => {

            engine.extend('start', 'before', async (ctx) => {

                ctx.fail('String message');
            });

            const [, err] = await attempt(() => app.start());

            expect(isHookError(err)).to.be.true;
            expect(err).to.have.property('originalError', undefined);
        });
    });

    describe('engine.wrap()', () => {

        it('wraps an object method in-place', async () => {

            const app = new TestApp();
            const engine = new HookEngine<TestApp>();
            const originalStart = app.start;

            engine.wrap(app, 'start');

            expect(app.start).to.not.equal(originalStart);
            expect(app.start).to.be.a('function');

            await app.start();

            expect(startFn).toHaveBeenCalledOnce();
        });

        it('binds to the instance automatically', async () => {

            const contextCapture = vi.fn();

            class ContextApp {

                value = 'instance-value';

                async getValue() {

                    contextCapture(this.value);
                    return this.value;
                }
            }

            const app = new ContextApp();
            const engine = new HookEngine<ContextApp>();

            engine.wrap(app, 'getValue');

            const result = await app.getValue();

            expect(contextCapture).toHaveBeenCalledWith('instance-value');
            expect(result).to.equal('instance-value');
        });

        it('allows extensions after wrapping', async () => {

            const app = new TestApp();
            const engine = new HookEngine<TestApp>();

            engine.wrap(app, 'start');
            engine.extend('start', 'before', beforeFn);
            engine.extend('start', 'after', afterFn);

            await app.start();

            expect(beforeFn).toHaveBeenCalledOnce();
            expect(startFn).toHaveBeenCalledOnce();
            expect(afterFn).toHaveBeenCalledOnce();
        });

        it('rejects invalid instance', () => {

            const engine = new HookEngine<TestApp>();

            expect(() => engine.wrap(null as any, 'start')).to.throw();
            expect(() => engine.wrap(undefined as any, 'start')).to.throw();
            expect(() => engine.wrap('string' as any, 'start')).to.throw();
        });

        it('preserves arguments and return values', async () => {

            const app = new TestApp();
            const engine = new HookEngine<TestApp>();
            const expectedResult = { wrapped: true };

            startFn.mockReturnValue(expectedResult);

            engine.wrap(app, 'start');

            const result = await app.start('arg1', 'arg2');

            expect(startFn).toHaveBeenCalledWith('arg1', 'arg2');
            expect(result).to.equal(expectedResult);
        });
    });

    describe('engine.clear()', () => {

        it('removes all extensions', async () => {

            const app = new TestApp();
            const engine = new HookEngine<TestApp>();

            engine.wrap(app, 'start');
            engine.extend('start', 'before', beforeFn);
            engine.extend('start', 'after', afterFn);

            await app.start();

            expect(beforeFn).toHaveBeenCalledOnce();
            expect(afterFn).toHaveBeenCalledOnce();

            beforeFn.mockReset();
            afterFn.mockReset();

            engine.clear();

            // Re-wrap after clear
            engine.wrap(app, 'start');

            await app.start();

            expect(beforeFn).not.toHaveBeenCalled();
            expect(afterFn).not.toHaveBeenCalled();
            expect(startFn).toHaveBeenCalled();
        });

        it('allows re-registration of hooks after clear', async () => {

            const app1 = new TestApp();
            const app2 = new TestApp();
            const engine = new HookEngine<TestApp>();

            engine.wrap(app1, 'start');

            engine.clear();

            // Should not throw - hook can be registered again with fresh instance
            engine.wrap(app2, 'start');
            engine.extend('start', 'before', beforeFn);

            await app2.start();

            expect(beforeFn).toHaveBeenCalledOnce();
        });

        it('clears registrations so hooks can be re-made', () => {

            const app = new TestApp();
            const engine = new HookEngine<TestApp>();

            engine.make('start', app.start, { bindTo: app });

            // Should throw - already registered
            expect(() => engine.make('start', app.start, { bindTo: app })).to.throw();

            engine.clear();

            // Should not throw after clear
            expect(() => engine.make('start', app.start, { bindTo: app })).to.not.throw();
        });
    });

    describe('context.removeHook()', () => {

        it('allows an extension to remove itself', async () => {

            const app = new TestApp();
            const engine = new HookEngine<TestApp>();

            engine.wrap(app, 'start');

            let callCount = 0;
            engine.extend('start', 'before', async (ctx) => {

                callCount++;

                if (callCount >= 2) {
                    ctx.removeHook();
                }
            });

            await app.start();
            await app.start();
            await app.start();
            await app.start();

            expect(callCount).to.equal(2);
        });

        it('removes the correct extension from multiple', async () => {

            const app = new TestApp();
            const engine = new HookEngine<TestApp>();

            engine.wrap(app, 'start');

            const firstFn = vi.fn();
            const selfRemovingFn = vi.fn(async (ctx) => {

                ctx.removeHook();
            });
            const lastFn = vi.fn();

            engine.extend('start', 'before', firstFn);
            engine.extend('start', 'before', selfRemovingFn);
            engine.extend('start', 'before', lastFn);

            await app.start();

            expect(firstFn).toHaveBeenCalledOnce();
            expect(selfRemovingFn).toHaveBeenCalledOnce();
            expect(lastFn).toHaveBeenCalledOnce();

            firstFn.mockReset();
            selfRemovingFn.mockReset();
            lastFn.mockReset();

            await app.start();

            expect(firstFn).toHaveBeenCalledOnce();
            expect(selfRemovingFn).not.toHaveBeenCalled();
            expect(lastFn).toHaveBeenCalledOnce();
        });
    });
});
