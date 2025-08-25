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
    wait,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    const { calledExactly } = mockHelpers(expect);

    describe('flow-control: debounce', () => {

        describe('basic debounce functionality', () => {

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
                expect(() => debounce(mock.fn(), { delay: 10, maxWait: 0 })).to.throw('maxWait must be a positive number');
                expect(() => debounce(mock.fn(), { delay: 10, maxWait: -5 })).to.throw('maxWait must be a positive number');
                expect(() => debounce(mock.fn(), { delay: 10, maxWait: 'not a number' as any })).to.throw('maxWait must be a positive number');
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

        describe('enhanced interface', () => {

            it('should have flush and cancel methods', () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 10 });

                expect(typeof fn.flush).to.equal('function');
                expect(typeof fn.cancel).to.equal('function');
            });
        });

        describe('flush() method', () => {

            it('should execute immediately and return result from sync function', () => {

                const mocked = mock.fn((x: number) => x * 2);
                const fn = debounce(mocked, { delay: 50 });

                fn(5);
                
                calledExactly(mocked, 0, 'before flush');

                const result = fn.flush();

                expect(result).to.equal(10);
                calledExactly(mocked, 1, 'after flush');
                expect(mocked.mock.calls[0]!.arguments).to.deep.equal([5]);
            });

            it('should execute immediately and return result from async function', async () => {

                const mocked = mock.fn(async (x: number) => {
                    await wait(1);
                    return x * 3;
                });
                const fn = debounce(mocked, { delay: 50 });

                fn(4);
                
                calledExactly(mocked, 0, 'before flush');

                const result = fn.flush();

                expect(result).to.be.instanceOf(Promise);
                const resolved = await result;
                expect(resolved).to.equal(12);
                calledExactly(mocked, 1, 'after flush');
            });

            it('should work with stored arguments from last call', () => {

                const mocked = mock.fn((a: string, b: number) => `${a}-${b}`);
                const fn = debounce(mocked, { delay: 50 });

                fn('first', 1);
                fn('second', 2);
                fn('third', 3);

                const result = fn.flush();

                expect(result).to.equal('third-3');
                calledExactly(mocked, 1, 'flush with last args');
                expect(mocked.mock.calls[0]!.arguments).to.deep.equal(['third', 3]);
            });

            it('should handle multiple flush calls', () => {

                const mocked = mock.fn((x: number) => x + 1);
                const fn = debounce(mocked, { delay: 50 });

                fn(10);

                const result1 = fn.flush();
                expect(result1).to.equal(11);
                calledExactly(mocked, 1, 'first flush');

                const result2 = fn.flush();
                expect(result2).to.be.undefined;
                calledExactly(mocked, 1, 'second flush should not execute again');
            });

            it('should flush on already-executed function', async () => {

                const mocked = mock.fn((x: number) => x + 5);
                const fn = debounce(mocked, { delay: 10 });

                fn(7);
                await wait(15);

                calledExactly(mocked, 1, 'executed normally');

                const result = fn.flush();
                expect(result).to.be.undefined;
                calledExactly(mocked, 1, 'flush after normal execution');
            });

            it('should return undefined when no pending execution', () => {

                const mocked = mock.fn((x: number) => x * 4);
                const fn = debounce(mocked, { delay: 50 });

                const result = fn.flush();

                expect(result).to.be.undefined;
                calledExactly(mocked, 0, 'flush with no pending execution');
            });

            it('should propagate errors from sync function execution', () => {

                const error = new Error('sync error');
                const mocked = mock.fn(() => { throw error; });
                const fn = debounce(mocked, { delay: 50 });

                fn();

                expect(() => fn.flush()).to.throw('sync error');
                calledExactly(mocked, 1, 'flush with sync error');
            });

            it('should propagate errors from async function execution', async () => {

                const error = new Error('async error');
                const mocked = mock.fn(async () => { throw error; });
                const fn = debounce(mocked, { delay: 50 });

                fn();

                const result = fn.flush();
                expect(result).to.be.instanceOf(Promise);
                
                const [resolved, err] = await attempt(() => result);
                expect(resolved).to.be.null;
                expect(err).to.be.instanceOf(Error);
                expect((err as Error).message).to.equal('async error');
                calledExactly(mocked, 1, 'flush with async error');
            });

            it('should clear timers when flushed', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50 });

                fn();
                fn.flush();

                await wait(60);

                calledExactly(mocked, 1, 'should not execute again after flush');
            });

            it('should clear maxWait timer when flushed', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 100, maxWait: 50 });

                fn();
                await wait(25);
                fn.flush();

                await wait(60);

                calledExactly(mocked, 1, 'should not execute from maxWait after flush');
            });
        });

        describe('cancel() method', () => {

            it('should prevent pending execution', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50 });

                fn();
                calledExactly(mocked, 0, 'before cancel');

                fn.cancel();

                await wait(60);

                calledExactly(mocked, 0, 'after cancel - should not execute');
            });

            it('should clear delay timer', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 20 });

                fn();
                fn.cancel();

                await wait(30);

                calledExactly(mocked, 0, 'delay timer cleared');
            });

            it('should clear maxWait timer', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 100, maxWait: 30 });

                fn();
                await wait(15);
                fn.cancel();

                await wait(40);

                calledExactly(mocked, 0, 'maxWait timer cleared');
            });

            it('should be safe to call multiple times', () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50 });

                fn();

                expect(() => {
                    fn.cancel();
                    fn.cancel();
                    fn.cancel();
                }).to.not.throw();
            });

            it('should be safe to call when no pending execution', () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50 });

                expect(() => fn.cancel()).to.not.throw();
            });

            it('should be safe to call after normal execution', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 10 });

                fn();
                await wait(15);
                calledExactly(mocked, 1, 'executed normally');

                expect(() => fn.cancel()).to.not.throw();
                calledExactly(mocked, 1, 'cancel after execution');
            });

            it('should reset state for future calls', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 20 });

                fn();
                fn.cancel();

                await wait(30);
                calledExactly(mocked, 0, 'cancelled');

                fn();
                await wait(30);
                calledExactly(mocked, 1, 'new call after cancel');
            });
        });

        describe('maxWait option', () => {

            it('should enforce maximum wait time', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 100, maxWait: 30 });

                fn();
                await wait(10);
                fn();
                await wait(10);
                fn();
                
                calledExactly(mocked, 0, 'before maxWait');

                await wait(15);

                calledExactly(mocked, 1, 'executed due to maxWait');
            });

            it('should use latest arguments when maxWait triggers', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 100, maxWait: 30 });

                fn('first');
                await wait(10);
                fn('second');
                await wait(10);
                fn('third');

                await wait(15);

                calledExactly(mocked, 1, 'maxWait execution');
                expect(mocked.mock.calls[0]!.arguments).to.deep.equal(['third']);
            });

            it('should reset after maxWait execution', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50, maxWait: 25 });

                fn();
                await wait(30);
                calledExactly(mocked, 1, 'maxWait triggered');

                fn();
                await wait(60);
                calledExactly(mocked, 2, 'normal delay after maxWait reset');
            });

            it('should work with very short maxWait values', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 100, maxWait: 5 });

                fn();
                await wait(10);

                calledExactly(mocked, 1, 'very short maxWait');
            });

            it('should work when maxWait is longer than delay', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 20, maxWait: 100 });

                fn();
                await wait(25);

                calledExactly(mocked, 1, 'normal delay before maxWait');
            });

            it('should handle continuous calls within maxWait window', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50, maxWait: 100 });

                fn();
                await wait(10);
                fn();
                await wait(10);
                fn();
                await wait(10);
                fn();
                await wait(10);
                fn();
                await wait(10);
                fn();

                calledExactly(mocked, 0, 'continuous calls before maxWait');

                await wait(50);

                calledExactly(mocked, 1, 'maxWait triggered');
            });

            it('should clear maxWait timer on normal execution', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 20, maxWait: 100 });

                fn();
                await wait(25);
                calledExactly(mocked, 1, 'normal execution');

                // Wait past original maxWait time to ensure it was cleared
                await wait(80);
                calledExactly(mocked, 1, 'maxWait timer was cleared');
            });
        });

        describe('flush() and cancel() interaction', () => {

            it('should allow cancel after flush', () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50 });

                fn();
                fn.flush();
                
                expect(() => fn.cancel()).to.not.throw();
                calledExactly(mocked, 1, 'cancel after flush');
            });

            it('should allow flush after cancel', () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50 });

                fn();
                fn.cancel();
                
                const result = fn.flush();
                expect(result).to.be.undefined;
                calledExactly(mocked, 0, 'flush after cancel');
            });

            it('should handle rapid flush and cancel calls', () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50 });

                fn();

                expect(() => {
                    fn.flush();
                    fn.cancel();
                    fn.flush();
                    fn.cancel();
                }).to.not.throw();

                calledExactly(mocked, 1, 'rapid flush/cancel calls');
            });
        });

        describe('memory and state management', () => {

            it('should properly clean up state after execution', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 10 });

                fn('test');
                await wait(15);

                // These should not affect anything since execution completed
                fn.cancel();
                const result = fn.flush();

                expect(result).to.be.undefined;
                calledExactly(mocked, 1, 'state cleaned up');
            });

            it('should properly clean up state after cancel', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50 });

                fn('test');
                fn.cancel();

                await wait(60);

                // Should allow new execution after cancel
                fn('new test');
                await wait(60);

                calledExactly(mocked, 1, 'new execution after cancel cleanup');
                expect(mocked.mock.calls[0]!.arguments).to.deep.equal(['new test']);
            });

            it('should properly clean up state after flush', async () => {

                const mocked = mock.fn();
                const fn = debounce(mocked, { delay: 50 });

                fn('test');
                fn.flush();

                await wait(60);

                // Should allow new execution after flush
                fn('new test');
                await wait(60);

                calledExactly(mocked, 2, 'new execution after flush cleanup');
                expect(mocked.mock.calls[1]!.arguments).to.deep.equal(['new test']);
            });
        });

        describe('edge cases and error handling', () => {

            it('should handle functions with no return value', () => {

                const mocked = mock.fn(() => {});
                const fn = debounce(mocked, { delay: 10 });

                fn();
                const result = fn.flush();

                expect(result).to.be.undefined;
                calledExactly(mocked, 1, 'no return value');
            });

            it('should handle functions that return null', () => {

                const mocked = mock.fn(() => null);
                const fn = debounce(mocked, { delay: 10 });

                fn();
                const result = fn.flush();

                expect(result).to.be.null;
                calledExactly(mocked, 1, 'null return value');
            });

            it('should handle functions that return false', () => {

                const mocked = mock.fn(() => false);
                const fn = debounce(mocked, { delay: 10 });

                fn();
                const result = fn.flush();

                expect(result).to.be.false;
                calledExactly(mocked, 1, 'false return value');
            });

            it('should handle async functions that resolve to undefined', async () => {

                const mocked = mock.fn(async () => {});
                const fn = debounce(mocked, { delay: 10 });

                fn();
                const result = await fn.flush();

                expect(result).to.be.undefined;
                calledExactly(mocked, 1, 'async undefined return');
            });

            it('should preserve function context when not bound', () => {

                class TestClass {
                    value = 42;
                    getValue() { return this.value; }
                }

                const instance = new TestClass();
                const fn = debounce(instance.getValue, { delay: 10 });

                fn(); // Call function to set up arguments
                
                // This should throw because `this` is not bound
                expect(() => fn.flush()).to.throw();
            });

            it('should work with bound functions', () => {

                class TestClass {
                    value = 42;
                    getValue() { return this.value; }
                }

                const instance = new TestClass();
                const fn = debounce(instance.getValue.bind(instance), { delay: 10 });

                fn();
                const result = fn.flush();

                expect(result).to.equal(42);
            });

            it('should handle complex return types', () => {

                const complexReturn = { data: [1, 2, 3], meta: { count: 3 } };
                const mocked = mock.fn(() => complexReturn);
                const fn = debounce(mocked, { delay: 10 });

                fn();
                const result = fn.flush();

                expect(result).to.deep.equal(complexReturn);
                expect(result).to.equal(complexReturn); // Same reference
                calledExactly(mocked, 1, 'complex return type');
            });
        });
    });
});