import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryDriver } from '../_helpers.ts';
import { StorageAdapter } from '../../../../packages/storage/src/adapter.ts';

interface TestValues {
    user: { id: string; name: string };
    count: number;
}

describe('@logosdx/storage: adapter events', () => {

    let storage: StorageAdapter<TestValues>;

    beforeEach(() => {

        storage = new StorageAdapter<TestValues>({
            driver: new MemoryDriver(),
        });
    });

    it('should emit before-set and after-set on set()', async () => {

        const before = vi.fn();
        const after = vi.fn();

        storage.on('before-set', before);
        storage.on('after-set', after);

        await storage.set('count', 42);

        expect(before).toHaveBeenCalledOnce();
        expect(before.mock.calls[0]![0]).to.deep.include({ key: 'count' });
        expect(after).toHaveBeenCalledOnce();
    });

    it('should emit before-remove and after-remove on rm()', async () => {

        const before = vi.fn();
        const after = vi.fn();

        storage.on('before-remove', before);
        storage.on('after-remove', after);

        await storage.set('count', 42);
        await storage.rm('count');

        expect(before).toHaveBeenCalledOnce();
        expect(after).toHaveBeenCalledOnce();
    });

    it('should emit clear on clear()', async () => {

        const listener = vi.fn();
        storage.on('clear', listener);

        await storage.set('count', 1);
        await storage.clear();

        expect(listener).toHaveBeenCalledOnce();
    });

    it('on() should return a cleanup function', async () => {

        const listener = vi.fn();
        const cleanup = storage.on('after-set', listener);

        await storage.set('count', 1);
        expect(listener).toHaveBeenCalledOnce();

        (cleanup as any)();

        await storage.set('count', 2);
        expect(listener).toHaveBeenCalledOnce();
    });

    it('off() should remove listener', async () => {

        const listener = vi.fn();
        storage.on('after-set', listener);
        storage.off('after-set', listener);

        await storage.set('count', 1);
        expect(listener).not.toHaveBeenCalled();
    });

    it('bulk set() should emit per key', async () => {

        const listener = vi.fn();
        storage.on('after-set', listener);

        await storage.set({ count: 1, user: { id: '1', name: 'A' } } as any);
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
