import { clone, assert, isObject } from '@logosdx/utils';
import type { FetchEngineCore } from '../engine/types.ts';
import type { StateEventData } from '../engine/events.ts';


/**
 * Manages instance state for FetchEngine with event emission.
 *
 * Provides a clean API for getting, setting, and resetting state
 * with automatic event emission on mutations. Validation is pulled
 * from engine options, not passed as a constructor parameter.
 *
 * @template S - State type
 *
 * @example
 * ```typescript
 * // Access via engine.state
 * engine.state.set('authToken', 'bearer-123');
 * engine.state.set({ user: 'john', role: 'admin' });
 *
 * const state = engine.state.get();
 * console.log(state.authToken);
 *
 * engine.state.reset();
 * ```
 */
export class FetchState<S> {

    #engine: FetchEngineCore<unknown, unknown, S>;
    #state: S;

    constructor(engine: FetchEngineCore<unknown, unknown, S>) {

        this.#engine = engine;
        this.#state = {} as S;
    }

    /**
     * Get the validate function from engine options.
     * This is pulled dynamically to allow runtime changes.
     */
    #getValidate(): ((state: S) => void) | undefined {

        return this.#engine.config.get('validate.state') as ((state: S) => void) | undefined;
    }

    /**
     * Get a deep clone of the current state.
     *
     * Returns a cloned copy to prevent external mutations.
     *
     * @example
     * ```typescript
     * const state = engine.state.get();
     * console.log(state.authToken);
     * ```
     */
    get(): S {

        return clone(this.#state);
    }

    /**
     * Set state by key-value or by partial object merge.
     *
     * Emits 'state-set' event after successful update.
     *
     * @example
     * ```typescript
     * // Set single property
     * engine.state.set('authToken', 'bearer-123');
     *
     * // Merge multiple properties
     * engine.state.set({ user: 'john', role: 'admin' });
     * ```
     */
    set<K extends keyof S>(key: K, value: S[K]): void;
    set(partial: Partial<S>): void;
    set(keyOrPartial: unknown, value?: unknown): void {

        const isKey = typeof keyOrPartial === 'string';

        assert(
            isObject(keyOrPartial) || isKey,
            'set requires an object or string key'
        );

        const previous = this.#state;
        let key: keyof S | undefined;
        let setValue: S[keyof S] | Partial<S>;

        if (isKey) {

            assert(
                value !== undefined,
                'set requires a value when setting by key'
            );

            key = keyOrPartial as keyof S;
            setValue = value as S[keyof S];

            this.#state = {
                ...this.#state,
                [key]: setValue
            };
        }
        else {

            setValue = keyOrPartial as Partial<S>;

            this.#state = {
                ...this.#state,
                ...setValue
            };
        }

        const validate = this.#getValidate();

        if (validate) {

            validate(this.#state);
        }

        const eventData = {
            key,
            value: setValue,
            previous,
            current: this.#state
        } as StateEventData<S>;

        this.#engine.emit('state-set', eventData);
    }

    /**
     * Reset state to empty object.
     *
     * Emits 'state-reset' event after reset.
     *
     * @example
     * ```typescript
     * engine.state.reset();
     * console.log(engine.state.get()); // {}
     * ```
     */
    reset(): void {

        const previous = this.#state;
        this.#state = {} as S;

        const validate = this.#getValidate();

        if (validate) {

            validate(this.#state);
        }

        const eventData = {
            previous,
            current: this.#state
        } as StateEventData<S>;

        this.#engine.emit('state-reset', eventData);
    }

    /**
     * Internal method to set state directly without events.
     * Used during engine initialization.
     * @internal
     */
    _setDirect(state: S): void {

        this.#state = state;
    }
}
