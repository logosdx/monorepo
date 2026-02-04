import { describe, it, expect, vi } from 'vitest';
import { ParamsManager } from '../../../../packages/fetch/src/properties/params.ts';


/**
 * Helper to create a mock engine for ParamsManager tests.
 * Provides a minimal FetchEngineCore-compatible interface.
 */
const createMockEngine = (
    params?: Record<string, string>,
    methodParams?: Record<string, Record<string, string>>,
    validate?: (p: any, m?: string) => void
) => ({

    emit: vi.fn(),
    config: {
        get: (path: string) => {

            if (path === 'params') return params;
            if (path === 'methodParams') return methodParams;
            if (path === 'validate.params') return validate;
            return undefined;
        }
    },
    state: null as any,
    headerStore: null as any,
    paramStore: null as any
});


describe('ParamsManager', () => {

    describe('constructor', () => {

        it('initializes with params from engine options', () => {

            const mockEngine = createMockEngine({ apiKey: 'abc123' });
            const manager = new ParamsManager(mockEngine as any);

            expect(manager.defaults).to.deep.equal({ apiKey: 'abc123' });
        });

        it('initializes with method params from engine options', () => {

            const mockEngine = createMockEngine(
                { format: 'json' },
                { GET: { page: '1' } }
            );
            const manager = new ParamsManager(mockEngine as any);

            expect(manager.forMethod('GET')).to.deep.equal({ page: '1' });
        });

        it('initializes with empty defaults when no params provided', () => {

            const mockEngine = createMockEngine();
            const manager = new ParamsManager(mockEngine as any);

            expect(manager.defaults).to.deep.equal({});
        });
    });

    describe('set', () => {

        it('sets param by key-value', () => {

            const mockEngine = createMockEngine();
            const manager = new ParamsManager(mockEngine as any);

            manager.set('apiKey', 'xyz');

            expect(manager.defaults.apiKey).to.equal('xyz');
        });

        it('sets param by object', () => {

            const mockEngine = createMockEngine();
            const manager = new ParamsManager(mockEngine as any);

            manager.set({ page: '1', limit: '10' });

            expect(manager.defaults).to.deep.equal({ page: '1', limit: '10' });
        });

        it('sets method-specific param', () => {

            const mockEngine = createMockEngine();
            const manager = new ParamsManager(mockEngine as any);

            manager.set('format', 'xml', 'GET');

            expect(manager.forMethod('GET')).to.deep.equal({ format: 'xml' });
        });

        it('emits param-add event for key-value', () => {

            const mockEngine = createMockEngine();
            const manager = new ParamsManager(mockEngine as any);

            manager.set('apiKey', 'abc');

            expect(mockEngine.emit).toHaveBeenCalledWith('param-add', {
                key: 'apiKey',
                value: 'abc',
                method: undefined
            });
        });

        it('emits param-add event for object', () => {

            const mockEngine = createMockEngine();
            const manager = new ParamsManager(mockEngine as any);

            const params = { page: '1' };
            manager.set(params);

            expect(mockEngine.emit).toHaveBeenCalledWith('param-add', {
                value: params,
                method: undefined
            });
        });

        it('emits param-add event with method', () => {

            const mockEngine = createMockEngine();
            const manager = new ParamsManager(mockEngine as any);

            manager.set('format', 'json', 'GET');

            expect(mockEngine.emit).toHaveBeenCalledWith('param-add', {
                key: 'format',
                value: 'json',
                method: 'GET'
            });
        });
    });

    describe('remove', () => {

        it('removes param by key', () => {

            const mockEngine = createMockEngine({ apiKey: 'abc' });
            const manager = new ParamsManager(mockEngine as any);

            manager.remove('apiKey');

            expect(manager.defaults.apiKey).to.be.undefined;
        });

        it('removes multiple params', () => {

            const mockEngine = createMockEngine({ page: '1', limit: '10' });
            const manager = new ParamsManager(mockEngine as any);

            manager.remove(['page', 'limit']);

            expect(manager.defaults).to.deep.equal({});
        });

        it('emits param-remove event', () => {

            const mockEngine = createMockEngine({ apiKey: 'abc' });
            const manager = new ParamsManager(mockEngine as any);

            manager.remove('apiKey');

            expect(mockEngine.emit).toHaveBeenCalledWith('param-remove', {
                key: 'apiKey',
                method: undefined
            });
        });
    });

    describe('has', () => {

        it('returns true for existing param', () => {

            const mockEngine = createMockEngine({ apiKey: 'abc' });
            const manager = new ParamsManager(mockEngine as any);

            expect(manager.has('apiKey')).to.be.true;
        });

        it('returns false for non-existing param', () => {

            const mockEngine = createMockEngine();
            const manager = new ParamsManager(mockEngine as any);

            expect(manager.has('apiKey')).to.be.false;
        });
    });

    describe('resolve', () => {

        it('merges defaults and method overrides', () => {

            const mockEngine = createMockEngine(
                { format: 'json', apiKey: 'abc' },
                { GET: { format: 'xml' } }
            );
            const manager = new ParamsManager(mockEngine as any);

            const resolved = manager.resolve('GET');

            expect(resolved).to.deep.equal({
                format: 'xml',
                apiKey: 'abc'
            });
        });

        it('applies request overrides', () => {

            const mockEngine = createMockEngine({ format: 'json' });
            const manager = new ParamsManager(mockEngine as any);

            const resolved = manager.resolve('GET', { page: '1' });

            expect(resolved).to.deep.equal({
                format: 'json',
                page: '1'
            });
        });
    });

    describe('validation', () => {

        it('calls validate function when setting params', () => {

            const validate = vi.fn();
            const mockEngine = createMockEngine({}, {}, validate);
            const manager = new ParamsManager(mockEngine as any);

            manager.set('apiKey', 'xyz');

            expect(validate).toHaveBeenCalled();
        });
    });
});
