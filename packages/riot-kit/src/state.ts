import { RiotComponent } from 'riot';

import {
    assert,
    deepEqual,
    definePrivateProps,
    isFunction,
    isFunctionOrObject,
    StateMachine
} from '@logos-ui/kit';

import {
    makeOnUpdated,
    makeOnBeforeUnmount,
    MkHookOpts,
    makeOnBeforeMount
} from '@logos-ui/riot-utils';

export type AnyState = Object | Array<any> | String | Map<any,any> | Set<any>;

export interface MapToStateFunction<A, P, S> {
    (appState: A, componentState: S, componentProps: P): S
};

export interface MapToComponentFunction<P = any, S = any> {
    (props: P, state: S): Partial<P>
};

export type StateMachineComponent<A, R, P, S> = {
    dispatch?: (value: A | R) => void

    mapToState?: MapToStateFunction<A, P, S>
    mapToComponent?: MapToComponentFunction<P, S>
};

type ConnectedComponent<A, R, P, S> = (
    Partial<StateMachineComponent<A, R, P, S>> &
    Partial<RiotComponent<P, S>>
)

type ConnectInternalStore<AppState, Props, State> = Partial<RiotComponent<Props, State>> & {
    componentState?: State,
    componentProps?: Props,
    listener?: {
        (newState: AppState): void
    },
};


/**
 * C = Component
 * A = App State
 * R = Reducer Value
 * P = Riot Props
 * S = Riot State
 * @param opts
 * @returns
 */
export const makeComponentStateable = <A, R, P, S, C extends ConnectedComponent<A, R, P, S>>(

    opts: {

        stateMachine: StateMachine<any>,
        component: C,
        mapToState: MapToStateFunction<A, P, S>,
        mapToComponent?: MapToComponentFunction<P, S>,
    }
) => {

    assert(
        opts.mapToState && isFunction(opts.mapToState),
        'mapToState must be a function'
    );

    assert(
        !opts.mapToComponent || isFunctionOrObject(opts.mapToComponent),
        'mapToComponent must be an object or function that returns and object'
    );

    const {
        component,
        stateMachine,
        mapToState,
        mapToComponent
    } = opts;

    const store: ConnectInternalStore<A, P, S> = {
        update: null as any,
        componentState: null as any,
        componentProps: null as any,
    };

    // Should only call update if state has changed
    store.listener = (newState) => {

        const { componentState, componentProps } = store;
        const change = mapToState(newState, componentState!, componentProps!);
        const isEqual = deepEqual(change, componentState);

        if (!isEqual) store.update!(change);
    };

    definePrivateProps(component, {
        dispatch: (value: any) => stateMachine.dispatch(value),
    })

    const onBeforeMount: MkHookOpts<C, P, S> = {
        component,
        callback: function (this: C, props: P, state: S) {

            store.update = (...args: [any, any]) => this.update!.apply(this, args);

            // When state is updated, update component state.
            stateMachine.addListener(store.listener!);

            state = { ...state, ...this.state };

            this.state = mapToState(stateMachine.state(), state, props);
            store.componentState = this.state;
            store.componentProps = props;

            if (mapToComponent) {

                let assign = (
                    isFunction(mapToComponent)
                    ? mapToComponent(props, state)
                    : mapToComponent
                );

                if (typeof assign === 'object') {
                    Object.assign(component, assign);
                }
                else {
                    throw TypeError('mapToComponent must return an object');
                }
            }
        },
    }

    const onUpdated: MkHookOpts<C, P, S> = {
        component,
        callback: function (_: P, currentState: S) {

            store.componentState = currentState;

            return true;
        }
    }

    const onBeforeUnmount: MkHookOpts<C, P, S> = {
        component,
        callback: function () {

            if (store.listener) {
                stateMachine.removeListener(store.listener);
            }

            return this;
        },
        runAfterOriginal: true
    }

    makeOnUpdated (onUpdated);
    makeOnBeforeMount(onBeforeMount);
    makeOnBeforeUnmount (onBeforeUnmount);

    return component;

};
