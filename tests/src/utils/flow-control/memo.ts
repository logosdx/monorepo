import {
    describe,
    it,
    mock,
} from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import { mockHelpers } from '../../_helpers';

import {
    wait,
    memoizeSync,
    memoize,
    attempt,
} from '../../../../packages/utils/src/index.ts';
import { attemptSync } from '../../../../packages/kit/src/index.ts';

describe('@logosdx/utils', () => {

    const { calledExactly } = mockHelpers(expect);

    describe('flow-control: memo', () => {

        it('should memoize sync functions', () => {
            const fn = mock.fn((n: number) => n * 2);
            const onError = mock.fn();

            const memoized = memoizeSync(fn, {
                ttl: 1000,
                maxSize: 100,
                onError
            });

            // First call should execute function
            const result1 = memoized(5);
            expect(result1).to.equal(10);
            calledExactly(fn, 1, 'memoizeSync first call');

            // Second call with same args should use cache
            const result2 = memoized(5);
            expect(result2).to.equal(10);
            calledExactly(fn, 1, 'memoizeSync cached call');

            // Different args should execute function again
            const result3 = memoized(10);
            expect(result3).to.equal(20);
            calledExactly(fn, 2, 'memoizeSync different args');

            calledExactly(onError, 0, 'memoizeSync no errors');
        });

        it('should memoize async functions', async () => {
            const fn = mock.fn(async (n: number) => {
                await wait(10);
                return n * 2;
            });
            const onError = mock.fn();

            const memoized = memoize(fn, {
                ttl: 1000,
                maxSize: 100,
                onError
            });

            // First call should execute function
            const result1 = await memoized(5);
            expect(result1).to.equal(10);
            calledExactly(fn, 1, 'memoize first call');

            // Second call with same args should use cache
            const result2 = await memoized(5);
            expect(result2).to.equal(10);
            calledExactly(fn, 1, 'memoize cached call');

            // Different args should execute function again
            const result3 = await memoized(10);
            expect(result3).to.equal(20);
            calledExactly(fn, 2, 'memoize different args');

            calledExactly(onError, 0, 'memoize no errors');
        });

        it('should respect TTL expiration', async () => {
            const fn = mock.fn((n: number) => n * 2);

            const memoized = memoizeSync(fn, {
                ttl: 50, // 50ms TTL
                maxSize: 100,
                onError: () => {}
            });

            // First call
            const result1 = memoized(5);
            expect(result1).to.equal(10);
            calledExactly(fn, 1, 'TTL first call');

            // Immediate second call should use cache
            const result2 = memoized(5);
            expect(result2).to.equal(10);
            calledExactly(fn, 1, 'TTL cached call');

            // Wait for TTL to expire
            await wait(60);

            // Call after TTL should execute function again
            const result3 = memoized(5);
            expect(result3).to.equal(10);
            calledExactly(fn, 2, 'TTL expired call');
        });

        it('should implement LRU eviction', () => {
            const fn = mock.fn((n: number) => n * 2);

            const memoized = memoizeSync(fn, {
                ttl: 10000,
                maxSize: 2, // Small cache size to test eviction
                onError: () => {}
            });

            // Fill cache to capacity
            memoized(1); // oldest
            memoized(2);
            expect(memoized.cache.size).to.equal(2);

            // Access first item to make it recently used
            memoized(1);

            // Add third item, should evict least recently used (2)
            memoized(3);

            expect(memoized.cache.size).to.equal(2);
            expect(memoized.cache.has('1')).to.be.true; // 1 should still be cached
            expect(memoized.cache.has('2')).to.be.false; // 2 should be evicted

            calledExactly(fn, 3, 'LRU eviction calls'); // 1, 2, 3 (1 is cached on second access)
        });

        it('should handle object property ordering in keys', () => {
            const fn = mock.fn((obj: { a: number; b: string }) => obj.a + obj.b.length);

            const memoized = memoizeSync(fn, {
                ttl: 1000,
                maxSize: 100,
                onError: () => {}
            });

            // These should produce the same cache key despite different property order
            const result1 = memoized({ a: 1, b: "test" });
            const result2 = memoized({ b: "test", a: 1 });

            expect(result1).to.equal(5);
            expect(result2).to.equal(5);
            calledExactly(fn, 1, 'object property ordering - should cache');
        });

        it('should handle circular references in key generation', () => {
            const fn = mock.fn((obj: any) => obj.value || 42);
            const onError = mock.fn();

            const memoized = memoizeSync(fn, {
                ttl: 1000,
                maxSize: 100,
                onError
            });

            // Create circular reference
            const circularObj: any = { value: 10 };
            circularObj.self = circularObj;

            const result = memoized(circularObj);
            expect(result).to.equal(10);
            calledExactly(fn, 1, 'circular reference handling');
            calledExactly(onError, 0, 'no errors with circular refs');
        });

        it('should provide cache statistics', () => {
            const fn = mock.fn((n: number) => n * 2);

            const memoized = memoizeSync(fn, {
                ttl: 1000,
                maxSize: 100,
                onError: () => {}
            });

            // Initial stats
            let stats = memoized.cache.stats();
            expect(stats.hits).to.equal(0);
            expect(stats.misses).to.equal(0);
            expect(stats.hitRate).to.equal(0);
            expect(stats.size).to.equal(0);

            // First call - miss
            memoized(5);
            stats = memoized.cache.stats();
            expect(stats.hits).to.equal(0);
            expect(stats.misses).to.equal(1);
            expect(stats.hitRate).to.equal(0);
            expect(stats.size).to.equal(1);

            // Second call - hit
            memoized(5);
            stats = memoized.cache.stats();
            expect(stats.hits).to.equal(1);
            expect(stats.misses).to.equal(1);
            expect(stats.hitRate).to.equal(0.5);
            expect(stats.size).to.equal(1);
        });

        it('should provide cache introspection methods', () => {
            const fn = mock.fn((n: number) => n * 2);

            const memoized = memoizeSync(fn, {
                ttl: 1000,
                maxSize: 100,
                onError: () => {}
            });

            // Add some entries
            memoized(1);
            memoized(2);
            memoized(3);

            expect(memoized.cache.size).to.equal(3);
            expect(memoized.cache.has('1')).to.be.true;
            expect(memoized.cache.has('4')).to.be.false;

            const keys = Array.from(memoized.cache.keys());
            expect(keys).to.include('1');
            expect(keys).to.include('2');
            expect(keys).to.include('3');

            const entries = memoized.cache.entries();
            expect(entries.length).to.equal(3);
            expect(entries.map(([, value]) => value)).to.deep.equal([2, 4, 6]);

            // Test delete
            const deleted = memoized.cache.delete('1');
            expect(deleted).to.be.true;
            expect(memoized.cache.size).to.equal(2);

            // Test clear
            memoized.cache.clear();
            expect(memoized.cache.size).to.equal(0);
        });

        it('should handle function execution errors', () => {
            const fn = mock.fn((shouldFail: boolean) => {
                if (shouldFail) {
                    throw new Error('function error');
                }
                return 'success';
            });

            const onError = mock.fn();

            const memoized = memoizeSync(fn, {
                ttl: 1000,
                maxSize: 100,
                onError
            });

            // Successful call
            const result1 = memoized(false);
            expect(result1).to.equal('success');
            calledExactly(onError, 0, 'no errors on success');

            // Failed call
            const result2 = memoized(true);
            expect(result2).to.be.null; // Error handling returns null from processMemo
            calledExactly(onError, 1, 'error reported on failure');

            // Verify error was passed correctly
            const errorCall = onError.mock.calls[0];
            expect(errorCall).to.not.be.undefined;
            expect(errorCall!.arguments[0]).to.be.instanceOf(Error);
            expect(errorCall!.arguments[0].message).to.equal('function error');
            expect(errorCall!.arguments[1]).to.deep.equal([true]);
        });

        it('should handle key generation errors', () => {
            const fn = mock.fn((n: number) => n * 2);
            const onError = mock.fn();

            const memoized = memoizeSync(fn, {
                ttl: 1000,
                maxSize: 100,
                onError,
                generateKey: () => {
                    throw new Error('key generation error');
                }
            });

            const result = memoized(5);
            expect(result).to.be.undefined; // Key error prevents caching/execution
            calledExactly(onError, 1, 'key generation error reported');
            calledExactly(fn, 0, 'function not called on key error');

            const errorCall = onError.mock.calls[0];
            expect(errorCall).to.not.be.undefined;
            expect(errorCall!.arguments[0].message).to.equal('key generation error');
        });

        it('should test WeakRef functionality', () => {
            let obj = { data: 'large object' };
            const fn = mock.fn((input: any) => input);

            const memoized = memoizeSync(fn, {
                ttl: 10000,
                maxSize: 100,
                useWeakRef: true,
                onError: () => {}
            });

            // Call with object
            const result1 = memoized(obj);
            expect(result1).to.deep.equal(obj);
            expect(memoized.cache.size).to.equal(1);

            // Cache should still work
            const result2 = memoized(obj);
            expect(result2).to.deep.equal(obj);
            calledExactly(fn, 1, 'WeakRef cached call');

            // Clear reference and force garbage collection
            // Note: We can't actually force GC in tests, but we can verify the structure
            const entries = memoized.cache.entries();
            expect(entries.length).to.equal(1);
        });

        it('should support background cleanup', async () => {
            const fn = mock.fn((n: number) => n * 2);

            const memoized = memoizeSync(fn, {
                ttl: 30, // Very short TTL
                maxSize: 100,
                cleanupInterval: 50, // Cleanup every 50ms
                onError: () => {}
            });

            // Add entries
            memoized(1);
            memoized(2);
            expect(memoized.cache.size).to.equal(2);

            // Wait for entries to expire and cleanup to run
            await wait(100);

            // Entries should be cleaned up
            expect(memoized.cache.size).to.equal(0);
        });

        it('should handle custom key generators', () => {
            const fn = mock.fn((a: number, b: string) => a + b.length);

            const customKeyGen = mock.fn((args: [number, string]) => {
                return `custom:${args[0]}:${args[1]}`;
            });

            const memoized = memoizeSync(fn, {
                ttl: 1000,
                maxSize: 100,
                onError: () => {},
                generateKey: customKeyGen
            });

            memoized(5, "test");
            memoized(5, "test"); // Should use cache

            calledExactly(fn, 1, 'custom key generator - cached');
            calledExactly(customKeyGen, 2, 'custom key generator called');

            const keys = Array.from(memoized.cache.keys());
            expect(keys[0]).to.equal('custom:5:test');
        });

        it('should handle different data types in key generation', () => {
            const fn = mock.fn((value: any) => String(value));

            const memoized = memoizeSync(fn, {
                ttl: 1000,
                maxSize: 100,
                onError: () => {}
            });

            // Test various data types
            memoized(null);
            memoized(undefined);
            memoized(42);
            memoized("string");
            memoized(true);
            memoized(new Date(2023, 0, 1));
            memoized(/regex/g);
            memoized([1, 2, 3]);
            memoized({ key: "value" });
            memoized(() => "function");

            expect(memoized.cache.size).to.equal(10);
            calledExactly(fn, 10, 'different data types');

            // Same values should use cache
            memoized(null);
            memoized(42);
            memoized("string");

            calledExactly(fn, 10, 'data types cached correctly');
        });

        it('should not double wrap the function', async () => {

            const fn = mock.fn(() => 'ok');

            const wrappedFnSync = memoizeSync(fn);
            const wrappedFnAsync = memoize(fn as any);

            const [, error1] = attemptSync(() => memoizeSync(wrappedFnSync));
            const [, error2] = await attempt(() => memoize(wrappedFnAsync));

            expect(error1).to.be.an.instanceof(Error);
            expect((error1 as Error).message).to.equal('Function is already wrapped by memoize');
            expect(error2).to.be.an.instanceof(Error);
            expect((error2 as Error).message).to.equal('Function is already wrapped by memoize');
        });
    })
});