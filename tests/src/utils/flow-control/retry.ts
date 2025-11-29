import {
    describe,
    it,
    vi,
    expect
} from 'vitest'


import { mockHelpers } from '../../_helpers';

import {
    attempt,
    retry,
    makeRetryable,
    wait,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils - flow-control: retry', () => {

    const { calledExactly } = mockHelpers(expect);

    it('should retry', async () => {

        const fn = vi.fn(() => 'ok');
        let succeedAfter = 2;

        fn.mockImplementation(() => {

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

        const fn = vi.fn(() => 'ok');
        let attempts = 0;

        fn.mockImplementation(() => {
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

        const fn = vi.fn(() => {
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

        const fn = vi.fn(() => {
            throw new Error('custom error');
        });

        const shouldRetry = vi.fn((error: Error) => {
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

        const fn = vi.fn(() => 'ok');
        let attempts = 0;

        fn.mockImplementation(() => {
            attempts++;
            if (attempts < 2) {
                throw new Error('retryable error');
            }
            return 'ok';
        });

        const shouldRetry = vi.fn((error: Error) => {
            return error.message === 'retryable error';
        });

        const result = await retry(fn, { retries: 3, shouldRetry });

        expect(result).to.equal('ok');
        calledExactly(fn, 2, 'retry shouldRetry true');
        calledExactly(shouldRetry, 1, 'retry shouldRetry callback true');
    });

    it('should retry with zero delay', async () => {

        const fn = vi.fn(() => 'ok');
        let attempts = 0;

        fn.mockImplementation(() => {
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

        const fn = vi.fn(() => 'immediate success');

        const result = await retry(fn, { retries: 3 });

        expect(result).to.equal('immediate success');
        calledExactly(fn, 1, 'retry immediate success');
    });

    it('should retry with async functions', async () => {

        const fn = vi.fn(async () => 'async ok');
        let attempts = 0;

        fn.mockImplementation(async () => {
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

        const fn = vi.fn(() => {
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
        expect(elapsed).to.be.greaterThan(55);
    });

    it('should retry with jitter', async () => {

        const fn = vi.fn(() => {
            throw new Error('always fail');
        });

        const start = Date.now();

        const [, error] = await attempt(() =>
            retry(fn, { retries: 3, delay: 10, jitterFactor: 0.5 })
        );

        const elapsed = Date.now() - start;

        expect(error).to.be.an.instanceof(Error);
        expect(error!.message).to.equal('Max retries reached');
        calledExactly(fn, 3, 'retry with jitter');

        // With jitterFactor of 0.5 (+1) and delay of 10: 10ms * ~1.5 + 10ms * ~1.5 + 10ms * ~1.5 = 37.5ms average
        expect(elapsed).to.be.greaterThan(31.5);
        expect(elapsed).to.be.lessThan(45);
    });

    it('should retry with abort signal', async () => {

        const fn = vi.fn(
            async () => {

                await wait(10);

                throw new Error('force retry');
            }
        );
        const controller1 = new AbortController();
        const controller2 = new AbortController();

        controller1.abort(new Error('test1'));

        const [result1, error1] = await attempt(() =>
            retry(fn, {
                retries: 3,
                signal: controller1.signal,
                delay: 10
            })
        );

        calledExactly(fn, 0, 'retry with abort signal');

        setTimeout(() => controller2.abort(new Error('test2')), 7);

        const [result2, error2] = await attempt(() =>
            retry(fn, {
                retries: 3,
                signal: controller2.signal,
                delay: 10
            })
        );

        calledExactly(fn, 1, 'retry with abort signal');

        expect(result1).to.be.null;
        expect(error1).to.be.an.instanceof(Error);
        expect(error1!.message).to.equal('test1');
        expect(result2).to.be.null;
        expect(error2).to.be.an.instanceof(Error);
        expect(error2!.message).to.equal('test2');

    });

    it('should not retry if the function returns falsy', async () => {

        const fnNull = vi.fn(() => null);
        const fnUndefined = vi.fn(() => undefined);
        const fnFalse = vi.fn(() => false);
        const fnZero = vi.fn(() => 0);
        const fnEmptyString = vi.fn(() => '');

        const resultNull = await retry(fnNull, { retries: 3, delay: 10 });
        const resultUndefined = await retry(fnUndefined, { retries: 3, delay: 10 });
        const resultFalse = await retry(fnFalse, { retries: 3, delay: 10 });
        const resultZero = await retry(fnZero, { retries: 3, delay: 10 });
        const resultEmptyString = await retry(fnEmptyString, { retries: 3, delay: 10 });

        expect(resultNull).to.be.null;
        expect(resultUndefined).to.be.undefined;
        expect(resultFalse).to.be.false;
        expect(resultZero).to.equal(0);
        expect(resultEmptyString).to.equal('');

        calledExactly(fnNull, 1, 'retry not retry null');
        calledExactly(fnUndefined, 1, 'retry not retry undefined');
        calledExactly(fnFalse, 1, 'retry not retry false');
        calledExactly(fnZero, 1, 'retry not retry zero');
        calledExactly(fnEmptyString, 1, 'retry not retry empty string');
    });
    describe('makeRetryable', () => {

        it('should create a retryable function', async () => {

            const fn = vi.fn(() => 'retryable ok');
            let attempts = 0;

            fn.mockImplementation(() => {
                attempts++;
                if (attempts < 3) {
                    throw new Error('retryable test');
                }
                return 'retryable ok';
            });

            const retryableFn = makeRetryable(fn, { retries: 3, delay: 5 });

            const result = await retryableFn();

            expect(result).to.equal('retryable ok');
            calledExactly(fn, 3, 'makeRetryable basic');
        });

        it('should preserve function arguments', async () => {

            const fn = vi.fn((a: number, b: string) => `${a}-${b}`);
            let attempts = 0;

            fn.mockImplementation((a: number, b: string) => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('args test');
                }
                return `${a}-${b}`;
            });

            const retryableFn = makeRetryable(fn, { retries: 3 });

            const result = await retryableFn(42, 'test');

            expect(result).to.equal('42-test');
            calledExactly(fn, 2, 'makeRetryable args');
            expect(fn.mock.calls[0]).to.deep.equal([42, 'test']);
            expect(fn.mock.calls[1]).to.deep.equal([42, 'test']);
        });

        it('should work with async functions', async () => {

            const asyncFn = vi.fn(async (value: string) => `async-${value}`);
            let attempts = 0;

            asyncFn.mockImplementation(async (value: string) => {
                attempts++;
                await wait(1);
                if (attempts < 2) {
                    throw new Error('async retryable test');
                }
                return `async-${value}`;
            });

            const retryableAsyncFn = makeRetryable(asyncFn, { retries: 3, delay: 2 });

            const result = await retryableAsyncFn('data');

            expect(result).to.equal('async-data');
            calledExactly(asyncFn, 2, 'makeRetryable async');
        });

        it('should respect retry options', async () => {

            const fn = vi.fn(() => {
                throw new Error('always fail');
            });

            const shouldRetry = vi.fn((error: Error) => {
                return error.message !== 'always fail';
            });

            const retryableFn = makeRetryable(fn, {
                retries: 3,
                shouldRetry
            });

            const [, error] = await attempt(() => retryableFn());

            expect(error).to.be.an.instanceof(Error);
            expect(error!.message).to.equal('always fail');
            calledExactly(fn, 1, 'makeRetryable shouldRetry');
            calledExactly(shouldRetry, 1, 'makeRetryable shouldRetry callback');
        });

        it('should handle backoff correctly', async () => {

            const fn = vi.fn(() => {
                throw new Error('backoff fail');
            });

            const retryableFn = makeRetryable(fn, {
                retries: 3,
                delay: 10,
                backoff: 2
            });

            const start = Date.now();

            const [, error] = await attempt(() => retryableFn());

            const elapsed = Date.now() - start;

            expect(error).to.be.an.instanceof(Error);
            expect(error!.message).to.equal('Max retries reached');
            calledExactly(fn, 3, 'makeRetryable backoff');

            // With backoff of 2 and delay of 10: 10ms + 20ms = 30ms minimum
            expect(elapsed).to.be.greaterThan(25);
        });

        it('should validate parameters', () => {

            expect(() => makeRetryable('not a function' as any, { retries: 3 }))
                .to.throw('fn must be a function');

            expect(() => makeRetryable(vi.fn(), 'not an object' as any))
                .to.throw('opts must be an object');

            expect(() => makeRetryable(vi.fn(), { retries: 0 }))
                .to.throw('retries must be a positive number');

            expect(() => makeRetryable(vi.fn(), { retries: 3, delay: -1 }))
                .to.throw('delay must be a positive number');

            expect(() => makeRetryable(vi.fn(), { retries: 3, backoff: 0 }))
                .to.throw('backoff must be a positive number');

            expect(() => makeRetryable(vi.fn(), { retries: 3, shouldRetry: 'not a function' as any }))
                .to.throw('shouldRetry must be a function');
        });

        it('should work with multiple instances independently', async () => {

            const fn1 = vi.fn(() => 'fn1 result');
            const fn2 = vi.fn(() => 'fn2 result');

            let attempts1 = 0;
            let attempts2 = 0;

            fn1.mockImplementation(() => {
                attempts1++;
                if (attempts1 < 2) {
                    throw new Error('fn1 error');
                }
                return 'fn1 result';
            });

            fn2.mockImplementation(() => {
                attempts2++;
                if (attempts2 < 3) {
                    throw new Error('fn2 error');
                }
                return 'fn2 result';
            });

            const retryableFn1 = makeRetryable(fn1, { retries: 3 });
            const retryableFn2 = makeRetryable(fn2, { retries: 3 });

            const [result1, result2] = await Promise.all([
                retryableFn1(),
                retryableFn2()
            ]);

            expect(result1).to.equal('fn1 result');
            expect(result2).to.equal('fn2 result');
            calledExactly(fn1, 2, 'makeRetryable independent fn1');
            calledExactly(fn2, 3, 'makeRetryable independent fn2');
        });

        it('should not double wrap the function', async () => {

            const fn = vi.fn(() => 'ok');

            const wrappedFn = makeRetryable(fn as any, { retries: 1 });

            const [, error] = await attempt(() => makeRetryable(wrappedFn, { retries: 1 }));

            expect(error).to.be.an.instanceof(Error);
            expect((error as Error).message).to.match(/Function is already wrapped/);

        });
    });
});