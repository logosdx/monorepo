import { assert, isFunction, merge } from "@logos-ui/utils";
import { RiotComponent } from "riot";

type HookKeys =
'onBeforeMount' |
'onMounted' |
'onBeforeUpdate' |
'onUpdated' |
'onBeforeUnmount' |
'onUnmounted';

type HookFunctions<P, S> = Pick<
    RiotComponent<P, S>,
    HookKeys
>

export type MkHookOpts <T, P, S> = {
    component: T,
    callback: (this: T, prop: P, state: S) => void,
    runAfterOriginal?: boolean
}


interface MakeHook<T, P, S> {

    /**
     * Creates a
     * @param component riot component to make hook on
     * @param fn hook function
     * @param runAfter whether to run hook function before or after original
     */
    (opts: MkHookOpts<T, P, S>): void
};

/**
 * Closure to implement stackable hooks
 * @param {RiotHookFn} hook
 * @returns {MakeHook}
 */
export const mkHook = <T, P, S>(hook: HookKeys): MakeHook<T, P, S> => (

    <T, P, S>(opts: MkHookOpts<T, P, S>) => {

        const original = opts.component[hook];

        assert(isFunction(opts.callback), `${hook} callback must be a function`)

        opts.component[hook] = function (props: P, state: S) {

            !opts.runAfterOriginal && original?.call(this, props, state);

            opts.callback.call(this, props, state);

            opts.runAfterOriginal && original?.call(this, props, state);
        };
    }
);

export const makeOnBeforeMount = mkHook('onBeforeMount');
export const makeOnMounted = mkHook('onMounted');
export const makeOnBeforeUpdate = mkHook('onBeforeUpdate');
export const makeOnUpdated = mkHook('onUpdated');
export const makeOnBeforeUnmount = mkHook('onBeforeUnmount');
export const makeOnUnmounted = mkHook('onUnmounted');

export const mergeState = <Component extends Partial<RiotComponent>, State = any>(component: Component, state: State) => {

    component.state = merge(component.state || {}, state);
};
