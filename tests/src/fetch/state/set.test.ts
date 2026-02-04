import { describe, it, expect, vi } from 'vitest';
import { FetchState } from '../../../../packages/fetch/src/state/index.ts';


/**
 * Helper to create a mock engine for FetchState tests.
 * Provides a minimal FetchEngineCore-compatible interface.
 */
const createMockEngine = (validate?: (state: any) => void) => ({

    emit: vi.fn(),
    config: {
        get: (path: string) => path === 'validate.state' ? validate : undefined
    },
    state: null as any,
    headerStore: null as any,
    paramStore: null as any
});


describe('FetchState.set', () => {

    it('sets state by key-value', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState<{ token: string }>(mockEngine as any);

        state.set('token', 'bearer-123');

        expect(state.get()).to.deep.equal({ token: 'bearer-123' });
    });

    it('sets state by partial object', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState<{ user: string; role: string }>(mockEngine as any);

        state.set({ user: 'john', role: 'admin' });

        expect(state.get()).to.deep.equal({ user: 'john', role: 'admin' });
    });

    it('merges with existing state', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState<{ a: number; b: number }>(mockEngine as any);

        state.set('a', 1);
        state.set('b', 2);

        expect(state.get()).to.deep.equal({ a: 1, b: 2 });
    });

    it('emits state-set event with key-value format', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState<{ token: string }>(mockEngine as any);

        state.set('token', 'abc');

        expect(mockEngine.emit).toHaveBeenCalledWith('state-set', {
            key: 'token',
            value: 'abc',
            previous: {},
            current: { token: 'abc' }
        });
    });

    it('emits state-set event with object format', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState<{ user: string }>(mockEngine as any);

        state.set({ user: 'john' });

        expect(mockEngine.emit).toHaveBeenCalledWith('state-set', {
            key: undefined,
            value: { user: 'john' },
            previous: {},
            current: { user: 'john' }
        });
    });

    it('calls validate function from engine options', () => {

        const validate = vi.fn();
        const mockEngine = createMockEngine(validate);
        const state = new FetchState<{ token: string }>(mockEngine as any);

        state.set('token', 'xyz');

        expect(validate).toHaveBeenCalledWith({ token: 'xyz' });
    });

    it('throws on invalid arguments', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState(mockEngine as any);

        expect(() => (state as any).set(123)).to.throw();
        expect(() => (state as any).set('key')).to.throw();
    });
});
