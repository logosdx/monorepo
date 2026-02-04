import type { FetchEngineCore } from '../engine/types.ts';
import type { PropertyEventData } from '../engine/events.ts';
import type { HttpMethods, DictAndT } from '../types.ts';
import { PropertyStore, type PropertyStoreOptions } from './store.ts';


/**
 * Manages URL parameters for FetchEngine with event emission.
 *
 * Wraps PropertyStore with FetchEngine-specific event emission.
 * Pulls initial params and validation from engine options.
 *
 * @template P - Params type
 *
 * @example
 * ```typescript
 * // Access via engine.params
 * engine.params.set('apiKey', 'abc123');
 * engine.params.set({ page: '1', limit: '10' });
 *
 * // Method-specific params
 * engine.params.set('format', 'json', 'GET');
 *
 * // Remove params
 * engine.params.remove('apiKey');
 * engine.params.remove(['page', 'limit']);
 *
 * // Check if param exists
 * if (engine.params.has('apiKey')) { ... }
 *
 * // Get resolved params for a request
 * const params = engine.params.resolve('GET', { extra: 'value' });
 * ```
 */
export class ParamsManager<P = unknown> {

    #engine: FetchEngineCore<unknown, P>;
    #store: PropertyStore<DictAndT<P>>;

    constructor(engine: FetchEngineCore<unknown, P>) {

        this.#engine = engine;

        const defaults = engine.config.get('params') ?? {} as DictAndT<P>;
        const methodOverrides = engine.config.get('methodParams');
        const validate = engine.config.get('validate.params');

        const storeOptions: PropertyStoreOptions<DictAndT<P>> = { defaults };

        if (methodOverrides !== undefined) {

            storeOptions.methodOverrides = methodOverrides;
        }

        if (validate !== undefined) {

            storeOptions.validate = validate;
        }

        this.#store = new PropertyStore<DictAndT<P>>(storeOptions);
    }

    /**
     * Set a param value globally or for a specific method.
     *
     * @example
     * ```typescript
     * engine.params.set('apiKey', 'abc123');
     * engine.params.set('format', 'json', 'GET');
     * ```
     */
    set(key: string, value: string, method?: HttpMethods): void;

    /**
     * Set multiple param values globally or for a specific method.
     *
     * @example
     * ```typescript
     * engine.params.set({ page: '1', limit: '10' });
     * engine.params.set({ format: 'json' }, 'GET');
     * ```
     */
    set(params: Partial<DictAndT<P>>, method?: HttpMethods): void;

    set(
        keyOrParams: string | Partial<DictAndT<P>>,
        valueOrMethod?: string | HttpMethods,
        maybeMethod?: HttpMethods
    ): void {

        if (typeof keyOrParams === 'string') {

            const key = keyOrParams;
            const value = valueOrMethod as string;
            const method = maybeMethod;

            this.#store.set(key, value, method);

            const eventData = { key, value, method } as PropertyEventData<DictAndT<P>>;
            this.#engine.emit('param-add', eventData);
        }
        else {

            const params = keyOrParams;
            const method = valueOrMethod as HttpMethods | undefined;

            this.#store.set(params, method);

            const eventData = { value: params as Partial<DictAndT<P>>, method } as PropertyEventData<DictAndT<P>>;
            this.#engine.emit('param-add', eventData);
        }
    }

    /**
     * Remove a param globally or for a specific method.
     *
     * @example
     * ```typescript
     * engine.params.remove('apiKey');
     * engine.params.remove('format', 'GET');
     * ```
     */
    remove(key: string, method?: HttpMethods): void;

    /**
     * Remove multiple params globally or for a specific method.
     *
     * @example
     * ```typescript
     * engine.params.remove(['page', 'limit']);
     * engine.params.remove(['format'], 'GET');
     * ```
     */
    remove(keys: string[], method?: HttpMethods): void;

    remove(keyOrKeys: string | string[], method?: HttpMethods): void {

        this.#store.remove(keyOrKeys as string, method);

        const eventData = { key: keyOrKeys, method } as PropertyEventData<DictAndT<P>>;
        this.#engine.emit('param-remove', eventData);
    }

    /**
     * Check if a param exists globally or for a specific method.
     *
     * @example
     * ```typescript
     * if (engine.params.has('apiKey')) {
     *     console.log('API key is set');
     * }
     * ```
     */
    has(key: string, method?: HttpMethods): boolean {

        return this.#store.has(key, method);
    }

    /**
     * Resolve the final params for a specific method.
     *
     * Merges in order: defaults → method overrides → request overrides.
     *
     * @example
     * ```typescript
     * const params = engine.params.resolve('GET', { extra: 'value' });
     * ```
     */
    resolve(method: HttpMethods, requestOverrides?: Partial<DictAndT<P>>): DictAndT<P> {

        return this.#store.resolve(method, requestOverrides);
    }

    /**
     * Get the default params (without method overrides).
     */
    get defaults(): DictAndT<P> {

        return this.#store.defaults;
    }

    /**
     * Get all params including method overrides.
     *
     * @example
     * ```typescript
     * const all = engine.params.all;
     * // { default: { apiKey: '...' }, get: { format: '...' } }
     * ```
     */
    get all(): { default: DictAndT<P> } & Record<string, Partial<DictAndT<P>>> {

        return this.#store.all;
    }

    /**
     * Get method-specific params only (not merged with defaults).
     */
    forMethod(method: HttpMethods): Partial<DictAndT<P>> {

        return this.#store.forMethod(method);
    }

    /**
     * Get the underlying PropertyStore for internal use.
     *
     * Exposed for FetchEngineCore compliance. Internal components
     * (executor, policies) access the store directly for resolution.
     *
     * @internal
     */
    get $store(): PropertyStore<DictAndT<P>> {

        return this.#store;
    }
}
