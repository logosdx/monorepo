import type { StateMachine } from './machine.ts';
import type { ConnectConfig } from './types.ts';
import type { ObserverEngine } from '@logosdx/observer';


export class StateHub<
    T extends Record<string, StateMachine<any, any, any>>
> {

    #machines: T;


    constructor(machines: T) {

        this.#machines = machines;
    }


    /**
     * Returns a machine by key, fully typed.
     *
     * @example
     *     const auth = hub.get('auth')
     *     auth.send('LOGIN', { user: 'admin' })
     */
    get<K extends keyof T>(key: K): T[K] {

        return this.#machines[key];
    }


    /**
     * Wire machines together declaratively. When the source machine
     * enters the specified state, sends an event to the target machine.
     *
     * Returns a cleanup function to tear down the connection.
     *
     * @example
     *     hub.connect({
     *         from: 'auth',
     *         enters: 'loggedOut',
     *         to: 'checkout',
     *         send: 'RESET',
     *     })
     */
    connect(config: ConnectConfig<T>): ObserverEngine.Cleanup {

        const source = this.#machines[config.from]!;
        const target = this.#machines[config.to]!;

        const listener = ({ context }: { context: any }) => {

            const data = config.data ? config.data(context) : undefined;
            target.send(config.send as any, data);
        };

        return source.on(config.enters as string, listener);
    }
}
