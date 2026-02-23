import { describe, it, expect } from 'vitest';
import { act } from 'react';

import { StateMachine } from '../../../packages/state-machine/src/index.ts';
import { createStateMachineContext, useStateMachine } from '../../../packages/react/src/index.ts';
import { renderHook } from './_helpers.ts';


interface CounterContext {
    count: number;
    label: string;
}

interface CounterEvents {
    INCREMENT: void;
    DECREMENT: void;
    SET: number;
    RESET: void;
}

type CounterStates = 'idle' | 'active';

function createCounter() {

    return new StateMachine<CounterContext, CounterEvents, CounterStates>({
        initial: 'idle',
        context: { count: 0, label: 'counter' },
        transitions: {
            idle: {
                on: {
                    INCREMENT: {
                        target: 'active',
                        action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
                    },
                    SET: {
                        target: 'active',
                        action: (ctx, val) => ({ ...ctx, count: val }),
                    },
                },
            },
            active: {
                on: {
                    INCREMENT: {
                        target: 'active',
                        action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
                    },
                    DECREMENT: {
                        target: 'active',
                        action: (ctx) => ({ ...ctx, count: ctx.count - 1 }),
                    },
                    SET: {
                        target: 'active',
                        action: (ctx, val) => ({ ...ctx, count: val }),
                    },
                    RESET: {
                        target: 'idle',
                        action: (ctx) => ({ ...ctx, count: 0 }),
                    },
                },
            },
        },
    });
}


describe('@logosdx/react: state-machine', () => {

    describe('useStateMachine', () => {

        it('returns the expected API shape', () => {

            const machine = createCounter();
            const { result } = renderHook(() => useStateMachine(machine as any));

            expect(result.current.state).to.equal('idle');
            expect(result.current.context).to.deep.equal({ count: 0, label: 'counter' });
            expect(result.current.send).to.be.a('function');
            expect(result.current.instance).to.equal(machine);
        });

        it('re-renders on state transition', () => {

            const machine = createCounter();

            let renderCount = 0;
            const { result } = renderHook(() => {

                renderCount++;
                return useStateMachine(machine as any);
            });

            expect(result.current.state).to.equal('idle');
            const before = renderCount;

            act(() => { machine.send('INCREMENT'); });

            expect(result.current.state).to.equal('active');
            expect((result.current.context as any).count).to.equal(1);
            expect(renderCount).to.be.greaterThan(before);
        });

        it('send() triggers transitions', () => {

            const machine = createCounter();
            const { result } = renderHook(() => useStateMachine(machine as any));

            act(() => { result.current.send('INCREMENT'); });

            expect(result.current.state).to.equal('active');
            expect((result.current.context as any).count).to.equal(1);
        });

        it('selector narrows context and prevents unnecessary re-renders', () => {

            const machine = createCounter();

            let renderCount = 0;
            const { result } = renderHook(() => {

                renderCount++;
                return useStateMachine(machine as any, (ctx: any) => ctx.count);
            });

            expect(result.current.context).to.equal(0);

            const before = renderCount;

            // Transition that changes count — should re-render
            act(() => { machine.send('INCREMENT'); });
            expect(result.current.context).to.equal(1);
            expect(renderCount).to.be.greaterThan(before);

            const after = renderCount;

            // Transition that results in same count — should NOT re-render
            act(() => { machine.send('SET', 1); });
            expect(renderCount).to.equal(after);
        });

        it('cleans up listener on unmount', () => {

            const machine = createCounter();

            let renderCount = 0;
            const { unmount } = renderHook(() => {

                renderCount++;
                return useStateMachine(machine as any);
            });

            const before = renderCount;
            unmount();

            machine.send('INCREMENT');
            expect(renderCount).to.equal(before);
        });
    });

    describe('createStateMachineContext', () => {

        it('returns [Provider, useHook] tuple', () => {

            const machine = createCounter();
            const result = createStateMachineContext(machine as any);

            expect(result).to.be.an('array').with.lengthOf(2);
            expect(result[0]).to.be.a('function');
            expect(result[1]).to.be.a('function');
        });

        it('hook works via Provider', () => {

            const machine = createCounter();
            const [Provider, useMachine] = createStateMachineContext(machine as any);

            const { result } = renderHook(
                () => useMachine(),
                Provider,
            );

            expect(result.current.state).to.equal('idle');
            expect(result.current.instance).to.equal(machine);
        });

        it('hook accepts selector via context', () => {

            const machine = createCounter();
            const [Provider, useMachine] = createStateMachineContext(machine as any);

            const { result } = renderHook(
                () => useMachine((ctx: any) => ctx.count),
                Provider,
            );

            expect(result.current.context).to.equal(0);

            act(() => { machine.send('INCREMENT'); });
            expect(result.current.context).to.equal(1);
        });

        it('re-renders on transitions via context', () => {

            const machine = createCounter();
            const [Provider, useMachine] = createStateMachineContext(machine as any);

            let renderCount = 0;
            const { result } = renderHook(
                () => {

                    renderCount++;
                    return useMachine();
                },
                Provider,
            );

            const before = renderCount;

            act(() => { machine.send('INCREMENT'); });

            expect(result.current.state).to.equal('active');
            expect(renderCount).to.be.greaterThan(before);
        });
    });
});
