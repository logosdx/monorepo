import { Func, assert, definePrivateProps } from '@logos-ui/utils';

type Events<Shape> = keyof Shape;

interface EventCallback<Shape> {
    (data: Shape): void
}

const ALL_CALLBACKS = '*'

type RgxEmitData<Shape> = {
    event: Events<Shape>,
    data: any
}

type EventCbData<E, Shape> = (
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


type Cleanup = {
    cleanup: () => void
}

export type ObservedComponent<E> = {
    on: EventListener<E, Cleanup>,
    one: EventListener<E>,
    once: EventListener<E>,
    off: EventListener<E>,
    trigger: EventEmit<E>,
    emit: EventEmit<E>,
};

export type ObservableChild<C, E> = C & ObservedComponent<E> & Cleanup

export type ObservableInstance<T, U> = ObservedComponent<U> & {
    observe: ObserverFactory<T, U>['observe'],
    $_spy?: ObserverSpy<T, U>;
    $_ref?: String;
    $_observer: ObserverFactory<T, U>
}

type ObservableFunctionName = 'on' | 'one' | 'off' | 'trigger';

type OberverSpyOptions<E> = {
    event: keyof E | RegExp | '*',
    listener?: Function,
    data?: any,
};

type ObserverSpyAction<C, E> = OberverSpyOptions<E> & {
    fn: ObservableFunctionName,
    context: ObserverFactory<C, E>
}

interface ObserverSpy<C, E> {
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
    trigger = 'trigger',
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


export class ObserverFactory<
    Component,
    Shape = any
> {

    private $_listenerMap: Map<Events<Shape>, Set<Func>> = new Map();
    private $_rgxListenerMap: Map<string, Set<Func>> = new Map();
    private $_target: any = null;

    private $_spy?: ObserverSpy<Component, Shape>;
    private $_ref?: String;

    private $_internalListener!: EventTarget;

    debug(on = true) {

        const original = this.$_spy;

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
    once!: ObserverFactory<Component, Shape>['one'];

    /**
     * Same as `observable.trigger`
     */
    emit!: ObserverFactory<Component, Shape>['trigger'];

    /**
     * Same as `observable.trigger`
     */
    send!: ObserverFactory<Component, Shape>['trigger'];

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
        this.$_target = target || this;

        // Make these functions non-enumerable
        definePrivateProps(this, {
            on: this.on,
            listen: this.on,
            one: this.one,
            once: this.one,
            off: this.off,
            remove: this.off,
            rm: this.off,
            unlisten: this.off,
            trigger: this.trigger,
            emit: this.trigger,
            send: this.trigger,
            observe: this.observe,
            $_listenerMap: this.$_listenerMap,
            $_rgxListenerMap: this.$_rgxListenerMap,
            $_target: this.$_target,
            $_internalListener: new EventTarget(),
            debug: this.debug,
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
            const _one = (ev: any, fn: any) => self.one(ev, fn);
            const _off = (ev: any, fn: any) => self.off(ev, fn);
            const _trigger = (ev: any, data: any) => self.trigger(ev, data);
            const _observe = (component: any) => self.observe(component);
            const _debug = (on = true) => self.debug(on)

            definePrivateProps(target, {
                on: _on,
                listen: _on,
                one: _one,
                once: _one,
                off: _off,
                remove: _off,
                rm: _off,
                unlisten: _off,
                trigger: _trigger,
                emit: _trigger,
                send: _trigger,
                observe: _observe,
                debug: _debug,
                $_observer: self
            });

        }

        return this.$_target;
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

        this.$_internalListener.addEventListener(InternalEvs.off, afterOff as Func);
        this.$_internalListener.addEventListener(InternalEvs.clear, rmAll as Func);

        definePrivateProps(component, {

            on: (ev: any, fn: any) => {

                return self.on(
                    ev,
                    trackListener(ev, fn) as any
                );
            },


            one: (ev: any, fn: any) => {

                return self.one(
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

                return self.trigger(ev, data);
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

    private $_eventInfo(event:  Events<Shape> | RegExp | '*') {

        const isRgx = (event as RegExp).constructor === RegExp;
        const eventName = event.toString() as any;

        return {
            isRgx,
            eventName,
            rgx: event as RegExp
        };
    }

    private $_withRgxMatchKeys (rgx: RegExp) {

        return [...this.$_listenerMap.keys()].filter(
            k => rgx.test(k as string)
        ) as Events<Shape>[];
    }

    private $_withKeyMatchRgx (key: string) {

        return [...this.$_rgxListenerMap.keys()].filter(
            s => rgxStrToRgx(s).test(key)
        ).flat();
    }

    private $_matchStr (rgx: RegExp) {

        const events = this.$_withRgxMatchKeys(rgx);

        return arrOfMatchingValues(
            events as any,
            this.$_listenerMap
        );
    }


    private $_matchRgx (str: string) {

        const events = this.$_withKeyMatchRgx(str);

        return arrOfMatchingValues(
            events as any,
            this.$_rgxListenerMap
        );
    }

    /**
     * Listen for an event
     * @param event
     * @param listener
     * @returns {Cleanup}
     */
    on<E extends Events<Shape> | RegExp>(
        event: E | '*',
        listener: E extends Events<Shape>
            ? EventCallback<Shape[E]>
            : Func
    ): Cleanup {

        if (this.$_spy) {

            sendToSpy <Shape>('on', this, { event, listener });
        }

        const { eventName, isRgx } = this.$_eventInfo(event);

        const listenerMap = isRgx ? this.$_rgxListenerMap : this.$_listenerMap;

        const cbSet = listenerMap.get(eventName) || new Set([listener]);

        if (cbSet && !cbSet.has(listener)) {
            cbSet.add(listener);
        }

        if (!listenerMap.has(eventName)) {

            listenerMap.set(eventName, cbSet);
        }

        this.$_internalListener.dispatchEvent(
            new InternalEvent(InternalEvs.on, [event as string, listener])
        );

        return {
            cleanup: () => {

                if (this.$_spy) {
                    sendToSpy <Shape>('clean', this, { event, listener });
                }

                cbSet!.delete(listener);

                this.$_internalListener.dispatchEvent(
                    new InternalEvent(InternalEvs.off, [event as string, listener])
                );
            }
        };
    }

    /**
     * Listen for an event once
     * @param event
     * @param listener
     */
    one <E extends Events<Shape> | RegExp>(
        event: E | '*',
        listener: E extends Events<Shape>
            ? EventCallback<Shape[E]>
            : Func
    ) {

        if (this.$_spy) {

            sendToSpy <Shape>('one', this, { event, listener });
        }

        const self = this;

        let listenedOn: ReturnType<typeof self.on>;

        const runOnce: any = function (e: E, cb: Func | EventCallback<E>) {

            listenedOn.cleanup();
            (listener as Func).apply(self, [e, cb]);
        }

        listenedOn = self.on(event, runOnce);

        return listenedOn;
    }

    /**
     * Stop listening for an event
     * @param event
     * @param listener
     */
    off <E extends Events<Shape> | RegExp>(
        event: E | '*',
        listener?: E extends Events<Shape>
            ? EventCallback<Shape[E]>
            : Function
    ) {

        if (this.$_spy) {

            sendToSpy <Shape>('off', this, { event, listener });
        }

        if (event === ALL_CALLBACKS && !listener) {

            this.$_listenerMap.clear();
            this.$_rgxListenerMap.clear();

            this.$_internalListener.dispatchEvent(
                new InternalEvent(InternalEvs.clear, [event as string, listener])
            );
            return;
        }

        const { eventName, isRgx, rgx } = this.$_eventInfo(event);

        const matches: Events<Shape>[] = isRgx ?
            this.$_withRgxMatchKeys(rgx) :
            [eventName]
        ;

        matches.forEach((_ev) => {

            const ev = _ev as Events<Shape>;

            this.$_internalListener.dispatchEvent(
                new InternalEvent(InternalEvs.off, [ev as string, listener])
            );

            if (listener) {
                const fns = this.$_listenerMap.get(ev);

                if (fns) {

                    fns.delete(listener as Func);
                    if (fns.size === 0) this.$_listenerMap.delete(ev);
                }

                return;
            };

            this.$_listenerMap.delete(ev);
        });

    }

    /**
     * Emits an event
     * @param event
     * @param args
     */
    trigger<E extends Events<Shape> | RegExp>(
        event: E | '*',
        data?: E extends Events<Shape> ? Shape[E] : Shape[Events<Shape>]
    ) {

        if (this.$_spy) {

            sendToSpy <Shape>('trigger', this, { event, data });
        }

        const { eventName, isRgx, rgx } = this.$_eventInfo(event);

        if (!isRgx) {

            const cbs = this.$_listenerMap.get(eventName);

            const rgxCbs = this.$_matchRgx(eventName);
            if (cbs) cbs.forEach(fn => fn.apply(this, [data]))
            if (rgxCbs) rgxCbs.forEach(fn => fn.apply(this, [data]))

            this.$_internalListener.dispatchEvent(
                new InternalEvent(InternalEvs.trigger, [eventName, data])
            );

            return;
        }

        const cbs = this.$_matchStr(rgx);

        if (cbs) cbs.forEach(fn => fn.apply(this, [data]))

        this.$_withRgxMatchKeys(rgx).forEach(
            ev => {

                this.$_internalListener.dispatchEvent(
                    new InternalEvent(InternalEvs.trigger, [ev as string, data])
                );
            }
        )
    }
}
