import {
    assert,
    AsyncFunc,
    attempt,
    FunctionProps,
    isFunction,
    isObject
} from '@logosdx/utils';

/**
 * Error thrown when a hook calls `ctx.fail()`.
 *
 * This error is only created when using the default `handleFail` behavior.
 * If a custom `handleFail` is provided, that error type is thrown instead.
 *
 * @example
 *     hooks.on('validate', async (ctx) => {
 *         if (!ctx.args[0].isValid) {
 *             ctx.fail('Validation failed');
 *         }
 *     });
 *
 *     const [, err] = await attempt(() => engine.emit('validate', data));
 *     if (isHookError(err)) {
 *         console.log(err.hookName);  // 'validate'
 *     }
 */
export class HookError extends Error {

    /** Name of the hook where the error occurred */
    hookName?: string;

    /** Original error if `fail()` was called with an Error instance */
    originalError?: Error;

    constructor(message: string) {

        super(message)
    }
}

/**
 * Type guard to check if an error is a HookError.
 *
 * @example
 *     const { error } = await engine.emit('validate', data);
 *     if (isHookError(error)) {
 *         console.log(`Hook "${error.hookName}" failed`);
 *     }
 */
export const isHookError = (error: unknown): error is HookError => {

    return (error as HookError)?.constructor?.name === HookError.name
}

/**
 * Result returned from `emit()` after running all hook callbacks.
 */
export interface EmitResult<F extends AsyncFunc> {

    /** Current arguments (possibly modified by callbacks) */
    args: Parameters<F>;

    /** Result value (if set by a callback) */
    result?: Awaited<ReturnType<F>> | undefined;

    /** Whether a callback called `returnEarly()` */
    earlyReturn: boolean;
}

/**
 * Context object passed to hook callbacks.
 * Provides access to arguments, results, and control methods.
 *
 * @example
 *     hooks.on('cacheCheck', async (ctx) => {
 *         const [url] = ctx.args;
 *         const cached = cache.get(url);
 *
 *         if (cached) {
 *             ctx.setResult(cached);
 *             ctx.returnEarly();
 *         }
 *     });
 */
export interface HookContext<F extends AsyncFunc, FailArgs extends unknown[] = [string]> {

    /** Current arguments passed to emit() */
    args: Parameters<F>;

    /** Result value (can be set by callbacks) */
    result?: Awaited<ReturnType<F>>;

    /** Abort hook execution with an error. */
    fail: (...args: FailArgs) => never;

    /** Replace the arguments for subsequent callbacks */
    setArgs: (next: Parameters<F>) => void;

    /** Set the result value */
    setResult: (next: Awaited<ReturnType<F>>) => void;

    /** Stop processing remaining callbacks and return early */
    returnEarly: () => void;

    /** Remove this callback from the hook */
    removeHook: () => void;
}

export type HookFn<F extends AsyncFunc, FailArgs extends unknown[] = [string]> =
    (ctx: HookContext<F, FailArgs>) => Promise<void>;

type HookOptions<F extends AsyncFunc, FailArgs extends unknown[] = [string]> = {
    callback: HookFn<F, FailArgs>;
    once?: true;
    ignoreOnFail?: true;
}

type HookOrOptions<F extends AsyncFunc, FailArgs extends unknown[] = [string]> =
    HookFn<F, FailArgs> | HookOptions<F, FailArgs>;

type FuncOrNever<T> = T extends AsyncFunc ? T : never;

/**
 * Custom error handler for `ctx.fail()`.
 * Can be an Error constructor or a function that throws.
 */
export type HandleFail<Args extends unknown[] = [string]> =
    | (new (...args: Args) => Error)
    | ((...args: Args) => never);

/**
 * Options for HookEngine constructor.
 */
export interface HookEngineOptions<FailArgs extends unknown[] = [string]> {

    /**
     * Custom handler for `ctx.fail()`.
     * Can be an Error constructor or a function that throws.
     *
     * @example
     *     // Use Firebase HttpsError
     *     new HookEngine({ handleFail: HttpsError });
     *
     *     // Use custom function
     *     new HookEngine({
     *         handleFail: (msg, data) => { throw Boom.badRequest(msg, data); }
     *     });
     */
    handleFail?: HandleFail<FailArgs>;
}

/**
 * A lightweight, type-safe lifecycle hook system.
 *
 * HookEngine allows you to define lifecycle events and subscribe to them.
 * Callbacks can modify arguments, set results, or abort execution.
 *
 * @example
 *     interface FetchLifecycle {
 *         preRequest(url: string, options: RequestInit): Promise<Response>;
 *         rateLimit(error: Error, attempt: number): Promise<void>;
 *         cacheHit(url: string, data: unknown): Promise<unknown>;
 *     }
 *
 *     const hooks = new HookEngine<FetchLifecycle>();
 *
 *     hooks.on('rateLimit', async (ctx) => {
 *         const [error, attempt] = ctx.args;
 *         if (attempt > 3) ctx.fail('Max retries exceeded');
 *         await sleep(error.retryAfter * 1000);
 *     });
 *
 *     hooks.on('cacheHit', async (ctx) => {
 *         console.log('Cache hit for:', ctx.args[0]);
 *     });
 *
 *     // In your implementation
 *     const result = await hooks.emit('cacheHit', url, cachedData);
 *
 * @typeParam Lifecycle - Interface defining the lifecycle hooks
 * @typeParam FailArgs - Arguments type for ctx.fail() (default: [string])
 */
/**
 * Default permissive lifecycle type when no type parameter is provided.
 */
type DefaultLifecycle = Record<string, AsyncFunc>;

/**
 * Extract only function property keys from a type.
 * This ensures only methods are available as hook names, not data properties.
 *
 * @example
 *     interface Doc {
 *         id: string;
 *         save(): Promise<void>;
 *         delete(): Promise<void>;
 *     }
 *
 *     type DocHooks = HookName<Doc>;  // 'save' | 'delete' (excludes 'id')
 */
export type HookName<T> = FunctionProps<T>;

export class HookEngine<Lifecycle = DefaultLifecycle, FailArgs extends unknown[] = [string]> {

    #hooks: Map<HookName<Lifecycle>, Set<HookFn<FuncOrNever<Lifecycle[HookName<Lifecycle>]>, FailArgs>>> = new Map();
    #hookOpts = new WeakMap<HookFn<any, any>, HookOptions<any, any>>();
    #handleFail: HandleFail<FailArgs>;
    #registered: Set<HookName<Lifecycle>> | null = null;

    constructor(options: HookEngineOptions<FailArgs> = {}) {

        this.#handleFail = options.handleFail ?? ((message: string): never => {

            throw new HookError(message);
        }) as unknown as HandleFail<FailArgs>;
    }

    /**
     * Validate that a hook is registered (if registration is enabled).
     */
    #assertRegistered(name: HookName<Lifecycle>, method: string) {

        if (this.#registered !== null && !this.#registered.has(name)) {

            const registered = [...this.#registered].map(String).join(', ');
            throw new Error(
                `Hook "${String(name)}" is not registered. ` +
                `Call register("${String(name)}") before using ${method}(). ` +
                `Registered hooks: ${registered || '(none)'}`
            );
        }
    }

    /**
     * Register hook names for runtime validation.
     * Once any hooks are registered, all hooks must be registered before use.
     *
     * @param names - Hook names to register
     * @returns this (for chaining)
     *
     * @example
     *     const hooks = new HookEngine<FetchLifecycle>()
     *         .register('preRequest', 'postRequest', 'rateLimit');
     *
     *     hooks.on('preRequest', cb);     // OK
     *     hooks.on('preRequset', cb);     // Error: not registered (typo caught!)
     */
    register(...names: HookName<Lifecycle>[]) {

        assert(names.length > 0, 'register() requires at least one hook name');

        if (this.#registered === null) {

            this.#registered = new Set();
        }

        for (const name of names) {

            assert(typeof name === 'string', `Hook name must be a string, got ${typeof name}`);
            this.#registered.add(name);
        }

        return this;
    }

    /**
     * Subscribe to a lifecycle hook.
     *
     * @param name - Name of the lifecycle hook
     * @param cbOrOpts - Callback function or options object
     * @returns Cleanup function to remove the subscription
     *
     * @example
     *     // Simple callback
     *     const cleanup = hooks.on('preRequest', async (ctx) => {
     *         console.log('Request:', ctx.args[0]);
     *     });
     *
     *     // With options
     *     hooks.on('analytics', {
     *         callback: async (ctx) => { track(ctx.args); },
     *         once: true,           // Remove after first run
     *         ignoreOnFail: true    // Don't throw if callback fails
     *     });
     *
     *     // Remove subscription
     *     cleanup();
     */
    on<K extends HookName<Lifecycle>>(
        name: K,
        cbOrOpts: HookOrOptions<FuncOrNever<Lifecycle[K]>, FailArgs>
    ) {

        const callback = typeof cbOrOpts === 'function' ? cbOrOpts : cbOrOpts?.callback;
        const opts = typeof cbOrOpts === 'function'
            ? {} as HookOptions<FuncOrNever<Lifecycle[K]>, FailArgs>
            : cbOrOpts;

        assert(typeof name === 'string', '"name" must be a string');
        assert(isFunction(callback) || isObject(cbOrOpts), '"cbOrOpts" must be a callback or options');
        assert(isFunction(callback), 'callback must be a function');

        this.#assertRegistered(name, 'on');

        const hooks = this.#hooks.get(name) ?? new Set();

        hooks.add(callback as HookFn<FuncOrNever<Lifecycle[keyof Lifecycle]>, FailArgs>);

        this.#hooks.set(name, hooks);
        this.#hookOpts.set(callback, opts);

        return () => {

            hooks.delete(callback as HookFn<FuncOrNever<Lifecycle[keyof Lifecycle]>, FailArgs>);
        }
    }

    /**
     * Subscribe to a lifecycle hook that fires only once.
     * Sugar for `on(name, { callback, once: true })`.
     *
     * @param name - Name of the lifecycle hook
     * @param callback - Callback function
     * @returns Cleanup function to remove the subscription
     *
     * @example
     *     // Log only the first request
     *     hooks.once('preRequest', async (ctx) => {
     *         console.log('First request:', ctx.args[0]);
     *     });
     */
    once<K extends HookName<Lifecycle>>(
        name: K,
        callback: HookFn<FuncOrNever<Lifecycle[K]>, FailArgs>
    ) {

        return this.on(name, { callback, once: true });
    }

    /**
     * Emit a lifecycle hook, running all subscribed callbacks.
     *
     * @param name - Name of the lifecycle hook to emit
     * @param args - Arguments to pass to callbacks
     * @returns EmitResult with final args, result, and earlyReturn flag
     *
     * @example
     *     const result = await hooks.emit('cacheCheck', url);
     *
     *     if (result.earlyReturn && result.result) {
     *         return result.result;  // Use cached value
     *     }
     *
     *     // Continue with modified args
     *     const [modifiedUrl] = result.args;
     */
    async emit<K extends HookName<Lifecycle>>(
        name: K,
        ...args: Parameters<FuncOrNever<Lifecycle[K]>>
    ): Promise<EmitResult<FuncOrNever<Lifecycle[K]>>> {

        this.#assertRegistered(name, 'emit');

        let earlyReturn = false;

        const hooks = this.#hooks.get(name);

        const context: HookContext<FuncOrNever<Lifecycle[K]>, FailArgs> = {
            args,
            removeHook() {},
            returnEarly() {

                earlyReturn = true;
            },
            setArgs: (next) => {

                assert(
                    Array.isArray(next),
                    `setArgs: args for '${String(name)}' must be an array`
                );

                context.args = next;
            },
            setResult: (next) => {

                context.result = next;
            },
            fail: ((...failArgs: FailArgs) => {

                const handler = this.#handleFail;

                // Check if handler is a constructor (class or function with prototype)
                const isConstructor = typeof handler === 'function' &&
                    handler.prototype?.constructor === handler;

                if (isConstructor) {

                    const error = new (handler as new (...args: FailArgs) => Error)(...failArgs);

                    if (error instanceof HookError) {

                        error.hookName = String(name);
                    }

                    throw error;
                }

                // For functions, call them and catch any thrown error to set hookName
                try {

                    (handler as (...args: FailArgs) => never)(...failArgs);
                }
                catch (error) {

                    if (error instanceof HookError) {

                        error.hookName = String(name);
                    }

                    throw error;
                }

                // If handler didn't throw, we need to throw something
                throw new HookError('ctx.fail() handler did not throw');
            }) as (...args: FailArgs) => never
        };

        if (!hooks || hooks.size === 0) {

            return {
                args: context.args,
                result: context.result,
                earlyReturn: false
            };
        }

        for (const fn of hooks) {

            context.removeHook = () => hooks.delete(fn as any);

            const opts: HookOptions<any, any> = this.#hookOpts.get(fn) ?? { callback: fn };
            const [, err] = await attempt(() => fn({ ...context } as any));

            if (opts.once) context.removeHook();

            if (err && opts.ignoreOnFail !== true) {

                throw err;
            }

            if (earlyReturn) break;
        }

        return {
            args: context.args,
            result: context.result,
            earlyReturn
        };
    }

    /**
     * Clear all registered hooks.
     *
     * @example
     *     hooks.on('preRequest', validator);
     *     hooks.on('postRequest', logger);
     *
     *     // Reset for testing
     *     hooks.clear();
     */
    clear() {

        this.#hooks.clear();
        this.#hookOpts = new WeakMap();
        this.#registered = null;
    }

    /**
     * Wrap a function with pre/post lifecycle hooks.
     *
     * - Pre hook: emitted with function args, can modify args or returnEarly with result
     * - Post hook: emitted with [result, ...args], can modify result
     *
     * @param fn - The async function to wrap
     * @param hooks - Object with optional pre and post hook names
     * @returns Wrapped function with same signature
     *
     * @example
     *     interface Lifecycle {
     *         preRequest(url: string, opts: RequestInit): Promise<Response>;
     *         postRequest(result: Response, url: string, opts: RequestInit): Promise<Response>;
     *     }
     *
     *     const hooks = new HookEngine<Lifecycle>();
     *
     *     // Add cache check in pre hook
     *     hooks.on('preRequest', async (ctx) => {
     *         const cached = cache.get(ctx.args[0]);
     *         if (cached) {
     *             ctx.setResult(cached);
     *             ctx.returnEarly();
     *         }
     *     });
     *
     *     // Log result in post hook
     *     hooks.on('postRequest', async (ctx) => {
     *         const [result, url] = ctx.args;
     *         console.log(`Fetched ${url}:`, result.status);
     *     });
     *
     *     // Wrap the fetch function
     *     const wrappedFetch = hooks.wrap(
     *         async (url: string, opts: RequestInit) => fetch(url, opts),
     *         { pre: 'preRequest', post: 'postRequest' }
     *     );
     */
    wrap<F extends AsyncFunc>(
        fn: F,
        hooks:
            | { pre: HookName<Lifecycle>; post?: HookName<Lifecycle> }
            | { pre?: HookName<Lifecycle>; post: HookName<Lifecycle> }
    ): (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>> {

        assert(
            hooks.pre || hooks.post,
            'wrap() requires at least one of "pre" or "post" hooks'
        );

        if (hooks.pre) this.#assertRegistered(hooks.pre, 'wrap');
        if (hooks.post) this.#assertRegistered(hooks.post, 'wrap');

        return async (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {

            let currentArgs = args;
            let result: Awaited<ReturnType<F>> | undefined;

            // Pre hook
            if (hooks.pre) {

                const preResult = await this.emit(hooks.pre, ...currentArgs as any);

                currentArgs = preResult.args as Parameters<F>;

                if (preResult.earlyReturn && preResult.result !== undefined) {

                    return preResult.result as Awaited<ReturnType<F>>;
                }
            }

            // Execute function
            result = await fn(...currentArgs);

            // Post hook
            if (hooks.post) {

                const postResult = await this.emit(
                    hooks.post,
                    ...[result, ...currentArgs] as any
                );

                if (postResult.result !== undefined) {

                    return postResult.result as Awaited<ReturnType<F>>;
                }
            }

            return result as Awaited<ReturnType<F>>;
        };
    }
}
