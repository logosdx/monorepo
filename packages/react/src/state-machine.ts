import {
    createContext,
    createElement,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import { equals } from '@logosdx/utils';

import type { StateMachine } from '@logosdx/state-machine';
import type { ProviderProps, UseStateMachineReturn } from './types.ts';


/**
 * Subscribes to a StateMachine instance and re-renders on transitions.
 * Optionally accepts a selector to narrow the context and prevent
 * unnecessary re-renders when unrelated context values change.
 *
 * @example
 *     const machine = new StateMachine({ ... });
 *
 *     function Counter() {
 *
 *         const { state, context, send } = useStateMachine(machine);
 *         return <button onClick={() => send('INCREMENT')}>{context.count}</button>;
 *     }
 *
 * @example
 *     // With selector — only re-renders when `count` changes
 *     const { context: count } = useStateMachine(machine, (ctx) => ctx.count);
 */
export function useStateMachine<
    Context,
    Events extends Record<string, any>,
    States extends string,
    Selected = Context
>(
    machine: StateMachine<Context, Events, States>,
    selector?: (context: Context) => Selected
): UseStateMachineReturn<Context, Events, States, Selected> {

    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    const select = (ctx: Context): Selected => {

        return selectorRef.current ? selectorRef.current(ctx) : ctx as unknown as Selected;
    };

    const [, forceRender] = useState(0);
    const stateRef = useRef<States>(machine.state);
    const selectedRef = useRef<Selected>(select(machine.context));

    useEffect(() => {

        return machine.on('*', (payload) => {

            const nextState = payload.to as States;
            const nextSelected = select(payload.context as Context);

            const stateChanged = stateRef.current !== nextState;
            const selectedChanged = !equals(selectedRef.current, nextSelected);

            stateRef.current = nextState;
            selectedRef.current = nextSelected;

            if (stateChanged || selectedChanged) {

                forceRender(n => n + 1);
            }
        });
    }, [machine]);

    return {
        state: stateRef.current,
        context: selectedRef.current,
        send: machine.send.bind(machine),
        instance: machine,
    };
}


/**
 * Creates a React context + hook pair bound to a StateMachine instance.
 * Returns a `[Provider, useHook]` tuple — rename to fit your domain.
 *
 * @example
 *     const machine = new StateMachine({ ... });
 *     export const [GameProvider, useGame] = createStateMachineContext(machine);
 *
 *     // In your app:
 *     <GameProvider><App /></GameProvider>
 *
 *     // In components:
 *     const { state, send } = useGame();
 *     const score = useGame((ctx) => ctx.score); // with selector
 */
export function createStateMachineContext<
    Context,
    Events extends Record<string, any>,
    States extends string
>(
    instance: StateMachine<Context, Events, States>
): [
    (props: ProviderProps) => ReturnType<typeof createElement>,
    <Selected = Context>(selector?: (context: Context) => Selected) => UseStateMachineReturn<Context, Events, States, Selected>
] {

    const MachineContext = createContext<StateMachine<Context, Events, States>>(instance);

    function Provider(props: ProviderProps) {

        return createElement(MachineContext.Provider, { value: instance }, props.children);
    }

    function useHook<Selected = Context>(
        selector?: (context: Context) => Selected
    ): UseStateMachineReturn<Context, Events, States, Selected> {

        const machine = useContext(MachineContext);
        return useStateMachine(machine, selector);
    }

    return [Provider, useHook];
}
