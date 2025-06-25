import {
    describe,
    it,
    mock,
} from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import { mockHelpers } from '../../_helpers';

import {
    attempt,
    attemptSync,
    withTimeout,
    TimeoutError,
    wait,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils - flow-control: withTimeout', () => {

    const { calledExactly } = mockHelpers(expect);

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

    it('should call abortController.abort() when timeout occurs', async () => {

        const abortController = new AbortController();
        const abortSpy = mock.fn();
        abortController.abort = abortSpy;

        const fn = mock.fn(async () => {
            await wait(100);
            return 'ok';
        });

        const wrappedFn = withTimeout(fn, {
            timeout: 50,
            abortController
        });

        const [result, error] = await attempt(() => wrappedFn());

        expect(result).to.be.null;
        expect(error).to.be.an.instanceof(TimeoutError);

        calledExactly(abortSpy, 1, 'abortController.abort called on timeout');
    });

    it('should call onError callback for timeout errors', async () => {

        const onError = mock.fn();

        const fn = mock.fn(async () => {
            await wait(100);
            return 'ok';
        });

        const wrappedFn = withTimeout(fn, {
            timeout: 50,
            onError
        });

        const [result, error] = await attempt(() => wrappedFn());

        expect(result).to.be.null;
        expect(error).to.be.an.instanceof(TimeoutError);

        calledExactly(onError, 1, 'onError called for timeout');

        expect(onError.mock.calls[0]!.arguments[0]).to.be.an.instanceof(TimeoutError);
        expect(onError.mock.calls[0]!.arguments[1]).to.equal(true); // didTimeout = true
    });

    it('should call onError callback for non-timeout errors', async () => {

        const onError = mock.fn();
        const testError = new Error('non-timeout error');

        const fn = mock.fn(async () => {
            await wait(10);
            throw testError;
        });

        const wrappedFn = withTimeout(fn, {
            timeout: 100,
            onError,
            throws: false
        });

        const result = await wrappedFn();

        expect(result).to.be.null;

        calledExactly(onError, 1, 'onError called for non-timeout error');

        expect(onError.mock.calls[0]!.arguments[0]).to.equal(testError);
        expect(onError.mock.calls[0]!.arguments[1]).to.equal(false); // didTimeout = false
    });

    it('should call onTimeout callback when timeout occurs', async () => {

        const onTimeout = mock.fn();

        const fn = mock.fn(async () => {
            await wait(100);
            return 'ok';
        });

        const wrappedFn = withTimeout(fn, {
            timeout: 50,
            onTimeout
        });

        const [result, error] = await attempt(() => wrappedFn());

        expect(result).to.be.null;
        expect(error).to.be.an.instanceof(TimeoutError);

        calledExactly(onTimeout, 1, 'onTimeout called');

        expect(onTimeout.mock.calls[0]!.arguments[0]).to.be.an.instanceof(TimeoutError);
        expect(onTimeout.mock.calls[0]!.arguments[1]).to.be.an.instanceof(Promise);
    });

    it('should throw non-timeout errors when throws is true', async () => {

        const testError = new Error('non-timeout error');

        const fn = mock.fn(async () => {
            await wait(10);
            throw testError;
        });

        const wrappedFn = withTimeout(fn, {
            timeout: 100,
            throws: true
        });

        const [result, error] = await attempt(() => wrappedFn());

        expect(result).to.be.null;
        expect(error).to.equal(testError);
    });

    it('should not throw non-timeout errors when throws is false', async () => {

        const testError = new Error('non-timeout error');

        const fn = mock.fn(async () => {
            await wait(10);
            throw testError;
        });

        const wrappedFn = withTimeout(fn, {
            timeout: 100,
            throws: false
        });

        const result = await wrappedFn();

        expect(result).to.be.null;
    });

    it('should call both onError and onTimeout callbacks when timeout occurs', async () => {

        const onError = mock.fn();
        const onTimeout = mock.fn();

        const fn = mock.fn(async () => {
            await wait(100);
            return 'ok';
        });

        const wrappedFn = withTimeout(fn, {
            timeout: 50,
            onError,
            onTimeout
        });

        const [result, error] = await attempt(() => wrappedFn());

        expect(result).to.be.null;
        expect(error).to.be.an.instanceof(TimeoutError);

        calledExactly(onError, 1, 'onError called on timeout');
        calledExactly(onTimeout, 1, 'onTimeout called on timeout');
    });

    it('should handle all options together', async () => {

        const abortController = new AbortController();
        const abortSpy = mock.fn();
        abortController.abort = abortSpy;

        const onError = mock.fn();
        const onTimeout = mock.fn();

        const fn = mock.fn(async () => {
            await wait(100);
            return 'ok';
        });

        const wrappedFn = withTimeout(fn, {
            timeout: 50,
            abortController,
            onError,
            onTimeout,
            throws: true
        });

        const [result, error] = await attempt(() => wrappedFn());

        expect(result).to.be.null;
        expect(error).to.be.an.instanceof(TimeoutError);

        calledExactly(abortSpy, 1, 'abortController.abort called');
        calledExactly(onError, 1, 'onError called');
        calledExactly(onTimeout, 1, 'onTimeout called');
    });

    it('should not double wrap the function', async () => {

        const fn = mock.fn(() => 'ok');

        const wrappedFn = withTimeout(fn, { timeout: 100 });

        const [, error] = await attempt(() => withTimeout(wrappedFn, { timeout: 100 }) as any);

        expect(error).to.be.an.instanceof(Error);
        expect((error as Error).message).to.equal('Function is already wrapped by withTimeout');
    });
});