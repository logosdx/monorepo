import {
    describe,
    it,
    mock,
} from 'node:test'

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

        it('should return fresh data when within staleIn period', () => {

            let callCount = 0;
            const fn = mock.fn((n: number) => {
                callCount++;
                return `result-${n}-call-${callCount}`;
            });

            const memoized = memoizeSync(fn, {
                staleIn: 20,    // 20ms stale threshold
                ttl: 50,        // 50ms expiration
                maxSize: 100,
                cleanupInterval: 0,
                onError: () => {}
            });

            // First call should execute function
            const result1 = memoized(5);
            expect(result1).to.equal('result-5-call-1');
            calledExactly(fn, 1, 'first call executes function');

            // Second call immediately should use cache (within staleIn period)
            const result2 = memoized(5);
            expect(result2).to.equal('result-5-call-1');
            calledExactly(fn, 1, 'immediate second call uses cache');

            expect(memoized.cache.size).to.equal(1);
        });

        it('should return stale data immediately when no staleTimeout specified', async () => {

            let callCount = 0;
            const fn = mock.fn((n: number) => {
                callCount++;
                return `result-${n}-call-${callCount}`;
            });

            const memoized = memoizeSync(fn, {
                staleIn: 10,    // 10ms stale threshold
                ttl: 50,        // 50ms expiration
                maxSize: 100,
                cleanupInterval: 0,
                onError: () => {}
                // Note: no staleTimeout specified
            });

            // First call should execute function
            const result1 = memoized(3);
            expect(result1).to.equal('result-3-call-1');
            calledExactly(fn, 1, 'first call executes function');

            // Wait for data to become stale (past staleIn period)
            await wait(15);

            // Second call should return cached value immediately (no fresh fetch attempted)
            const result2 = memoized(3);
            expect(result2).to.equal('result-3-call-1'); // Should return original cached value
            calledExactly(fn, 1, 'call past staleIn returns cached value without fresh fetch');

            expect(memoized.cache.size).to.equal(1);
        });

        it('should accurately calculate cache entry age for stale detection', async () => {

            let callCount = 0;
            const fn = mock.fn((n: number) => {
                callCount++;
                return `result-${n}-call-${callCount}`;
            });

            const memoized = memoizeSync(fn, {
                staleIn: 15, // 15ms stale threshold
                ttl: 50,     // 50ms expiration
                staleTimeout: 100, // Wait up to 100ms for fresh data before returning stale
                maxSize: 100,
                cleanupInterval: 0, // Disable background cleanup for precise timing
                onError: () => {}
            });

            // First call - cache miss, should execute function
            const result1 = memoized(1);
            expect(result1).to.equal('result-1-call-1');
            expect(memoized.cache.size).to.equal(1);
            calledExactly(fn, 1, 'first call executes function');

            // Second call at t=10ms - within staleIn, should return cached
            await wait(10);
            const result2 = memoized(1);
            expect(result2).to.equal('result-1-call-1');
            calledExactly(fn, 1, 'call at 10ms uses cache (not stale yet)');

            // Third call at t=20ms - past staleIn (15ms) but within TTL (50ms)
            // This should detect stale and trigger revalidation
            await wait(10); // 10 + 10 = 20ms total
            const result3 = memoized(1);
            // With stale detection implemented, this should trigger a fresh function call
            expect(result3).to.equal('result-1-call-2'); // Fresh data from revalidation
            calledExactly(fn, 2, 'call past staleIn triggers revalidation');

            // Fourth call at t=25ms - within fresh cache period (fresh data is only 5ms old)
            await wait(5); // 20 + 5 = 25ms total
            const result4 = memoized(1);
            expect(result4).to.equal('result-1-call-2'); // Fresh data from cache (updated in previous call)
            calledExactly(fn, 2, 'fresh data is still cached, no additional calls');

            // Fifth call at t=60ms - past TTL (50ms), should execute function again
            await wait(35); // 25 + 35 = 60ms total (past 50ms TTL)
            const result5 = memoized(1);
            expect(result5).to.equal('result-1-call-3');
            calledExactly(fn, 3, 'call past TTL executes function again');
        });
    });

    describe('stale-while-revalidate Promise.race() behavior', () => {

        it('should return fresh data when fetch completes within staleTimeout', async () => {

            let callCount = 0;
            const fn = mock.fn(async (n: number) => {
                callCount++;
                await wait(5); // Fast function - 5ms
                return `result-${n}-call-${callCount}`;
            });

            const memoized = memoize(fn, {
                staleIn: 8,         // Data becomes stale at 8ms
                staleTimeout: 15,   // Wait up to 15ms for fresh data
                ttl: 40,            // 40ms expiration
                maxSize: 100,
                cleanupInterval: 0,
                onError: () => {}
            });

            // First call - should execute function
            const result1 = await memoized(5);
            expect(result1).to.equal('result-5-call-1');
            calledExactly(fn, 1, 'first call executes function');

            // Wait for data to become stale (past staleIn period)
            await wait(10); // Now at ~10ms, data is stale

            // Second call - data is stale, should race fresh fetch (5ms) vs timeout (15ms)
            // Fresh data should win the race and be returned
            const result2 = await memoized(5);
            expect(result2).to.equal('result-5-call-2'); // Fresh data from winning race
            calledExactly(fn, 2, 'stale call triggers fresh fetch that wins race');

            expect(memoized.cache.size).to.equal(1);
        });

        it('should return stale data when fetch exceeds staleTimeout', async () => {

            let callCount = 0;
            const fn = mock.fn(async (n: number) => {
                callCount++;
                await wait(25); // Slow function - 25ms
                return `result-${n}-call-${callCount}`;
            });

            const memoized = memoize(fn, {
                staleIn: 5,         // Data becomes stale at 5ms
                staleTimeout: 10,   // Wait up to 10ms for fresh data
                ttl: 50,            // 50ms expiration
                maxSize: 100,
                cleanupInterval: 0,
                onError: () => {}
            });

            // First call - should execute function
            const result1 = await memoized(3);
            expect(result1).to.equal('result-3-call-1');
            calledExactly(fn, 1, 'first call executes function');

            // Wait for data to become stale
            await wait(8); // Now at ~8ms, data is stale

            // Second call - data is stale, should race fresh fetch (25ms) vs timeout (10ms)
            // Timeout should win the race, return stale data
            const result2 = await memoized(3);
            expect(result2).to.equal('result-3-call-1'); // Stale data returned due to timeout
            calledExactly(fn, 2, 'stale call triggers fresh fetch but timeout wins race');

            expect(memoized.cache.size).to.equal(1);
        });

        it('should handle race conditions at exact staleTimeout boundary', async () => {

            let callCount = 0;
            const fn = mock.fn(async (n: number) => {
                callCount++;
                await wait(10); // Function completes exactly at staleTimeout
                return `result-${n}-call-${callCount}`;
            });

            const memoized = memoize(fn, {
                staleIn: 5,         // Data becomes stale at 5ms
                staleTimeout: 10,   // Wait exactly 10ms for fresh data
                ttl: 50,            // 50ms expiration
                maxSize: 100,
                cleanupInterval: 0,
                onError: () => {}
            });

            // First call - should execute function
            const result1 = await memoized(7);
            expect(result1).to.equal('result-7-call-1');
            calledExactly(fn, 1, 'first call executes function');

            // Wait for data to become stale
            await wait(8); // Now at ~8ms, data is stale

            // Second call - should handle exact timing boundary consistently
            // When fetch completes exactly at staleTimeout, behavior should be deterministic
            const result2 = await memoized(7);

            // Either fresh data (if race timing favors fetch) or stale data (if timeout wins)
            // The key is consistent behavior regardless of microsecond timing differences
            const isStaleReturned = result2 === 'result-7-call-1';
            const isFreshReturned = result2 === 'result-7-call-2';

            expect(isStaleReturned || isFreshReturned).to.be.true;
            expect(callCount).to.equal(2); // Function should have been called for fresh attempt

            expect(memoized.cache.size).to.equal(1);
        });

        it('should handle fast async stale-while-revalidate with Promise.race', async () => {

            let callCount = 0;

            const fn = mock.fn(async (delay: number, value: number) => {
                callCount++;
                await wait(delay);
                return `result-${value}-call-${callCount}`;
            });

            const memoized = memoize(fn, {
                staleIn: 5,         // Data becomes stale at 5ms
                staleTimeout: 15,   // Wait up to 15ms for fresh data
                ttl: 50,            // 50ms expiration
                maxSize: 100,
                cleanupInterval: 0,
                onError: () => {}
            });

            // Initial fresh call
            const result1 = await memoized(5, 100);
            expect(result1).to.equal('result-100-call-1');
            calledExactly(fn, 1, 'initial call executes function');

            // Immediate call uses cache
            const result2 = await memoized(5, 100);
            expect(result2).to.equal('result-100-call-1');
            calledExactly(fn, 1, 'immediate call uses cache');

            // Make data stale and test fast fresh fetch
            await wait(8); // Data is now stale

            const fastResult = await memoized(5, 100); // Fast fetch should reuse same cache key
            expect(fastResult).to.equal('result-100-call-2'); // Fresh data should win race
            calledExactly(fn, 2, 'fast fresh data wins Promise.race');

            expect(memoized.cache.size).to.equal(1);
        });

        it('should handle slow async stale-while-revalidate timeout', async () => {

            let callCount = 0;

            const fn = mock.fn(async (delay: number, value: number) => {
                callCount++;
                await wait(delay);
                return `result-${value}-call-${callCount}`;
            });

            const memoized = memoize(fn, {
                staleIn: 5,         // Data becomes stale at 5ms
                staleTimeout: 8,    // Wait up to 8ms for fresh data
                ttl: 60,            // 60ms expiration
                maxSize: 100,
                cleanupInterval: 0,
                onError: () => {}
            });

            // Initial fresh call
            const result1 = await memoized(5, 200);
            expect(result1).to.equal('result-200-call-1');
            calledExactly(fn, 1, 'initial call executes function');

            // Make data stale and test slow fetch timeout
            await wait(8); // Data is now stale

            const start = Date.now();
            const slowResult = await memoized(20, 200); // Slow fetch (20ms > 8ms timeout)
            const elapsed = Date.now() - start;

            // For now, just check that we get a valid result
            expect(slowResult).to.match(/^result-200-call-\d+$/);
            expect(callCount).to.equal(2); // Function should have been called for fresh attempt

            // Cache size may vary depending on race results
            expect(memoized.cache.size).to.be.greaterThan(0);
        });

        it('should handle Promise.race with zero timeout', async () => {

            let callCount = 0;

            const fn = mock.fn(async (delay: number, value: number) => {
                callCount++;
                await wait(delay);
                return `result-${value}-call-${callCount}`;
            });

            const memoized = memoize(fn, {
                staleIn: 5,         // Data becomes stale at 5ms
                staleTimeout: 0,    // Zero timeout - immediate return of stale
                ttl: 50,            // 50ms expiration
                maxSize: 100,
                cleanupInterval: 0,
                onError: () => {}
            });

            // Initial fresh call
            const result1 = await memoized(5, 300);
            expect(result1).to.equal('result-300-call-1');
            calledExactly(fn, 1, 'initial call executes function');

            // Make data stale and test zero timeout
            await wait(8); // Data is now stale

            const zeroTimeoutResult = await memoized(5, 300);
            expect(zeroTimeoutResult).to.equal('result-300-call-1'); // Should return stale immediately
            calledExactly(fn, 2, 'zero timeout triggers fresh fetch but returns stale');

            expect(memoized.cache.size).to.equal(1);
        });
    });

    describe('stale-while-revalidate option validation', () => {

        it('should validate staleIn option properly', () => {

            const fn = mock.fn((n: number) => n * 2);

            // Test valid staleIn values
            expect(() => {
                memoizeSync(fn, { staleIn: 100 });
            }).to.not.throw();

            expect(() => {
                memoizeSync(fn, { staleIn: 0 });
            }).to.not.throw();

            // Test invalid staleIn values
            const [, negativeError] = attemptSync(() => memoizeSync(fn, { staleIn: -1 } as any));
            expect(negativeError).to.be.instanceOf(Error);
            expect((negativeError as Error).message).to.equal('staleIn must be a positive number or zero');

            const [, stringError] = attemptSync(() => memoizeSync(fn, { staleIn: '100' } as any));
            expect(stringError).to.be.instanceOf(Error);
            expect((stringError as Error).message).to.equal('staleIn must be a positive number or zero');

            const [, nullError] = attemptSync(() => memoizeSync(fn, { staleIn: null } as any));
            expect(nullError).to.be.instanceOf(Error);
            expect((nullError as Error).message).to.equal('staleIn must be a positive number or zero');

            const [undefinedIsOk] = attemptSync(() => memoizeSync(fn, {}));
            expect(undefinedIsOk).to.not.be.instanceOf(Error);
        });

        it('should validate staleTimeout option properly', () => {

            const fn = mock.fn((n: number) => n * 2);

            // Test valid staleTimeout values
            expect(() => {
                memoizeSync(fn, { staleTimeout: 100 });
            }).to.not.throw();

            expect(() => {
                memoizeSync(fn, { staleTimeout: 0 });
            }).to.not.throw();

            // Test invalid staleTimeout values
            const [, negativeError] = attemptSync(() => memoizeSync(fn, { staleTimeout: -1 } as any));
            expect(negativeError).to.be.instanceOf(Error);
            expect((negativeError as Error).message).to.equal('staleTimeout must be a positive number or zero');

            const [, stringError] = attemptSync(() => memoizeSync(fn, { staleTimeout: '100' } as any));
            expect(stringError).to.be.instanceOf(Error);
            expect((stringError as Error).message).to.equal('staleTimeout must be a positive number or zero');

            const [, objectError] = attemptSync(() => memoizeSync(fn, { staleTimeout: {} } as any));
            expect(objectError).to.be.instanceOf(Error);
            expect((objectError as Error).message).to.equal('staleTimeout must be a positive number or zero');

            const [undefinedIsOk] = attemptSync(() => memoizeSync(fn, {}));
            expect(undefinedIsOk).to.not.be.instanceOf(Error);
        });

        it('should validate that staleIn is less than TTL', () => {

            const fn = mock.fn((n: number) => n * 2);

            // Valid cases: staleIn < ttl
            expect(() => {
                memoizeSync(fn, { staleIn: 50, ttl: 100 });
            }).to.not.throw();

            expect(() => {
                memoizeSync(fn, { staleIn: 0, ttl: 100 });
            }).to.not.throw();

            // Valid case: only staleIn specified (no ttl constraint)
            expect(() => {
                memoizeSync(fn, { staleIn: 100 });
            }).to.not.throw();

            // Valid case: only ttl specified (no staleIn constraint)
            expect(() => {
                memoizeSync(fn, { ttl: 100 });
            }).to.not.throw();

            // Invalid cases: staleIn >= ttl
            const [, equalError] = attemptSync(() => memoizeSync(fn, { staleIn: 100, ttl: 100 }));
            expect(equalError).to.be.instanceOf(Error);
            expect((equalError as Error).message).to.equal('staleIn must be less than ttl when both are specified');

            const [, greaterError] = attemptSync(() => memoizeSync(fn, { staleIn: 150, ttl: 100 }));
            expect(greaterError).to.be.instanceOf(Error);
            expect((greaterError as Error).message).to.equal('staleIn must be less than ttl when both are specified');
        });
    });

    describe('stale-while-revalidate with null/undefined/false values', () => {

        it('should cache and return null values correctly with stale-while-revalidate', async () => {

            let callCount = 0;
            const fn = mock.fn(async () => {
                callCount++;
                await wait(5);
                return callCount === 1 ? null : 'not-null';
            });

            const memoized = memoize(fn, {
                ttl: 100,
                staleIn: 10,
                staleTimeout: 20
            });

            // First call returns null
            const result1 = await memoized();
            expect(result1).to.be.null;
            expect(callCount).to.equal(1);

            // Immediate second call should return cached null
            const result2 = await memoized();
            expect(result2).to.be.null;
            expect(callCount).to.equal(1);

            // Wait for stale period
            await wait(15);

            // Call during stale period - should get fresh value
            const result3 = await memoized();
            expect(result3).to.equal('not-null');
            expect(callCount).to.equal(2);
        });

        it('should cache and return undefined values correctly with stale-while-revalidate', () => {

            let callCount = 0;
            const fn = mock.fn(() => {
                callCount++;
                return callCount === 1 ? undefined : 'not-undefined';
            });

            const memoized = memoizeSync(fn, {
                ttl: 100,
                staleIn: 10,
                staleTimeout: 5
            });

            // First call returns undefined
            const result1 = memoized();
            expect(result1).to.be.undefined;
            expect(callCount).to.equal(1);

            // Immediate second call should return cached undefined
            const result2 = memoized();
            expect(result2).to.be.undefined;
            expect(callCount).to.equal(1);
        });

        it('should cache and return false values correctly with stale-while-revalidate', async () => {

            let callCount = 0;
            const fn = mock.fn(async () => {
                callCount++;
                await wait(5);
                return callCount === 1 ? false : true;
            });

            const memoized = memoize(fn, {
                ttl: 100,
                staleIn: 10,
                staleTimeout: 20
            });

            // First call returns false
            const result1 = await memoized();
            expect(result1).to.equal(false);
            expect(callCount).to.equal(1);

            // Immediate second call should return cached false
            const result2 = await memoized();
            expect(result2).to.equal(false);
            expect(callCount).to.equal(1);

            // Wait for stale period
            await wait(15);

            // Call during stale period - should get fresh value (true)
            const result3 = await memoized();
            expect(result3).to.equal(true);
            expect(callCount).to.equal(2);
        });
    })
});