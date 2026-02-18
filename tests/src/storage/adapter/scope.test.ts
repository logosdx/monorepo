import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDriver } from '../_helpers.ts';
import { StorageAdapter } from '../../../../packages/storage/src/adapter.ts';

interface TestValues {
    user: { id: string; name: string; email?: string };
    count: number;
}

describe('@logosdx/storage: scope()', () => {

    let storage: StorageAdapter<TestValues>;

    beforeEach(() => {

        storage = new StorageAdapter<TestValues>({
            driver: new MemoryDriver(),
        });
    });

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
        await scoped.assign({ email: 'jane@x.com' });
        expect(await storage.get('user')).to.deep.equal({
            id: '1', name: 'Jane', email: 'jane@x.com'
        });
    });

    it('rm and clear are aliases for remove', async () => {

        const scoped = storage.scope('count');
        expect(scoped.rm).to.equal(scoped.remove);
        expect(scoped.clear).to.equal(scoped.remove);
    });
});
