import {
    describe,
    it,
    expect
} from 'vitest';

import {
    wait,
    SingleFlight,
} from '../../../../packages/utils/src/index.ts';

import type {
    CacheAdapter,
    CacheItem,
} from '../../../../packages/utils/src/index.ts';

describe('@logosdx/utils - SingleFlight', () => {

    describe('cache primitives', () => {

        it('should return null for non-existent cache entry', async () => {

            const flight = new SingleFlight();
            const result = await flight.getCache('non-existent');

            expect(result).to.be.null;
        });

        it('should store and retrieve cache entry', async () => {

            const flight = new SingleFlight<string>();
            await flight.setCache('key1', 'value1');

            const result = await flight.getCache('key1');

            expect(result).to.not.be.null;
            expect(result!.value).to.equal('value1');
            expect(result!.isStale).to.be.false;
        });

        it('should mark entry as stale after staleIn threshold', async () => {

            const flight = new SingleFlight<string>({
                defaultTtl: 1000,
                defaultStaleIn: 50
            });

            await flight.setCache('key1', 'value1');

            // Initially fresh
            let result = await flight.getCache('key1');
            expect(result!.isStale).to.be.false;

            // Wait for stale threshold
            await wait(60);

            result = await flight.getCache('key1');
            expect(result).to.not.be.null;
            expect(result!.isStale).to.be.true;
            expect(result!.value).to.equal('value1');
        });

        it('should return null for expired cache entry', async () => {

            const flight = new SingleFlight<string>({
                defaultTtl: 50
            });

            await flight.setCache('key1', 'value1');

            // Initially exists
            let result = await flight.getCache('key1');
            expect(result).to.not.be.null;

            // Wait for TTL
            await wait(60);

            result = await flight.getCache('key1');
            expect(result).to.be.null;
        });

        it('should override default TTL with per-set TTL', async () => {

            const flight = new SingleFlight<string>({
                defaultTtl: 1000  // 1 second default
            });

            await flight.setCache('key1', 'value1', { ttl: 50 });

            // Wait beyond custom TTL but within default
            await wait(60);

            const result = await flight.getCache('key1');
            expect(result).to.be.null;
        });

        it('should override default staleIn with per-set staleIn', async () => {

            const flight = new SingleFlight<string>({
                defaultTtl: 1000,
                defaultStaleIn: 500  // 500ms default stale
            });

            await flight.setCache('key1', 'value1', { staleIn: 50 });

            // Wait beyond custom staleIn but within default
            await wait(60);

            const result = await flight.getCache('key1');
            expect(result).to.not.be.null;
            expect(result!.isStale).to.be.true;
        });

        it('should delete cache entry', async () => {

            const flight = new SingleFlight<string>();
            await flight.setCache('key1', 'value1');

            expect(await flight.hasCache('key1')).to.be.true;

            const deleted = await flight.deleteCache('key1');

            expect(deleted).to.be.true;
            expect(await flight.hasCache('key1')).to.be.false;
            expect(await flight.getCache('key1')).to.be.null;
        });

        it('should return false when deleting non-existent entry', async () => {

            const flight = new SingleFlight<string>();
            const deleted = await flight.deleteCache('non-existent');

            expect(deleted).to.be.false;
        });

        it('should check if cache entry exists with hasCache', async () => {

            const flight = new SingleFlight<string>();

            expect(await flight.hasCache('key1')).to.be.false;

            await flight.setCache('key1', 'value1');

            expect(await flight.hasCache('key1')).to.be.true;
        });

        it('should handle complex object values', async () => {

            const complexValue = {
                id: 42,
                nested: { data: [1, 2, 3] },
                date: new Date()
            };

            const flight = new SingleFlight<typeof complexValue>();
            await flight.setCache('complex', complexValue);

            const result = await flight.getCache('complex');

            expect(result).to.not.be.null;
            expect(result!.value).to.equal(complexValue);
            expect(result!.value.id).to.equal(42);
            expect(result!.value.nested.data).to.deep.equal([1, 2, 3]);
        });
    });

    describe('inflight primitives', () => {

        it('should return null for non-existent inflight entry', () => {

            const flight = new SingleFlight();
            const result = flight.getInflight('non-existent');

            expect(result).to.be.null;
        });

        it('should track inflight promise', async () => {

            const flight = new SingleFlight<string>();

            const promise = wait(100, 'resolved-value') as Promise<string>;
            const cleanup = flight.trackInflight('key1', promise);

            const entry = flight.getInflight('key1');

            expect(entry).to.not.be.null;
            expect(entry!.promise).to.equal(promise);
            expect(entry!.waitingCount).to.equal(1);

            cleanup();

            expect(flight.getInflight('key1')).to.be.null;
        });

        it('should increment waitingCount when joining inflight', async () => {

            const flight = new SingleFlight<string>();

            const promise = wait(100, 'resolved-value') as Promise<string>;
            flight.trackInflight('key1', promise);

            expect(flight.getInflight('key1')!.waitingCount).to.equal(1);

            const count1 = flight.joinInflight('key1');
            expect(count1).to.equal(2);
            expect(flight.getInflight('key1')!.waitingCount).to.equal(2);

            const count2 = flight.joinInflight('key1');
            expect(count2).to.equal(3);
            expect(flight.getInflight('key1')!.waitingCount).to.equal(3);
        });

        it('should return 0 when joining non-existent inflight', () => {

            const flight = new SingleFlight<string>();
            const count = flight.joinInflight('non-existent');

            expect(count).to.equal(0);
        });

        it('should check if key has inflight request with hasInflight', async () => {

            const flight = new SingleFlight<string>();

            expect(flight.hasInflight('key1')).to.be.false;

            const promise = wait(100, 'resolved-value') as Promise<string>;
            const cleanup = flight.trackInflight('key1', promise);

            expect(flight.hasInflight('key1')).to.be.true;

            cleanup();

            expect(flight.hasInflight('key1')).to.be.false;
        });

        it('should support multiple independent inflight requests', async () => {

            const flight = new SingleFlight<string>();

            const promise1 = wait(100, 'value1') as Promise<string>;
            const promise2 = wait(100, 'value2') as Promise<string>;

            const cleanup1 = flight.trackInflight('key1', promise1);
            const cleanup2 = flight.trackInflight('key2', promise2);

            expect(flight.hasInflight('key1')).to.be.true;
            expect(flight.hasInflight('key2')).to.be.true;

            cleanup1();

            expect(flight.hasInflight('key1')).to.be.false;
            expect(flight.hasInflight('key2')).to.be.true;

            cleanup2();

            expect(flight.hasInflight('key2')).to.be.false;
        });

        it('should track inflight request through promise resolution', async () => {

            const flight = new SingleFlight<string>();

            let resolvePromise!: (value: string) => void;
            const promise = new Promise<string>((resolve) => {

                resolvePromise = resolve;
            });

            const cleanup = flight.trackInflight('key1', promise);

            expect(flight.hasInflight('key1')).to.be.true;

            resolvePromise('resolved');
            await promise;

            // Still in-flight until cleanup is called
            expect(flight.hasInflight('key1')).to.be.true;

            cleanup();

            expect(flight.hasInflight('key1')).to.be.false;
        });
    });

    describe('lifecycle', () => {

        it('should clear all state with clear()', async () => {

            const flight = new SingleFlight<string>();

            await flight.setCache('cache1', 'value1');
            await flight.setCache('cache2', 'value2');

            const promise = wait(100, 'value') as Promise<string>;
            flight.trackInflight('inflight1', promise);

            const stats = flight.stats();
            expect(stats.cacheSize).to.equal(2);
            expect(stats.inflightCount).to.equal(1);

            await flight.clear();

            const newStats = flight.stats();
            expect(newStats.cacheSize).to.equal(0);
            expect(newStats.inflightCount).to.equal(0);
        });

        it('should clear only cache with clearCache()', async () => {

            const flight = new SingleFlight<string>();

            await flight.setCache('cache1', 'value1');
            await flight.setCache('cache2', 'value2');

            const promise = wait(100, 'value') as Promise<string>;
            flight.trackInflight('inflight1', promise);

            await flight.clearCache();

            const stats = flight.stats();
            expect(stats.cacheSize).to.equal(0);
            expect(stats.inflightCount).to.equal(1);
        });

        it('should return accurate stats', async () => {

            const flight = new SingleFlight<string>();

            let stats = flight.stats();
            expect(stats.cacheSize).to.equal(0);
            expect(stats.inflightCount).to.equal(0);

            await flight.setCache('key1', 'value1');
            await flight.setCache('key2', 'value2');
            await flight.setCache('key3', 'value3');

            stats = flight.stats();
            expect(stats.cacheSize).to.equal(3);

            const promise1 = wait(100, 'v') as Promise<string>;
            const promise2 = wait(100, 'v') as Promise<string>;
            flight.trackInflight('i1', promise1);
            flight.trackInflight('i2', promise2);

            stats = flight.stats();
            expect(stats.inflightCount).to.equal(2);
        });
    });

    describe('custom adapter support', () => {

        it('should work with custom async adapter', async () => {

            const store = new Map<string, CacheItem<string>>();

            const asyncAdapter: CacheAdapter<string> = {

                async get(key) {

                    await wait(10);
                    return store.get(key);
                },

                async set(key, item) {

                    await wait(10);
                    store.set(key, item);
                },

                async delete(key) {

                    await wait(10);
                    return store.delete(key);
                },

                async has(key) {

                    await wait(10);
                    return store.has(key);
                },

                async clear() {

                    await wait(10);
                    store.clear();
                },

                get size() {

                    return store.size;
                }
            };

            const flight = new SingleFlight<string>({
                adapter: asyncAdapter,
                defaultTtl: 60000
            });

            await flight.setCache('key1', 'value1');
            const result = await flight.getCache('key1');

            expect(result).to.not.be.null;
            expect(result!.value).to.equal('value1');
        });

        it('should work with deleteCache for custom adapters', async () => {

            const store = new Map<string, CacheItem<string>>();

            const asyncAdapter: CacheAdapter<string> = {

                async get(key) {

                    return store.get(key);
                },

                async set(key, item) {

                    store.set(key, item);
                },

                async delete(key) {

                    return store.delete(key);
                },

                async has(key) {

                    return store.has(key);
                },

                async clear() {

                    store.clear();
                },

                get size() {

                    return store.size;
                }
            };

            const flight = new SingleFlight<string>({
                adapter: asyncAdapter,
                defaultTtl: 60000
            });

            await flight.setCache('key1', 'value1');
            expect(store.has('key1')).to.be.true;

            const deleted = await flight.deleteCache('key1');

            expect(deleted).to.be.true;
            expect(store.has('key1')).to.be.false;
        });

        it('should work with hasCache for custom adapters', async () => {

            const store = new Map<string, CacheItem<string>>();

            const asyncAdapter: CacheAdapter<string> = {

                async get(key) {

                    return store.get(key);
                },

                async set(key, item) {

                    store.set(key, item);
                },

                async delete(key) {

                    return store.delete(key);
                },

                async has(key) {

                    return store.has(key);
                },

                async clear() {

                    store.clear();
                },

                get size() {

                    return store.size;
                }
            };

            const flight = new SingleFlight<string>({
                adapter: asyncAdapter,
                defaultTtl: 60000
            });

            expect(await flight.hasCache('key1')).to.be.false;

            await flight.setCache('key1', 'value1');

            expect(await flight.hasCache('key1')).to.be.true;
        });

        it('should work with clearCache for custom adapters', async () => {

            const store = new Map<string, CacheItem<string>>();

            const asyncAdapter: CacheAdapter<string> = {

                async get(key) {

                    return store.get(key);
                },

                async set(key, item) {

                    store.set(key, item);
                },

                async delete(key) {

                    return store.delete(key);
                },

                async has(key) {

                    return store.has(key);
                },

                async clear() {

                    store.clear();
                },

                get size() {

                    return store.size;
                }
            };

            const flight = new SingleFlight<string>({
                adapter: asyncAdapter,
                defaultTtl: 60000
            });

            await flight.setCache('key1', 'value1');
            await flight.setCache('key2', 'value2');

            expect(store.size).to.equal(2);

            await flight.clearCache();

            expect(store.size).to.equal(0);
        });
    });

    describe('integration: cache + inflight coordination', () => {

        it('should support typical cache-then-dedupe pattern', async () => {

            const flight = new SingleFlight<string>({
                defaultTtl: 1000
            });

            let fetchCount = 0;

            const fetchData = async (key: string): Promise<string> => {

                // 1. Check cache
                const cached = await flight.getCache(key);

                if (cached && !cached.isStale) {

                    return cached.value;
                }

                // 2. Check in-flight
                const inflight = flight.getInflight(key);

                if (inflight) {

                    flight.joinInflight(key);
                    return inflight.promise;
                }

                // 3. Start new request
                const promise = (async () => {

                    fetchCount++;
                    await wait(50);
                    return `data-${key}-${fetchCount}`;
                })();

                const cleanup = flight.trackInflight(key, promise);

                try {

                    const value = await promise;
                    await flight.setCache(key, value);
                    return value;
                }
                finally {

                    cleanup();
                }
            };

            // First call - fetches and caches
            const result1 = await fetchData('user:1');
            expect(result1).to.equal('data-user:1-1');
            expect(fetchCount).to.equal(1);

            // Second call - from cache
            const result2 = await fetchData('user:1');
            expect(result2).to.equal('data-user:1-1');
            expect(fetchCount).to.equal(1);  // Still 1

            // Concurrent calls for new key - deduped
            const [result3, result4, result5] = await Promise.all([
                fetchData('user:2'),
                fetchData('user:2'),
                fetchData('user:2')
            ]);

            expect(result3).to.equal('data-user:2-2');
            expect(result4).to.equal('data-user:2-2');
            expect(result5).to.equal('data-user:2-2');
            expect(fetchCount).to.equal(2);  // Only one more fetch
        });

        it('should support stale-while-revalidate pattern', async () => {

            const flight = new SingleFlight<string>({
                defaultTtl: 200,
                defaultStaleIn: 50
            });

            let fetchCount = 0;

            const fetchData = async (key: string): Promise<string> => {

                const cached = await flight.getCache(key);

                if (cached) {

                    if (cached.isStale) {

                        // Return stale immediately, revalidate in background
                        const inflight = flight.getInflight(key);

                        if (!inflight) {

                            const promise = (async () => {

                                fetchCount++;
                                await wait(100);
                                return `fresh-${key}-${fetchCount}`;
                            })();

                            const cleanup = flight.trackInflight(key, promise);
                            promise
                                .then(value => flight.setCache(key, value))
                                .finally(cleanup);
                        }

                        return cached.value;  // Return stale immediately
                    }

                    return cached.value;  // Fresh cache
                }

                // No cache - do fresh fetch
                fetchCount++;
                const value = `initial-${key}-${fetchCount}`;
                await flight.setCache(key, value);
                return value;
            };

            // Initial fetch
            const result1 = await fetchData('key1');
            expect(result1).to.equal('initial-key1-1');

            // Wait for stale but not expired
            await wait(60);

            // Stale hit - returns stale, triggers background refresh
            const result2 = await fetchData('key1');
            expect(result2).to.equal('initial-key1-1');  // Stale value
            expect(fetchCount).to.equal(2);  // Background fetch started

            // Wait for background fetch
            await wait(150);

            // Now should have fresh data
            const result3 = await fetchData('key1');
            expect(result3).to.equal('fresh-key1-2');
        });
    });

    describe('edge cases', () => {

        it('should handle undefined values in cache', async () => {

            const flight = new SingleFlight<undefined>();
            await flight.setCache('key1', undefined);

            const result = await flight.getCache('key1');

            expect(result).to.not.be.null;
            expect(result!.value).to.be.undefined;
        });

        it('should handle null values in cache', async () => {

            const flight = new SingleFlight<null>();
            await flight.setCache('key1', null);

            const result = await flight.getCache('key1');

            expect(result).to.not.be.null;
            expect(result!.value).to.be.null;
        });

        it('should handle empty string keys', async () => {

            const flight = new SingleFlight<string>();
            await flight.setCache('', 'empty-key-value');

            const result = await flight.getCache('');

            expect(result).to.not.be.null;
            expect(result!.value).to.equal('empty-key-value');
        });

        it('should handle special characters in keys', async () => {

            const flight = new SingleFlight<string>();
            const specialKey = 'key:with/special\ncharacters\t!@#$%^&*()';

            await flight.setCache(specialKey, 'special-value');

            const result = await flight.getCache(specialKey);

            expect(result).to.not.be.null;
            expect(result!.value).to.equal('special-value');
        });

        it('should overwrite existing cache entry with same key', async () => {

            const flight = new SingleFlight<string>();

            await flight.setCache('key1', 'value1');
            expect((await flight.getCache('key1'))!.value).to.equal('value1');

            await flight.setCache('key1', 'value2');
            expect((await flight.getCache('key1'))!.value).to.equal('value2');

            expect(flight.stats().cacheSize).to.equal(1);
        });

        it('should handle rapid set/get cycles', async () => {

            const flight = new SingleFlight<number>();

            for (let i = 0; i < 100; i++) {

                await flight.setCache(`key${i}`, i);
            }

            for (let i = 0; i < 100; i++) {

                const result = await flight.getCache(`key${i}`);
                expect(result!.value).to.equal(i);
            }

            expect(flight.stats().cacheSize).to.equal(100);
        });

        it('should handle cleanup being called multiple times', async () => {

            const flight = new SingleFlight<string>();

            const promise = wait(50, 'value') as Promise<string>;
            const cleanup = flight.trackInflight('key1', promise);

            cleanup();
            cleanup();
            cleanup();

            expect(flight.hasInflight('key1')).to.be.false;
        });

        it('should handle concurrent track/clear operations', async () => {

            const flight = new SingleFlight<string>();

            const promise = wait(100, 'value') as Promise<string>;
            flight.trackInflight('key1', promise);
            await flight.setCache('cached', 'value');

            // Clear while inflight exists
            await flight.clear();

            expect(flight.stats().cacheSize).to.equal(0);
            expect(flight.stats().inflightCount).to.equal(0);
        });
    });

    describe('type safety', () => {

        it('should maintain type safety for cached values', async () => {

            interface User {
                id: number;
                name: string;
            }

            const flight = new SingleFlight<User>();

            await flight.setCache('user1', { id: 1, name: 'Alice' });

            const result = await flight.getCache('user1');

            if (result) {

                // TypeScript should know these properties exist
                expect(result.value.id).to.equal(1);
                expect(result.value.name).to.equal('Alice');
            }
        });

        it('should allow any type when using default generic', async () => {

            const flight = new SingleFlight();

            await flight.setCache('string', 'hello');
            await flight.setCache('number', 42);
            await flight.setCache('object', { foo: 'bar' });
            await flight.setCache('array', [1, 2, 3]);

            expect((await flight.getCache('string'))!.value).to.equal('hello');
            expect((await flight.getCache('number'))!.value).to.equal(42);
            expect((await flight.getCache('object'))!.value).to.deep.equal({ foo: 'bar' });
            expect((await flight.getCache('array'))!.value).to.deep.equal([1, 2, 3]);
        });
    });
});
