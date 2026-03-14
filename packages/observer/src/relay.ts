import { ObserverEngine } from './engine.ts';

export type RelayEvents<TEvents extends Record<string, any>, TCtx extends object> = {
    [K in keyof TEvents]: { data: TEvents[K]; ctx: TCtx }
}

export interface ObserverRelayOptions {
    name?: string
    spy?: ObserverEngine.Spy<any>
    signal?: AbortSignal
    emitValidator?: {
        pub?: ObserverEngine.EmitValidator<any>
        sub?: ObserverEngine.EmitValidator<any>
    }
}

export abstract class ObserverRelay<
    TEvents extends Record<string, any>,
    TCtx extends object
> {

    #pub: ObserverEngine<TEvents>
    #sub: ObserverEngine<RelayEvents<TEvents, TCtx>>
    #subEmit!: (event: string, data: unknown) => void
    #isShutdown = false

    emit: ObserverEngine<TEvents>['emit']
    on: ObserverEngine<RelayEvents<TEvents, TCtx>>['on']
    once: ObserverEngine<RelayEvents<TEvents, TCtx>>['once']
    off: ObserverEngine<RelayEvents<TEvents, TCtx>>['off']
    queue: ObserverEngine<RelayEvents<TEvents, TCtx>>['queue']

    constructor(options?: ObserverRelayOptions) {

        const name = options?.name

        this.#pub = new ObserverEngine<TEvents>({
            name: name ? `${name}:pub` : undefined,
            spy: options?.spy,
            signal: options?.signal,
            emitValidator: options?.emitValidator?.pub,
        })

        this.#sub = new ObserverEngine<RelayEvents<TEvents, TCtx>>({
            name: name ? `${name}:sub` : undefined,
            spy: options?.spy,
            signal: options?.signal,
            emitValidator: options?.emitValidator?.sub,
        })

        this.on = this.#sub.on.bind(this.#sub)
        this.once = this.#sub.once.bind(this.#sub)
        this.off = this.#sub.off.bind(this.#sub)
        this.queue = this.#sub.queue.bind(this.#sub)
        this.#subEmit = this.#sub.emit.bind(this.#sub) as (event: string, data: unknown) => void

        const pubEmit = this.#pub.emit.bind(this.#pub)

        this.emit = ((event: any, data: any) => {

            if (this.#isShutdown) return
            pubEmit(event, data)
        }) as ObserverEngine<TEvents>['emit']

        this.#pub.on(/.+/, ({ event, data }) => this.send(event as string, data))

        if (options?.signal) {

            options.signal.addEventListener('abort', () => {

                this.#isShutdown = true
            })
        }
    }

    protected abstract send(event: string, data: unknown): void

    protected receive(event: string, data: unknown, ctx: TCtx): void {

        if (this.#isShutdown) return

        this.#subEmit(event, { data, ctx })
    }

    spy(spy: ObserverEngine.Spy<any>): void {

        if (this.#isShutdown) return

        this.#pub.spy(spy, true)
        this.#sub.spy(spy, true)
    }

    $has(event: string | RegExp) {

        return {
            pub: this.#pub.$has(event as any),
            sub: this.#sub.$has(event as any),
        }
    }

    $facts() {

        return {
            pub: this.#pub.$facts(),
            sub: this.#sub.$facts(),
        }
    }

    $internals() {

        return {
            pub: this.#pub.$internals(),
            sub: this.#sub.$internals(),
        }
    }

    get isShutdown(): boolean {

        return this.#isShutdown
    }

    shutdown(): void {

        if (this.#isShutdown) return

        this.#isShutdown = true
        this.#pub.clear()
        this.#sub.clear()
    }
}
