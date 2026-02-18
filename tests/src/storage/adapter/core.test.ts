import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDriver } from '../_helpers.ts';
import { StorageAdapter } from '../../../../packages/storage/src/adapter.ts';

interface TestValues {
    user: { id: string; name: string };
    count: number;
    tags: string[];
}

describe('@logosdx/storage: adapter core', () => {

    let storage: StorageAdapter<TestValues>;
    let driver: MemoryDriver;

    beforeEach(() => {

        driver = new MemoryDriver();
        storage = new StorageAdapter<TestValues>({ driver });
    });

    describe('set and get', () => {

        it('should set and get a single value', async () => {

            await storage.set('count', 42);
            const result = await storage.get('count');
            expect(result).to.equal(42);
        });

        it('should set and get an object value', async () => {

            await storage.set('user', { id: '1', name: 'Jane' });
            const result = await storage.get('user');
            expect(result).to.deep.equal({ id: '1', name: 'Jane' });
        });

        it('should set multiple values from object', async () => {

            await storage.set({ count: 10, tags: ['a', 'b'] } as any);
            expect(await storage.get('count')).to.equal(10);
            expect(await storage.get('tags')).to.deep.equal(['a', 'b']);
        });

        it('should get multiple keys as partial object', async () => {

            await storage.set('count', 5);
            await storage.set('tags', ['x']);
            const result = await storage.get(['count', 'tags']);
            expect(result).to.deep.equal({ count: 5, tags: ['x'] });
        });

        it('should get all values', async () => {

            await storage.set('count', 1);
            await storage.set('tags', ['a']);
            const all = await storage.get();
            expect(all).to.deep.equal({ count: 1, tags: ['a'] });
        });

        it('should return null for missing key', async () => {

            const result = await storage.get('count');
            expect(result).to.be.null;
        });
    });

    describe('serialization', () => {

        it('should JSON serialize when structured is false (default)', async () => {

            await storage.set('user', { id: '1', name: 'Jane' });
            const raw = await driver.get('user');
            expect(typeof raw).to.equal('string');
            expect(JSON.parse(raw as string)).to.deep.equal({ id: '1', name: 'Jane' });
        });

        it('should pass through when structured is true', async () => {

            const structured = new StorageAdapter<TestValues>({
                driver,
                structured: true,
            });

            await structured.set('user', { id: '1', name: 'Jane' });
            const raw = await driver.get('user');
            expect(typeof raw).to.equal('object');
            expect(raw).to.deep.equal({ id: '1', name: 'Jane' });
        });
    });

    describe('prefix', () => {

        it('should prefix keys in the driver', async () => {

            const prefixed = new StorageAdapter<TestValues>({
                driver,
                prefix: 'app',
            });

            await prefixed.set('count', 42);
            const raw = await driver.get('app:count');
            expect(raw).to.exist;
        });

        it('should only return keys matching prefix', async () => {

            const prefixed = new StorageAdapter<TestValues>({
                driver,
                prefix: 'app',
            });

            await driver.set('other:key', '"val"');
            await prefixed.set('count', 1);
            const keys = await prefixed.keys();
            expect(keys).to.deep.equal(['count']);
        });
    });

    describe('rm / remove', () => {

        it('should remove a single key', async () => {

            await storage.set('count', 42);
            await storage.rm('count');
            expect(await storage.get('count')).to.be.null;
        });

        it('should remove multiple keys', async () => {

            await storage.set('count', 42);
            await storage.set('tags', ['a']);
            await storage.rm(['count', 'tags']);
            expect(await storage.get('count')).to.be.null;
            expect(await storage.get('tags')).to.be.null;
        });

        it('remove is an alias for rm', async () => {

            expect(storage.remove).to.equal(storage.rm);
        });
    });

    describe('has', () => {

        it('should return true for existing key', async () => {

            await storage.set('count', 42);
            expect(await storage.has('count')).to.be.true;
        });

        it('should return false for missing key', async () => {

            expect(await storage.has('count')).to.be.false;
        });

        it('should return array of booleans for multiple keys', async () => {

            await storage.set('count', 1);
            const result = await storage.has(['count', 'tags']);
            expect(result).to.deep.equal([true, false]);
        });
    });

    describe('clear / reset', () => {

        it('should clear all keys', async () => {

            await storage.set('count', 1);
            await storage.set('tags', ['a']);
            await storage.clear();
            const keys = await storage.keys();
            expect(keys).to.have.length(0);
        });

        it('should only clear prefixed keys', async () => {

            const prefixed = new StorageAdapter<TestValues>({
                driver,
                prefix: 'app',
            });

            await driver.set('other', '"keep"');
            await prefixed.set('count', 1);
            await prefixed.clear();

            const allKeys = await driver.keys();
            expect(allKeys).to.deep.equal(['other']);
        });

        it('reset is an alias for clear', async () => {

            expect(storage.reset).to.equal(storage.clear);
        });
    });

    describe('keys / entries / values', () => {

        it('should return all keys', async () => {

            await storage.set('count', 1);
            await storage.set('tags', ['a']);
            const keys = await storage.keys();
            expect(keys).to.include('count');
            expect(keys).to.include('tags');
        });

        it('should return entries', async () => {

            await storage.set('count', 1);
            const entries = await storage.entries();
            expect(entries).to.deep.include(['count', 1]);
        });

        it('should return values', async () => {

            await storage.set('count', 1);
            const vals = await storage.values();
            expect(vals).to.include(1);
        });
    });

    describe('assign', () => {

        it('should shallow merge into existing object', async () => {

            await storage.set('user', { id: '1', name: 'Jane' });
            await storage.assign('user', { name: 'Bob' });
            const result = await storage.get('user');
            expect(result).to.deep.equal({ id: '1', name: 'Bob' });
        });

        it('should set value if key does not exist', async () => {

            await storage.assign('user', { id: '1', name: 'Jane' } as any);
            const result = await storage.get('user');
            expect(result).to.deep.equal({ id: '1', name: 'Jane' });
        });

        it('should throw if current value is not an object', async () => {

            await storage.set('count', 42);

            await expect(
                storage.assign('count', {} as any)
            ).rejects.toThrow();
        });
    });

    describe('validation', () => {

        it('should throw on invalid key', async () => {

            await expect(
                storage.get('' as any)
            ).rejects.toThrow();
        });

        it('should require a driver in config', () => {

            expect(
                () => new StorageAdapter({} as any)
            ).to.throw();
        });
    });

    describe('scope', () => {

        it('should get scoped value', async () => {

            await storage.set('count', 42);
            const scoped = storage.scope('count');
            expect(await scoped.get()).to.equal(42);
        });

        it('should set scoped value', async () => {

            const scoped = storage.scope('count');
            await scoped.set(10);
            expect(await storage.get('count')).to.equal(10);
        });

        it('should remove scoped value', async () => {

            await storage.set('count', 1);
            const scoped = storage.scope('count');
            await scoped.remove();
            expect(await storage.get('count')).to.be.null;
        });

        it('should assign scoped value', async () => {

            await storage.set('user', { id: '1', name: 'Jane' });
            const scoped = storage.scope('user');
            await scoped.assign({ name: 'Bob' });
            expect(await storage.get('user')).to.deep.equal({
                id: '1', name: 'Bob'
            });
        });

        it('rm and clear are aliases for remove', async () => {

            const scoped = storage.scope('count');
            expect(scoped.rm).to.equal(scoped.remove);
            expect(scoped.clear).to.equal(scoped.remove);
        });
    });
});
