import type { FetchEngineCore } from '../engine/types.ts';
import type { HttpMethods, DictAndT } from '../types.ts';
import { PropertyStore, type PropertyStoreOptions } from './store.ts';


/**
 * Manages HTTP headers for FetchEngine with event emission.
 *
 * Wraps PropertyStore with FetchEngine-specific event emission.
 * Pulls initial headers and validation from engine options.
 *
 * @template H - Headers type
 *
 * @example
 * ```typescript
 * // Access via engine.headers
 * engine.headers.set('Authorization', 'Bearer token');
 * engine.headers.set({ 'X-API-Key': 'abc', 'X-Request-ID': '123' });
 *
 * // Method-specific headers
 * engine.headers.set('Content-Type', 'application/json', 'POST');
 *
 * // Remove headers
 * engine.headers.remove('Authorization');
 * engine.headers.remove(['X-API-Key', 'X-Request-ID']);
 *
 * // Check if header exists
 * if (engine.headers.has('Authorization')) { ... }
 *
 * // Get resolved headers for a request
 * const headers = engine.headers.resolve('POST', { 'X-Override': 'value' });
 * ```
 */
export class HeadersManager<H = unknown> {

    #engine: FetchEngineCore<H>;
    #store: PropertyStore<DictAndT<H>>;

    constructor(engine: FetchEngineCore<H>) {

        this.#engine = engine;

        const defaults = engine.config.get('headers') ?? {} as DictAndT<H>;
        const methodOverrides = engine.config.get('methodHeaders');
        const validate = engine.config.get('validate.headers');

        const storeOptions: PropertyStoreOptions<DictAndT<H>> = { defaults };

        if (methodOverrides !== undefined) {

            storeOptions.methodOverrides = methodOverrides;
        }

        if (validate !== undefined) {

            storeOptions.validate = validate;
        }

        this.#store = new PropertyStore<DictAndT<H>>(storeOptions);
    }

    /**
     * Set a header value globally or for a specific method.
     *
     * @example
     * ```typescript
     * engine.headers.set('Authorization', 'Bearer token');
     * engine.headers.set('Content-Type', 'application/json', 'POST');
     * ```
     */
    set(key: string, value: string, method?: HttpMethods): void;

    /**
     * Set multiple header values globally or for a specific method.
     *
     * @example
     * ```typescript
     * engine.headers.set({ Authorization: 'Bearer token', 'X-API-Key': 'abc' });
     * engine.headers.set({ 'Content-Type': 'application/json' }, 'POST');
     * ```
     */
    set(headers: Partial<DictAndT<H>>, method?: HttpMethods): void;

    set(
        keyOrHeaders: string | Partial<DictAndT<H>>,
        valueOrMethod?: string | HttpMethods,
        maybeMethod?: HttpMethods
    ): void {

        if (typeof keyOrHeaders === 'string') {

            const key = keyOrHeaders;
            const value = valueOrMethod as string;
            const method = maybeMethod;

            this.#store.set(key, value, method);

            const eventData = { key, value, method };
            this.#engine.emit('header-add' as any, eventData);

            return;
        }

        const headers = keyOrHeaders;
        const method = valueOrMethod as HttpMethods | undefined;

        this.#store.set(headers, method);

        const eventData = { value: headers as Partial<DictAndT<H>>, method };
        this.#engine.emit('header-add' as any, eventData);
    }

    /**
     * Remove a header globally or for a specific method.
     *
     * @example
     * ```typescript
     * engine.headers.remove('Authorization');
     * engine.headers.remove('Content-Type', 'POST');
     * ```
     */
    remove(key: string, method?: HttpMethods): void;

    /**
     * Remove multiple headers globally or for a specific method.
     *
     * @example
     * ```typescript
     * engine.headers.remove(['Authorization', 'X-API-Key']);
     * engine.headers.remove(['Content-Type'], 'POST');
     * ```
     */
    remove(keys: string[], method?: HttpMethods): void;

    remove(keyOrKeys: string | string[], method?: HttpMethods): void {

        this.#store.remove(keyOrKeys as string, method);

        const eventData = { key: keyOrKeys, method };
        this.#engine.emit('header-remove' as any, eventData);
    }

    /**
     * Check if a header exists globally or for a specific method.
     *
     * @example
     * ```typescript
     * if (engine.headers.has('Authorization')) {
     *     console.log('Auth header is set');
     * }
     * ```
     */
    has(key: string, method?: HttpMethods): boolean {

        return this.#store.has(key, method);
    }

    /**
     * Resolve the final headers for a specific method.
     *
     * Merges in order: defaults → method overrides → request overrides.
     *
     * @example
     * ```typescript
     * const headers = engine.headers.resolve('POST', { 'X-Request-ID': '123' });
     * ```
     */
    resolve(method: HttpMethods, requestOverrides?: Partial<DictAndT<H>>): DictAndT<H> {

        return this.#store.resolve(method, requestOverrides);
    }

    /**
     * Get the default headers (without method overrides).
     */
    get defaults(): DictAndT<H> {

        return this.#store.defaults;
    }

    /**
     * Get all headers including method overrides.
     *
     * @example
     * ```typescript
     * const all = engine.headers.all;
     * // { default: { Authorization: '...' }, post: { 'Content-Type': '...' } }
     * ```
     */
    get all(): { default: DictAndT<H> } & Record<string, Partial<DictAndT<H>>> {

        return this.#store.all;
    }

    /**
     * Get method-specific headers only (not merged with defaults).
     */
    forMethod(method: HttpMethods): Partial<DictAndT<H>> {

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
    get $store(): PropertyStore<DictAndT<H>> {

        return this.#store;
    }
}
