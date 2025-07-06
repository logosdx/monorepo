import type { ObserverEngine } from './engine.ts';
import type { Events } from './types.ts';


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
        'Observable.Engine',
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

export const isEventError = (err: unknown): err is EventError => {
    return err instanceof EventError;
}

export type EventData<S, E extends Events<S> | RegExp = Events<S>> = (
    E extends Events<S>
    ? S[E]
    : E extends RegExp
        ? ObserverEngine.RgxEmitData<S>
        : S[Events<S>]
);


export class EventPromise<T> extends Promise<T> {

    cleanup?: () => void
    reject?: (err: Error | string) => void
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
