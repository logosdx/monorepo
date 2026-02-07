import { describe, it, expect } from 'vitest';
import { FetchState } from '@logosdx/fetch';


/**
 * Helper to create a mock engine for FetchState tests.
 * Provides a minimal FetchEngineCore-compatible interface.
 */
const createMockEngine = (validate?: (state: any) => void) => ({

    emit: () => {},
    config: {
        get: (path: string) => path === 'validate.state' ? validate : undefined
    },
    state: null as any,
    headerStore: null as any,
    paramStore: null as any
});


describe('FetchState.get', () => {

    it('returns empty object for initial state', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState(mockEngine as any);

        expect(state.get()).to.deep.equal({});
    });

    it('returns a deep clone of the state', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState<{ nested: { value: number } }>(mockEngine as any);

        state.set({ nested: { value: 1 } });
        const result = state.get();

        // Modify the returned object
        result.nested.value = 999;

        // Original state should be unchanged
        expect(state.get().nested.value).to.equal(1);
    });

    it('returns state after set', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState<{ token: string }>(mockEngine as any);

        state.set('token', 'abc123');

        expect(state.get()).to.deep.equal({ token: 'abc123' });
    });
});
