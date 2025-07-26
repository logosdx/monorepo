import {
    describe,
    it,
    mock,
} from 'node:test'

import { expect } from 'chai';

import { mockHelpers } from '../../_helpers';

import {
    attempt,
    attemptSync,
    debounce,
    throttle,
    wait,
    runInSeries,
    makeInSeries,
    nextLoop,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    const { calledExactly } = mockHelpers(expect);

    describe('flow-control: attempt', () => {

        it('should attempt', async () => {

            const [result, error] = await attempt(async () => {

                throw new Error('poop');
            });

            expect(result).to.be.null;
            expect(error).to.be.an.instanceof(Error);
            expect(error!.message).to.equal('poop');

            const [result2, error2] = await attempt(async () => {

                return 'ok';
            });

            expect(result2).to.equal('ok');
            expect(error2).to.be.null;
        });

        it('should attemptSync', () => {

            const [result, error] = attemptSync(() => {

                throw new Error('poop');
            });

            expect(result).to.be.null;
            expect(error).to.be.an.instanceof(Error);
            expect(error!.message).to.equal('poop');

            const [result2, error2] = attemptSync(() => {

                return 'ok';
            });

            expect(result2).to.equal('ok');
            expect(error2).to.be.null;
        });

        it('should validate attempt parameters', async () => {

            try {
                await attempt('not a function' as any);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.an.instanceof(Error);
                expect((error as Error).message).to.equal('fn must be a function');
            }
        });

        it('should validate attemptSync parameters', () => {

            expect(() => attemptSync('not a function' as any)).to.throw('fn must be a function');
        });
    });

    describe('flow-control: debounce', () => {

        it('should debounce', async () => {

            const mocked = mock.fn();

            const fn = debounce(mocked, { delay: 10 });

            fn();
            fn();
            fn();

            calledExactly(mocked, 0, 'debounce 1');

            await wait(8);

            fn();

            calledExactly(mocked, 0, 'debounce 2');

            await wait(10);

            calledExactly(mocked, 1, 'debounce 3');
        });

        it('should validate debounce parameters', () => {

            expect(() => debounce('not a function' as any, { delay: 10 })).to.throw('fn must be a function');
            expect(() => debounce(mock.fn(), { delay: 0 })).to.throw('delay must be a positive number');
            expect(() => debounce(mock.fn(), { delay: -5 })).to.throw('delay must be a positive number');
            expect(() => debounce(mock.fn(), { delay: 'not a number' as any })).to.throw('delay must be a positive number');
        });

        it('should debounce with arguments', async () => {

            const mocked = mock.fn();

            const fn = debounce(mocked, { delay: 10 });

            fn('arg1', 'arg2');
            fn('arg3', 'arg4');

            await wait(15);

            calledExactly(mocked, 1, 'debounce with args');
            expect(mocked.mock.calls[0]!.arguments).to.deep.equal(['arg3', 'arg4']);
        });

        it('should handle multiple debounced functions independently', async () => {

            const mocked1 = mock.fn();
            const mocked2 = mock.fn();

            const fn1 = debounce(mocked1, { delay: 10 });
            const fn2 = debounce(mocked2, { delay: 15 });

            fn1('a');
            fn2('b');

            await wait(12);

            calledExactly(mocked1, 1, 'debounce independent 1');
            calledExactly(mocked2, 0, 'debounce independent 2 not yet');

            await wait(5);

            calledExactly(mocked2, 1, 'debounce independent 2');
        });

        it('should not double wrap the function', async () => {

            const fn = mock.fn(() => 'ok');

            const wrappedFn = debounce(fn as any, { delay: 10 });

            const [, error] = attemptSync(() => debounce(wrappedFn, { delay: 10 }));

            expect(error).to.be.an.instanceof(Error);
            expect((error as Error).message).to.equal('Function is already wrapped by debounce');
        });
    });

    describe('flow-control: throttle', () => {

        it('should throttle', async () => {

            const mocked = mock.fn();
            const onThrottle = mock.fn();

            const fn = throttle(mocked, {
                delay: 20,
                onThrottle
            });

            fn();

            calledExactly(mocked, 1, 'throttle 1');

            await wait(15);

            fn();

            calledExactly(mocked, 1, 'throttle 2');
            calledExactly(onThrottle, 1, 'throttle onThrottle 2');

            await wait(15);

            fn();

            calledExactly(mocked, 2, 'throttle 3');

            await wait(15);

            fn();

            calledExactly(mocked, 2, 'throttle 4');
        });

        it('should throttle with throws', async () => {

            const mocked = mock.fn();
            const onThrottle = mock.fn();

            const fn = throttle(mocked, {
                delay: 20,
                onThrottle,
                throws: true
            });

            fn();

            expect(() => fn()).to.throw('Throttled');
            calledExactly(mocked, 1, 'throttle with throws 1');
            calledExactly(onThrottle, 1, 'throttle with throws onThrottle 1');

            await wait(21);

            fn();

            calledExactly(mocked, 2, 'throttle with throws 2');
            calledExactly(onThrottle, 1, 'throttle with throws onThrottle 2');
        });

        it('should validate throttle parameters', () => {

            expect(() => throttle('not a function' as any, { delay: 10 })).to.throw('fn must be a function');
            expect(() => throttle(mock.fn(), { delay: 0 })).to.throw('delay must be a positive number');
            expect(() => throttle(mock.fn(), { delay: -5 })).to.throw('delay must be a positive number');
            expect(() => throttle(mock.fn(), { delay: 'not a number' as any })).to.throw('delay must be a positive number');
            expect(() => throttle(mock.fn(), { delay: 10, onThrottle: 'not a function' as any })).to.throw('onThrottle must be a function');
            expect(() => throttle(mock.fn(), { delay: 10, throws: 'not a boolean' as any })).to.throw('throws must be a boolean');
        });

        it('should throttle with return values', async () => {

            const mocked = mock.fn((x: number) => x * 2);

            const fn = throttle(mocked, { delay: 20 });

            const result1 = fn(5);
            expect(result1).to.equal(10);

            const result2 = fn(10); // Should return cached result
            expect(result2).to.equal(10);

            calledExactly(mocked, 1, 'throttle return values');

            await wait(21);

            const result3 = fn(15);
            expect(result3).to.equal(30);

            calledExactly(mocked, 2, 'throttle return values after delay');
        });

        it('should throttle with arguments', async () => {

            const mocked = mock.fn();
            const onThrottle = mock.fn();

            const fn = throttle(mocked, { delay: 20, onThrottle });

            fn('arg1', 'arg2');
            fn('arg3', 'arg4');

            calledExactly(mocked, 1, 'throttle with args');
            expect(mocked.mock.calls[0]!.arguments).to.deep.equal(['arg1', 'arg2']);

            calledExactly(onThrottle, 1, 'throttle with args onThrottle');
            expect(onThrottle.mock.calls[0]!.arguments[0]).to.deep.equal(['arg3', 'arg4']);
        });

        it('should test ThrottleError class', async () => {

            const mocked = mock.fn();

            const fn = throttle(mocked, { delay: 20, throws: true });

            fn();

            const [result, error] = attemptSync(() => fn());

            expect(result).to.be.null;
            expect(error).to.be.an.instanceof(Error);
            expect((error as Error).constructor.name).to.equal('ThrottleError');
            expect((error as Error).message).to.equal('Throttled');
        });

        it('should throttle without onThrottle callback', async () => {

            const mocked = mock.fn((x: number) => x * 2);

            const fn = throttle(mocked, { delay: 20 });

            const result1 = fn(5);
            const result2 = fn(10); // Should return cached result

            expect(result1).to.equal(10);
            expect(result2).to.equal(10); // Same as first call

            calledExactly(mocked, 1, 'throttle no callback');
        });

        it('should throttle with async functions', async () => {

            const mocked = mock.fn(async (x: number) => {
                await wait(1);
                return x * 2;
            });

            const fn = throttle(mocked, { delay: 20 });

            const result1 = fn(5);
            const result2 = fn(10);

            // Both should return the same promise (from first call)
            expect(result1).to.equal(result2);

            const resolved = await result1;
            expect(resolved).to.equal(10);

            calledExactly(mocked, 1, 'throttle async');
        });

        it('should not double wrap the function', async () => {

            const fn = mock.fn(() => 'ok');

            const wrappedFn = throttle(fn as any, { delay: 10 });

            const [, error] = attemptSync(() => throttle(wrappedFn, { delay: 10 }));

            expect(error).to.be.an.instanceof(Error);
            expect((error as Error).message).to.equal('Function is already wrapped by throttle');
        });
    });

    describe('flow-control: runInSeries', () => {

        it('should run functions in series', () => {

            const results: string[] = [];
            const fn1 = () => { results.push('first'); };
            const fn2 = () => { results.push('second'); };
            const fn3 = () => { results.push('third'); };

            const result = runInSeries([fn1, fn2, fn3]);

            expect(results).to.deep.equal(['first', 'second', 'third']);
            expect(result).to.deep.equal([undefined, undefined, undefined]);
        });

        it('should run functions in series with return values', () => {

            const fn1 = () => 'first';
            const fn2 = () => 'second';
            const fn3 = () => 'third';

            const result = runInSeries([fn1, fn2, fn3]);

            expect(result).to.deep.equal(['first', 'second', 'third']);
        });

        it('should handle empty array', () => {

            const result = runInSeries([]);

            expect(result).to.deep.equal([]);
        });

        it('should handle single function', () => {

            const fn = () => 'single';
            const result = runInSeries([fn]);

            expect(result).to.deep.equal(['single']);
        });

        it('should handle functions that throw', () => {

            const fn1 = () => 'first';
            const fn2 = () => { throw new Error('second failed'); };
            const fn3 = () => 'third';

            expect(() => runInSeries([fn1, fn2, fn3])).to.throw('second failed');
        });

        it('should work with any iterable', () => {

            const fn1 = () => 'first';
            const fn2 = () => 'second';

            // Test with Set
            const set = new Set([fn1, fn2]);
            const result1 = runInSeries(set);
            expect(result1).to.deep.equal(['first', 'second']);

            // Test with Map values
            const map = new Map([['a', fn1], ['b', fn2]]);
            const result2 = runInSeries(map.values());
            expect(result2).to.deep.equal(['first', 'second']);
        });
    });

    describe('flow-control: makeInSeries', () => {

        it('should create a function that runs functions in series', () => {

            const logStep = (step: string) => `logged: ${step}`;
            const saveData = (data: any) => `saved: ${JSON.stringify(data)}`;
            const sendNotification = (message: string) => `sent: ${message}`;

            const inSeries = makeInSeries([logStep, saveData, sendNotification] as const);

            const result = inSeries(['processing'], [{ id: 1 }], ['User created']);

            expect(result).to.deep.equal([
                'logged: processing',
                'saved: {"id":1}',
                'sent: User created'
            ]);
        });

        it('should handle functions with different argument counts', () => {

            const fn1 = (a: string) => `fn1: ${a}`;
            const fn2 = (a: number, b: string) => `fn2: ${a}-${b}`;
            const fn3 = () => 'fn3: no args';

            const inSeries = makeInSeries([fn1, fn2, fn3]);

            const result = inSeries(['hello'], [42, 'world']);

            expect(result).to.deep.equal([
                'fn1: hello',
                'fn2: 42-world',
                'fn3: no args'
            ]);
        });

        it('should handle empty array', () => {

            const inSeries = makeInSeries([]);

            const result = inSeries();

            expect(result).to.deep.equal([]);
        });

        it('should handle single function', () => {

            const fn = (x: number) => x * 2;
            const inSeries = makeInSeries([fn]);

            const result = inSeries([5]);

            expect(result).to.deep.equal([10]);
        });

        it('should validate input parameters', () => {

            expect(() => makeInSeries('not an array' as any)).to.throw('fns must be an array');
            expect(() => makeInSeries([() => 'ok', 'not a function' as any])).to.throw('fns must be an array of functions');
        });

        it('should handle functions that throw', () => {

            const fn1 = (x: string) => `ok: ${x}`;
            const fn2 = () => { throw new Error('fn2 failed'); };
            const fn3 = (x: string) => `ok: ${x}`;

            const inSeries = makeInSeries([fn1, fn2, fn3] as const);

            expect(() => inSeries(['a'], [], ['c'])).to.throw('fn2 failed');
        });

        it('should handle missing arguments gracefully', () => {

            const fn1 = (a: string) => `fn1: ${a}`;
            const fn2 = (a: number, b: string) => `fn2: ${a}-${b}`;

            const inSeries = makeInSeries([fn1, fn2]);

            // Provide fewer arguments than functions
            const result = inSeries(['hello']);

            expect(result).to.deep.equal([
                'fn1: hello',
                'fn2: undefined-undefined'
            ]);
        });
    });

    describe('flow-control: nextLoop', () => {

        it('should resolve after the next event loop', async () => {

            const start = Date.now();
            await nextLoop();
            const end = Date.now();

            // Should resolve quickly (within a few milliseconds)
            expect(end - start).to.be.lessThan(10);
        });

        it('should resolve in the correct order', async () => {

            const results: string[] = [];

            // Schedule immediate execution
            setImmediate(() => results.push('immediate'));

            // Schedule nextLoop execution
            nextLoop().then(() => results.push('nextLoop'));

            // Schedule setTimeout execution
            setTimeout(() => results.push('timeout'), 5);

            // Wait for all to complete
            await wait(10);

            // nextLoop should resolve before setTimeout but after immediate
            expect(results).to.deep.equal(['immediate', 'nextLoop', 'timeout']);
        });

        it('should work with async/await', async () => {

            let executed = false;

            const asyncFn = async () => {

                await nextLoop();
                executed = true;
            };

            await asyncFn();

            expect(executed).to.be.true;
        });

    });
});
