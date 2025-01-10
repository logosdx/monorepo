import type { ObserverFactory } from './factory.ts';

import type { Events } from './types.ts';


export const ALL_CALLBACKS = '*';
export const MATCH_EVERYTHING = /.*/;

export class EventTrace extends Error {
    listener!: Function | null
    data: unknown | null
    func!: string
    event!: string
    stack!: string
}

export const traceStackFilterRgx = (
    new RegExp(`(${[
        'node_modules',
        'node:internal',
        '$spy',
        'makeEventTracer',
        'sendToSpy',
        'Function.spy',
        'Observable.Factory',
    ].join('|')})`)
);

type EventValidationOpts = {
    event: string | RegExp,
    listener: Function,
    data: unknown
}

export class EventError extends Error {
    event?: string | RegExp;
    listener?: Function
    data?: unknown
    constructor (
        message: string,
        opts?: EventValidationOpts
    ) {

        super(message);

        this.event = opts?.event!;
        this.listener = opts?.listener!;
        this.data = opts?.data;
    }
}

export class EventPromise<T> extends Promise<T> {

    cleanup?: () => void
    reject?: (err: Error | string) => void
}

export class DeferredEvent<T> {

    private _resolve!: Function;
    private _reject!: Function;
    private _promise: EventPromise<T>;

    constructor() {
        this._promise = new EventPromise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        this._promise.reject = this.reject.bind(this);
    }

    resolve(data: T) {
        this._resolve(data);
    }

    reject(err: Error | string) {
        this._reject(err);
    }

    get promise() {
        return this._promise;
    }
}

export class EventGenerator<S, E extends Events<S> | RegExp | '*' = Events<S>> {

    #observer: ObserverFactory<S>;
    #event: E | RegExp | '*';
    #defer: DeferredEvent<any>;
    #done: boolean = false;
    #listener: ObserverFactory.EventCallback<S> | null = null;

    #assertNotDestroyed = () => {

        if (this.#done === true) {
            throw new EventError(
                `Event generator for ${this.#event.toString()} has been destroyed`,
                {
                    event: this.#event as string,
                    listener: this.#listener!,
                    data: null
                }
            );
        }
    }

    destroy!: ObserverFactory.Cleanup

    next: () => Promise<
        E extends Events<S>
        ? S[E]
        : E extends RegExp
            ? ObserverFactory.RgxEmitData<S>
            : S[Events<S>]
    >;

    constructor(
        observer: ObserverFactory<S>,
        event: E | RegExp | '*'
    ) {

        this.#observer = observer;
        this.#event = event;

        this.#listener = (data: unknown) => {

            this.#defer.resolve(data);
            this.#defer = new DeferredEvent();
            this.#defer.promise.cleanup = this.destroy;
        }

        const cleanup = observer.on(
            event as never,
            this.#listener! as never
        );


        this.next = () => {

            this.#assertNotDestroyed();

            return this.#defer.promise
        };

        this.destroy = () => {

            cleanup();
            this.#done = true;
        }

        this.#defer = new DeferredEvent();
        this.#defer.promise.cleanup = this.destroy;
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

        this.#assertNotDestroyed();
        this.#observer.emit(this.#event, data);
    }
}

export const makeEventTracer = (
    event: string,
    caller: string,
    listenerOrData?: Function | unknown
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

export const rgxStrToRgx = (rgxStr: string) => {

    const split = rgxStr?.replace(/^\//, '').split('/');

    const flags = split.pop();
    const expr = split.join('/');

    return RegExp(expr, flags);
};

export const arrOfMatchingValues = (
    vals: string[],
    map: Map<any, Set<Function>>
) => {

    const listeners: ({ event: string, func: Function })[] = [];


    for (const key of vals) {
        for (const fn of map.get(key) || new Set()) {
            listeners.push({ event: key, func: fn });
        }
    }

    return listeners;
}


export enum InternalEvs {

    on = 'on',
    off = 'off',
    emit = 'emit',
    clear = 'clear',
}

export class InternalEvent extends Event {

    type: keyof typeof InternalEvs;
    data: [string, unknown];
    constructor (ev: keyof typeof InternalEvs, data: [string, any]) {

        super(ev as string);
        this.data = data;
        this.type = ev;
    }
}

export interface InternalListener {

    (e: InternalEvent): void
}

export const validateEvent = (fn: string, opts: EventValidationOpts) => {

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

export const validateListener = (
    fn: string,
    opts: EventValidationOpts
) => {

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
