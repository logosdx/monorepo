import type { _InternalHttpMethods, HttpMethods } from './types.ts';


/**
 * Validation function type for PropertyStore.
 *
 * @template T - The property type
 */
export type PropertyValidateFn<T> = (
    value: T,
    method?: _InternalHttpMethods
) => void;


/**
 * Method-specific overrides type for PropertyStore.
 *
 * @template T - The property type
 */
export type MethodOverrides<T> = Partial<Record<_InternalHttpMethods, Partial<T>>>;


/**
 * PropertyStore constructor options.
 *
 * @template T - The property type
 */
export interface PropertyStoreOptions<T> {

    /** Default values applied to all requests */
    defaults?: T;

    /** Method-specific overrides (e.g., POST has different headers than GET) */
    methodOverrides?: MethodOverrides<T>;

    /** Validation function called when values are set */
    validate?: PropertyValidateFn<T>;
}


/**
 * Generic store for request properties (headers, params).
 *
 * Handles CRUD operations, method-specific overrides, and merging
 * for requests. This class is used internally by FetchEngine
 * to manage both headers and params with a unified API.
 *
 * Properties are resolved in order:
 * 1. Instance defaults
 * 2. Method-specific overrides
 * 3. Request-level overrides
 *
 * @template T - The property type (e.g., Record<string, string>)
 *
 * @example
 * ```typescript
 * const headers = new PropertyStore<Headers>({
 *     defaults: { 'Content-Type': 'application/json' },
 *     methodOverrides: {
 *         POST: { 'X-Custom': 'post-only' }
 *     }
 * });
 *
 * // Add header globally
 * headers.set('Authorization', 'Bearer token');
 *
 * // Add header for specific method
 * headers.set('X-Request-ID', 'abc', 'POST');
 *
 * // Resolve headers for a request
 * const resolved = headers.resolve('POST', { 'X-Override': 'value' });
 * ```
 */
export class PropertyStore<T extends Record<string, unknown>> {

    #defaults: T;
    #methodOverrides: Map<string, Partial<T>>;
    #validate: PropertyValidateFn<T> | undefined;

    constructor(options: PropertyStoreOptions<T> = {}) {

        this.#defaults = (options.defaults ?? {}) as T;
        this.#methodOverrides = new Map();
        this.#validate = options.validate;

        if (options.methodOverrides) {

            for (const [method, overrides] of Object.entries(options.methodOverrides)) {

                if (overrides) {

                    this.#methodOverrides.set(method.toLowerCase(), overrides);
                }
            }
        }
    }


    /**
     * Set a property value globally or for a specific method.
     *
     * @param key - Property key
     * @param value - Property value
     * @param method - Optional HTTP method for method-specific override
     *
     * @example
     * headers.set('Authorization', 'Bearer token');
     * headers.set('X-Custom', 'value', 'POST');
     */
    set(key: string, value: unknown, method?: HttpMethods): void;

    /**
     * Set multiple property values globally or for a specific method.
     *
     * @param values - Object with key-value pairs to set
     * @param method - Optional HTTP method for method-specific overrides
     *
     * @example
     * headers.set({ 'Authorization': 'Bearer token', 'X-API-Key': 'abc' });
     * headers.set({ 'X-Custom': 'value' }, 'POST');
     */
    set(values: Partial<T>, method?: HttpMethods): void;

    set(
        keyOrValues: string | Partial<T>,
        valueOrMethod?: unknown | HttpMethods,
        maybeMethod?: HttpMethods
    ): void {

        if (typeof keyOrValues === 'string') {

            const key = keyOrValues;
            const value = valueOrMethod;
            const method = maybeMethod?.toLowerCase();

            if (method) {

                const existing = this.#methodOverrides.get(method) ?? {};

                const updated = { ...existing, [key]: value } as Partial<T>;
                this.#methodOverrides.set(method, updated);

                if (this.#validate) {

                    this.#validate(
                        { ...this.#defaults, ...updated } as T,
                        method as _InternalHttpMethods
                    );
                }
            }
            else {

                (this.#defaults as Record<string, unknown>)[key] = value;

                if (this.#validate) {

                    this.#validate(this.#defaults);
                }
            }
        }
        else {

            const values = keyOrValues;
            const method = (valueOrMethod as HttpMethods | undefined)?.toLowerCase();

            if (method) {

                const existing = this.#methodOverrides.get(method) ?? {};
                const updated = { ...existing, ...values } as Partial<T>;
                this.#methodOverrides.set(method, updated);

                if (this.#validate) {

                    this.#validate(
                        { ...this.#defaults, ...updated } as T,
                        method as _InternalHttpMethods
                    );
                }
            }
            else {

                Object.assign(this.#defaults, values);

                if (this.#validate) {

                    this.#validate(this.#defaults);
                }
            }
        }
    }


    /**
     * Remove a property globally or for a specific method.
     *
     * @param key - Property key to remove
     * @param method - Optional HTTP method for method-specific removal
     *
     * @example
     * headers.remove('Authorization');
     * headers.remove('X-Custom', 'POST');
     */
    remove(key: string, method?: HttpMethods): void;

    /**
     * Remove multiple properties globally or for a specific method.
     *
     * @param keys - Array of property keys to remove
     * @param method - Optional HTTP method for method-specific removal
     *
     * @example
     * headers.remove(['Authorization', 'X-API-Key']);
     * headers.remove(['X-Custom', 'X-Other'], 'POST');
     */
    remove(keys: string[], method?: HttpMethods): void;

    remove(keyOrKeys: string | string[], method?: HttpMethods): void {

        const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
        const lowerMethod = method?.toLowerCase();

        if (lowerMethod) {

            const existing = this.#methodOverrides.get(lowerMethod);

            if (existing) {

                for (const key of keys) {

                    delete (existing as Record<string, unknown>)[key];
                }
            }
        }
        else {

            for (const key of keys) {

                delete (this.#defaults as Record<string, unknown>)[key];
            }
        }
    }


    /**
     * Check if a property exists globally or for a specific method.
     *
     * @param key - Property key to check
     * @param method - Optional HTTP method to check method-specific value
     * @returns True if the property exists
     *
     * @example
     * if (headers.has('Authorization')) {
     *     console.log('Auth header is set');
     * }
     */
    has(key: string, method?: HttpMethods): boolean {

        const lowerMethod = method?.toLowerCase();

        if (lowerMethod) {

            const methodValues = this.#methodOverrides.get(lowerMethod);

            if (methodValues && key in methodValues) {

                return true;
            }
        }

        return key in this.#defaults;
    }


    /**
     * Get the default values (without method overrides).
     *
     * @returns Clone of the default values
     *
     * @example
     * const defaultHeaders = headers.defaults;
     */
    get defaults(): T {

        return { ...this.#defaults };
    }


    /**
     * Get all values including method overrides.
     *
     * Returns an object with 'default' key for defaults and
     * method names as keys for method-specific overrides.
     *
     * @returns Object with all property values
     *
     * @example
     * const all = headers.all;
     * // { default: { Authorization: '...' }, POST: { 'X-Custom': '...' } }
     */
    get all(): { default: T } & Record<string, Partial<T>> {

        const result: { default: T } & Record<string, Partial<T>> = {
            default: { ...this.#defaults }
        };

        for (const [method, values] of this.#methodOverrides) {

            result[method] = { ...values };
        }

        return result;
    }


    /**
     * Get method-specific overrides only (not merged with defaults).
     *
     * @param method - HTTP method
     * @returns Method-specific overrides or empty object
     *
     * @example
     * const postHeaders = headers.forMethod('POST');
     */
    forMethod(method: HttpMethods): Partial<T> {

        const lowerMethod = method.toLowerCase();
        const overrides = this.#methodOverrides.get(lowerMethod);

        return overrides ? { ...overrides } : {} as Partial<T>;
    }


    /**
     * Resolve the final property values for a specific method.
     *
     * Merges in order: defaults → method overrides → request overrides.
     *
     * @param method - HTTP method
     * @param requestOverrides - Request-level overrides (highest priority)
     * @returns Merged property values
     *
     * @example
     * const headers = this.headers.resolve('POST', { 'X-Request-ID': '123' });
     */
    resolve(method: HttpMethods, requestOverrides?: Partial<T>): T {

        const lowerMethod = method.toLowerCase();
        const methodOverrides = this.#methodOverrides.get(lowerMethod) ?? {};

        return {
            ...this.#defaults,
            ...methodOverrides,
            ...(requestOverrides ?? {})
        } as T;
    }
}
