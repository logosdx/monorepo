import {
    assert,
    attempt,
    attemptSync,
    FunctionProps,
    isFunction,
    isObject
} from '@logosdx/utils';

/**
 * Error thrown when a hook calls `ctx.fail()`.
 *
 * Only created when using the default `handleFail` behavior.
 * If a custom `handleFail` is provided, that error type is thrown instead.
 *
 * @example
 *     hooks.add('validate', (data, ctx) => {
 *         if (!data.isValid) ctx.fail('Validation failed');
 *     });
 *
 *     const [, err] = await attempt(() => engine.run('validate', data));
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

        super(message);
    }
}

/**
 * Type guard to check if an error is a HookError.
 *
 * @example
 *     const [, err] = await attempt(() => engine.run('validate', data));
 *     if (isHookError(err)) {
 *         console.log(`Hook "${err.hookName}" failed`);
 *     }
 */
export const isHookError = (error: unknown): error is HookError => {

    return (error as HookError)?.constructor?.name === HookError.name;
};

/**
 * Custom error handler for `ctx.fail()`.
 * Can be an Error constructor or a function that throws.
 */
export type HandleFail<Args extends unknown[] = [string]> =
    | (new (...args: Args) => Error)
    | ((...args: Args) => never);

/**
 * Request-scoped state bag that flows across hook runs and engine instances.
 *
 * Use symbols for private plugin state and strings for shared cross-plugin contracts.
 *
 * @example
 *     // Private plugin state (symbol key)
 *     const CACHE_STATE = Symbol('cache');
 *     ctx.scope.set(CACHE_STATE, { key, rule });
 *
 *     // Shared cross-plugin contract (string key)
 *     ctx.scope.set('serializedKey', key);
 */
export class HookScope {

    #data = new Map<symbol | string, unknown>();

    /**
     * Get a value from the scope.
     *
     * @example
     *     const state = ctx.scope.get<CacheState>(CACHE_STATE);
     */
    get<T = unknown>(key: symbol | string): T | undefined {

        return this.#data.get(key) as T | undefined;
    }

    /**
     * Set a value in the scope.
     *
     * @example
     *     ctx.scope.set(CACHE_STATE, { key: 'abc', rule });
     */
    set<T = unknown>(key: symbol | string, value: T): void {

        this.#data.set(key, value);
    }

    /**
     * Check if a key exists in the scope.
     */
    has(key: symbol | string): boolean {

        return this.#data.has(key);
    }

    /**
     * Delete a key from the scope.
     */
    delete(key: symbol | string): boolean {

        return this.#data.delete(key);
    }
}

const EARLY_RETURN: unique symbol = Symbol('early-return');
type EarlyReturnSignal = typeof EARLY_RETURN;

type FuncOrNever<T> = T extends (...args: any[]) => any ? T : never;

/**
 * Extract only function property keys from a type.
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

/**
 * Context object passed as the last argument to hook callbacks.
 * Provides methods to modify args, short-circuit, fail, or self-remove.
 *
 * @example
 *     // Replace args for downstream callbacks
 *     hooks.add('beforeRequest', (url, opts, ctx) => {
 *         ctx.args(url, { ...opts, cache: 'no-store' });
 *     });
 *
 *     // Short-circuit: replace args AND stop the chain
 *     hooks.add('beforeRequest', (url, opts, ctx) => {
 *         return ctx.args(normalizedUrl, opts);
 *     });
 *
 *     // Short-circuit with a result value
 *     hooks.add('beforeRequest', (url, opts, ctx) => {
 *         const cached = cache.get(url);
 *         if (cached) return ctx.returns(cached);
 *     });
 */
export class HookContext<
    Args extends unknown[] = unknown[],
    Result = unknown,
    FailArgs extends unknown[] = [string]
> {

    #args: Args | undefined;
    #argsChanged = false;
    #result: Result | undefined;
    #earlyReturn = false;
    #handleFail: HandleFail<FailArgs>;
    #hookName: string;
    #removeFn: () => void;

    /**
     * Request-scoped state bag shared across hook runs and engine instances.
     *
     * @example
     *     // In beforeRequest hook
     *     ctx.scope.set(CACHE_KEY, serializedKey);
     *
     *     // In afterRequest hook (same scope)
     *     const key = ctx.scope.get<string>(CACHE_KEY);
     */
    readonly scope: HookScope;

    /** @internal */
    constructor(
        handleFail: HandleFail<FailArgs>,
        hookName: string,
        removeFn: () => void,
        scope: HookScope
    ) {

        this.#handleFail = handleFail;
        this.#hookName = hookName;
        this.#removeFn = removeFn;
        this.scope = scope;
    }

    /**
     * Replace args for downstream callbacks.
     * When used with `return`, also stops the chain.
     *
     * @example
     *     // Just replace args, continue chain
     *     ctx.args(newUrl, newOpts);
     *
     *     // Replace args AND stop the chain
     *     return ctx.args(newUrl, newOpts);
     */
    args(...args: Args): EarlyReturnSignal {

        this.#args = args;
        this.#argsChanged = true;
        return EARLY_RETURN;
    }

    /**
     * Set a result value and stop the chain.
     * Always used with `return`.
     *
     * @example
     *     return ctx.returns(cachedResponse);
     */
    returns(value: Result): EarlyReturnSignal {

        this.#result = value;
        this.#earlyReturn = true;
        return EARLY_RETURN;
    }

    /**
     * Abort hook execution with an error.
     * Uses the engine's `handleFail` to create the error.
     *
     * @example
     *     ctx.fail('Validation failed');
     */
    fail(...args: FailArgs): never {

        const handler = this.#handleFail;

        const isConstructor = typeof handler === 'function' &&
            handler.prototype?.constructor === handler;

        const [, error] = attemptSync(() => {

            if (isConstructor) {

                throw new (handler as new (...a: FailArgs) => Error)(...args);
            }

            (handler as (...a: FailArgs) => never)(...args);
        });

        if (error) {

            if (error instanceof HookError) {

                error.hookName = this.#hookName;
            }

            throw error;
        }

        throw new HookError('ctx.fail() handler did not throw');
    }

    /**
     * Remove this callback from future runs.
     *
     * @example
     *     hooks.add('init', (config, ctx) => {
     *         bootstrap(config);
     *         ctx.removeHook();
     *     });
     */
    removeHook(): void {

        this.#removeFn();
    }

    /** @internal */
    get _argsChanged(): boolean { return this.#argsChanged; }

    /** @internal */
    get _newArgs(): Args | undefined { return this.#args; }

    /** @internal */
    get _result(): Result | undefined { return this.#result; }

    /** @internal */
    get _earlyReturn(): boolean { return this.#earlyReturn; }
}

/**
 * Context object passed as the last argument to pipe middleware callbacks.
 * Simpler than HookContext — no `returns()` needed since you control
 * flow by calling or not calling `next()`.
 *
 * @example
 *     hooks.add('execute', async (next, opts, ctx) => {
 *         // Modify opts for inner layers
 *         ctx.args({ ...opts, headers: { ...opts.headers, Auth: token } });
 *
 *         // Call next to continue the chain, or don't to short-circuit
 *         return next();
 *     });
 */
export class PipeContext<
    FailArgs extends unknown[] = [string]
> {

    #handleFail: HandleFail<FailArgs>;
    #hookName: string;
    #removeFn: () => void;
    #setArgs: (args: unknown[]) => void;

    /**
     * Request-scoped state bag shared across hook runs and engine instances.
     */
    readonly scope: HookScope;

    /** @internal */
    constructor(
        handleFail: HandleFail<FailArgs>,
        hookName: string,
        removeFn: () => void,
        scope: HookScope,
        setArgs: (args: unknown[]) => void
    ) {

        this.#handleFail = handleFail;
        this.#hookName = hookName;
        this.#removeFn = removeFn;
        this.scope = scope;
        this.#setArgs = setArgs;
    }

    /**
     * Replace args for `next()` and downstream middleware.
     *
     * @example
     *     ctx.args({ ...opts, timeout: 5000 });
     *     return next(); // next receives modified opts
     */
    args(...args: unknown[]): void {

        this.#setArgs(args);
    }

    /**
     * Abort execution with an error.
     *
     * @example
     *     ctx.fail('Rate limit exceeded');
     */
    fail(...args: FailArgs): never {

        const handler = this.#handleFail;

        const isConstructor = typeof handler === 'function' &&
            handler.prototype?.constructor === handler;

        const [, error] = attemptSync(() => {

            if (isConstructor) {

                throw new (handler as new (...a: FailArgs) => Error)(...args);
            }

            (handler as (...a: FailArgs) => never)(...args);
        });

        if (error) {

            if (error instanceof HookError) {

                error.hookName = this.#hookName;
            }

            throw error;
        }

        throw new HookError('ctx.fail() handler did not throw');
    }

    /**
     * Remove this middleware from future runs.
     */
    removeHook(): void {

        this.#removeFn();
    }
}

/**
 * Callback type for hooks. Receives spread args + ctx as last param.
 *
 * @example
 *     type BeforeRequest = HookCallback<(url: string, opts: RequestInit) => Promise<Response>>;
 *     // (url: string, opts: RequestInit, ctx: HookContext) => void | EarlyReturnSignal | Promise<...>
 */
export type HookCallback<
    F extends (...args: any[]) => any = (...args: any[]) => any,
    FailArgs extends unknown[] = [string]
> = F extends (...args: infer A) => infer R
    ? (...args: [...A, HookContext<A, Awaited<R>, FailArgs>]) => void | EarlyReturnSignal | Promise<void | EarlyReturnSignal>
    : never;

/**
 * Callback type for pipe middleware. Receives `(next, ...args, ctx)`.
 *
 * @example
 *     type ExecuteMiddleware = PipeCallback<[opts: RequestOpts]>;
 *     // (next: () => Promise<R>, opts: RequestOpts, ctx: PipeContext) => R | Promise<R>
 */
export type PipeCallback<
    Args extends unknown[] = unknown[],
    R = unknown,
    FailArgs extends unknown[] = [string]
> = (next: () => R | Promise<R>, ...args: [...Args, PipeContext<FailArgs>]) => R | Promise<R>;

/**
 * Result returned from `run()`/`runSync()` after executing all hook callbacks.
 */
export interface RunResult<F extends (...args: any[]) => any = (...args: any[]) => any> {

    /** Current arguments (possibly modified by callbacks) */
    args: Parameters<F>;

    /** Result value (if set via `ctx.returns()`) */
    result: Awaited<ReturnType<F>> | undefined;

    /** Whether a callback short-circuited via `return ctx.returns()` or `return ctx.args()` */
    returned: boolean;

    /** The scope used during this run (pass to subsequent runs to share state) */
    scope: HookScope;
}

type DefaultLifecycle = Record<string, (...args: any[]) => any>;

type HookEntry<F extends (...args: any[]) => any, FailArgs extends unknown[]> = {
    callback: HookCallback<F, FailArgs>;
    options: HookEngine.AddOptions;
    priority: number;
};

/**
 * A lightweight, type-safe lifecycle hook system.
 *
 * HookEngine allows you to define lifecycle events and subscribe to them.
 * Callbacks receive spread arguments with a context object as the last param.
 *
 * @example
 *     interface FetchLifecycle {
 *         beforeRequest(url: string, options: RequestInit): Promise<Response>;
 *         afterRequest(response: Response, url: string): Promise<Response>;
 *     }
 *
 *     const hooks = new HookEngine<FetchLifecycle>();
 *
 *     hooks.add('beforeRequest', (url, opts, ctx) => {
 *         ctx.args(url, { ...opts, headers: { ...opts.headers, 'X-Token': token } });
 *     });
 *
 *     hooks.add('beforeRequest', (url, opts, ctx) => {
 *         const cached = cache.get(url);
 *         if (cached) return ctx.returns(cached);
 *     });
 *
 *     const pre = await hooks.run('beforeRequest', url, options);
 *     if (pre.returned) return pre.result;
 *     const response = await fetch(...pre.args);
 *
 * @typeParam Lifecycle - Interface defining the lifecycle hooks
 * @typeParam FailArgs - Arguments type for ctx.fail() (default: [string])
 */
export class HookEngine<Lifecycle = DefaultLifecycle, FailArgs extends unknown[] = [string]> {

    #hooks: Map<string, Array<HookEntry<any, FailArgs>>> = new Map();
    #handleFail: HandleFail<FailArgs>;
    #registered: Set<HookName<Lifecycle>> | null = null;
    #callCounts: WeakMap<Function, number> = new WeakMap();

    constructor(options: HookEngine.Options<FailArgs> = {}) {

        this.#handleFail = options.handleFail ?? ((message: string): never => {

            throw new HookError(message);
        }) as unknown as HandleFail<FailArgs>;
    }

    /**
     * Validate that a hook name is registered (when strict mode is active).
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
     *         .register('beforeRequest', 'afterRequest');
     *
     *     hooks.add('beforeRequest', cb);     // OK
     *     hooks.add('beforeRequset', cb);     // Error: not registered (typo caught!)
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
     * @param callback - Callback function receiving spread args + ctx
     * @param options - Options for this subscription
     * @returns Cleanup function to remove the subscription
     *
     * @example
     *     // Simple callback
     *     const cleanup = hooks.add('beforeRequest', (url, opts, ctx) => {
     *         console.log('Request:', url);
     *     });
     *
     *     // With options
     *     hooks.add('analytics', (event, ctx) => {
     *         track(event);
     *     }, { once: true, ignoreOnFail: true });
     *
     *     // With priority (lower runs first)
     *     hooks.add('beforeRequest', cb, { priority: -10 });
     *
     *     // Remove subscription
     *     cleanup();
     */
    add<K extends HookName<Lifecycle>>(
        name: K,
        callback: HookCallback<FuncOrNever<Lifecycle[K]>, FailArgs>,
        options: HookEngine.AddOptions = {}
    ): () => void {

        assert(typeof name === 'string', '"name" must be a string');
        assert(isFunction(callback), '"callback" must be a function');

        this.#assertRegistered(name, 'add');

        const priority = options.priority ?? 0;
        const entry: HookEntry<any, FailArgs> = { callback, options, priority };

        const hooks = this.#hooks.get(name as string) ?? [];

        let inserted = false;

        for (let i = 0; i < hooks.length; i++) {

            if (hooks[i]!.priority > priority) {

                hooks.splice(i, 0, entry);
                inserted = true;
                break;
            }
        }

        if (!inserted) {

            hooks.push(entry);
        }

        this.#hooks.set(name as string, hooks);

        return () => {

            const arr = this.#hooks.get(name as string);

            if (arr) {

                const idx = arr.indexOf(entry);

                if (idx !== -1) {

                    arr.splice(idx, 1);
                }
            }
        };
    }

    /**
     * Run all callbacks for a hook asynchronously.
     *
     * @param name - Name of the lifecycle hook to run
     * @param args - Arguments to pass to callbacks (spread + ctx)
     * @returns RunResult with final args, result, and returned flag
     *
     * @example
     *     const pre = await hooks.run('beforeRequest', url, options);
     *     if (pre.returned) return pre.result;
     *     const response = await fetch(...pre.args);
     */
    async run<K extends HookName<Lifecycle>>(
        name: K,
        ...args: Parameters<FuncOrNever<Lifecycle[K]>> | [...Parameters<FuncOrNever<Lifecycle[K]>>, HookEngine.RunOptions<FuncOrNever<Lifecycle[K]>>]
    ): Promise<RunResult<FuncOrNever<Lifecycle[K]>>> {

        this.#assertRegistered(name, 'run');

        const { realArgs, runOptions } = this.#extractRunOptions(args);
        let currentArgs = realArgs as Parameters<FuncOrNever<Lifecycle[K]>>;
        const scope = runOptions?.scope ?? new HookScope();

        const hooks = this.#hooks.get(name as string);
        const entries = hooks ? [...hooks] : [];

        if (runOptions?.append) {

            entries.push({
                callback: runOptions.append as unknown as HookCallback<any, FailArgs>,
                options: {},
                priority: Infinity
            });
        }

        let result: Awaited<ReturnType<FuncOrNever<Lifecycle[K]>>> | undefined;
        let returned = false;

        for (const entry of entries) {

            const { callback, options: opts } = entry;

            const timesExceeded = this.#checkTimes(callback, opts);

            if (timesExceeded) {

                this.#removeEntry(name as string, entry);
                continue;
            }

            const removeFn = () => this.#removeEntry(name as string, entry);
            const ctx = new HookContext<any, any, FailArgs>(this.#handleFail, String(name), removeFn, scope);

            if (opts.ignoreOnFail) {

                const [, err] = await attempt(async () => {

                    const signal = await callback(...currentArgs, ctx);
                    this.#processCtx(ctx, signal, (a) => { currentArgs = a; }, (r) => { result = r; }, () => { returned = true; });
                });

                if (!err && opts.once) removeFn();

                if (returned) break;
                continue;
            }

            const signal = await callback(...currentArgs, ctx);
            this.#processCtx(ctx, signal, (a) => { currentArgs = a; }, (r) => { result = r; }, () => { returned = true; });

            if (opts.once) removeFn();

            if (returned) break;
        }

        return { args: currentArgs, result, returned, scope };
    }

    /**
     * Run all callbacks for a hook synchronously.
     *
     * @param name - Name of the lifecycle hook to run
     * @param args - Arguments to pass to callbacks (spread + ctx)
     * @returns RunResult with final args, result, and returned flag
     *
     * @example
     *     const pre = hooks.runSync('beforeValidation', data);
     *     if (pre.returned) return pre.result;
     */
    runSync<K extends HookName<Lifecycle>>(
        name: K,
        ...args: Parameters<FuncOrNever<Lifecycle[K]>> | [...Parameters<FuncOrNever<Lifecycle[K]>>, HookEngine.RunOptions<FuncOrNever<Lifecycle[K]>>]
    ): RunResult<FuncOrNever<Lifecycle[K]>> {

        this.#assertRegistered(name, 'runSync');

        const { realArgs, runOptions } = this.#extractRunOptions(args as unknown[]);
        let currentArgs = realArgs as Parameters<FuncOrNever<Lifecycle[K]>>;
        const scope = runOptions?.scope ?? new HookScope();

        const hooks = this.#hooks.get(name as string);
        const entries = hooks ? [...hooks] : [];

        if (runOptions?.append) {

            entries.push({
                callback: runOptions.append as unknown as HookCallback<any, FailArgs>,
                options: {},
                priority: Infinity
            });
        }

        let result: Awaited<ReturnType<FuncOrNever<Lifecycle[K]>>> | undefined;
        let returned = false;

        for (const entry of entries) {

            const { callback, options: opts } = entry;

            const timesExceeded = this.#checkTimes(callback, opts);

            if (timesExceeded) {

                this.#removeEntry(name as string, entry);
                continue;
            }

            const removeFn = () => this.#removeEntry(name as string, entry);
            const ctx = new HookContext<any, any, FailArgs>(this.#handleFail, String(name), removeFn, scope);

            if (opts.ignoreOnFail) {

                const [, err] = attemptSync(() => {

                    const signal = callback(...currentArgs, ctx);
                    this.#processCtx(ctx, signal, (a) => { currentArgs = a; }, (r) => { result = r; }, () => { returned = true; });
                });

                if (!err && opts.once) removeFn();

                if (returned) break;
                continue;
            }

            const signal = callback(...currentArgs, ctx);
            this.#processCtx(ctx, signal, (a) => { currentArgs = a; }, (r) => { result = r; }, () => { returned = true; });

            if (opts.once) removeFn();

            if (returned) break;
        }

        return { args: currentArgs, result, returned, scope };
    }

    /**
     * Wrap an async function with pre/post lifecycle hooks.
     *
     * - Pre hook: called with function args, can modify args or return early
     * - Post hook: called with `(result, ...originalArgs)`, can transform result
     *
     * @param fn - The async function to wrap
     * @param hooks - Object with optional pre and post hook names
     * @returns Wrapped function with same signature
     *
     * @example
     *     const wrappedFetch = hooks.wrap(
     *         async (url: string, opts: RequestInit) => fetch(url, opts),
     *         { pre: 'beforeRequest', post: 'afterRequest' }
     *     );
     */
    wrap<F extends (...args: any[]) => Promise<any>>(
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

            if (hooks.pre) {

                const preResult = await this.run(hooks.pre, ...currentArgs as any);
                currentArgs = preResult.args as Parameters<F>;

                if (preResult.returned && preResult.result !== undefined) {

                    return preResult.result as Awaited<ReturnType<F>>;
                }
            }

            const result = await fn(...currentArgs);

            if (hooks.post) {

                const postResult = await this.run(
                    hooks.post,
                    ...[result, ...currentArgs] as any
                );

                if (postResult.returned) {

                    return postResult.result as Awaited<ReturnType<F>>;
                }
            }

            return result as Awaited<ReturnType<F>>;
        };
    }

    /**
     * Wrap a synchronous function with pre/post lifecycle hooks.
     *
     * @param fn - The sync function to wrap
     * @param hooks - Object with optional pre and post hook names
     * @returns Wrapped function with same signature
     *
     * @example
     *     const wrappedValidate = hooks.wrapSync(
     *         (data: UserData) => validate(data),
     *         { pre: 'beforeValidate' }
     *     );
     */
    wrapSync<F extends (...args: any[]) => any>(
        fn: F,
        hooks:
            | { pre: HookName<Lifecycle>; post?: HookName<Lifecycle> }
            | { pre?: HookName<Lifecycle>; post: HookName<Lifecycle> }
    ): (...args: Parameters<F>) => ReturnType<F> {

        assert(
            hooks.pre || hooks.post,
            'wrapSync() requires at least one of "pre" or "post" hooks'
        );

        if (hooks.pre) this.#assertRegistered(hooks.pre, 'wrapSync');
        if (hooks.post) this.#assertRegistered(hooks.post, 'wrapSync');

        return (...args: Parameters<F>): ReturnType<F> => {

            let currentArgs = args;

            if (hooks.pre) {

                const preResult = this.runSync(hooks.pre, ...currentArgs as any);
                currentArgs = preResult.args as Parameters<F>;

                if (preResult.returned && preResult.result !== undefined) {

                    return preResult.result as ReturnType<F>;
                }
            }

            const result = fn(...currentArgs);

            if (hooks.post) {

                const postResult = this.runSync(
                    hooks.post,
                    ...[result, ...currentArgs] as any
                );

                if (postResult.returned) {

                    return postResult.result as ReturnType<F>;
                }
            }

            return result as ReturnType<F>;
        };
    }

    /**
     * Execute middleware hooks as an onion (nested) composition.
     *
     * Unlike `run()` which executes hooks linearly, `pipe()` composes hooks
     * as nested middleware. Each hook receives a `next` function that calls
     * the next layer. The innermost layer is `coreFn`. Control flow is
     * managed by calling or not calling `next()` — no `ctx.returns()` needed.
     *
     * Hooks execute in priority order (lower first = outermost layer).
     *
     * @param name - Name of the lifecycle hook
     * @param coreFn - The innermost function to wrap
     * @param args - Arguments passed to each middleware
     * @returns The result from the middleware chain
     *
     * @example
     *     // Retry plugin wraps the fetch call
     *     hooks.add('execute', async (next, opts, ctx) => {
     *         for (let i = 0; i < 3; i++) {
     *             const [result, err] = await attempt(next);
     *             if (!err) return result;
     *             await wait(1000 * i);
     *         }
     *         throw lastError;
     *     }, { priority: -20 });
     *
     *     // Dedupe plugin wraps retry
     *     hooks.add('execute', async (next, opts, ctx) => {
     *         const inflight = getInflight(key);
     *         if (inflight) return inflight;
     *         const result = await next();
     *         share(result);
     *         return result;
     *     }, { priority: -30 });
     *
     *     // Execute: dedupe( retry( makeCall() ) )
     *     const response = await hooks.pipe(
     *         'execute',
     *         () => makeCall(opts),
     *         opts
     *     );
     */
    async pipe<K extends HookName<Lifecycle>, R = unknown>(
        name: K,
        coreFn: () => Promise<R>,
        ...args: unknown[]
    ): Promise<R> {

        this.#assertRegistered(name, 'pipe');

        const { realArgs, runOptions } = this.#extractRunOptions(args);
        const scope = runOptions?.scope ?? new HookScope();

        const hooks = this.#hooks.get(name as string);
        const entries = hooks ? [...hooks] : [];

        if (runOptions?.append) {

            entries.push({
                callback: runOptions.append as unknown as HookCallback<any, FailArgs>,
                options: {},
                priority: Infinity
            });
        }

        let currentArgs = realArgs;

        const buildChain = (index: number): (() => Promise<R>) => {

            if (index >= entries.length) return coreFn;

            return async () => {

                const entry = entries[index]!;
                const { callback, options: opts } = entry;

                const timesExceeded = this.#checkTimes(callback, opts);

                if (timesExceeded) {

                    this.#removeEntry(name as string, entry);
                    return buildChain(index + 1)();
                }

                const removeFn = () => this.#removeEntry(name as string, entry);
                const ctx = new PipeContext<FailArgs>(
                    this.#handleFail,
                    String(name),
                    removeFn,
                    scope,
                    (newArgs) => { currentArgs = newArgs; }
                );

                const next = buildChain(index + 1);
                const cb = callback as any;

                if (opts.ignoreOnFail) {

                    const [result, err] = await attempt(
                        async () => cb(next, ...currentArgs, ctx)
                    );

                    if (opts.once) removeFn();

                    if (err) return next();

                    return result as R;
                }

                const result = await cb(next, ...currentArgs, ctx);

                if (opts.once) removeFn();

                return result as R;
            };
        };

        return buildChain(0)();
    }

    /**
     * Synchronous version of `pipe()`.
     *
     * @param name - Name of the lifecycle hook
     * @param coreFn - The innermost function to wrap
     * @param args - Arguments passed to each middleware
     * @returns The result from the middleware chain
     */
    pipeSync<K extends HookName<Lifecycle>, R = unknown>(
        name: K,
        coreFn: () => R,
        ...args: unknown[]
    ): R {

        this.#assertRegistered(name, 'pipeSync');

        const { realArgs, runOptions } = this.#extractRunOptions(args);
        const scope = runOptions?.scope ?? new HookScope();

        const hooks = this.#hooks.get(name as string);
        const entries = hooks ? [...hooks] : [];

        if (runOptions?.append) {

            entries.push({
                callback: runOptions.append as unknown as HookCallback<any, FailArgs>,
                options: {},
                priority: Infinity
            });
        }

        let currentArgs = realArgs;

        const buildChain = (index: number): (() => R) => {

            if (index >= entries.length) return coreFn;

            return () => {

                const entry = entries[index]!;
                const { callback, options: opts } = entry;

                const timesExceeded = this.#checkTimes(callback, opts);

                if (timesExceeded) {

                    this.#removeEntry(name as string, entry);
                    return buildChain(index + 1)();
                }

                const removeFn = () => this.#removeEntry(name as string, entry);
                const ctx = new PipeContext<FailArgs>(
                    this.#handleFail,
                    String(name),
                    removeFn,
                    scope,
                    (newArgs) => { currentArgs = newArgs; }
                );

                const next = buildChain(index + 1);
                const cb = callback as any;

                if (opts.ignoreOnFail) {

                    const [result, err] = attemptSync(
                        () => cb(next, ...currentArgs, ctx)
                    );

                    if (opts.once) removeFn();

                    if (err) return next();

                    return result as R;
                }

                const result = cb(next, ...currentArgs, ctx);

                if (opts.once) removeFn();

                return result as R;
            };
        };

        return buildChain(0)();
    }

    /**
     * Clear all hooks and reset registration state.
     *
     * @example
     *     hooks.add('beforeRequest', validator);
     *     hooks.clear();
     *     // All hooks removed, back to permissive mode
     */
    clear() {

        this.#hooks.clear();
        this.#registered = null;
        this.#callCounts = new WeakMap();
    }

    /**
     * Process a HookContext after a callback has run.
     */
    #processCtx(
        ctx: HookContext<any, any, FailArgs>,
        signal: unknown,
        setArgs: (a: any) => void,
        setResult: (r: any) => void,
        setReturned: () => void
    ) {

        if (ctx._earlyReturn) {

            setResult(ctx._result);
            setReturned();
            return;
        }

        if (ctx._argsChanged) {

            setArgs(ctx._newArgs);

            if (signal === EARLY_RETURN) {

                setReturned();
            }
        }
    }

    /**
     * Check times limit and increment counter. Returns true if exceeded.
     */
    #checkTimes(callback: Function, opts: HookEngine.AddOptions): boolean {

        if (opts.times === undefined) return false;

        const count = this.#callCounts.get(callback) ?? 0;

        if (count >= opts.times) return true;

        this.#callCounts.set(callback, count + 1);
        return false;
    }

    /**
     * Remove an entry from the hooks array.
     */
    #removeEntry(name: string, entry: HookEntry<any, FailArgs>) {

        const arr = this.#hooks.get(name);

        if (arr) {

            const idx = arr.indexOf(entry);

            if (idx !== -1) {

                arr.splice(idx, 1);
            }
        }
    }

    /**
     * Extract RunOptions from the args array if present.
     */
    #extractRunOptions(
        args: unknown[]
    ): { realArgs: unknown[]; runOptions: HookEngine.RunOptions<any> | undefined } {

        const last = args[args.length - 1];

        if (isObject(last) && (
            ('append' in (last as object) && isFunction((last as any).append)) ||
            ('scope' in (last as object) && (last as any).scope instanceof HookScope)
        )) {

            return {
                realArgs: args.slice(0, -1),
                runOptions: last as HookEngine.RunOptions<any>
            };
        }

        return { realArgs: args, runOptions: undefined };
    }
}

export namespace HookEngine {

    export interface Options<FailArgs extends unknown[] = [string]> {

        /**
         * Custom handler for `ctx.fail()`.
         * Can be an Error constructor or a function that throws.
         *
         * @example
         *     new HookEngine({ handleFail: HttpsError });
         */
        handleFail?: HandleFail<FailArgs>;
    }

    export interface AddOptions {

        /** Remove after first run (sugar for `times: 1`) */
        once?: true;

        /** Run N times then auto-remove */
        times?: number;

        /** Swallow errors from this callback, continue chain */
        ignoreOnFail?: true;

        /** Execution order, lower runs first. Default 0. */
        priority?: number;
    }

    export interface RunOptions<F extends (...args: any[]) => any = (...args: any[]) => any> {

        /** Ephemeral callback that runs last (for per-request hooks) */
        append?: HookCallback<F>;

        /** Shared scope that flows across hook runs and engine instances */
        scope?: HookScope;
    }

    export interface PipeOptions {

        /** Ephemeral middleware that runs last (innermost before coreFn) */
        append?: (...args: any[]) => any;

        /** Shared scope that flows across hook runs and engine instances */
        scope?: HookScope;
    }
}
