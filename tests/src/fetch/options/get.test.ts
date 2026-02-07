import { describe, it, expect, vi } from 'vitest';
import { ConfigStore } from '@logosdx/fetch';


describe('ConfigStore.get', () => {

    it('returns cloned options when no path provided', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const initialOptions = {
            baseUrl: 'https://api.example.com',
            retry: { maxAttempts: 3 }
        };

        const store = new ConfigStore(mockEngine, initialOptions);
        const result = store.get();

        expect(result).to.deep.equal(initialOptions);
        expect(result).to.not.equal(initialOptions);
    });

    it('returns value at simple path', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, {
            baseUrl: 'https://api.example.com',
            totalTimeout: 5000
        });

        expect(store.get('baseUrl')).to.equal('https://api.example.com');
        expect(store.get('totalTimeout')).to.equal(5000);
    });

    it('returns value at nested path', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, {
            baseUrl: 'https://api.example.com',
            retry: {
                maxAttempts: 3,
                baseDelay: 1000
            }
        });

        expect(store.get('retry.maxAttempts')).to.equal(3);
        expect(store.get('retry.baseDelay')).to.equal(1000);
    });

    it('returns cloned object for nested object paths', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const retry = { maxAttempts: 3, baseDelay: 1000 };
        const store = new ConfigStore(mockEngine, { baseUrl: 'https://api.example.com', retry });

        const result = store.get('retry');

        expect(result).to.deep.equal(retry);
        expect(result).to.not.equal(retry);
    });

    it('returns undefined for non-existent paths', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, { baseUrl: 'https://api.example.com' });

        expect(store.get('nonExistent' as any)).to.be.undefined;
        expect(store.get('nested.path' as any)).to.be.null;
    });

    it('prevents mutation through returned values', () => {

        const mockEngine = { emit: vi.fn() } as any;
        const store = new ConfigStore(mockEngine, {
            baseUrl: 'https://api.example.com',
            retry: { maxAttempts: 3 }
        });

        const result = store.get();
        (result.retry as any).maxAttempts = 999;

        expect(store.get('retry.maxAttempts')).to.equal(3);
    });
});
