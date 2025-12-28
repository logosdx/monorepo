import {
    assert,
    AsyncFunc,
    attempt,
    isFunction,
    isObject,
    FunctionProps
} from '@logosdx/utils';

/**
 * Error thrown when a hook extension calls `fail()` or when hook execution fails.
 *
 * @example
 *     engine.extend('save', 'before', async (ctx) => {
 *         if (!ctx.args[0].isValid) {
 *             ctx.fail('Validation failed');
 *         }
 *     });
 *
 *     const [, err] = await attempt(() => app.save(data));
 *     if (isHookError(err)) {
 *         console.log(err.hookName);  // 'save'
 *         console.log(err.extPoint);  // 'before'
 *     }
 */
export class HookError extends Error {

    /** Name of the hook where the error occurred */
    hookName?: string;

    /** Extension point where the error occurred: 'before', 'after', or 'error' */
    extPoint?: string;

    /** Original error if `fail()` was called with an Error instance */
    originalError?: Error;

    /** Whether the hook was explicitly aborted via `fail()` */
    aborted = false;

    constructor(message: string) {

        super(message)
    }
}

/**
 * Type guard to check if an error is a HookError.
 *
 * @example
 *     const [result, err] = await attempt(() => app.save(data));
 *     if (isHookError(err)) {
 *         console.log(`Hook "${err.hookName}" failed at "${err.extPoint}"`);
 *     }
 */
export const isHookError = (error: unknown): error is HookError => {

    return (error as HookError)?.constructor?.name === HookError.name
}

interface HookShape<F extends AsyncFunc> {
    args: Parameters<F>,
    results?: Awaited<ReturnType<F>>
}

/**
 * Context object passed to hook extension callbacks.
 * Provides access to arguments, results, and control methods.
 *
 * @example
 *     engine.extend('fetch', 'before', async (ctx) => {
 *         // Read current arguments
 *         const [url, options] = ctx.args;
 *
 *         // Modify arguments before the original function runs
 *         ctx.setArgs([url, { ...options, cache: 'force-cache' }]);
 *
 *         // Or skip the original function entirely
 *         if (isCached(url)) {
 *             ctx.setResult(getCached(url));
 *             ctx.returnEarly();
 *         }
 *     });
 */
export interface HookContext<F extends AsyncFunc> extends HookShape<F> {

    /** Current extension point: 'before', 'after', or 'error' */
    point: keyof Hook<F>;

    /** Error from the original function (only set in 'error' extensions) */
    error?: unknown,

    /** Abort hook execution with an error. Throws a HookError. */
    fail: (error?: unknown) => never,

    /** Replace the arguments passed to the original function */
    setArgs: (next: Parameters<F>) => void,

    /** Replace the result returned from the hook chain */
    setResult: (next: Awaited<ReturnType<F>>) => void,

    /** Skip the original function and return early with the current result */
    returnEarly: () => void;

    /** Remove this extension from the hook (useful with `once` behavior) */
    removeHook: () => void;
}

export type HookFn<F extends AsyncFunc> = (ctx: HookContext<F>) => Promise<void>;

class Hook<F extends AsyncFunc> {
    before: Set<HookFn<F>> = new Set();
    after: Set<HookFn<F>> = new Set();
    error: Set<HookFn<F>> = new Set();
}

const allowedExtPoints = new Set([
    'before',
    'after',
    'error'
]);

type HookExtOptions<F extends AsyncFunc> = {
    callback: HookFn<F>,
    once?: true,
    ignoreOnFail?: true
}

type HookExtOrOptions<F extends AsyncFunc> = HookFn<F> | HookExtOptions<F>

type MakeHookOptions<F extends AsyncFunc> = {
    bindTo?: any
}

type FuncOrNever<T> = T extends AsyncFunc ? T : never;

/**
 * A lightweight, type-safe hook system for extending function behavior.
 *
 * HookEngine allows you to wrap functions and add extensions that run
 * before, after, or on error. Extensions can modify arguments, change
 * results, or abort execution entirely.
 *
 * @example
 *     interface MyApp {
 *         save(data: Data): Promise<Result>;
 *         load(id: string): Promise<Data>;
 *     }
 *
 *     const app = new MyAppImpl();
 *     const hooks = new HookEngine<MyApp>();
 *
 *     // Wrap a method to make it hookable
 *     hooks.wrap(app, 'save');
 *
 *     // Add a validation extension
 *     hooks.extend('save', 'before', async (ctx) => {
 *         if (!ctx.args[0].isValid) {
 *             ctx.fail('Validation failed');
 *         }
 *     });
 *
 *     // Add logging extension
 *     hooks.extend('save', 'after', async (ctx) => {
 *         console.log('Saved:', ctx.results);
 *     });
 *
 * @typeParam Shape - Interface defining the hookable functions
 */
export class HookEngine<Shape> {

    #registered = new Set<keyof Shape>();
    #hooks: Map<keyof Shape, Hook<FuncOrNever<Shape[keyof Shape]>>> = new Map();
    #hookFnOpts = new WeakMap();
    #wrapped = new WeakMap();

    /**
     * Add an extension to a registered hook.
     *
     * Extensions run at specific points in the hook lifecycle:
     * - `before`: Runs before the original function. Can modify args or return early.
     * - `after`: Runs after successful execution. Can modify the result.
     * - `error`: Runs when the original function throws. Can handle or transform errors.
     *
     * @param name - Name of the registered hook to extend
     * @param extensionPoint - When to run: 'before', 'after', or 'error'
     * @param cbOrOpts - Extension callback or options object
     * @returns Cleanup function to remove the extension
     *
     * @example
     *     // Simple callback
     *     const cleanup = hooks.extend('save', 'before', async (ctx) => {
     *         console.log('About to save:', ctx.args);
     *     });
     *
     *     // With options
     *     hooks.extend('save', 'after', {
     *         callback: async (ctx) => { console.log('Saved!'); },
     *         once: true,           // Remove after first run
     *         ignoreOnFail: true    // Don't throw if this extension fails
     *     });
     *
     *     // Later: remove the extension
     *     cleanup();
     */
    extend<K extends FunctionProps<Shape>>(
        name: K,
        extensionPoint: keyof Hook<FuncOrNever<Shape[K]>>,
        cbOrOpts: HookExtOrOptions<FuncOrNever<Shape[K]>>
    ) {
        const callback = typeof cbOrOpts === 'function' ? cbOrOpts : cbOrOpts?.callback;
        const opts = typeof cbOrOpts === 'function' ? {} as HookExtOptions<FuncOrNever<Shape[K]>> : cbOrOpts;

        assert(typeof name === 'string', '"name" must be a string');
        assert(this.#registered.has(name), `'${name.toString()}' is not a registered hook`);
        assert(typeof extensionPoint === 'string', '"extensionPoint" must be a string');
        assert(allowedExtPoints.has(extensionPoint), `'${extensionPoint}' is not a valid extension point`);
        assert(isFunction(callback) || isObject(cbOrOpts), '"cbOrOpts" must be a extension callback or options');
        assert(isFunction(callback), 'callback must be a function');

        const hook = this.#hooks.get(name) ?? new Hook<FuncOrNever<Shape[K]>>();

        hook[extensionPoint].add(callback);

        this.#hooks.set(name, hook);
        this.#hookFnOpts.set(callback, opts);

        /**
         * Removes the registered hook extension
         */
        return () => {

            hook[extensionPoint].delete(callback);
        }
    }

    /**
     * Register a function as a hookable and return the wrapped version.
     *
     * The wrapped function behaves identically to the original but allows
     * extensions to be added via `extend()`. Use `wrap()` for a simpler API
     * when working with object methods.
     *
     * @param name - Unique name for this hook (must match a key in Shape)
     * @param cb - The original function to wrap
     * @param opts - Options for the wrapped function
     * @returns Wrapped function with hook support
     *
     * @example
     *     const hooks = new HookEngine<{ fetch: typeof fetch }>();
     *
     *     const hookedFetch = hooks.make('fetch', fetch);
     *
     *     hooks.extend('fetch', 'before', async (ctx) => {
     *         console.log('Fetching:', ctx.args[0]);
     *     });
     *
     *     await hookedFetch('/api/data');
     */
    make<K extends FunctionProps<Shape>>(
        name: K,
        cb: FuncOrNever<Shape[K]>,
        opts: MakeHookOptions<FuncOrNever<Shape[K]>> = {}
    ) {

        assert(typeof name === 'string', '"name" must be a string');
        assert(!this.#registered.has(name), `'${name.toString()}' hook is already registered`);
        assert(isFunction(cb), '"cb" must be a function');
        assert(isObject(opts), '"opts" must be an object');

        this.#registered.add(name);

        if (this.#wrapped.has(cb)) {

            return this.#wrapped.get(cb) as FuncOrNever<Shape[K]>;
        }

        const callback = async (...origArgs: Parameters<FuncOrNever<Shape[K]>>) => {

            let returnEarly = false;

            const hook = this.#hooks.get(name)!;

            const context: HookContext<FuncOrNever<Shape[K]>> = {
                args: origArgs,
                point: 'before',
                removeHook() {},
                returnEarly() {
                    returnEarly = true;
                },
                setArgs(next) {

                    assert(
                        Array.isArray(next),
                        `setArgs: next args for '${context.point}' '${name.toString()}' must be an array of arguments`
                    );

                    context.args = next;
                },
                setResult(next) {
                    context.results = next;
                },
                fail(reason) {

                    const error = new HookError(`Hook Aborted: ${reason ?? 'unknown'}`);

                    if (reason instanceof Error) {

                        error.originalError = reason;
                    }

                    error.extPoint = context.point;
                    error.hookName = name as string;

                    throw error;
                },
            }

            const { before, after, error: errorFns } = hook ?? new Hook<FuncOrNever<Shape[K]>>();

            const handleSet = async (
                which: typeof before,
                point: keyof typeof hook
            ) => {

                context.point = point;

                for (const fn of which) {

                    context.removeHook = () => which.delete(fn);

                    const opts: HookExtOptions<FuncOrNever<Shape[K]>> = this.#hookFnOpts.get(fn);
                    const [, err] = await attempt(() => fn({ ...context }));

                    if (opts.once) context.removeHook();

                    if (err && opts.ignoreOnFail !== true) {
                        throw err;
                    }

                    if (returnEarly) break;
                }
            }

            await handleSet(before, 'before');

            if (returnEarly) return context.results!

            const [res, err] = await attempt(() => cb.apply(opts?.bindTo || cb, context.args));

            context.results = res;
            context.error = err;

            if (err) {
                context.point = 'error';

                await handleSet(errorFns, 'error');

                throw err;
            }

            await handleSet(after, 'after');

            return context.results!;
        }

        return callback as FuncOrNever<Shape[K]>;
    }

    /**
     * Wrap an object method in-place to make it hookable.
     *
     * This is a convenience method that combines `make()` with automatic
     * binding and reassignment. The method is replaced on the instance
     * with the wrapped version.
     *
     * @param instance - Object containing the method to wrap
     * @param name - Name of the method to wrap
     * @param opts - Additional options
     *
     * @example
     *     class UserService {
     *         async save(user: User) { ... }
     *     }
     *
     *     const service = new UserService();
     *     const hooks = new HookEngine<UserService>();
     *
     *     hooks.wrap(service, 'save');
     *
     *     // Now service.save() is hookable
     *     hooks.extend('save', 'before', async (ctx) => {
     *         console.log('Saving user:', ctx.args[0]);
     *     });
     */
    wrap<K extends FunctionProps<Shape>>(
        instance: Shape,
        name: K,
        opts?: MakeHookOptions<FuncOrNever<Shape[K]>>
    ) {

        assert(isObject(instance), '"instance" must be an object');

        const wrapped = this.make(
            name,
            instance[name] as FuncOrNever<Shape[K]>,
            {
                bindTo: instance,
                ...opts
            }
        );

        this.#wrapped.set(wrapped, instance[name] as AsyncFunc);

        instance[name] = wrapped as Shape[K];

    }

    /**
     * Clear all registered hooks and extensions.
     *
     * After calling this method, all hooks are unregistered and all
     * extensions are removed. Previously wrapped functions will continue
     * to work but without any extensions.
     *
     * @example
     *     hooks.wrap(app, 'save');
     *     hooks.extend('save', 'before', validator);
     *
     *     // Reset for testing
     *     hooks.clear();
     *
     *     // app.save() still works, but validator no longer runs
     */
    clear() {

        this.#registered.clear();
        this.#hooks.clear();
        this.#hookFnOpts = new WeakMap();
    }
}