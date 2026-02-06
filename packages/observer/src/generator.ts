import { Deferred, PriorityQueue } from '@logosdx/utils';

import { type EventData, EventPromise, EventError } from './helpers.ts';
import { type ObserverEngine } from './engine.ts';
import { type Events } from './types.ts';

export interface EventGeneratorOptions {
    signal?: AbortSignal | undefined;
}

export class DeferredEvent<T> extends Deferred<T> {

    declare promise: EventPromise<T>;
    cleanup?: () => void
}

export class EventGenerator<S extends Record<string, any>, E extends Events<S> | RegExp = Events<S>> {

    #observer: ObserverEngine<S>;
    #event: E | RegExp;
    #buffer: PriorityQueue<EventData<S, E>>;
    #waiting: DeferredEvent<EventData<S, E>> | null = null;
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
        event: E | RegExp,
        options?: EventGeneratorOptions
    ) {

        this.#observer = observer;
        this.#event = event;
        this.#buffer = new PriorityQueue<EventData<S, E>>();

        this.#listener = (data: unknown) => {

            this.#lastValue = data;

            if (this.#waiting) {

                const defer = this.#waiting;
                this.#waiting = null;
                defer.resolve(data as EventData<S, E>);
            }
            else {

                this.#buffer.push(data as EventData<S, E>);
            }
        }

        const off = observer.on(
            event as never,
            this.#listener! as never
        ) as unknown as ObserverEngine.Cleanup;

        // Mutable controller for managing abort listener lifecycle
        let generatorAbortCtrl: AbortController | undefined;

        this.next = () => {

            this.#assertNotDestroyed();

            const buffered = this.#buffer.pop();

            if (buffered !== null) {

                return Promise.resolve(buffered);
            }

            if (!this.#waiting) {

                this.#waiting = new DeferredEvent();
                this.#waiting.promise.cleanup = this.cleanup;
                this.#waiting.promise.resolve = this.#waiting.resolve;
                this.#waiting.promise.reject = this.#waiting.reject;
            }

            return this.#waiting.promise;
        };

        this.cleanup = () => {

            if (this.#done) return;

            off();
            this.#done = true;

            // Reject pending promises on cancellation
            const abortError = new EventError('Aborted', {
                event: this.#event as string,
                listener: this.#listener!,
                data: null
            });

            if (this.#waiting) {

                this.#waiting.reject(abortError);
                this.#waiting = null;
            }

            // Reject all lingering iterator promises
            this.#_iterPromise.forEach(promise => {
                promise.reject?.(abortError);
            });

            // Cleanup the set and buffer
            this.#_iterPromise.clear();
            this.#buffer.clear();
            this.#lastValue = null;

            // Abort the generator's abort controller if it exists
            generatorAbortCtrl?.abort();
        }

        // Wire up signal to auto-cleanup
        const userSignal = options?.signal;

        if (userSignal) {

            if (userSignal.aborted) {

                this.#done = true;
                return;
            }

            generatorAbortCtrl = new AbortController();

            userSignal.addEventListener('abort', this.cleanup, {
                signal: generatorAbortCtrl.signal
            });
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
