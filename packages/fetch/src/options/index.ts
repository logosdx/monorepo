import { clone, assert, isObject, reach, setDeep, type PathNames, type PathValue } from '@logosdx/utils';
import type { FetchEngineCore } from '../engine/types.ts';
import type { OptionsEventData } from '../engine/events.ts';
import type { EngineConfig, InstanceHeaders, InstanceParams, InstanceState } from './types.ts';
import { validateOptions } from '../helpers/validations.ts';


/**
 * Manages configuration options for FetchEngine with deep path access.
 *
 * Provides a clean API for getting and setting nested configuration
 * values with type-safe paths and automatic event emission on mutations.
 * ConfigStore is the single source of truth for ALL configuration.
 *
 * The store is fully typed with EngineConfig, ensuring:
 * - `get('baseUrl')` returns `string`
 * - `get('retry.maxAttempts')` returns `number`
 * - `get('dedupePolicy')` returns the correct policy type
 * - `set('timeout', value)` validates value is a number
 *
 * @template H - Headers type
 * @template P - Params type
 * @template S - State type
 *
 * @example
 * ```typescript
 * // Access via engine.config
 * engine.config.get('baseUrl')        // string
 * engine.config.get('retry.maxAttempts')  // number
 *
 * // Set options (runtime configurable)
 * engine.config.set('baseUrl', 'https://new-api.com')
 * engine.config.set('retry.maxAttempts', 5)
 *
 * // Merge partial options
 * engine.config.set({ retry: { maxAttempts: 5 } })
 * ```
 */
export class ConfigStore<
    H = InstanceHeaders,
    P = InstanceParams,
    S = InstanceState
> {

    #engine: FetchEngineCore<H, P, S>;
    #config: EngineConfig<H, P, S>;

    /** Validators run against a pending `set()` before it mutates the store. */
    #preSetValidators: ((data: OptionsEventData) => void)[] = [];

    constructor(engine: FetchEngineCore<H, P, S>, initialConfig: EngineConfig<H, P, S>) {

        validateOptions(initialConfig as any);
        this.#engine = engine;
        this.#config = clone(initialConfig);
    }

    /**
     * Get a deep clone of all options or a specific nested value.
     *
     * Returns a cloned copy to prevent external mutations.
     * All return types are properly inferred from EngineConfig.
     *
     * @example
     * ```typescript
     * // Get all options
     * const opts = engine.config.get();  // EngineConfig<H, P, S>
     *
     * // Get nested value
     * const maxAttempts = engine.config.get('retry.maxAttempts');  // number
     * const baseUrl = engine.config.get('baseUrl');  // string
     * ```
     */
    get(): EngineConfig<H, P, S>;
    get<K extends PathNames<EngineConfig<H, P, S>> & string>(path: K): PathValue<EngineConfig<H, P, S>, K>;
    get<K extends PathNames<EngineConfig<H, P, S>> & string>(path?: K): EngineConfig<H, P, S> | PathValue<EngineConfig<H, P, S>, K> {

        if (path === undefined) {

            return clone(this.#config) as EngineConfig<H, P, S>;
        }

        const value = reach(this.#config, path);
        return (isObject(value) ? clone(value) : value) as PathValue<EngineConfig<H, P, S>, K>;
    }

    /**
     * Set options by path-value or by partial object merge.
     *
     * Runs registered pre-set validators against the pending change before
     * anything mutates — a validator that throws rejects the whole `set()`
     * call, so a rejected change never partially applies. Emits
     * 'config-change' after a successful update. All values are
     * type-checked against EngineConfig.
     *
     * @example
     * ```typescript
     * // Set by path (type-checked)
     * engine.config.set('baseUrl', 'https://new-api.com');  // OK
     * engine.config.set('retry.maxAttempts', 5);  // OK
     * engine.config.set('retry.maxAttempts', 'five');  // Type error!
     *
     * // Merge partial options
     * engine.config.set({ retry: { maxAttempts: 5 } });
     * ```
     */
    set<K extends PathNames<EngineConfig<H, P, S>> & string>(path: K, value: PathValue<EngineConfig<H, P, S>, K>): void;
    set<K extends PathNames<EngineConfig<H, P, S>> & string>(path: K, value: undefined): void;
    set(partial: Partial<EngineConfig<H, P, S>>): void;
    set<K extends PathNames<EngineConfig<H, P, S>> & string>(
        pathOrPartial: K | Partial<EngineConfig<H, P, S>>,
        value?: PathValue<EngineConfig<H, P, S>, K>
    ): void {

        const isPath = typeof pathOrPartial === 'string';

        assert(
            isObject(pathOrPartial) || isPath,
            'set requires a path string or config object'
        );

        const eventData = (
            isPath
                ? { path: pathOrPartial, value }
                : { value: pathOrPartial }
        ) as OptionsEventData;

        this.#runPreSetValidators(eventData);

        if (isPath) {

            setDeep(this.#config, pathOrPartial, value as any);
        }
        else {

            this.#mergeDeep(this.#config, pathOrPartial as Partial<EngineConfig<H, P, S>>);
        }

        this.#engine.emit('config-change', eventData as any);
    }

    /**
     * Register a validator that runs against a pending `set()` before it
     * mutates the store.
     *
     * The validator throws to reject the change — nothing mutates and no
     * `config-change` event fires. Generic on purpose: the store has no
     * opinion on what makes a change valid, only that rejection must
     * happen before mutation. Callers (e.g. the engine's policy-ownership
     * check) own the actual rule.
     *
     * @param validator - Called with the pending change before mutation
     * @returns Cleanup function to unregister the validator
     */
    onBeforeSet(validator: (data: OptionsEventData) => void): () => void {

        this.#preSetValidators.push(validator);

        return () => {

            const index = this.#preSetValidators.indexOf(validator);
            if (index !== -1) this.#preSetValidators.splice(index, 1);
        };
    }

    /**
     * Run all registered pre-set validators against a pending change.
     *
     * Any validator may throw to reject the `set()` call before it mutates.
     */
    #runPreSetValidators(data: OptionsEventData): void {

        for (const validator of this.#preSetValidators) {

            validator(data);
        }
    }

    /**
     * Deep merge source into target, mutating target.
     */
    #mergeDeep(target: any, source: any): void {

        for (const key of Object.keys(source)) {

            const sourceVal = source[key];
            const targetVal = target[key];

            if (isObject(sourceVal) && isObject(targetVal)) {

                this.#mergeDeep(targetVal, sourceVal);
            }
            else {

                target[key] = sourceVal;
            }
        }
    }

    /**
     * Set an option directly without emitting events.
     *
     * Used internally for backward compatibility methods that
     * emit their own specific events.
     *
     * @internal
     */
    _setDirect<K extends PathNames<EngineConfig<H, P, S>> & string>(path: K, value: PathValue<EngineConfig<H, P, S>, K>): void {

        setDeep(this.#config, path, value);
    }
}


// Re-export types
export type {
    EngineConfig,
    EngineType,
    RequestConfig,
    CallConfig,
    EngineRequestConfig,
    EngineLifecycle,
    ValidateConfig,
DetermineTypeFn,
    InstanceHeaders,
    InstanceParams,
    InstanceState
} from './types.ts';
