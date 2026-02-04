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
     * Emits 'options-change' event after successful update.
     * All values are type-checked against EngineConfig.
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

        if (isPath) {

            setDeep(this.#config, pathOrPartial, value as any);

            const eventData = { path: pathOrPartial, value } as OptionsEventData;
            this.#engine.emit('config-change', eventData as any);
        }
        else {

            this.#mergeDeep(this.#config, pathOrPartial as Partial<EngineConfig<H, P, S>>);

            const eventData = { value: pathOrPartial } as OptionsEventData;
            this.#engine.emit('config-change', eventData as any);
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
    ModifyConfigFn,
    DetermineTypeFn,
    InstanceHeaders,
    InstanceParams,
    InstanceState
} from './types.ts';
