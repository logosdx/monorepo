import { describe, it, expect, vi } from 'vitest';
import { FetchState } from '@logosdx/fetch';


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


describe('FetchState.reset', () => {

    it('resets state to empty object', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState<{ token: string }>(mockEngine as any);

        state.set('token', 'abc');
        state.reset();

        expect(state.get()).to.deep.equal({});
    });

    it('emits state-reset event', () => {

        const mockEngine = createMockEngine();
        const state = new FetchState<{ token: string }>(mockEngine as any);

        state.set('token', 'abc');
        mockEngine.emit.mockClear();

        state.reset();

        expect(mockEngine.emit).toHaveBeenCalledWith('state-reset', {
            previous: { token: 'abc' },
            current: {}
        });
    });

    it('calls validate function from engine options after reset', () => {

        const validate = vi.fn();
        const mockEngine = createMockEngine(validate);
        const state = new FetchState<{ token: string }>(mockEngine as any);

        state.reset();

        expect(validate).toHaveBeenCalledWith({});
    });
});
