import { describe, it, expect, vi } from 'vitest';
import { HeadersManager } from '../../../../packages/fetch/src/properties/headers.ts';


/**
 * Helper to create a mock engine for HeadersManager tests.
 * Provides a minimal FetchEngineCore-compatible interface.
 */
const createMockEngine = (
    headers?: Record<string, string>,
    methodHeaders?: Record<string, Record<string, string>>,
    validate?: (h: any, m?: string) => void
) => ({

    emit: vi.fn(),
    config: {
        get: (path: string) => {

            if (path === 'headers') return headers;
            if (path === 'methodHeaders') return methodHeaders;
            if (path === 'validate.headers') return validate;
            return undefined;
        }
    },
    state: null as any,
    headerStore: null as any,
    paramStore: null as any
});


describe('HeadersManager', () => {

    describe('constructor', () => {

        it('initializes with headers from engine options', () => {

            const mockEngine = createMockEngine({ Authorization: 'Bearer token' });
            const manager = new HeadersManager(mockEngine as any);

            expect(manager.defaults).to.deep.equal({ Authorization: 'Bearer token' });
        });

        it('initializes with method headers from engine options', () => {

            const mockEngine = createMockEngine(
                { 'Content-Type': 'application/json' },
                { POST: { 'X-Custom': 'post-value' } }
            );
            const manager = new HeadersManager(mockEngine as any);

            expect(manager.forMethod('POST')).to.deep.equal({ 'X-Custom': 'post-value' });
        });

        it('initializes with empty defaults when no headers provided', () => {

            const mockEngine = createMockEngine();
            const manager = new HeadersManager(mockEngine as any);

            expect(manager.defaults).to.deep.equal({});
        });
    });

    describe('set', () => {

        it('sets header by key-value', () => {

            const mockEngine = createMockEngine();
            const manager = new HeadersManager(mockEngine as any);

            manager.set('Authorization', 'Bearer xyz');

            expect(manager.defaults.Authorization).to.equal('Bearer xyz');
        });

        it('sets header by object', () => {

            const mockEngine = createMockEngine();
            const manager = new HeadersManager(mockEngine as any);

            manager.set({ 'X-API-Key': 'abc', 'X-Request-ID': '123' });

            expect(manager.defaults).to.deep.equal({ 'X-API-Key': 'abc', 'X-Request-ID': '123' });
        });

        it('sets method-specific header', () => {

            const mockEngine = createMockEngine();
            const manager = new HeadersManager(mockEngine as any);

            manager.set('Content-Type', 'multipart/form-data', 'POST');

            expect(manager.forMethod('POST')).to.deep.equal({ 'Content-Type': 'multipart/form-data' });
        });

        it('emits header-add event for key-value', () => {

            const mockEngine = createMockEngine();
            const manager = new HeadersManager(mockEngine as any);

            manager.set('Authorization', 'Bearer token');

            expect(mockEngine.emit).toHaveBeenCalledWith('header-add', {
                key: 'Authorization',
                value: 'Bearer token',
                method: undefined
            });
        });

        it('emits header-add event for object', () => {

            const mockEngine = createMockEngine();
            const manager = new HeadersManager(mockEngine as any);

            const headers = { 'X-API-Key': 'abc' };
            manager.set(headers);

            expect(mockEngine.emit).toHaveBeenCalledWith('header-add', {
                value: headers,
                method: undefined
            });
        });

        it('emits header-add event with method', () => {

            const mockEngine = createMockEngine();
            const manager = new HeadersManager(mockEngine as any);

            manager.set('Content-Type', 'application/json', 'POST');

            expect(mockEngine.emit).toHaveBeenCalledWith('header-add', {
                key: 'Content-Type',
                value: 'application/json',
                method: 'POST'
            });
        });
    });

    describe('remove', () => {

        it('removes header by key', () => {

            const mockEngine = createMockEngine({ Authorization: 'Bearer token' });
            const manager = new HeadersManager(mockEngine as any);

            manager.remove('Authorization');

            expect(manager.defaults.Authorization).to.be.undefined;
        });

        it('removes multiple headers', () => {

            const mockEngine = createMockEngine({ 'X-API-Key': 'abc', 'X-Request-ID': '123' });
            const manager = new HeadersManager(mockEngine as any);

            manager.remove(['X-API-Key', 'X-Request-ID']);

            expect(manager.defaults).to.deep.equal({});
        });

        it('emits header-remove event', () => {

            const mockEngine = createMockEngine({ Authorization: 'Bearer token' });
            const manager = new HeadersManager(mockEngine as any);

            manager.remove('Authorization');

            expect(mockEngine.emit).toHaveBeenCalledWith('header-remove', {
                key: 'Authorization',
                method: undefined
            });
        });
    });

    describe('has', () => {

        it('returns true for existing header', () => {

            const mockEngine = createMockEngine({ Authorization: 'Bearer token' });
            const manager = new HeadersManager(mockEngine as any);

            expect(manager.has('Authorization')).to.be.true;
        });

        it('returns false for non-existing header', () => {

            const mockEngine = createMockEngine();
            const manager = new HeadersManager(mockEngine as any);

            expect(manager.has('Authorization')).to.be.false;
        });
    });

    describe('resolve', () => {

        it('merges defaults and method overrides', () => {

            const mockEngine = createMockEngine(
                { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
                { POST: { 'Content-Type': 'multipart/form-data' } }
            );
            const manager = new HeadersManager(mockEngine as any);

            const resolved = manager.resolve('POST');

            expect(resolved).to.deep.equal({
                'Content-Type': 'multipart/form-data',
                Authorization: 'Bearer token'
            });
        });

        it('applies request overrides', () => {

            const mockEngine = createMockEngine({ 'Content-Type': 'application/json' });
            const manager = new HeadersManager(mockEngine as any);

            const resolved = manager.resolve('POST', { 'X-Request-ID': '123' });

            expect(resolved).to.deep.equal({
                'Content-Type': 'application/json',
                'X-Request-ID': '123'
            });
        });
    });

    describe('validation', () => {

        it('calls validate function when setting headers', () => {

            const validate = vi.fn();
            const mockEngine = createMockEngine({}, {}, validate);
            const manager = new HeadersManager(mockEngine as any);

            manager.set('Authorization', 'Bearer token');

            expect(validate).toHaveBeenCalled();
        });
    });
});
