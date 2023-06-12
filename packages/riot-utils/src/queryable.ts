import { RiotComponent, RiotComponentWithoutInternals } from 'riot';
import { definePrivateProps, Func, isFunction, NonFunctionProps, FunctionProps } from '@logos-ui/utils';

import { mergeState } from './utils';

export type RiotComponentExport<C, P = any, S = any> = (
    RiotComponentWithoutInternals<
        RiotComponent<P, S>
    > &
    C
);

export type QueryableState<S> = S & {
    isQuerying?: boolean,
    queryError?: Error | null;
    queryData?: any
};

export interface QueryableComponent<C, S> {

    state: QueryableState<S>;

    /**
     * Names of the functions to make queryable on before mount
     */
    queryable: (FunctionProps<C>)[],

    /**
     * Toggle or set isQuerying. Useful for when, for example,
     * binding functions to events.
     * @param isQuerying set is querying
     */
    toggleQuerying(isQuerying?: boolean): void,

    /**
     * Sets component's state to isQuerying true and captures any
     * errors caused by the function querying. Useful for use inside
     * of other functions.
     * @param {function} fn function to be executed
     */
    setQuerying<T extends Func>(fn: T): ReturnType<T>;

    /**
     * Creates a monad that will execute given function and toggle
     * state to `isQuerying` when it does. Captures errors and can
     * update state given a return value. Useful for onclick handlers
     * and event bindings.
     * @param {Function} fn function to be executed
     * @returns {function}
     */
    fnWillQuery: <T extends Func>(fn: T) => ReturnType<T>;
}

/**
 * Adds functionality to riot components that allow them to
 * set its own state to isQuerying while an async call is being made.
 * Any errors are recorded in the state's `queryError` property
 * @param implement
 * @returns component with a queryable interface
 */
export const makeQueryable = function <
    T extends RiotComponentExport<any>,
    State = any
>(component: RiotComponentExport<T, unknown, State>): T & QueryableComponent<T, State> {


    type OnlyRCFuncs = Omit<RiotComponent<{}, QueryableState<State>>, 'state'>;

    type I = T  & OnlyRCFuncs & QueryableComponent<T, State>;

    const implement = component as I;

    const state = (implement.state || {}) as I['state'];

    mergeState(implement, {
        isQuerying: state.isQuerying || false,
        queryError: null,
        queryData: null
    });


    definePrivateProps(
        implement,
        {
            toggleQuerying: function (this: I, isQuerying?: boolean) {

                const change = { isQuerying: !this.state.isQuerying }

                if (isQuerying !== undefined) {

                    change.isQuerying = isQuerying;
                }

                this.update(change as QueryableState<State>);
            },
            setQuerying: async function <F extends Function>(this: I, fn: F) {

                this.update({
                    isQuerying: true,
                    queryError: null,
                    queryData: null
                } as QueryableState<State>);

                try {

                    const queryData = await fn() || {};

                    implement.update({
                        queryData,
                        queryError: null,
                        isQuerying: false,
                    } as QueryableState<State>);
                }
                catch (queryError) {

                    implement.update({
                        queryData: null,
                        queryError,
                        isQuerying: false,
                    } as QueryableState<State>);
                }
            },
            fnWillQuery: function <F extends Func>(this: I, fn: F) {

                const self = this;

                return (...args: Parameters<F>) => (

                    implement.setQuerying(() => fn.apply(self, args))
                )
            }
        }
    )

    if (implement.queryable?.length) {

        const exists = implement.queryable.filter(
            (name: keyof T) => !!implement[name] && isFunction(implement[name])
        );

        for (const fn of exists) {

            implement[fn as keyof T] = implement.fnWillQuery(implement[fn as FunctionProps<T>] as Func);
        }
    }

    return implement;
};
