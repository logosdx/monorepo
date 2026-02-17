import {
    clone,
    assert,
    isObject,
    definePrivateProps,
} from '@logosdx/utils';

import { ObserverEngine } from '@logosdx/observer';

import type {
    MachineConfig,
    MachineOptions,
    MachineObserverShape,
    StateConfig,
    TransitionTarget,
    TransitionPayload,
    RejectedPayload,
    StorageAdapter,
} from './types.ts';


export class StateMachine<
    Context = any,
    Events extends Record<string, any> = Record<string, any>,
    States extends string = string
> {

    #state: States;
    #context: Context;
    #config: MachineConfig<Context, Events, States>;
    #observer: ObserverEngine<MachineObserverShape<Context>>;
    #options: MachineOptions | undefined;
    #invokeId: number = 0;
    #ready: boolean = true;
    #readyPromise?: Promise<void>;


    constructor(
        config: MachineConfig<Context, Events, States>,
        options?: MachineOptions
    ) {

        assert(isObject(config), 'StateMachine config must be an object', TypeError);
        assert(typeof config.initial === 'string', 'StateMachine config.initial must be a string', TypeError);
        assert(isObject(config.transitions), 'StateMachine config.transitions must be an object', TypeError);
        assert(
            config.initial in config.transitions,
            `Initial state "${config.initial}" does not exist in transitions`
        );

        this.#validateTransitions(config);

        this.#config = config;
        this.#state = config.initial;
        this.#context = clone(config.context);
        this.#options = options;

        this.#observer = new ObserverEngine<MachineObserverShape<Context>>(
            config.debug ? { spy: (action) => console.log('[StateMachine]', action.fn, action.event, action.data) } : undefined
        );

        definePrivateProps(this, {
            send: this.send.bind(this),
            on: this.on.bind(this),
            off: this.off.bind(this),
        });

        if (options?.persistence) {

            this.#ready = false;
            this.#readyPromise = this.#hydrate(options.persistence);
        }
    }


    get state(): States {

        return this.#state;
    }


    get context(): Context {

        return clone(this.#context);
    }


    /**
     * Attempt a state transition by sending an event.
     *
     * @example
     *     machine.send('FETCH')
     *     machine.send('ADD_ITEM', { id: '1', name: 'Widget' })
     */
    send<E extends keyof Events>(
        ...args: Events[E] extends void
            ? [event: E]
            : [event: E, data: Events[E]]
    ): void {

        const [event, data] = args as [E, Events[E]?];
        const eventStr = event as string;

        const stateConfig = this.#config.transitions[this.#state] as StateConfig<Context, Events>;

        if (!stateConfig?.on || !(event in stateConfig.on)) {

            this.#observer.emit('$rejected', {
                state: this.#state,
                event: eventStr,
                data,
                reason: 'no_transition',
            } as RejectedPayload);

            return;
        }

        const transition = stateConfig.on[event] as TransitionTarget<Context, Events[E]>;
        const { target, action, guard } = this.#resolveTransition(transition);

        if (guard && !guard(this.#context, data as Events[E])) {

            this.#observer.emit('$rejected', {
                state: this.#state,
                event: eventStr,
                data,
                reason: 'guard_failed',
            } as RejectedPayload);

            return;
        }

        this.#invokeId++;

        const from = this.#state;
        let newContext = this.#context;

        if (action) {

            newContext = action(this.#context, data as Events[E]);
        }

        this.#state = target as States;
        this.#context = newContext;

        const payload: TransitionPayload<Context> = {
            from,
            to: this.#state,
            event: eventStr,
            context: clone(this.#context),
            data,
        };

        this.#observer.emit(this.#state as string, payload);
        this.#observer.emit('*', payload);

        this.#persist();
        this.#checkInvoke();
    }


    /**
     * Listen for state transitions.
     *
     * @example
     *     machine.on('error', ({ context, from, event }) => { ... })
     *     machine.on('*', (payload) => { ... })
     *     machine.on('$rejected', ({ state, event, reason }) => { ... })
     *     machine.on(/error|failed/, (payload) => { ... })
     */
    on(
        event: string | RegExp,
        listener: (payload: any) => void,
        options?: ObserverEngine.ListenerOptions
    ): ObserverEngine.Cleanup {

        return this.#observer.on(event as any, listener, options) as ObserverEngine.Cleanup;
    }


    /**
     * Remove a listener for a state or pattern.
     */
    off(event: string | RegExp, listener?: (payload: any) => void): void {

        this.#observer.off(event as any, listener);
    }


    /**
     * Returns a promise that resolves when the machine is hydrated from persistence.
     * If no persistence is configured, resolves immediately.
     */
    async ready(): Promise<void> {

        if (this.#ready) return;
        return this.#readyPromise;
    }


    #resolveTransition<Data>(transition: TransitionTarget<Context, Data>) {

        if (typeof transition === 'string') {

            return { target: transition, action: undefined, guard: undefined };
        }

        return {
            target: transition.target,
            action: transition.action,
            guard: transition.guard,
        };
    }


    #validateTransitions(config: MachineConfig<Context, Events, States>) {

        const stateNames = Object.keys(config.transitions);
        const stateSet: Record<string, true> = {};

        for (const name of stateNames) {

            stateSet[name] = true;
        }

        for (const stateName of stateNames) {

            const stateConfig = config.transitions[stateName as States] as StateConfig<Context, Events>;

            if (stateConfig.final && stateConfig.on) {

                const eventCount = Object.keys(stateConfig.on).length;

                assert(
                    eventCount === 0,
                    `Final state "${stateName}" should not have transitions`
                );
            }

            if (stateConfig.on) {

                for (const eventName of Object.keys(stateConfig.on)) {

                    const transition = (stateConfig.on as any)[eventName];
                    const target = typeof transition === 'string' ? transition : transition?.target;

                    if (target) {

                        assert(
                            stateSet[target],
                            `Transition target "${target}" from "${stateName}.on.${eventName}" does not exist`
                        );
                    }
                }
            }

            if (stateConfig.invoke) {

                const { onDone, onError } = stateConfig.invoke;
                const doneTarget = typeof onDone === 'string' ? onDone : onDone?.target;
                const errorTarget = typeof onError === 'string' ? onError : onError?.target;

                if (doneTarget) {

                    assert(
                        stateSet[doneTarget],
                        `Invoke onDone target "${doneTarget}" from "${stateName}" does not exist`
                    );
                }

                if (errorTarget) {

                    assert(
                        stateSet[errorTarget],
                        `Invoke onError target "${errorTarget}" from "${stateName}" does not exist`
                    );
                }
            }
        }
    }


    #checkInvoke() {

        const stateConfig = this.#config.transitions[this.#state] as StateConfig<Context, Events>;

        if (!stateConfig?.invoke) return;

        const { src, onDone, onError } = stateConfig.invoke;
        const invokeId = ++this.#invokeId;
        const currentState = this.#state;

        src(this.#context).then(
            (result) => {

                if (this.#invokeId !== invokeId) {

                    this.#observer.emit('$invoke.cancelled', { state: currentState });
                    return;
                }

                this.#observer.emit('$invoke.done', { state: currentState, result });
                this.#applyInvokeTransition(onDone, result);
            },
            (error) => {

                if (this.#invokeId !== invokeId) {

                    this.#observer.emit('$invoke.cancelled', { state: currentState });
                    return;
                }

                this.#observer.emit('$invoke.error', { state: currentState, error });
                this.#applyInvokeTransition(onError, error);
            }
        );
    }


    #applyInvokeTransition(transition: TransitionTarget<Context, any>, data: any) {

        const { target, action } = this.#resolveTransition(transition);
        const from = this.#state;

        let newContext = this.#context;

        if (action) {

            newContext = action(this.#context, data);
        }

        this.#state = target as States;
        this.#context = newContext;

        const payload: TransitionPayload<Context> = {
            from,
            to: this.#state,
            event: from === target ? '$invoke' : `$invoke`,
            context: clone(this.#context),
            data,
        };

        this.#observer.emit(this.#state as string, payload);
        this.#observer.emit('*', payload);

        this.#persist();
        this.#checkInvoke();
    }


    #persist() {

        if (!this.#options?.persistence) return;

        const { key, adapter } = this.#options.persistence;

        adapter.save(key, {
            state: this.#state,
            context: this.#context,
        });
    }


    async #hydrate(persistence: { key: string, adapter: StorageAdapter }) {

        const snapshot = await persistence.adapter.load(persistence.key);

        if (snapshot) {

            const stateExists = snapshot.state in this.#config.transitions;

            if (stateExists) {

                this.#state = snapshot.state as States;
                this.#context = snapshot.context;
            }
        }

        this.#ready = true;
    }
}
