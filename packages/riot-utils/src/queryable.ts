import { RiotComponent, RiotComponentWithoutInternals } from 'riot';
import { definePrivateProps, Func, isFunction, NonFunctionProps } from '@logos-ui/utils';

import { mergeState } from './utils';

export type RiotComponentExport<C, P = any, S = any> = (
    RiotComponentWithoutInternals<
        RiotComponent<P, S>
    > &
    C
);

export type QueryableState<S> = S & {
    isFetching?: boolean,
    fetchError?: Error | null;
};

export interface QueryableComponent<C, S> {

    state: QueryableState<S>;

    /**
     * Names of the functions to make queryable on before mount
     */
    makeFetching: (keyof Omit<C, NonFunctionProps<C>>)[],

    /**
     * Toggle or set isFetching. Useful for when, for example,
     * binding functions to events.
     * @param isFetching set is fetching
     */
    toggleFetching(isFetching?: boolean): void,

    /**
     * Sets component's state to isFetching true and captures any
     * errors caused by the function fetching. Useful for use inside
     * of other functions.
     * @param {function} fn function to be executed
     */
    setFetching<T extends Func>(fn: T): ReturnType<T>;

    /**
     * Creates a monad that will execute given function and toggle
     * state to `isFetching` when it does. Captures errors and can
     * update state given a return value. Useful for onclick handlers
     * and event bindings.
     * @param {Function} fn function to be executed
     * @returns {function}
     */
    fnWillFetch: <T extends Func>(fn: T) => ReturnType<T>;
}

/**
 * Adds functionality to riot components that allow them to
 * set its own state to isFetching while an async call is being made.
 * Any errors are recorded in the state's `fetchError` property
 * @param implement
 * @returns component with a fetchable interface
 */
export const makeQueryable = function <
    T extends RiotComponentExport<any>,
    State = any
>(component: RiotComponentExport<T>): T & QueryableComponent<T, State> {

    type I = T & RiotComponent<any, State> & QueryableComponent<T, State>;

    const implement = component as I;

    const state = (implement.state || {}) as I['state'];

    mergeState(implement, {
        isFetching: state.isFetching || false,
        fetchError: null
    });

    definePrivateProps(
        implement,
        {
            toggleFetching: function (this: I, isFetching?: boolean) {

                const change = { isFetching: !this.state.isFetching }

                if (isFetching !== undefined) {

                    change.isFetching = isFetching;
                }

                this.update(change as QueryableState<State>);
            },
            setFetching: async function <F extends Function>(this: I, fn: F) {

                const state = {
                    isFetching: true,
                    fetchError: null
                } as QueryableState<State>;

                this.update({ ...state });

                state.isFetching = false;

                try {

                    const update = await fn() || {};

                    implement.update({ ...state, ...update });
                }
                catch (fetchError) {

                    implement.update({ ...state, fetchError });
                }
            },
            fnWillFetch: function <F extends Func>(this: I, fn: F) {

                const self = this;

                return (...args: Parameters<F>) => (

                    implement.setFetching(() => fn.apply(self, args))
                )
            }
        }
    )

    if (implement.makeFetching?.length) {

        const exists = implement.makeFetching.filter(
            name => !!implement[name] && isFunction(implement[name])
        );

        for (const fn of exists) {

            implement[fn] = implement.fnWillFetch(implement[fn] as Func);
        }
    }

    return implement;
};
