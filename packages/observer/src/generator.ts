import { Deferred } from '@logosdx/utils';

import { type EventData, EventPromise, EventError } from './helpers.ts';
import { type ObserverEngine } from './engine.ts';
import { type Events } from './types.ts';

export class DeferredEvent<T> extends Deferred<T> {

    declare promise: EventPromise<T>;
    cleanup?: () => void
}

export class EventGenerator<S extends Record<string, any>, E extends Events<S> | RegExp = Events<S>> {

    #observer: ObserverEngine<S>;
    #event: E | RegExp;
    #defer: DeferredEvent<EventData<S, E>>;
    #done: boolean = false;
    #listener: ObserverEngine.EventCallback<S> | null = null;
    #lastValue: unknown | null = null;

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

    cleanup!: ObserverEngine.Cleanup

    next: () => Promise<EventData<S, E>>;

    constructor(
        observer: ObserverEngine<S>,
        event: E | RegExp
    ) {

        this.#observer = observer;
        this.#event = event;

        this.#defer = new DeferredEvent();
        this.#defer.promise.cleanup = this.cleanup;
        this.#defer.promise.resolve = this.#defer.resolve;

        this.#listener = (data: unknown) => {

            this.#lastValue = data;
            this.#defer.resolve(data as EventData<S, E>);
            this.#defer = new DeferredEvent();
            this.#defer.promise.cleanup = this.cleanup;
            this.#defer.promise.resolve = this.#defer.resolve;
        }

        const off = observer.on(
            event as never,
            this.#listener! as never
        );


        this.next = () => {

            this.#assertNotDestroyed();

            return this.#defer.promise
        };

        this.cleanup = () => {

            this.#assertNotDestroyed();

            off();
            this.#done = true;

            // Resolve all lingering promises
            // with the last value
            this.#_iterPromise.forEach(promise => {
                promise.resolve?.(this.#lastValue as EventData<S, E>);
            });

            // Cleanup the set
            this.#_iterPromise.clear();
            this.#lastValue = null;
        }

    }

    /**
     * Store iterator's last promise. Handles multiple promises
     * for when the generator is used in multiple places.
     */
    #_iterPromise: Set<EventPromise<EventData<S, E>>> = new Set();

    async * [Symbol.asyncIterator]() {

        while (!this.#done) {
            // capture the promise before yielding
            const promise = this.next();

            this.#_iterPromise.add(promise);
            yield await promise;

            // remove the promise after yielding
            this.#_iterPromise.delete(promise);
        }
        return Promise.resolve(undefined);
    }


    get lastValue() {
        return this.#lastValue as E extends Events<S>
            ? S[E]
            : E extends RegExp
                ? ObserverEngine.RgxEmitData<S>
                : S[Events<S>];
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
