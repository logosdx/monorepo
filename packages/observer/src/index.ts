import { Func, assert, definePrivateProps } from '@logos-ui/utils';

type Events<Shape> = keyof Shape;

interface EventCallback<Shape> {
    (data: Shape): void
}

const ALL_CALLBACKS = '*'

export type RgxEmitData<Shape> = {
    event: Events<Shape>,
    data: any
}

export type EventCbData<E, Shape> = (
    E extends Events<Shape>
    ? Shape[E]
    : E extends RegExp
        ? RgxEmitData<Shape>
        : never
)

export interface EventListener<
    Shape,
    Returns = void
> {
    <E extends Events<Shape> | RegExp>(
        event: E,
        fn: EventCallback<EventCbData<E, Shape>>
    ): Returns
}

export interface EventEmit<Shape> {
    <E extends Events<Shape> | RegExp>(
        event: E,
        data: E extends Events<Shape>
        ? Shape[E][]
        : any
    ): void
}

export interface RemoveEventListener<Shape> {
    <E extends keyof Shape | RegExp>(
        event: E,
        listener?: Function
    ): void
}


export type Cleanup = () => void

export type ObservedComponent<E> = {
    on: EventListener<E, Cleanup>,
    one: EventListener<E>,
    once: EventListener<E>,
    off: EventListener<E>,
    trigger: EventEmit<E>,
    emit: EventEmit<E>,
};

export type ObservableChild<C, E> = C & ObservedComponent<E> & {
    cleanup: Cleanup
}

export type ObservableInstance<T, U> = ObservedComponent<U> & {
    observe: ObserverFactory<T, U>['observe'],
    $_spy?: ObserverSpy<T, U>;
    $_ref?: String;
    $_observer: ObserverFactory<T, U>
}

export type ObservableFunctionName = 'on' | 'once' | 'off' | 'emit';

export type OberverSpyOptions<E> = {
    event: keyof E | RegExp | '*',
    listener?: Function,
    data?: any,
};

export type ObserverSpyAction<C, E> = OberverSpyOptions<E> & {
    fn: ObservableFunctionName,
    context: ObserverFactory<C, E>
}

export interface ObserverSpy<C, E> {
    (action: ObserverSpyAction<C, E>): void
}

const sendToSpy = <U>(
    fn: string,
    context: any,
    {
        event,
        listener = undefined,
        data = null
    }: OberverSpyOptions<U>
) => {

    if (context.$_spy) {

        context.$_spy.call(context.$_spy, {
            fn,
            event,
            listener,
            context,
            data
        });
    }
}

export type ObservableOptions<T, U> = {
    ref?: string,
    spy?: ObserverSpy<T, U>
};

class EventTrace extends Error {
    listener!: Function | null
    data: any
    func!: string
    event!: string
    stack!: string
}

const traceStackFilterRgx = (
    new RegExp(`(${[
        'node_modules',
        'node:internal',
        '$_spy',
        'makeEventTracer',
        'sendToSpy',
        'Function.spy',
        'ObserverFactory',
    ].join('|')})`)
);

class EventError extends Error {
    event?: string | RegExp;
    listener?: Function
    data?: any
    constructor (
        message: string,
        opts?: {
            event: string,
            listener: Function,
            data: any
        }
    ) {

        super(message);

        this.event = opts?.event;
        this.listener = opts?.listener;
        this.data = opts?.data;
    }
}

class EventPromise<T> extends Promise<T> {

    cleanup?: () => void
}

class DeferredEvent<T> {

    private _resolve!: Function;
    private _reject!: Function;
    private _promise: EventPromise<T>;

    constructor() {
        this._promise = new EventPromise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    resolve(data: T) {
        this._resolve(data);
    }

    reject(err: any) {
        this._reject(err);
    }

    get promise() {
        return this._promise;
    }
}

class EventGenerator<S, E extends Events<S> | RegExp | '*' = Events<S>> {

    #observer: ObserverFactory<any, any>;
    #event: E | RegExp | '*';
    #defer: DeferredEvent<any>;
    #done: boolean = false;
    #listener: EventCallback<S> | null = null;

    destroy!: Cleanup

    next: () => Promise<
        E extends Events<S>
        ? S[E]
        : E extends RegExp
            ? RgxEmitData<S>
            : S[Events<S>]
    >;

    constructor(
        observer: ObserverFactory<any, any>,
        event: E | RegExp | '*'
    ) {

        this.#observer = observer;
        this.#event = event;
        this.#defer = new DeferredEvent();
        this.#listener = (data: any) => {

            this.#defer.resolve(data);
            this.#defer = new DeferredEvent();
        }

        const cleanup = observer.on(
            event as never,
            this.#listener! as never
        );

        this.next = () => this.#defer.promise;

        this.destroy = () => {

            cleanup();

            this.#defer.reject(
                new EventError(
                    `Event generator for ${this.#event.toString()} has been destroyed`,
                    {
                        event: this.#event as string,
                        listener: this.#listener!,
                        data: null
                    }
                )

            );
            this.#done = true;
        }
    }

    get done() {
        return this.#done;
    }

    emit(
        data?: (
            E extends Events<S>
            ? S[E]
            : S[Events<S>]
        )
    ) {

        if (this.#done) return;

        this.#observer.emit(this.#event, data);
    }
}

export const makeEventTracer = (
    event: string,
    caller: any,
    listenerOrData?: Function | any
) => {

    const err = new Error();

    const split = err.stack!.split('\n');

    split.shift();

    const filtered = split.filter(
        line => !traceStackFilterRgx.test(line)
    );

    const message = `EventStack (${event} ${caller.toString()}):`;

    filtered.unshift(message);
    const stack = filtered.join('\n');

    const tracer = new EventTrace(message);

    tracer.name = message;

    tracer.func = caller;
    tracer.event = event;
    tracer.stack = stack;

    tracer.listener = null;
    tracer.data = null;

    if (typeof listenerOrData === 'function') {

        tracer.listener = listenerOrData;
    }
    else {

        tracer.data = listenerOrData;
    }

    return tracer;
};

const rgxStrToRgx = (rgxStr: string) => {

    const split = rgxStr?.replace(/^\//, '').split('/');

    const flags = split.pop();
    const expr = split.join('/');

    return RegExp(expr, flags);
};

const arrOfMatchingValues = (
    vals: string[],
    map: Map<any, Set<Function>>
) => {

    const listeners: Function[] = [];


    for (const key of vals) {
        for (const fn of map.get(key) || new Set()) {
            listeners.push(fn);
        }
    }

    return listeners;
}


enum InternalEvs {

    on = 'on',
    off = 'off',
    emit = 'emit',
    clear = 'clear',
}

class InternalEvent extends Event {

    type: keyof typeof InternalEvs;
    data: [string, any];
    constructor (ev: keyof typeof InternalEvs, data: [string, any]) {

        super(ev as string);
        this.data = data;
        this.type = ev;
    }
}

interface InternalListener {

    (e: InternalEvent): void
}

const validateEvent = (fn: string, opts: any) => {

    if (
        opts.event === undefined ||
        typeof opts.event !== 'string' &&
        opts.event instanceof RegExp === false
    ) {

        throw new EventError(
            `observer.${fn}: Event must be a string or RegExp`,
            opts
        );
    }
};

const validateListener = (fn: string, opts: any) => {

    if (
        opts.listener !== undefined &&
        typeof opts.listener !== 'function'
    ) {

        throw new EventError(
            `observer.${fn}: Listener must be a function`,
            opts
        );
    }
}

export class ObserverFactory<
    Component,
    Shape = any
> {

    #_listenerMap: Map<Events<Shape>, Set<Func>> = new Map();
    #_rgxListenerMap: Map<string, Set<Func>> = new Map();
    #_target: any = null;
    #_ref?: String;
    #_internalListener = new EventTarget();

    private $_spy?: ObserverSpy<Component, Shape>;

    /**
     * Returns facts about the the internal state of the observable instance.
     */
    $_facts() {


        const listenKeys = [...this.#_listenerMap.keys()];
        const rgxKeys = [...this.#_rgxListenerMap.keys()];
        const listenerCounts = Object.fromEntries([
            listenKeys.map(
                k => [k, this.#_listenerMap.get(k)?.size]
            ),
            rgxKeys.map(
                k => [k, this.#_rgxListenerMap.get(k)?.size]
            )
        ].flat());

        return {
            listeners: listenKeys,
            rgxListeners: rgxKeys,
            listenerCounts,
            hasSpy: !!this.$_spy
        }
    }

	/**
	 * The internals themselves.
     *
	 * ! CAUTION: Do no meddle with this because. It is not meant to be used directly.
     * ! This is only exposed for debugging purposes.
	 */
    $_internals() {

        return {
            listenerMap: this.#_listenerMap,
            rgxListenerMap: this.#_rgxListenerMap,
            internalListener: this.#_internalListener,
            target: this.#_target,
            ref: this.#_ref,
            spy: this.$_spy
        }
    }

    #_spy(...args: Parameters<ObserverSpy<Component, Shape>>) {

        if (this.$_spy) {

            this.$_spy(...args);
        }
    }

    debug(on = true) {

        const original = this.#_spy;

        const spy: ObserverSpy<Component, Shape> = (ev) => {

            const {
                event,
                fn,
                data,
                listener
            } = ev;

            console.log(
                makeEventTracer(
                    event as any,
                    fn,
                    data || listener
                )
            );

            original && original(ev);
        }

        let config = { $_spy: original };

        if (on) {

            config = { $_spy: spy };
        }

        definePrivateProps(this, config, true);
    }

    /**
     * Same as `observable.on`
     */
    listen!: ObserverFactory<Component, Shape>['on'];

    /**
     * Same as `observable.one`
     */
    one!: ObserverFactory<Component, Shape>['once'];

    /**
     * Same as `observable.trigger`
     */
    trigger!: ObserverFactory<Component, Shape>['emit'];

    /**
     * Same as `observable.trigger`
     */
    send!: ObserverFactory<Component, Shape>['emit'];

    /**
     * Same as `observable.off`
     */
    unlisten!: ObserverFactory<Component, Shape>['off'];

    /**
     * Same as `observable.off`
     */
    remove!: ObserverFactory<Component, Shape>['off'];

    /**
     * Same as `observable.off`
     */
    rm!: ObserverFactory<Component, Shape>['off'];

    constructor(target?: Component | null, options?: ObservableOptions<Component, Shape>) {

        const self = this;
        this.#_target = target || this;

        // Make these functions non-enumerable
        definePrivateProps(this, {
            on: this.on,
            listen: this.on,
            one: this.once,
            once: this.once,
            off: this.off,
            remove: this.off,
            rm: this.off,
            unlisten: this.off,
            trigger: this.emit,
            emit: this.emit,
            send: this.emit,
            observe: this.observe,
            debug: this.debug,
            $_facts: this.$_facts,
            $_internals: this.$_internals
        });

        // Validate option if exists
        if (options) {

            assert(
                !options.ref || typeof options.ref === 'string',
                'Observable options.ref must be a string',
                TypeError
            );

            assert(
                !options.spy || typeof options.spy === 'function',
                'Observable options.spy must be a function',
                TypeError
            );

            options.ref && definePrivateProps(this, { $_ref: options.ref });
            options.spy && definePrivateProps(this, { $_spy: options.spy }, true);
        }

        // Wrapper functions if you want to observe a target
        // Defined to make them non-enumerable
        if (target) {
            const _on = (ev: any, fn: any) => self.on(ev, fn);
            const _once = (ev: any, fn: any) => self.once(ev, fn);
            const _off = (ev: any, fn: any) => self.off(ev, fn);
            const _emit = (ev: any, data: any) => self.emit(ev, data);
            const _observe = (component: any) => self.observe(component);
            const _debug = (on = true) => self.debug(on)

            definePrivateProps(target, {
                on: _on,
                listen: _on,
                one: _once,
                once: _once,
                off: _off,
                remove: _off,
                rm: _off,
                unlisten: _off,
                trigger: _emit,
                emit: _emit,
                send: _emit,
                observe: _observe,
                debug: _debug,
                $_observer: self
            });

        }

        return this.#_target;
    }


    /**
     * Observes given component as an extension of this observable instance.
     * @param component Component to wrap events around
     *
     * @example
     *
     * const obs = new ObserverFactory();
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
                _set?.delete(callback);
            }
        };

        this.#_internalListener.addEventListener(InternalEvs.off, afterOff as Func);
        this.#_internalListener.addEventListener(InternalEvs.clear, rmAll as Func);

        definePrivateProps(component, {

            on: (ev: any, fn: any) => {

                return self.on(
                    ev,
                    trackListener(ev, fn) as any
                );
            },


            one: (ev: any, fn: any) => {

                return self.once(
                    ev,
                    trackListener(ev, fn) as any
                );
            },


            off: (event: string, fn: Func) => {

                if (event === ALL_CALLBACKS) {

                    rmAll();
                }
                else {

                    self.off(
                        event as any,
                        fn as any
                    );
                }
            },


            trigger: (ev: any, data: any) => {

                return self.emit(ev, data);
            },


            cleanup: () => {

                (component as any).off('*');
            }
        });

        const observed = component as ObservableChild<C, Shape>;

        definePrivateProps(observed, {
            listen: observed.on,
            once: observed.one,
            remove: observed.off,
            rm: observed.off,
            unlisten: observed.off,
            emit: observed.trigger,
            send: observed.trigger,
        });

        return observed;
    }

    #_eventInfo(event: string | RegExp | Events<Shape>) {

        const isRgx = (event as RegExp).constructor === RegExp;
        const eventName = event.toString() as any;

        return {
            isRgx,
            eventName,
            rgx: event as RegExp
        };
    }

    #_withRgxMatchKeys (rgx: RegExp) {

        return [...this.#_listenerMap.keys()].filter(
            k => rgx.test(k as string)
        ) as Events<Shape>[];
    }

    #_withKeyMatchRgx (key: string) {

        return [...this.#_rgxListenerMap.keys()].filter(
            s => rgxStrToRgx(s).test(key)
        ).flat();
    }

    #_matchStr (rgx: RegExp) {

        const events = this.#_withRgxMatchKeys(rgx);

        return arrOfMatchingValues(
            events as any,
            this.#_listenerMap
        );
    }


    #_matchRgx (str: string) {

        const events = this.#_withKeyMatchRgx(str);

        return arrOfMatchingValues(
            events as any,
            this.#_rgxListenerMap
        );
    }

    /**
     * Returns an event generator that will listen for all events
     */
    on (event: '*'): EventGenerator<Shape, '*'>;

    /**
     * Listens for all events and executes the given callback
     */
    on (event: '*', listener: EventCallback<Shape[Events<Shape>]>): Cleanup;

    /**
     * Returns an event generator that will listen for the specified event
     */
    on <E extends Events<Shape>>(event: E): EventGenerator<Shape, E>;

    /**
     * Listens for the specified event and executes the given callback
     */
    on <E extends Events<Shape>>(event: E, listener: EventCallback<Shape[E]>): Cleanup;

    /**
     * Returns an event generator that will listen for all events matching the regex
     */
    on (event: RegExp): EventGenerator<Shape, RegExp>;

    /**
     * Listens for all events matching the regex and executes the given callback
     */
    on (event: RegExp, listener: EventCallback<RgxEmitData<Shape>>): Cleanup;

    /**
     * Used internally
     */
    on (event: any, listener?: Func, opts?: object): Cleanup | EventGenerator<any>

    /**
     * Listen for an event
     * @param event
     * @param listener
     */
    on (
        event: RegExp | Events<Shape> | '*',
        listener?: Func,
        _opts?: { once: boolean }
    ) {

        if (!_opts?.once) {

            validateEvent('on', { event, listener });
            validateListener('on', { event, listener });
        }

        const { eventName, isRgx } = this.#_eventInfo(
            event as string | RegExp
        );

        const listenerMap = isRgx ? this.#_rgxListenerMap : this.#_listenerMap;

        if (listener === undefined) {

            return new EventGenerator(
                this,
                event as never
            ) as EventGenerator<any, any>;
        }

        sendToSpy <Shape>(
            _opts?.once ? 'once' : 'on',
            this,
            {
                event,
                listener
            }
        );

        const cbSet = listenerMap.get(eventName) || new Set([listener]);

        if (cbSet && !cbSet.has(listener)) {
            cbSet.add(listener);
        }

        if (!listenerMap.has(eventName)) {

            listenerMap.set(eventName, cbSet);
        }

        this.#_internalListener.dispatchEvent(
            new InternalEvent(InternalEvs.on, [event as string, listener])
        );

        return () => {

            sendToSpy <Shape>('clean', this, { event, listener });

            cbSet!.delete(listener);

            this.#_internalListener.dispatchEvent(
                new InternalEvent(InternalEvs.off, [event as string, listener])
            );
        }
    }

    /**
     * Returns an event promise that resolves when
     * any event is emitted
     */
    once (event: '*'): EventPromise<Shape[Events<Shape>]>;

    /**
     * Executes a callback once when any event is
     * emitted
     */
    once (event: '*', listener: EventCallback<Shape[Events<Shape>]>): Cleanup;

    /**
     * Returns an event promise that resolves when
     * the specified event is emitted
     */
    once <E extends Events<Shape>>(event: E): EventPromise<Shape[E]>;

    /**
     * Executes a callback once when the specified
     * event is emitted
     */
    once <E extends Events<Shape>>(event: E, listener: EventCallback<Shape[E]>): Cleanup;

    /**
     * Returns an event promise that resolves when
     * any events matching the regex are emitted
     */
    once (event: RegExp): EventPromise<RgxEmitData<Shape>>;

    /**
     * Executes a callback once when any events
     * matching the regex are emitted
     */
    once (event: RegExp, listener: EventCallback<RgxEmitData<Shape>>): Cleanup;

    /**
     * Executes a callback once when the specified
     * event is emitted, or returns a promise that
     * resolves when the event is emitted
     */
    once (
        event: RegExp | string,
        listener?: Func
    ) {

        validateEvent('once', { event, listener });
        validateListener('once', { event, listener });

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

        let cleanup: Cleanup;

        const runOnce: any = function (...args: any[]) {

            cleanup?.();
            (listener as Func).apply(self, args);
        }

        cleanup = this.on(
            event as never,
            runOnce,
            { once: true }
        ) as Cleanup;

        return cleanup;
    }

    /**
     * Stop listening for an event
     * @param event
     * @param listener
     */
    off <E extends Events<Shape> | RegExp | '*'>(
        event: E,
        listener?: E extends Events<Shape>
            ? EventCallback<Shape[E]>
            : Function
    ) {

        validateEvent('off', { event, listener });

        sendToSpy <Shape>('off', this, { event, listener });

        if (event === ALL_CALLBACKS && !listener) {

            this.#_listenerMap.clear();
            this.#_rgxListenerMap.clear();

            this.#_internalListener.dispatchEvent(
                new InternalEvent(InternalEvs.clear, [event as string, listener])
            );
            return;
        }

        const { eventName, isRgx, rgx } = this.#_eventInfo(event);

        const matches: Events<Shape>[] = isRgx ?
            this.#_withRgxMatchKeys(rgx) :
            [eventName]
        ;

        matches.forEach((_ev) => {

            const ev = _ev as Events<Shape>;

            this.#_internalListener.dispatchEvent(
                new InternalEvent(InternalEvs.off, [ev as string, listener])
            );

            if (listener) {
                const fns = this.#_listenerMap.get(ev);

                if (fns) {

                    fns.delete(listener as Func);
                    if (fns.size === 0) this.#_listenerMap.delete(ev);
                }

                return;
            };

            this.#_listenerMap.delete(ev);
        });

    }

    /**
     * Emits an event
     * @param event
     * @param args
     */
    emit<E extends Events<Shape> | RegExp | '*'>(
        event: E,
        data?: E extends Events<Shape> ? Shape[E] : Shape[Events<Shape>]
    ) {

        validateEvent('emit', { event, data });

        sendToSpy <Shape>('emit', this, { event, data });

        const { eventName, isRgx, rgx } = this.#_eventInfo(event);

        if (!isRgx) {

            const cbs = this.#_listenerMap.get(eventName);

            const rgxCbs = this.#_matchRgx(eventName);
            if (cbs) cbs.forEach(fn => fn.apply(this, [data]))
            if (rgxCbs) rgxCbs.forEach(fn => fn.apply(this, [data]))

            this.#_internalListener.dispatchEvent(
                new InternalEvent(InternalEvs.emit, [eventName, data])
            );

            return;
        }

        const cbs = this.#_matchStr(rgx);

        if (cbs) cbs.forEach(fn => fn.apply(this, [data]))

        this.#_withRgxMatchKeys(rgx).forEach(
            ev => {

                this.#_internalListener.dispatchEvent(
                    new InternalEvent(InternalEvs.emit, [ev as string, data])
                );
            }
        )
    }
}
