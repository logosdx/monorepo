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
    throttle,
    wait,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    const { calledExactly } = mockHelpers(expect);

    describe('flow-control: throttle', () => {

        // Define the expected interface for enhanced throttle
        interface ThrottledFunction<T extends (...args: any[]) => any> {
            (...args: Parameters<T>): ReturnType<T>;
            cancel(): void;
        }

        describe('basic throttle functionality', () => {

            it('should throttle and provide cancel method', async () => {

                const mocked = mock.fn();
                const onThrottle = mock.fn();

                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, {
                    delay: 20,
                    onThrottle
                });

                // Verify the function has a cancel method
                expect(fn.cancel).to.be.a('function');

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

            it('should throttle with throws and provide cancel method', async () => {

                const mocked = mock.fn();
                const onThrottle = mock.fn();

                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, {
                    delay: 20,
                    onThrottle,
                    throws: true
                });

                // Verify the function has a cancel method
                expect(fn.cancel).to.be.a('function');

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

            it('should throttle with return values and provide cancel method', async () => {

                const mocked = mock.fn((x: number) => x * 2);

                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 20 });

                // Verify the function has a cancel method
                expect(fn.cancel).to.be.a('function');

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

            it('should throttle with arguments and provide cancel method', async () => {

                const mocked = mock.fn();
                const onThrottle = mock.fn();

                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 20, onThrottle });

                // Verify the function has a cancel method
                expect(fn.cancel).to.be.a('function');

                fn('arg1', 'arg2');
                fn('arg3', 'arg4');

                calledExactly(mocked, 1, 'throttle with args');
                expect(mocked.mock.calls[0]!.arguments).to.deep.equal(['arg1', 'arg2']);

                calledExactly(onThrottle, 1, 'throttle with args onThrottle');
                expect(onThrottle.mock.calls[0]!.arguments[0]).to.deep.equal(['arg3', 'arg4']);
            });

            it('should test ThrottleError class', async () => {

                const mocked = mock.fn();

                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 20, throws: true });

                fn();

                const [result, error] = attemptSync(() => fn());

                expect(result).to.be.null;
                expect(error).to.be.an.instanceof(Error);
                expect((error as Error).constructor.name).to.equal('ThrottleError');
                expect((error as Error).message).to.equal('Throttled');
            });

            it('should throttle without onThrottle callback and provide cancel method', async () => {

                const mocked = mock.fn((x: number) => x * 2);

                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 20 });

                // Verify the function has a cancel method
                expect(fn.cancel).to.be.a('function');

                const result1 = fn(5);
                const result2 = fn(10); // Should return cached result

                expect(result1).to.equal(10);
                expect(result2).to.equal(10); // Same as first call

                calledExactly(mocked, 1, 'throttle no callback');
            });

            it('should throttle with async functions and provide cancel method', async () => {

                const mocked = mock.fn(async (x: number) => {
                    await wait(1);
                    return x * 2;
                });

                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 20 });

                // Verify the function has a cancel method
                expect(fn.cancel).to.be.a('function');

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

        describe('enhanced interface', () => {

            it('should have cancel method', () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 10 });

                expect(typeof fn.cancel).to.equal('function');
            });
        });

        describe('cancel() method', () => {

            it('should prevent pending execution during throttle period', async () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                // Call function once - should execute immediately
                fn();
                calledExactly(mocked, 1, 'initial call');

                // Call function again during throttle period - gets throttled
                fn();
                calledExactly(mocked, 1, 'throttled call');

                // Cancel should clear the throttle state
                fn.cancel();

                // Wait past the original throttle period
                await wait(60);

                // Function should not have executed again
                calledExactly(mocked, 1, 'no execution after cancel');

                // New calls should work normally after cancel
                fn();
                calledExactly(mocked, 2, 'new call after cancel');
            });

            it('should clear cached return values', async () => {

                const mocked = mock.fn((x: number) => x * 2);
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                // First call
                const result1 = fn(5);
                expect(result1).to.equal(10);
                calledExactly(mocked, 1, 'first call');

                // Throttled call should return cached result
                const result2 = fn(10);
                expect(result2).to.equal(10); // Same cached result
                calledExactly(mocked, 1, 'throttled call returns cached');

                // Cancel clears state
                fn.cancel();

                // After cancel, new call should execute with new arguments
                const result3 = fn(15);
                expect(result3).to.equal(30); // New calculation
                calledExactly(mocked, 2, 'new call after cancel');
            });

            it('should be safe to call multiple times', () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                fn();

                expect(() => {
                    fn.cancel();
                    fn.cancel();
                    fn.cancel();
                }).to.not.throw();

                calledExactly(mocked, 1, 'multiple cancel calls');
            });

            it('should be safe to call when no throttling is active', () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                // Call cancel before any function calls
                expect(() => fn.cancel()).to.not.throw();

                calledExactly(mocked, 0, 'cancel before any calls');
            });

            it('should be safe to call after throttle period expires', async () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 20 });

                fn();
                calledExactly(mocked, 1, 'initial call');

                // Wait for throttle period to expire naturally
                await wait(25);

                // Cancel after period expired should be safe
                expect(() => fn.cancel()).to.not.throw();
                calledExactly(mocked, 1, 'cancel after period expired');
            });

            it('should not affect onThrottle callback behavior before cancel', async () => {

                const mocked = mock.fn();
                const onThrottle = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50, onThrottle });

                fn('arg1');
                fn('arg2'); // Should trigger onThrottle

                calledExactly(mocked, 1, 'function call');
                calledExactly(onThrottle, 1, 'onThrottle called');
                expect(onThrottle.mock.calls[0]!.arguments[0]).to.deep.equal(['arg2']);

                fn.cancel();

                // onThrottle should have been called before cancel
                calledExactly(onThrottle, 1, 'onThrottle called before cancel');
            });

            it('should work with throws: true option', async () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50, throws: true });

                fn();
                calledExactly(mocked, 1, 'initial call');

                // Should throw during throttle period
                expect(() => fn()).to.throw('Throttled');

                fn.cancel();

                // After cancel, new calls should work normally (not throw)
                fn();
                calledExactly(mocked, 2, 'call after cancel works');
            });

            it('should reset state for future calls', async () => {

                const mocked = mock.fn((x: number) => x + 1);
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                // First execution
                const result1 = fn(5);
                expect(result1).to.equal(6);

                // Throttled call returns cached result
                const result2 = fn(10);
                expect(result2).to.equal(6); // Same cached result

                fn.cancel();

                // After cancel, state should be reset
                const result3 = fn(15);
                expect(result3).to.equal(16); // New calculation

                // Verify it can throttle again normally
                const result4 = fn(20);
                expect(result4).to.equal(16); // Returns cached result from previous call

                calledExactly(mocked, 2, 'state reset after cancel');
            });

            it('should clear internal timestamp state', async () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 30 });

                fn();
                calledExactly(mocked, 1, 'first call');

                // Cancel should clear the lastCalled timestamp
                fn.cancel();

                // Immediate call after cancel should execute (not be throttled)
                fn();
                calledExactly(mocked, 2, 'immediate call after cancel executes');
            });

            it('should work correctly with rapid cancel and new calls', async () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 100 });

                fn();
                calledExactly(mocked, 1, 'initial call');

                fn.cancel();
                fn(); // Should execute immediately after cancel
                calledExactly(mocked, 2, 'call after cancel');

                fn.cancel();
                fn(); // Should execute immediately after second cancel
                calledExactly(mocked, 3, 'call after second cancel');
            });

            it('should handle cancel during async function execution', async () => {

                const mocked = mock.fn(async (x: number) => {
                    await wait(10);
                    return x * 2;
                });

                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                const result1 = fn(5);
                expect(result1).to.be.instanceOf(Promise);

                // Cancel while async function is still running
                fn.cancel();

                // The already-running async function should complete normally
                const resolved = await result1;
                expect(resolved).to.equal(10);
                calledExactly(mocked, 1, 'async function completed despite cancel');

                // New call after cancel should work
                const result2 = fn(10);
                expect(result2).to.be.instanceOf(Promise);
                const resolved2 = await result2;
                expect(resolved2).to.equal(20);
                calledExactly(mocked, 2, 'new async call after cancel');
            });

            it('should clear cached promise results', async () => {

                const mocked = mock.fn(async (x: number) => {
                    await wait(1);
                    return x * 3;
                });

                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                const promise1 = fn(5);
                const promise2 = fn(10); // Should return same promise due to throttling

                expect(promise1).to.equal(promise2);

                fn.cancel();

                // After cancel, new call should create new promise
                const promise3 = fn(15);
                expect(promise3).to.not.equal(promise1);

                const result1 = await promise1;
                const result3 = await promise3;

                expect(result1).to.equal(15);
                expect(result3).to.equal(45);
                calledExactly(mocked, 2, 'new promise after cancel');
            });
        });

        describe('edge cases and error handling', () => {

            it('should handle cancel with no prior state', () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                // Cancel without any prior calls should not throw
                expect(() => fn.cancel()).to.not.throw();
                calledExactly(mocked, 0, 'cancel with no state');
            });

            it('should maintain function identity after cancel', () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                const originalCancel = fn.cancel;

                fn();
                fn.cancel();

                // The cancel method should remain the same function
                expect(fn.cancel).to.equal(originalCancel);
                expect(typeof fn.cancel).to.equal('function');
            });

            it('should work with functions that return undefined', () => {

                const mocked = mock.fn(() => undefined);
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                const result1 = fn();
                expect(result1).to.be.undefined;

                const result2 = fn(); // Throttled call
                expect(result2).to.be.undefined;

                fn.cancel();

                const result3 = fn();
                expect(result3).to.be.undefined;

                calledExactly(mocked, 2, 'undefined return values');
            });

            it('should work with functions that return null', () => {

                const mocked = mock.fn(() => null);
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                const result1 = fn();
                expect(result1).to.be.null;

                const result2 = fn(); // Throttled call
                expect(result2).to.be.null;

                fn.cancel();

                const result3 = fn();
                expect(result3).to.be.null;

                calledExactly(mocked, 2, 'null return values');
            });

            it('should work with functions that return false', () => {

                const mocked = mock.fn(() => false);
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                const result1 = fn();
                expect(result1).to.be.false;

                const result2 = fn(); // Throttled call
                expect(result2).to.be.false;

                fn.cancel();

                const result3 = fn();
                expect(result3).to.be.false;

                calledExactly(mocked, 2, 'false return values');
            });
        });

        describe('memory and state management', () => {

            it('should properly clean up state after cancel', async () => {

                const mocked = mock.fn((x: number) => x * 2);
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                fn(5);
                fn(10); // Throttled
                calledExactly(mocked, 1, 'before cancel');

                fn.cancel();

                // After cancel, all state should be cleared
                fn(15); // Should execute immediately with new args
                calledExactly(mocked, 2, 'immediate execution after cancel');

                expect(mocked.mock.calls[1]!.arguments).to.deep.equal([15]);
            });

            it('should not retain references after cancel', () => {

                const mocked = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                fn('some', 'arguments');
                fn.cancel();

                // Internal argument references should be cleared
                // This is more of a conceptual test - the implementation should not hold references
                fn('new', 'arguments');

                calledExactly(mocked, 2, 'no retained references');
                expect(mocked.mock.calls[1]!.arguments).to.deep.equal(['new', 'arguments']);
            });

            it('should handle complex throttling and cancel scenarios', async () => {

                const mocked = mock.fn((x: number, y: string) => `${x}-${y}`);
                const onThrottle = mock.fn();
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, {
                    delay: 50,
                    onThrottle
                });

                // First call executes immediately
                const result1 = fn(1, 'a');
                expect(result1).to.equal('1-a');
                calledExactly(mocked, 1, 'first call');

                // Second call is throttled
                const result2 = fn(2, 'b');
                expect(result2).to.equal('1-a'); // Returns cached result
                calledExactly(mocked, 1, 'throttled call');
                calledExactly(onThrottle, 1, 'onThrottle called');

                // Cancel clears state
                fn.cancel();

                // Next call should execute with new arguments
                const result3 = fn(3, 'c');
                expect(result3).to.equal('3-c');
                calledExactly(mocked, 2, 'call after cancel');

                // Verify it can throttle again normally
                const result4 = fn(4, 'd');
                expect(result4).to.equal('3-c'); // Returns cached result
                calledExactly(mocked, 2, 'throttling works after cancel');
                calledExactly(onThrottle, 2, 'onThrottle called again');
            });

            it('should handle cancel with complex argument patterns', () => {

                const mocked = mock.fn((...args: unknown[]) => args.length);
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                // Call with various argument patterns
                fn(1, 2, 3);
                fn('a', 'b');
                fn({ key: 'value' });
                fn();

                calledExactly(mocked, 1, 'only first call executed');
                expect(mocked.mock.calls[0]!.arguments).to.deep.equal([1, 2, 3]);

                fn.cancel();

                // After cancel, new call with different args should work
                const result = fn('x', 'y', 'z', 'w');
                expect(result).to.equal(4);
                calledExactly(mocked, 2, 'call after cancel with new args');
                expect(mocked.mock.calls[1]!.arguments).to.deep.equal(['x', 'y', 'z', 'w']);
            });

            it('should handle cancel with error-throwing functions', () => {

                const error = new Error('test error');
                const mocked = mock.fn(() => { throw error; });
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 50 });

                // First call throws
                expect(() => fn()).to.throw('test error');
                calledExactly(mocked, 1, 'error on first call');

                // Throttled call returns cached result (which is the error)
                expect(() => fn()).to.throw('test error');
                calledExactly(mocked, 1, 'cached error on throttled call');

                fn.cancel();

                // After cancel, new call should execute normally
                expect(() => fn()).to.throw('test error');
                calledExactly(mocked, 2, 'new execution after cancel');
            });

            it('should maintain proper TypeScript interface compliance', () => {

                const syncMocked = mock.fn((x: number) => x.toString());
                const asyncMocked = mock.fn(async (x: number) => x.toString());

                const syncFn: ThrottledFunction<typeof syncMocked> = throttle(syncMocked, { delay: 50 });
                const asyncFn: ThrottledFunction<typeof asyncMocked> = throttle(asyncMocked, { delay: 50 });

                // Verify function call signatures work correctly
                const syncResult: string = syncFn(42);
                const asyncResult: Promise<string> = asyncFn(42);

                // Verify cancel method exists and is callable
                expect(typeof syncFn.cancel).to.equal('function');
                expect(typeof asyncFn.cancel).to.equal('function');

                syncFn.cancel();
                asyncFn.cancel();

                // These should not throw TypeScript errors
                expect(syncResult).to.be.a('string');
                expect(asyncResult).to.be.instanceOf(Promise);
            });

            it('should handle cancel during throttle period with complex timing', async () => {

                const mocked = mock.fn((x: number) => x * 2);
                const fn: ThrottledFunction<typeof mocked> = throttle(mocked, { delay: 100 });

                // Execute first call
                const result1 = fn(5);
                expect(result1).to.equal(10);
                calledExactly(mocked, 1, 'first execution');

                // Wait partial delay period
                await wait(25);

                // Throttled call during delay
                const result2 = fn(10);
                expect(result2).to.equal(10); // Returns cached result
                calledExactly(mocked, 1, 'throttled during delay');

                // Cancel mid-throttle period
                fn.cancel();

                // Immediate call after cancel should execute
                const result3 = fn(15);
                expect(result3).to.equal(30);
                calledExactly(mocked, 2, 'immediate execution after mid-throttle cancel');

                // Wait past throttle period (need >100ms since fn(15) call)
                await wait(101);

                // Should still be able to throttle normally
                const result4 = fn(20);
                expect(result4).to.equal(40);
                calledExactly(mocked, 3, 'normal execution after delay');

                const result5 = fn(25);
                expect(result5).to.equal(40); // Should be throttled
                calledExactly(mocked, 3, 'throttled after normal execution');
            });
        });
    });
});