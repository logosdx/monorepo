import { assert, definePrivateProps } from '@logos-ui/utils';

/**
 * Overrideable interface
 */
export interface ObservableEvents {}

/**
 * Extendible event prefixes
 */
export interface ObservableEventPrefix { }

type PrefixNames = keyof ObservableEventPrefix;

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

export type ObservedComponent<E = ObservableEvents> = {
    on: EventListener<E, Cleanup>,
    one: EventListener<E>,
    once: EventListener<E>,
    off: EventListener<E>,
    trigger: EventEmit<E>,
    emit: EventEmit<E>,
};

export type ObservableInstanceChild<C, E = ObservableEvents> = C & ObservedComponent<E> & Cleanup

export type ObservableInstance<T, U = ObservableEvents> = ObservedComponent<U> & {
    observe: Observable<T, U>['observe'],
    $_spy?: ObserverSpy<T, U>;
    $_ref?: String;
    $_observer: Observable<T, U>
}

type ObservableFunctionName = 'on' | 'one' | 'off' | 'trigger';

type OberverSpyOptions<E> = {
    event: keyof E | RegExp | '*',
    listener?: Function,
    data?: any,
};

type ObserverSpyEvent<C, E> = OberverSpyOptions<E> & {
    fn: ObservableFunctionName,
    context: Observable<C, E>
}

interface ObserverSpy<C, E> {
    (event: ObserverSpyEvent<C, E>): void
}

const sendToSpy = <U>(
    fn: string,
    context: any,
    {
        event,
        listener = null,
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
    listener: Function | null
    data: any
    func: string
    event: string
    stack: string
}

const traceStackFilterRgx = (
    new RegExp(`(${[
        'traceFn',
        'node_modules',
        '$_spy',
        'observable'
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

    tracer.func = event;
    tracer.event = caller;
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


export class Observable<
    Component,
    Shape = ObservableEvents,
    PrefixNames extends string = keyof ObservableEventPrefix
> {

    $_listenerMap: Map<Events<Shape>, Set<Function>> = new Map();
    $_rgxListenerMap: Map<string, Set<Function>> = new Map();
    $_target: any = null;
    $_spy?: ObserverSpy<Component, Shape>;
    $_ref?: String;

    $_debug() {

        const original = this.$_spy;

        const spy: ObserverSpy<Component, Shape> = (ev) => {

            const {
                event,
                fn,
                data,
                listener
            } = ev;

            makeEventTracer(
                event as any,
                fn,
                data || listener
            );

            original && original(ev);
        }

        this.$_spy = spy;
    }

    /**
     * Same as `observable.on`
     */
    listen: Observable<Component, Shape>['on'];

    /**
     * Same as `observable.one`
     */
    once: Observable<Component, Shape>['one'];

    /**
     * Same as `observable.trigger`
     */
    emit: Observable<Component, Shape>['trigger'];

    /**
     * Same as `observable.trigger`
     */
    send: Observable<Component, Shape>['trigger'];

    /**
     * Same as `observable.off`
     */
    unlisten: Observable<Component, Shape>['off'];

    /**
     * Same as `observable.off`
     */
    remove: Observable<Component, Shape>['off'];

    /**
     * Same as `observable.off`
     */
    rm: Observable<Component, Shape>['off'];

    constructor(target?: Component, options?: ObservableOptions<Component, Shape>) {

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
            $_debug: this.$_debug,
        });

        // Validate option if exists
        if (options) {

            assert(
                options.ref && typeof options.ref === 'string',
                'Observable options.ref must be a string',
                TypeError
            );

            assert(
                options.spy && typeof options.spy === 'function',
                'Observable options.spy must be a function',
                TypeError
            );

            options.ref && definePrivateProps(this, { $_ref: options.ref });
            options.spy && definePrivateProps(this, { $_spy: options.spy });
        }

        // Wrapper functions if you want to observe a target
        // Defined to make them non-enumerable
        if (target) {
            const _on = (ev: any, fn: any) => self.on(ev, fn);
            const _one = (ev: any, fn: any) => self.one(ev, fn);
            const _off = (ev: any, fn: any) => self.off(ev, fn);
            const _trigger = (ev: any, data: any) => self.trigger(ev, data);
            const _observe = (component: any, prefix?: PrefixNames) => self.observe(component, prefix);

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
                $_observer: self
            });

        }

        return this.$_target;
    }


    /**
     * Observes given component as an extension of this observable instance.
     * Optionally prefix for dispatching within it's own context, while still
     * being able to be triggered by the original instance's events.
     * @param component Component to wrap events around
     * @param prefix Prefix this component will dispatch and listen to
     *
     * @example
     *
     * const obs = new Observable();
     *
     * const modal = {};
     *
     * obs.observe(modal, 'modal');
     *
     * modal.on('open', () => {});
     *
     * obs.trigger('modal-open'); // opens modal
     * modal.trigger('open'); // calls the same event
     *
     * modal.cleanup(); // clears all event listeners
     */
    observe<C>(component: C, prefix?: PrefixNames) {

        const self = this;

        interface PrefixCallback {
            <E extends Events<Shape>>(event: E): Events<Shape>
        }

        let namedEvent: PrefixCallback = (ev) => `${prefix}-${ev as string}` as any;

        if (!prefix) {

            namedEvent = (ev) => ev;
        }

        // Simple tacking for simple cleanup for now
        // TODO: figure out a way to track parent `off` to avoid tracking
        const listenerTracker: Set<[string, Function]> = new Set();

        const trackListener = (event, fn) => {

            listenerTracker.add([event, fn]);

            return fn
        };

        definePrivateProps(component, {

            on: (ev: any, fn: any) => {

                return self.on(
                    namedEvent(ev),
                    trackListener(ev, fn)
                );
            },


            one: (ev: any, fn: any) => {

                return self.one(
                    namedEvent(ev),
                    trackListener(ev, fn)
                );
            },


            off: (ev: any, fn: any) => {

                const tracked = [...listenerTracker.values()];

                // Handle removing all callbacks from this instance related to child observable. Only all of the child instance's callbacks should be removed.
                if (ev === ALL_CALLBACKS) {

                    for (const entry of tracked) {

                        const [ev, listener] = entry as [Events<Shape>, EventCallback<Shape>];
                        listenerTracker.delete(entry);
                        self.off(namedEvent(ev), listener as any);
                    }
                }
                else {

                    const entry = tracked.find(([e, f]) => (
                        ev === e && fn === f
                    ));
                    listenerTracker.delete(entry);
                    self.off(namedEvent(ev), fn);
                }
            },


            trigger: (ev: any, data: any) => {

                return self.trigger(namedEvent(ev), data);
            },


            cleanup: () => {

                (component as any).off('*');
            }

        });

        const observed = component as ObservableInstanceChild<C>;

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
            : Function
    ): Cleanup {

        if (this.$_spy) {

            sendToSpy <Shape>('on', this, { event, listener });
        }

        const { eventName, isRgx } = this.$_eventInfo(event);

        const listenerMap = isRgx ? this.$_rgxListenerMap : this.$_listenerMap;

        const cbSet = listenerMap.get(eventName);

        if (cbSet && !cbSet.has(listener)) {
            cbSet.add(listener);
        }

        if (!cbSet) {

            listenerMap.set(eventName, new Set([listener]));
        }

        return {
            cleanup: () => {

                if (this.$_spy) {
                    sendToSpy <Shape>('clean', this, { event, listener });
                }

                cbSet.delete(listener);
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
            : Function
    ) {

        if (this.$_spy) {

            sendToSpy <Shape>('one', this, { event, listener });
        }

        const self = this;

        const runOnce: any = function (e, cb) {

            self.off(event, runOnce);
            listener.apply(self, [e, cb]);
        }

        return self.on(event, runOnce);
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
            return;
        }

        const { eventName, isRgx, rgx } = this.$_eventInfo(event);

        const matches: Events<Shape>[] = isRgx ?
            this.$_withRgxMatchKeys(rgx) :
            [eventName]
        ;

        matches.forEach((_ev) => {

            const ev = _ev as Events<Shape>;

            if (listener) {
                const fns = this.$_listenerMap.get(ev);

                if (fns) {

                    fns.delete(listener);
                    if (fns.size === 0) this.$_listenerMap.delete(ev);
                }

                return;
            };

            this.$_listenerMap.delete(ev);
        })

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

            return;
        }

        const cbs = this.$_matchStr(rgx);

        if (cbs) cbs.forEach(fn => fn.apply(this, [data]))
    }
}
