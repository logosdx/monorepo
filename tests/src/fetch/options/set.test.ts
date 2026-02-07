import { describe, it, expect, vi } from 'vitest';
import { ConfigStore } from '@logosdx/fetch';


describe('ConfigStore.set', () => {

    it('sets value by simple path', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, {
            baseUrl: 'https://old.example.com',
            totalTimeout: 5000
        });

        store.set('baseUrl', 'https://new.example.com');

        expect(store.get('baseUrl')).to.equal('https://new.example.com');
    });

    it('sets value by nested path', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, {
            baseUrl: 'https://api.example.com',
            retry: { maxAttempts: 3, baseDelay: 1000 }
        });

        store.set('retry.maxAttempts' as any, 5);

        expect(store.get('retry.maxAttempts')).to.equal(5);
        expect(store.get('retry.baseDelay')).to.equal(1000);
    });

    it('merges partial options object', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, {
            baseUrl: 'https://api.example.com',
            totalTimeout: 5000,
            retry: { maxAttempts: 3 }
        });

        store.set({ totalTimeout: 10000 });

        expect(store.get('totalTimeout')).to.equal(10000);
        expect(store.get('baseUrl')).to.equal('https://api.example.com');
    });

    it('deep merges nested partial options', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, {
            baseUrl: 'https://api.example.com',
            retry: { maxAttempts: 3, baseDelay: 1000, maxDelay: 10000 }
        });

        store.set({ retry: { maxAttempts: 5 } } as any);

        expect(store.get('retry.maxAttempts')).to.equal(5);
        expect(store.get('retry.baseDelay')).to.equal(1000);
        expect(store.get('retry.maxDelay')).to.equal(10000);
    });

    it('emits options-change event with path when setting by path', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, {
            baseUrl: 'https://api.example.com'
        });

        store.set('baseUrl', 'https://new.example.com');

        expect(mockEngine.emit).toHaveBeenCalledWith('config-change', {
            path: 'baseUrl',
            value: 'https://new.example.com'
        });
    });

    it('emits options-change event with value when setting by object', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, {
            baseUrl: 'https://api.example.com'
        });

        const partial = { baseUrl: 'https://new.example.com' };
        store.set(partial);

        expect(mockEngine.emit).toHaveBeenCalledWith('config-change', {
            value: partial
        });
    });

    it('throws on invalid arguments', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, { baseUrl: 'https://api.example.com' });

        expect(() => (store as any).set(123)).to.throw();
        // Setting a path without a value (undefined) is now allowed for clearing
        expect(() => (store as any).set('path')).to.not.throw();
    });

    it('creates intermediate objects for new paths', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, {
            baseUrl: 'https://api.example.com',
            retry: {} as any
        });

        store.set('retry.maxAttempts' as any, 5);

        expect(store.get('retry.maxAttempts' as any)).to.equal(5);
    });
});
