/**
 * @vitest-environment node
 *
 * Tests for custom cache adapter using file system storage.
 */
import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach
} from 'vitest'

import * as fs from 'node:fs';
import * as path from 'node:path';

import { FetchEngine } from '../../../packages/fetch/src/index.ts';

import {
    CacheAdapter,
    CacheItem
} from '../../../packages/utils/src/index.ts';

import { makeTestStubs } from './_helpers.ts';

describe('@logosdx/fetch: file system cache adapter', async () => {

    const { testUrl } = await makeTestStubs(4126);
    const TMP_DIR = path.join(process.cwd(), 'tmp', 'cache-adapter-test');

    /**
     * File system cache adapter that writes to tmp directory.
     * Each cache entry is stored as a JSON file.
     */
    class FileSystemCacheAdapter<T> implements CacheAdapter<T> {

        #dir: string;

        constructor(dir: string) {

            this.#dir = dir;
            fs.mkdirSync(dir, { recursive: true });
        }

        #keyToPath(key: string): string {

            // Encode key to be file-system safe
            const encoded = Buffer.from(key).toString('base64url');
            return path.join(this.#dir, `${encoded}.json`);
        }

        get size(): number {

            try {

                const files = fs.readdirSync(this.#dir);
                return files.filter(f => f.endsWith('.json')).length;
            }
            catch {

                return 0;
            }
        }

        async get(key: string): Promise<CacheItem<T> | null> {

            const filepath = this.#keyToPath(key);

            try {

                const data = fs.readFileSync(filepath, 'utf-8');
                return JSON.parse(data) as CacheItem<T>;
            }
            catch {

                return null;
            }
        }

        async set(key: string, item: CacheItem<T>): Promise<void> {

            const filepath = this.#keyToPath(key);
            fs.writeFileSync(filepath, JSON.stringify(item), 'utf-8');
        }

        async delete(key: string): Promise<boolean> {

            const filepath = this.#keyToPath(key);

            try {

                fs.unlinkSync(filepath);
                return true;
            }
            catch {

                return false;
            }
        }

        async has(key: string): Promise<boolean> {

            const filepath = this.#keyToPath(key);
            return fs.existsSync(filepath);
        }

        async clear(): Promise<void> {

            try {

                const files = fs.readdirSync(this.#dir);

                for (const file of files) {

                    if (file.endsWith('.json')) {

                        fs.unlinkSync(path.join(this.#dir, file));
                    }
                }
            }
            catch {

                // Ignore errors
            }
        }

        cleanup(): void {

            try {

                fs.rmSync(this.#dir, { recursive: true, force: true });
            }
            catch {

                // Ignore errors
            }
        }
    }

    beforeEach(() => {

        fs.rmSync(TMP_DIR, { recursive: true, force: true });
    });

    afterEach(() => {

        fs.rmSync(TMP_DIR, { recursive: true, force: true });
    });

    it('should work with file system cache adapter', async () => {

        const adapter = new FileSystemCacheAdapter(TMP_DIR);

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: {
                adapter,
                ttl: 60000
            }
        });

        const hitEvents: string[] = [];
        const missEvents: string[] = [];
        const cacheKeys: string[] = [];

        api.on('fetch-cache-hit', (data) => hitEvents.push(data.path!));
        api.on('fetch-cache-miss', (data) => missEvents.push(data.path!));
        api.on('fetch-cache-set', (data) => cacheKeys.push(data.key));

        // First request - cache miss, stored to file
        await api.get('/json');

        expect(missEvents.length).to.equal(1);
        expect(cacheKeys.length).to.equal(1);
        expect(adapter.size).to.equal(1);

        // Second request - cache hit from file
        await api.get('/json');

        expect(hitEvents.length).to.equal(1);
        expect(missEvents.length).to.equal(1);

        // Verify data is in file system using actual key
        const cached = await adapter.get(cacheKeys[0]!);
        expect(cached).to.not.be.null;
        expect(cached!.value).to.have.property('data');

        api.destroy();
        adapter.cleanup();
    });

    it('should persist cache across multiple requests', async () => {

        const adapter = new FileSystemCacheAdapter(TMP_DIR);

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: {
                adapter,
                ttl: 60000
            }
        });

        // Make several different requests
        await api.get('/json');
        await api.get('/json1');
        await api.get('/json2');

        expect(adapter.size).to.equal(3);

        // All should be cache hits now
        const hitEvents: string[] = [];
        api.on('fetch-cache-hit', (data) => hitEvents.push(data.path!));

        await api.get('/json');
        await api.get('/json1');
        await api.get('/json2');

        expect(hitEvents.length).to.equal(3);

        api.destroy();
        adapter.cleanup();
    });

    it('should support cache invalidation', async () => {

        const adapter = new FileSystemCacheAdapter(TMP_DIR);

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: {
                adapter,
                ttl: 60000
            }
        });

        await api.get('/json');
        await api.get('/json1');

        expect(adapter.size).to.equal(2);

        // Clear cache
        await api.clearCache();

        expect(adapter.size).to.equal(0);

        // Should be cache miss again
        const missEvents: string[] = [];
        api.on('fetch-cache-miss', (data) => missEvents.push(data.path!));

        await api.get('/json');

        expect(missEvents.length).to.equal(1);

        api.destroy();
        adapter.cleanup();
    });

    it('should handle SWR', async () => {

        const adapter = new FileSystemCacheAdapter(TMP_DIR);

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: {
                adapter,
                ttl: 60000,
                staleIn: 1 // Stale after 1ms
            }
        });

        const staleEvents: string[] = [];
        const revalidateEvents: string[] = [];

        api.on('fetch-cache-stale', (data) => staleEvents.push(data.path!));
        api.on('fetch-cache-revalidate', (data) => revalidateEvents.push(data.path!));

        // First request - cache miss
        await api.get('/json');

        // Wait for stale threshold
        await new Promise(r => setTimeout(r, 10));

        // Second request - should be stale, trigger background revalidation
        await api.get('/json');

        expect(staleEvents.length).to.equal(1);
        expect(revalidateEvents.length).to.equal(1);

        // Wait for background revalidation to complete
        await new Promise(r => setTimeout(r, 100));

        api.destroy();
        adapter.cleanup();
    });

    it('should delete specific cache entry', async () => {

        const adapter = new FileSystemCacheAdapter(TMP_DIR);

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: {
                adapter,
                ttl: 60000
            }
        });

        // Capture actual cache keys from events
        const cacheKeys: string[] = [];
        api.on('fetch-cache-set', (data) => cacheKeys.push(data.key));

        await api.get('/json');
        await api.get('/json1');

        expect(adapter.size).to.equal(2);
        expect(cacheKeys.length).to.equal(2);

        // Delete first key using actual key from event
        const deleted = await api.deleteCache(cacheKeys[0]!);

        expect(deleted).to.be.true;
        expect(adapter.size).to.equal(1);

        // Verify first key is gone but second remains
        const hasFirst = await adapter.has(cacheKeys[0]!);
        const hasSecond = await adapter.has(cacheKeys[1]!);

        expect(hasFirst).to.be.false;
        expect(hasSecond).to.be.true;

        api.destroy();
        adapter.cleanup();
    });

    it('should work with concurrent requests', async () => {

        const adapter = new FileSystemCacheAdapter(TMP_DIR);

        const api = new FetchEngine({
            baseUrl: testUrl,
            cachePolicy: {
                adapter,
                ttl: 60000
            },
            dedupePolicy: true // Enable deduplication too
        });

        // Fire 10 concurrent requests to same endpoint
        const promises = Array.from({ length: 10 }, () => api.get('/json'));

        await Promise.all(promises);

        // Should only have 1 cache entry (deduplicated)
        expect(adapter.size).to.equal(1);

        api.destroy();
        adapter.cleanup();
    });
});
