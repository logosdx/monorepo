import {
    describe,
    it,
    before,
    after,
    mock,
    Mock
} from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import { mockHelpers } from '../../_helpers';

import {
    attempt,
    attemptSync,
    debounce,
    throttle,
    retry,
    batch,
    wait,
    withTimeout,
    TimeoutError,
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

    describe('flow-control: batch', () => {

        it('should batch', async () => {

            const func = async (n: number) => {

                await wait(10);

                return n;
            }

            const fn = mock.fn(func);
            const onStart = mock.fn();
            const onEnd = mock.fn();
            const onChunkStart = mock.fn();
            const onChunkEnd = mock.fn();

            const items = Array.from(
                { length: 100 },
                (_, i) => [i] as [number]
            );

            const promise1 = batch(fn, {

                items,
                concurrency: 40,
                onStart,
                onEnd,
                onChunkStart,
                onChunkEnd,
            });

            await wait(1);

            calledExactly(onStart, 1, 'batch onStart 1');
            calledExactly(onChunkStart, 1, 'batch onChunkStart 1');
            calledExactly(fn, 40, 'batch fn 1');

            await wait(10);

            calledExactly(onChunkStart, 2, 'batch onChunkStart 2');
            calledExactly(onChunkEnd, 1, 'batch onChunkEnd 2');
            calledExactly(fn, 80, 'batch fn 2');

            await wait(10);

            calledExactly(onChunkStart, 3, 'batch onChunkStart 3');
            calledExactly(onChunkEnd, 2, 'batch onChunkEnd 3');
            calledExactly(fn, 100, 'batch fn 3');
            calledExactly(onEnd, 0, 'batch onEnd 3');

            const result = await promise1;

            calledExactly(onEnd, 1, 'batch onEnd 4');

            expect(result.map(r => r.result)).to.deep.equal(items.map(([i]) => i));
        });

        it('should batch in failureModes continue', async () => {

            const items = Array.from(
                { length: 100 },
                (_, i) => [i] as [number]
            );

            const fn = mock.fn((n: number) => {

                if (n % 2 === 0) {
                    throw new Error('poop');
                }

                return 'ok';
            });

            const onError = mock.fn();

            const result = await batch(fn, {

                items,
                concurrency: 10,
                failureMode: 'continue',
                onError,
            });

            calledExactly(onError, 50, 'batch onError 1');

            const errors = result.filter(r => r.error);
            const results = result.filter(r => !r.error);

            expect(errors.length).to.equal(50);
            expect(results.length).to.equal(50);
        });

        it('should batch in failureMode abort', async () => {

            const items = Array.from(
                { length: 10 },
                (_, i) => [i] as [number]
            );

            const fn = mock.fn((n: number) => {

                if (n === 5) {
                    throw new Error('abort test');
                }

                return 'ok';
            });

            const onError = mock.fn();

            const [result, error] = await attempt(() =>
                batch(fn, {
                    items,
                    concurrency: 2,
                    failureMode: 'abort',
                    onError,
                })
            );

            expect(result).to.be.null;
            expect(error).to.be.an.instanceof(Error);
            expect(error!.message).to.equal('abort test');

            calledExactly(onError, 1, 'batch abort onError');
            calledExactly(fn, 6, 'batch abort fn');
        });

        it('should validate parameters', async () => {

            const items = [[1], [2], [3]];

                        // fn must be a function
            const [, error1] = await attempt(() =>
                batch('not a function' as any, { items })
            );
            expect(error1).to.be.an.instanceof(Error);
            expect((error1 as Error).message).to.equal('fn must be a function');

            // concurrency must be greater than 0
            const [, error2] = await attempt(() =>
                batch(mock.fn(), { items, concurrency: 0 })
            );
            expect(error2).to.be.an.instanceof(Error);
            expect((error2 as Error).message).to.equal('concurrency must be greater than 0');

            // items must be an array
            const [, error3] = await attempt(() =>
                batch(mock.fn(), { items: 'not an array' as any })
            );
            expect(error3).to.be.an.instanceof(Error);
            expect((error3 as Error).message).to.equal('items must be an array');

            // failureMode validation
            const [, error4] = await attempt(() =>
                batch(mock.fn(), { items, failureMode: 'invalid' as any })
            );
            expect(error4).to.be.an.instanceof(Error);
            expect((error4 as Error).message).to.equal('failureMode must be either "abort" or "continue"');

            // callback function validation
            const [, error5] = await attempt(() =>
                batch(mock.fn(), { items, onError: 'not a function' as any })
            );
            expect(error5).to.be.an.instanceof(Error);
            expect((error5 as Error).message).to.equal('onError must be a function');

            const [, error6] = await attempt(() =>
                batch(mock.fn(), { items, onStart: 'not a function' as any })
            );
            expect(error6).to.be.an.instanceof(Error);
            expect((error6 as Error).message).to.equal('onStart must be a function');

            const [, error7] = await attempt(() =>
                batch(mock.fn(), { items, onChunkStart: 'not a function' as any })
            );
            expect(error7).to.be.an.instanceof(Error);
            expect((error7 as Error).message).to.equal('onChunkStart must be a function');

            const [, error8] = await attempt(() =>
                batch(mock.fn(), { items, onChunkEnd: 'not a function' as any })
            );
            expect(error8).to.be.an.instanceof(Error);
            expect((error8 as Error).message).to.equal('onChunkEnd must be a function');

            const [, error9] = await attempt(() =>
                batch(mock.fn(), { items, onEnd: 'not a function' as any })
            );
            expect(error9).to.be.an.instanceof(Error);
            expect((error9 as Error).message).to.equal('onEnd must be a function');
        });

        it('should handle empty items array', async () => {

            const fn = mock.fn();
            const onStart = mock.fn();
            const onEnd = mock.fn();
            const onChunkStart = mock.fn();
            const onChunkEnd = mock.fn();

            const result = await batch(fn, {
                items: [],
                onStart,
                onEnd,
                onChunkStart,
                onChunkEnd
            });

            expect(result).to.deep.equal([]);
            calledExactly(fn, 0, 'empty items fn');
            calledExactly(onStart, 1, 'empty items onStart');
            calledExactly(onEnd, 1, 'empty items onEnd');
            calledExactly(onChunkStart, 0, 'empty items onChunkStart');
            calledExactly(onChunkEnd, 0, 'empty items onChunkEnd');
        });

        it('should handle concurrency of 1 (sequential)', async () => {

            const fn = mock.fn((n: number) => n * 2);
            const items = [[1], [2], [3]] as [number][];

            const result = await batch(fn, {
                items,
                concurrency: 1
            });

            calledExactly(fn, 3, 'sequential fn calls');
            expect(result.map(r => r.result)).to.deep.equal([2, 4, 6]);
        });

        it('should handle concurrency larger than items length', async () => {

            const fn = mock.fn((n: number) => n * 2);
            const items = [[1], [2]] as [number][];

            const result = await batch(fn, {
                items,
                concurrency: 10
            });

            calledExactly(fn, 2, 'large concurrency fn calls');
            expect(result.map(r => r.result)).to.deep.equal([2, 4]);
        });

        it('should use default values', async () => {

            const fn = mock.fn((n: number) => n);
            const items = Array.from({ length: 25 }, (_, i) => [i] as [number]);
            const onChunkStart = mock.fn();
            const onChunkEnd = mock.fn();

            const result = await batch(fn, { items, onChunkStart, onChunkEnd });

            // With default concurrency of 10, should process in 3 chunks
            calledExactly(fn, 25, 'default values fn calls');
            expect(result.length).to.equal(25);

            calledExactly(onChunkStart, 3, 'default values onChunkStart');
            calledExactly(onChunkEnd, 3, 'default values onChunkEnd');
        });

        it('should pass correct parameters to callbacks', async () => {

            const fn = mock.fn((n: number) => n);
            const items = Array.from({ length: 7 }, (_, i) => [i] as [number]);

            const onStart = mock.fn();
            const onChunkStart = mock.fn();
            const onChunkEnd = mock.fn();
            const onEnd = mock.fn();

            await batch(fn, {
                items,
                concurrency: 3,
                onStart,
                onChunkStart,
                onChunkEnd,
                onEnd
            });

            // onStart should be called with total chunks (3 chunks: 3+3+1)
            calledExactly(onStart, 1, 'callback params onStart');
            expect(onStart.mock.calls[0]!.arguments[0]).to.equal(3);

            // onChunkStart should be called 3 times with correct parameters
            calledExactly(onChunkStart, 3, 'callback params onChunkStart');

            // First chunk
            const firstChunkStartCall = onChunkStart.mock.calls[0]!.arguments[0];
            expect(firstChunkStartCall.index).to.equal(0);
            expect(firstChunkStartCall.total).to.equal(3);
            expect(firstChunkStartCall.items.length).to.equal(3);
            expect(firstChunkStartCall.processedCount).to.equal(0);
            expect(firstChunkStartCall.remainingCount).to.equal(6);
            expect(firstChunkStartCall.completionPercent).to.be.closeTo(33.33, 0.01);

            // Last chunk
            const lastChunkStartCall = onChunkStart.mock.calls[2]!.arguments[0];
            expect(lastChunkStartCall.index).to.equal(2);
            expect(lastChunkStartCall.total).to.equal(3);
            expect(lastChunkStartCall.items.length).to.equal(1);
            expect(lastChunkStartCall.processedCount).to.equal(6);
            expect(lastChunkStartCall.remainingCount).to.equal(0);
            expect(lastChunkStartCall.completionPercent).to.equal(100);

            // onEnd should be called with results
            calledExactly(onEnd, 1, 'callback params onEnd');
            expect(onEnd.mock.calls[0]!.arguments[0].length).to.equal(7);
        });

        it('should handle mixed success and failure results correctly', async () => {

            const items = [[1], [2], [3], [4]] as [number][];

            const fn = mock.fn((n: number) => {
                if (n % 2 === 0) {
                    throw new Error(`Error for ${n}`);
                }
                return `Success ${n}`;
            });

            const result = await batch(fn, {
                items,
                concurrency: 2,
                failureMode: 'continue'
            });

            expect(result.length).to.equal(4);

            // Check success cases
            expect(result[0]!.result).to.equal('Success 1');
            expect(result[0]!.error).to.be.null;
            expect(result[2]!.result).to.equal('Success 3');
            expect(result[2]!.error).to.be.null;

            // Check error cases
            expect(result[1]!.result).to.be.null;
            expect(result[1]!.error).to.be.an.instanceof(Error);
            expect(result[1]!.error!.message).to.equal('Error for 2');
            expect(result[3]!.result).to.be.null;
            expect(result[3]!.error).to.be.an.instanceof(Error);
            expect(result[3]!.error!.message).to.equal('Error for 4');
        });
    });

    describe('flow-control: debounce', () => {

        it('should debounce', async () => {

            const mocked = mock.fn();

            const fn = debounce(mocked, 10);

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

            expect(() => debounce('not a function' as any, 10)).to.throw('fn must be a function');
            expect(() => debounce(mock.fn(), 0)).to.throw('delay must be a positive number');
            expect(() => debounce(mock.fn(), -5)).to.throw('delay must be a positive number');
            expect(() => debounce(mock.fn(), 'not a number' as any)).to.throw('delay must be a positive number');
        });

        it('should debounce with arguments', async () => {

            const mocked = mock.fn();

            const fn = debounce(mocked, 10);

            fn('arg1', 'arg2');
            fn('arg3', 'arg4');

            await wait(15);

            calledExactly(mocked, 1, 'debounce with args');
            expect(mocked.mock.calls[0]!.arguments).to.deep.equal(['arg3', 'arg4']);
        });

        it('should debounce with return values', async () => {

            const mocked = mock.fn((x: number) => x * 2);

            const fn = debounce(mocked, 10);

            // Debounced functions don't return values immediately
            const result1 = fn(5);
            const result2 = fn(10);

            expect(result1).to.be.undefined;
            expect(result2).to.be.undefined;

            await wait(15);

            calledExactly(mocked, 1, 'debounce return values');
            expect(mocked.mock.calls[0]!.arguments).to.deep.equal([10]);
        });

        it('should handle multiple debounced functions independently', async () => {

            const mocked1 = mock.fn();
            const mocked2 = mock.fn();

            const fn1 = debounce(mocked1, 10);
            const fn2 = debounce(mocked2, 15);

            fn1('a');
            fn2('b');

            await wait(12);

            calledExactly(mocked1, 1, 'debounce independent 1');
            calledExactly(mocked2, 0, 'debounce independent 2 not yet');

            await wait(5);

            calledExactly(mocked2, 1, 'debounce independent 2');
        });
    });

    describe('flow-control: retry', () => {

        it('should retry', async () => {

            const fn = mock.fn(() => 'ok');
            let succeedAfter = 2;

            fn.mock.mockImplementation(() => {

                if (succeedAfter > 0) {
                    succeedAfter--;
                    throw new Error('poop');
                }

                return 'ok';
            });

            const result = await retry(fn, { retries: 3, delay: 10 });

            calledExactly(fn, 3, 'retry 1');
            expect(result).to.equal('ok');

            succeedAfter = 0;

            const result2 = await retry(fn, { retries: 3, delay: 10 });

            calledExactly(fn, 4, 'retry 2');
            expect(result2).to.equal('ok');

            succeedAfter = 4;

            const [result3, error3] = await attempt(
                () => retry(fn, { retries: 3, delay: 10 })
            );

            expect(result3).to.be.null;
            expect(error3).to.be.an.instanceof(Error);
            expect(error3!.message).to.equal('Max retries reached');
        });

        it('should retry with default values', async () => {

            const fn = mock.fn(() => 'ok');
            let attempts = 0;

            fn.mock.mockImplementation(() => {
                attempts++;
                if (attempts < 3) {
                    throw new Error('retry test');
                }
                return 'ok';
            });

            const result = await retry(fn, { retries: 3 });

            calledExactly(fn, 3, 'retry default values');
            expect(result).to.equal('ok');
        });

        it('should retry with backoff', async () => {

            const fn = mock.fn(() => {
                throw new Error('backoff test');
            });

            const start = Date.now();

            const [, error] = await attempt(() =>
                retry(fn, { retries: 3, delay: 10, backoff: 2 })
            );

            const elapsed = Date.now() - start;

            expect(error).to.be.an.instanceof(Error);
            expect(error!.message).to.equal('Max retries reached');
            calledExactly(fn, 3, 'retry with backoff');

            // With backoff of 2 and delay of 10: 10ms + 20ms = 30ms minimum
            expect(elapsed).to.be.greaterThan(25);
        });

        it('should retry with shouldRetry callback', async () => {

            const fn = mock.fn(() => {
                throw new Error('custom error');
            });

            const shouldRetry = mock.fn((error: Error) => {
                return error.message !== 'custom error';
            });

            const [, error] = await attempt(() =>
                retry(fn, { retries: 3, shouldRetry })
            );

            expect(error).to.be.an.instanceof(Error);
            expect(error!.message).to.equal('custom error');
            calledExactly(fn, 1, 'retry shouldRetry false');
            calledExactly(shouldRetry, 1, 'retry shouldRetry callback');
        });

        it('should retry with shouldRetry returning true', async () => {

            const fn = mock.fn(() => 'ok');
            let attempts = 0;

            fn.mock.mockImplementation(() => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('retryable error');
                }
                return 'ok';
            });

            const shouldRetry = mock.fn((error: Error) => {
                return error.message === 'retryable error';
            });

            const result = await retry(fn, { retries: 3, shouldRetry });

            expect(result).to.equal('ok');
            calledExactly(fn, 2, 'retry shouldRetry true');
            calledExactly(shouldRetry, 1, 'retry shouldRetry callback true');
        });

        it('should retry with zero delay', async () => {

            const fn = mock.fn(() => 'ok');
            let attempts = 0;

            fn.mock.mockImplementation(() => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('no delay test');
                }
                return 'ok';
            });

            const start = Date.now();
            const result = await retry(fn, { retries: 3, delay: 0 });
            const elapsed = Date.now() - start;

            expect(result).to.equal('ok');
            calledExactly(fn, 2, 'retry zero delay');
            expect(elapsed).to.be.lessThan(10); // Should be very fast
        });

        it('should retry with function that succeeds immediately', async () => {

            const fn = mock.fn(() => 'immediate success');

            const result = await retry(fn, { retries: 3 });

            expect(result).to.equal('immediate success');
            calledExactly(fn, 1, 'retry immediate success');
        });

        it('should retry with async functions', async () => {

            const fn = mock.fn(async () => 'async ok');
            let attempts = 0;

            fn.mock.mockImplementation(async () => {
                attempts++;
                await wait(1);
                if (attempts < 2) {
                    throw new Error('async retry test');
                }
                return 'async ok';
            });

            const result = await retry(fn, { retries: 3, delay: 5 });

            expect(result).to.equal('async ok');
            calledExactly(fn, 2, 'retry async');
        });

        it('should retry with complex backoff pattern', async () => {

            const fn = mock.fn(() => {
                throw new Error('always fail');
            });

            const start = Date.now();

            const [, error] = await attempt(() =>
                retry(fn, { retries: 4, delay: 5, backoff: 3 })
            );

            const elapsed = Date.now() - start;

            expect(error).to.be.an.instanceof(Error);
            expect(error!.message).to.equal('Max retries reached');
            calledExactly(fn, 4, 'retry complex backoff');

            // With backoff of 3 and delay of 5: 5ms + 15ms + 45ms = 65ms minimum
            expect(elapsed).to.be.greaterThan(60);
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

    });

    describe('flow-control: withTimeout', () => {

        it('should throw TimeoutError when the function takes too long', async () => {

            const fn = mock.fn(async () => {
                // Simulate a function that takes 100ms to complete
                await wait(100);
                return 'ok';
            });

            const wrappedFn = withTimeout(fn, { timeout: 50 });

            const [result, error] = await attempt(() => wrappedFn());

            expect(result).to.be.null;
            expect(error).to.be.an.instanceof(TimeoutError);
            expect((error as TimeoutError).message).to.equal('Function timed out');
        });

        it('should return the result when the function completes within the timeout', async () => {

            const fn = mock.fn(async () => {
                // Simulate a function that takes 10ms to complete
                await wait(10);
                return 'ok';
            });

            const wrappedFn = withTimeout(fn, { timeout: 100 });
            const result = await wrappedFn();

            expect(result).to.equal('ok');
        });

        it('should pass arguments correctly', async () => {

            const fn = mock.fn(async (a: number, b: string) => {
                await wait(10);
                return `${a}-${b}`;
            });

            const wrappedFn = withTimeout(fn, { timeout: 100 });
            const result = await wrappedFn(42, 'test');

            expect(result).to.equal('42-test');
        });
    });
});
