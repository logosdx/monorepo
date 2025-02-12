import {
    Func,
    assert,
    definePrivateProps,
    deepClone
} from '@logos-ui/utils';

import {
    Events,
} from './types.ts';

import {
    ALL_CALLBACKS,
    MATCH_EVERYTHING,
    arrOfMatchingValues,
    DeferredEvent,
    EventGenerator,
    EventPromise,
    InternalEvent,
    InternalEvs,
    InternalListener,
    makeEventTracer,
    rgxStrToRgx,
    validateEvent,
    validateListener,
} from './helpers.ts';

export class ObserverEngine<
    Shape = Record<string, any>
> {

    #listenerMap: Map<Events<Shape>, Set<Func>> = new Map();
    #rgxListenerMap: Map<string, Set<Func>> = new Map();
    #internalListener = new EventTarget();
    #emitValidator?: ObserverEngine.EmitValidator<Shape>;
    #spy?: ObserverEngine.Spy<Shape>;

    // Hidden property for holding the spy function
    // when debugging is enabled. Used to restore the
    // original spy function when debugging is disabled.
    #__spy?: ObserverEngine.Spy<Shape>;


    constructor(options?: ObserverEngine.Options<Shape>) {

        // Validate option if exists
        if (options) {

            assert(
                !options.name || typeof options.name === 'string',
                'Observable options.name must be a string',
                TypeError
            );

            assert(
                !options.spy || typeof options.spy === 'function',
                'Observable options.spy must be a function',
                TypeError
            );

            assert(
                !options.emitValidator || typeof options.emitValidator === 'function',
                'Observable options.emitValidator must be a function',
                TypeError
            );

            this.#spy = options.spy!;
        }

        // Make these functions non-enumerable
        definePrivateProps(this, {
            on: this.on,
            once: this.once,
            emit: this.emit,
            off: this.off,
            observe: this.observe,
            debug: this.debug,
            $has: this.$has,
            $facts: this.$facts,
            $internals: this.$internals,
            name: options?.name || Math.random().toString(36).substring(7)
        });

        this.#emitValidator = options?.emitValidator!;
    }

    name!: string;

    /**
     * Returns facts about the the internal state of the observable instance.
     */
    $facts() {


        const listenKeys = [...this.#listenerMap.keys()];
        const rgxKeys = [...this.#rgxListenerMap.keys()];
        const listenerCounts = Object.fromEntries([
            listenKeys.map(
                k => [k, this.#listenerMap.get(k)?.size]
            ),
            rgxKeys.map(
                k => [k, this.#rgxListenerMap.get(k)?.size]
            )
        ].flat()) as Record<string, number>;

        return {
            listeners: listenKeys,
            rgxListeners: rgxKeys,
            listenerCounts,
            hasSpy: !!this.#spy
        }
    }

	/**
	 * The internals of the observable instance.
     *
     * NOTE: Do not use this to try to meddle with the
     * internals of the observable instance. This is for
     * debugging purposes only.
	 */
    $internals() {

        return {
            listenerMap: deepClone(this.#listenerMap),
            rgxListenerMap: deepClone(this.#rgxListenerMap),
            internalListener: deepClone(this.#internalListener),
            name: this.name,
            spy: this.#spy
        }
    }

    /**
     * Returns if the observable instance has the given event
     */
    $has(event: Events<Shape>): boolean;

    /**
     * Returns if the observable instance has a regex event
     */
    $has(event: RegExp): boolean;

    /**
     * Returns if the observable instance has the given event
     */
    $has(event: '*' | string): boolean;
    $has(event: Events<Shape> | RegExp | string) {

        if (event === '*') return true;
        if (event instanceof RegExp) {

            return this.#rgxListenerMap.has(event.toString());
        }

        return (
            this.#listenerMap.has(event as Events<Shape>) ||
            this.#rgxListenerMap.has(event as string)
        );
    }

    #currentSpy(...args: Parameters<ObserverEngine.Spy<Shape>>) {

        if (this.#spy) {

            this.#spy.apply(this, args);
        }
    }

    /**
     * Enables or disables debugging for the observable instance.
     * Works in conjunction with your spy function. Provides a
     * stack trace of events that are triggered, listened to, and
     * cleaned up.
     *
     * @param on Whether to enable or disable debugging
     */
    debug(on = true) {

        const original = this.#spy;

        const spy: ObserverEngine.Spy<Shape> = (ev) => {

            const {
                event,
                fn,
                data,
                listener
            } = ev;

            console.info(
                makeEventTracer(
                    event as any,
                    fn,
                    data || listener
                )
            );

            original && original(ev);
        }

        if (on) {

            this.#spy = spy;
            this.#__spy = original!;

            return;
        }

        this.#spy = this.#__spy!;
    }

    /**
     * Observes given component as an extension of this observable instance.
     * @param component Component to wrap events around
     *
     * @example
     *
     * const obs = new ObserverEngine();
     *
     * const modal = {};
     *
     * obs.observe(modal);
     *
     * modal.on('modal-open', () => {});
     *
     * obs.trigger('modal-open'); // opens modal
     * modal.trigger('modal-open'); // opens modal
     *
     * modal.cleanup(); // clears all event listeners
     */
    observe<C>(component: C) {

        const self = this;

        const track = new Map<string, Set<Func>>;

        const trackListener = (event: string, fn: Func) => {

            const _set = track.get(event) || new Set<Func>;
            _set.add(fn);

            track.set(event, _set);

            return fn
        };

        // Handle removing all callbacks from this instance related to child observable.
        // Only all of the child instance's callbacks should be removed.
        const rmAll = () => {

            for (const entry of track.entries()) {

                const [ev, _set] = entry;

                // For each function, remove listener from observer
                [..._set].forEach(
                    fn => self.off(ev as any, fn as any)
                );

                // Clear the tracker
                track.set(ev, new Set());
            }
        }

        const afterOff: InternalListener = (_event) => {

            const [event, callback] = _event.data;

            if (event === ALL_CALLBACKS) {

                rmAll();
            }
            else {

                const _set = track.get(event);
                _set?.delete(callback as Func);
            }
        };

        this.#internalListener.addEventListener(InternalEvs.off, afterOff as Func);
        this.#internalListener.addEventListener(InternalEvs.clear, rmAll as Func);

        const on = (ev: string, fn: Func) => {

            return self.on(
                ev,
                trackListener(ev, fn)
            );
        }

        const once = (ev: string, fn: Func) => {

            return self.once(
                ev as never,
                trackListener(ev, fn)
            );
        }

        const off = (ev: string, fn: Func) => {

            if (
                ev ===  ALL_CALLBACKS
            ) {

                rmAll();

                return;
            }

            self.off(ev as never, fn);
        }

        const emit = (ev: string, data: unknown) => {

            return self.emit(
                ev as never,
                data as never
            );
        }

        const cleanup = () => {

            rmAll();
            self.#internalListener.removeEventListener(InternalEvs.off, afterOff as Func);
            self.#internalListener.removeEventListener(InternalEvs.clear, rmAll as Func);
        }

        definePrivateProps(component, {
            on,
            once,
            off,
            emit,
            cleanup
        });

        return component as ObserverEngine.Child<C, Shape>;
    }

    /**
     * Gets information about the event, whether it's a regex or not,
     * the event name, and the regex itself.
     */
    #eventInfo(event: string | RegExp | Events<Shape>) {

        const isRgx = (event as RegExp).constructor === RegExp;
        const eventName = event.toString() as Events<Shape>;

        return {
            isRgx,
            eventName,
            rgx: event as RegExp
        };
    }

    /**
     * Returns all event names that match the regex
     */
    #withRgxMatchKeys (rgx: RegExp) {

        return [...this.#listenerMap.keys()].filter(
            k => rgx.test(k as string)
        ) as Events<Shape>[];
    }

    /**
     * Returns all regexes that match the key
     */
    #withKeyMatchRgx (key: string) {

        return [...this.#rgxListenerMap.keys()].filter(
            s => rgxStrToRgx(s).test(key)
        ).flat();
    }

    /**
     * Returns all event names that match the regex
     */
    #matchStr (rgx: RegExp) {

        const events = this.#withRgxMatchKeys(rgx);

        return arrOfMatchingValues(
            events as any,
            this.#listenerMap
        );
    }

    /**
     * Returns all regexes that match the key
     */
    #matchRgx (str: string) {

        const events = this.#withKeyMatchRgx(str);

        return arrOfMatchingValues(
            events as any,
            this.#rgxListenerMap
        );
    }

    /**
     * Returns an event generator that will listen for all events
     *
     * @example
     *
     * const obs = new ObserverEngine();
     *
     * const onEvent = obs.on('*');
     * await onEvent.next(); // waits for next event
     * onEvent.emit('data'); // emits data to listeners
     *
     * onEvent.cleanup(); // stops listening for events
     */
    on (event: '*'): EventGenerator<ObserverEngine.RgxEmitData<Shape>, '*'>;

    /**
     * Listens for all events and executes the given callback
     *
     * @example
     *
     * const obs = new ObserverEngine();
     *
     * obs.on('*', (data) => {
     *     console.log(data);
     * });
     */
    on (event: '*', listener: ObserverEngine.EventCallback<ObserverEngine.RgxEmitData<Shape>>): ObserverEngine.Cleanup;

    /**
     * Returns an event generator that will listen for the specified event
     *
     * @example
     *
     * const obs = new ObserverEngine();
     *
     * const something = obs.on('something');
     * const data = await something.next(); // waits for next event
     * something.emit('special'); // emits data to listeners
     *
     * something.cleanup(); // stops listening for events
     */
    on <E extends Events<Shape>>(event: E): EventGenerator<Shape, E>;

    /**
     * Listens for the specified event and executes the given callback
     *
     * @example
     *
     * const obs = new ObserverEngine();
     *
     * obs.on('something', (data) => {
     *    console.log(data);
     * });
     */
    on <E extends Events<Shape>>(event: E, listener: ObserverEngine.EventCallback<Shape[E]>): ObserverEngine.Cleanup;

    /**
     * Returns an event generator that will listen for all events matching the regex
     *
     * @example
     *
     * const obs = new ObserverEngine();
     *
     * const onEvent = obs.on(/some/);
     * const { event, data } = await onEvent.next(); // waits for next event
     * onEvent.emit('something'); // emits data to listeners
     *
     * onEvent.cleanup(); // stops listening for events
     */
    on (event: RegExp): EventGenerator<Shape, RegExp>;

    /**
     * Listens for all events matching the regex and executes the given callback
     *
     * @example
     *
     * const obs = new ObserverEngine();
     *
     * obs.on(/some/, ({ event, data }) => {
     *     console.log(event, data);
     * });
     */
    on (event: RegExp, listener: ObserverEngine.EventCallback<ObserverEngine.RgxEmitData<Shape>>): ObserverEngine.Cleanup;

    /**
     * Used internally
     */
    on (event: unknown, listener?: Func, opts?: object): ObserverEngine.Cleanup | EventGenerator<any>

    /**
     * Listen for an event
     * @param event
     * @param listener
     */
    on (
        event: RegExp | Events<Shape> | '*',
        listener?: (
            ObserverEngine.EventCallback<Shape[Events<Shape>]> |
            ObserverEngine.EventCallback<ObserverEngine.RgxEmitData<Shape>>
        ),
        _opts?: { once: boolean }
    ) {

        if (!_opts?.once) {

            validateEvent('on', { event, listener } as never);
            validateListener('on', { event, listener } as never);
        }

        if (event === '*') {

            event = MATCH_EVERYTHING;
        }

        const { eventName, isRgx } = this.#eventInfo(
            event
        );

        const listenerMap = isRgx ? this.#rgxListenerMap : this.#listenerMap;

        if (listener === undefined) {

            return new EventGenerator(
                this,
                event as never
            ) as EventGenerator<any, any>;
        }

        this.#currentSpy({
            event,
            fn: _opts?.once ? 'once' : 'on',
            data: null,
            listener,
            context: this
        });

        const cbSet = listenerMap.get(eventName as never) || new Set([listener]);

        if (cbSet && !cbSet.has(listener as Func)) {
            cbSet.add(listener as Func);
        }

        if (!listenerMap.has(eventName as never)) {

            listenerMap.set(
                eventName as Events<Shape> & string,
                cbSet as Set<Func>
            );
        }

        this.#internalListener.dispatchEvent(
            new InternalEvent(InternalEvs.on, [event as string, listener])
        );

        return () => {

            this.#currentSpy({
                event,
                fn: 'cleanup',
                data: null,
                listener,
                context: this
            });

            cbSet!.delete(listener as Func);

            this.#internalListener.dispatchEvent(
                new InternalEvent(InternalEvs.off, [event as string, listener])
            );
        }
    }

    /**
     * Returns an event promise that resolves when
     * any event is emitted
     */
    once (event: '*'): EventPromise<ObserverEngine.RgxEmitData<Shape>>;

    /**
     * Executes a callback once when any event is
     * emitted
     */
    once (event: '*', listener: ObserverEngine.EventCallback<ObserverEngine.RgxEmitData<Shape>>): ObserverEngine.Cleanup;

    /**
     * Returns an event promise that resolves when
     * the specified event is emitted
     */
    once <E extends Events<Shape>>(event: E): EventPromise<Shape[E]>;

    /**
     * Executes a callback once when the specified
     * event is emitted
     */
    once <E extends Events<Shape>>(event: E, listener: ObserverEngine.EventCallback<Shape[E]>): ObserverEngine.Cleanup;

    /**
     * Returns an event promise that resolves when
     * any events matching the regex are emitted
     */
    once (event: RegExp): EventPromise<ObserverEngine.RgxEmitData<Shape>>;

    /**
     * Executes a callback once when any events
     * matching the regex are emitted
     */
    once (event: RegExp, listener: ObserverEngine.EventCallback<ObserverEngine.RgxEmitData<Shape>>): ObserverEngine.Cleanup;

    /**
     * Executes a callback once when the specified
     * event is emitted, or returns a promise that
     * resolves when the event is emitted
     */
    once (
        event: RegExp | string,
        listener?: (
            ObserverEngine.EventCallback<Shape[Events<Shape>]> |
            ObserverEngine.EventCallback<ObserverEngine.RgxEmitData<Shape>>
        )
    ) {

        validateEvent('once', { event, listener } as never);
        validateListener('once', { event, listener } as never);

        if (!listener) {

            const defer = new DeferredEvent<unknown>();

            const cleanup = this.once(
                event as never,
                ((data: unknown) => defer.resolve(data)) as never
            );

            defer.promise.cleanup = cleanup;

            return defer.promise;
        }

        const self = this;

        let cleanup: ObserverEngine.Cleanup;

        const runOnce = function (...args: unknown[]) {

            cleanup?.();
            (listener as Func).apply(self, args);
        }

        cleanup = this.on(
            event as never,
            runOnce,
            { once: true }
        ) as ObserverEngine.Cleanup;

        return cleanup;
    }

    /**
     * Stop listening for an event
     * @param event
     * @param listener
     */
    off (
        event: Events<Shape> | RegExp | '*',
        listener?: Function
    ) {

        validateEvent('off', { event, listener } as never);

        this.#currentSpy({
            event,
            fn: 'off',
            data: null,
            listener,
            context: this
        });

        if (event === ALL_CALLBACKS && !listener) {

            this.#listenerMap.clear();
            this.#rgxListenerMap.clear();

            this.#internalListener.dispatchEvent(
                new InternalEvent(InternalEvs.clear, [event as string, listener])
            );
            return;
        }

        const { eventName, isRgx, rgx } = this.#eventInfo(event);

        const matches: Events<Shape>[] = isRgx ?
            this.#withRgxMatchKeys(rgx) :
            [eventName as Events<Shape>]
        ;

        matches.forEach((_ev) => {

            const ev = _ev as Events<Shape>;

            this.#internalListener.dispatchEvent(
                new InternalEvent(InternalEvs.off, [ev as string, listener])
            );

            if (listener) {
                const fns = this.#listenerMap.get(ev);

                if (fns) {

                    fns.delete(listener as Func);
                    if (fns.size === 0) this.#listenerMap.delete(ev);
                }

                return;
            };

            this.#listenerMap.delete(ev);
        });

    }

    /** Emits an event */
    // emit (event: '*', data?: Shape[Events<Shape>]): void;
    // emit <E extends Events<Shape>>(event: E, data: Shape[E]): void;
    // emit (event: RegExp, data: Observable.RgxEmitData<Shape>): void;
    emit <E extends Events<Shape> | RegExp | '*'>(
        event: E,
        data?: E extends '*'
            ? Shape[Events<Shape>]
            : E extends Events<Shape>
                ? Shape[E]
                : unknown
    ) {

        validateEvent('emit', { event, data } as never);

        if (this.#emitValidator) {

            this.#emitValidator(
                event as Events<Shape>,
                data as Shape[Events<Shape>],
                this
            );
        }

        this.#currentSpy({
            event,
            fn: 'emit',
            data,
            listener: null,
            context: this
        });

        if (event === '*') {

            event = MATCH_EVERYTHING as E;
        }


        const { eventName, isRgx, rgx } = this.#eventInfo(event);

        if (!isRgx) {

            const cbs = this.#listenerMap.get(eventName);

            const rgxCbs = this.#matchRgx(eventName as string);
            if (cbs) cbs.forEach(
                (fn) => fn.apply(this, [data, { event, listener: fn }])
            );
            if (rgxCbs) rgxCbs.forEach(
                ({  func }) => func.apply(this, [{ data, event, listener: func }])
            );

            this.#internalListener.dispatchEvent(
                new InternalEvent(
                    InternalEvs.emit,
                    [
                        eventName as string,
                        data
                    ]
                )
            );

            return;
        }

        const cbs = this.#matchStr(rgx);

        if (cbs) cbs.forEach(
            ({ event, func }) => func.apply(this, [data, { event, listener: func }])
        );

        this.#withRgxMatchKeys(rgx).forEach(
            ev => {

                this.#internalListener.dispatchEvent(
                    new InternalEvent(InternalEvs.emit, [ev as string, data])
                );
            }
        )
    }
}
