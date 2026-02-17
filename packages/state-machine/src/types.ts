// --- Event Data Extraction ---

export type EventData<Events, E extends keyof Events> =
    Events[E] extends void ? undefined : Events[E];


// --- Transition Definitions ---

export interface TransitionAction<Context, Data = any> {
    (context: Context, data: Data): Context
}

export interface TransitionGuard<Context, Data = any> {
    (context: Context, data: Data): boolean
}

export type TransitionTarget<Context, Data = any> = string | {
    target: string
    action?: TransitionAction<Context, Data>
    guard?: TransitionGuard<Context, Data>
};


// --- Invoke ---

export type InvokeConfig<Context> = {
    src: (context: Context) => Promise<any>
    onDone: TransitionTarget<Context>
    onError: TransitionTarget<Context>
};


// --- State Config ---

export type StateConfig<Context, Events extends Record<string, any>> = {
    on?: { [E in keyof Events]?: TransitionTarget<Context, Events[E]> }
    invoke?: InvokeConfig<Context>
    final?: boolean
};


// --- Machine Config ---

export type MachineConfig<
    Context,
    Events extends Record<string, any>,
    States extends string = string
> = {
    initial: States
    context: Context
    transitions: Record<States, StateConfig<Context, Events>>
    debug?: boolean
};


// --- Machine Options ---

export type MachineOptions = {
    persistence?: {
        key: string
        adapter: StorageAdapter
    }
};


// --- Storage Adapter ---

export type StorageAdapter = {
    load: (key: string) => Promise<{ state: string, context: any } | null>
    save: (key: string, snapshot: { state: string, context: any }) => Promise<void>
};


// --- Payloads ---

export type TransitionPayload<Context> = {
    from: string
    to: string
    event: string
    context: Context
    data?: any
};

export type RejectedPayload = {
    state: string
    event: string
    data?: any
    reason: 'no_transition' | 'guard_failed'
};


// --- Internal Observer Shape ---

export type MachineObserverShape<Context> = {
    '*': TransitionPayload<Context>
    '$rejected': RejectedPayload
    '$invoke.done': { state: string, result: any }
    '$invoke.error': { state: string, error: any }
    '$invoke.cancelled': { state: string }
    [state: string]: any
};


// --- Send signature ---

export type Send<Events extends Record<string, any>> = {
    <E extends keyof Events>(
        ...args: Events[E] extends void
            ? [event: E]
            : [event: E, data: Events[E]]
    ): void
};


// --- Hub Connect ---

export type ConnectConfig<Machines extends Record<string, any>> = {
    from: keyof Machines
    enters: string
    to: keyof Machines
    send: string
    data?: (context: any) => any
};


// --- StateMachine Namespace ---

declare module './machine.ts' {
    export namespace StateMachine {
        export type Config<
            Context,
            Events extends Record<string, any>,
            States extends string = string
        > = MachineConfig<Context, Events, States>;

        export type Options = MachineOptions;

        export type Adapter = StorageAdapter;
    }
}

declare module './hub.ts' {
    export namespace StateHub {
        export type Connect<Machines extends Record<string, any>> = ConnectConfig<Machines>;
    }
}
