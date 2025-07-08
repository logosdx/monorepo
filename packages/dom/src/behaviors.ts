import { attemptSync, debounce, assert, itemsToArray, isPlainObject, allKeysValid, isFunction, isOptional, noop } from '@logosdx/utils';
import { HtmlEvents } from './events.ts';
import { $ } from './index.ts';

type BehaviorHandler = (el: Element) => Unbind | void;

type Unbind = () => void;
type BehaviorCb = () => Unbind | void;
type BehaviorInit = BehaviorCb | {
    els: string | Element | Element[];
    handler: BehaviorHandler;
    shouldObserve?: boolean;
    shouldDispatch?: boolean;
    debounceMs?: number;
};

/**
 * Registry to track observed feature/selector combinations
 *
 * Enables efficient tracking of which features are being watched for dynamic DOM changes, so that behaviors can be bound automatically as new elements appear. This avoids manual re-initialization and ensures features are only observed once per selector/root.
 */
interface ObservedFeature {
    feature: string;
    selector: string;
    eventDispatcher: () => void;
    root: Element;
}

/**
 * Error thrown when MutationObserver is not available in the environment
 */
export class MutationObserverUnavailableError extends Error {

    constructor() {

        super('MutationObserver not available in this environment. observePrepare will not work.');
        this.name = 'MutationObserverUnavailableError';
    }
}

/**
 * HtmlBehaviors
 *
 * Centralizes all logic for declarative, safe, and automatic DOM behavior binding. Solves the problem of dynamic content in SPAs and component frameworks, where elements may appear/disappear at any time. Prevents duplicate bindings, memory leaks, and missed features by tracking state and using MutationObserver.
 *
 * Use static methods to register, bind, and observe behaviors. See method-level examples for usage patterns.
 */
export class HtmlBehaviors {

    static #log(...args: any[]): void {

        if (!this.#debug) return
        console.debug('[HtmlBehaviors]', ...args);
    }

    static #ok(...args: any[]): void {

        this.#log('✅', ...args);
    }

    static #error(...args: any[]): void {

        this.#log('❌', ...args);
    }

    static #warn(...args: any[]): void {

        this.#log('⚠️', ...args);
    }

    static #debug = false;

    static debug(on: boolean): void {

        this.#debug = on;

        if (on) this.#ok('Debug mode enabled');
    }

    /**
     * Registry of bound elements to features
     */
    static #boundElements = new WeakMap<Element, Set<string>>();

    static #unbinders = new WeakMap<Element, Map<string, Unbind>>();

    /**
     * Registry of all observed features across different roots
     */
    static #observedFeatures = new Map<string, ObservedFeature>();

    /**
     * Registry of MutationObservers per root element
     */
    static #rootObservers = new Map<Element, MutationObserver>();


    /**
     * Prevents duplicate event handlers or behavior logic from
     * being attached to the same element/feature, which can cause
     * bugs or memory leaks. Used internally to ensure idempotent
     * binding.
     */
    static isBound<T extends Element>(el: T, feature: string): boolean {

        const isBound = this.#boundElements.get(el)?.has(feature) ?? false;

        this.#ok('isBound', feature, el, isBound);

        return isBound;
    }

    /**
     * Returns all features bound to an element
     */
    static allBound(el: Element): string[] {

        return Array.from(this.#boundElements.get(el) ?? []);
    }

    /**
     * Ensures that future attempts to bind the same feature to this
     * element are ignored, enforcing idempotency and preventing resource
     * leaks.
     */
    static #markBound<T extends Element>(el: T, feature: string): void {

        const boundFeatures = this.#boundElements.get(el) ?? new Set();
        boundFeatures.add(feature);
        this.#boundElements.set(el, boundFeatures);

        this.#ok('markBound', feature, el);
    }

    /**
     * Allows behaviors to be initialized only when needed, supporting
     * lazy or on-demand setup. This pattern is crucial for performance
     * in large apps and for features that may not always be present.
     *
     * Register a callback for a feature, then dispatch the feature when
     * ready. See example.
     *
     * @param feature The feature name (will listen to `prepare:${feature}`)
     * @param init The initialization function to run when the event is triggered
     * @returns A cleanup function to unregister the event listener
     *
     * @example
     * const cleanup = html.behaviors.on('copy', () => {
     *     const copyEls = $('[copy]');
     *     return html.behaviors.bind(copyEls, 'Copy', el => new CopyToClipboard(el));
     * });
     * cleanup(); // Unregister and unbind all features
     */
    static on(feature: string, init: BehaviorCb): Unbind {

        assert(typeof feature === 'string' && feature.length > 0, 'Feature name must be a non-empty string');
        assert(typeof init === 'function', 'Init must be a function');

        this.#ok('on', feature);

        const unbinds = new Set<Unbind>();

        const off = HtmlEvents.on(window, `init:${feature}`, () => {

            const unbind = init();
            unbind && unbinds.add(unbind);
        });

        unbinds.add(off);

        return () => {

            unbinds.forEach(unbind => unbind?.());
            unbinds.clear();
        }
    }

    /**
     * Triggers all registered initialization logic for a feature, ensuring
     * that behaviors are set up when the DOM is ready or when new content
     * is added. Use this after dynamic DOM changes or on page load.
     *
     * @param features The feature names to prepare
     *
     * @example
     * html.behaviors.dispatch('copy', 'nav', 'modal');
     */
    static dispatch(...features: string[]): void {

        assert(
            features.every(feature => typeof feature === 'string' && feature.length > 0),
            'Feature names must be non-empty strings'
        );

        this.#ok('dispatching', features);

        features.forEach(feature => {

            HtmlEvents.emit(window, `init:${feature}`);
        });
    }

    static #bindOne(el: Element, featureName: string, handler: BehaviorHandler) {

        if (this.isBound(el as Element, featureName)) {

            return;
        }

        assert(typeof featureName === 'string' && featureName.length > 0, 'Feature name must be a non-empty string');
        assert(typeof handler === 'function', 'Handler must be a function');

        const [unbind, err] = attemptSync(() => handler(el as Element));

        if (err) {

            this.#error(`Failed to bind ${featureName}:`, err);
            return;
        }

        this.#markBound(el as Element, featureName);

        if (isFunction(unbind)) {

            const unbinders = this.#unbinders.get(el) ?? new Map();
            unbinders.set(featureName, unbind);
            this.#unbinders.set(el, unbinders);
        }

        return unbind ?? noop;
    }

    /**
     * Guarantees that each element/feature pair is only bound once,
     * and that errors in user-provided handlers do not break the app.
     * This is the core method for attaching behaviors to elements,
     * and is used by higher-level APIs.
     *
     * **NOTE:** The returned cleanup function must be called to
     * unbind the behavior. You are responsible for implementing
     * cleanup logic in you r handler.
     *
     * Call with an element, feature name, and handler. Can be used
     * with single elements, arrays, or selectors. See example.
     *
     * @param el The element to bind the behavior to
     * @param featureName The feature name
     * @param handler The behavior handler function
     *
     * @returns A cleanup function to unbind the behavior
     *
     * @example
     * // Bind to a single element:
     * html.behaviors.bind(button, 'Copy', el => new CopyToClipboard(el));
     *
     * // Bind to multiple elements:
     * html.behaviors.bind($('[copy]'), 'Copy', el => new CopyToClipboard(el));
     *
     * // Or bind to all elements matching a selector:
     * html.behaviors.bind('[copy]', 'Copy', el => new CopyToClipboard(el));
     *
     * // Cleanup the binding:
     * const cleanup = html.behaviors.bind(button, 'Copy', el => new CopyToClipboard(el));
     * cleanup(); // Unbind the behavior
     */
    static bind<T extends Element>(
        el: T | T[] | string,
        featureName: string,
        handler: BehaviorHandler
    ) {

        let els: T[] = [];

        if (typeof el === 'string') {
            els = $(el) as T[];
        } else {
            els = itemsToArray(el);
        }

        this.#ok('binding', featureName, el);

        els = els.filter(el => {

            return !el.closest('[hidden],[data-template],[aria-hidden="true"]');
        });

        if (els.length === 0) {

            this.#warn('No elements found to bind to:', featureName);
            return;
        }

        const unbinds = els.map(e => this.#bindOne(e, featureName, handler));

        return () => unbinds.forEach(unbind => unbind?.());
    }

    /**
     * Removes all event handlers and cleanup functions associated with a specific feature
     * on an element. This prevents memory leaks and ensures clean teardown when behaviors
     * are no longer needed, such as when elements are removed from the DOM or when
     * features are dynamically disabled.
     *
     * @param el The element to unbind the behavior from
     * @param featureName The feature name
     */
    static unbind(el: Element, featureName: string): void {

        const unbinders = this.#unbinders.get(el);
        if (!unbinders) {
            this.#warn('No unbinders found for:', el, featureName);
            return;
        }

        const featureUnbinders = unbinders.get(featureName);
        if (!featureUnbinders) {
            this.#warn('No unbinders found for:', el, featureName);
            return;
        }

        const [, err] = attemptSync(() => featureUnbinders());

        if (err) {
            this.#error('unbind failed', featureName, el, err);
        }
        else {
            this.#ok('unbound', featureName, el);
        }

        unbinders.delete(featureName);

        if (unbinders.size === 0) {
            this.#unbinders.delete(el);
        }
    }

    /**
     * Removes all behaviors bound to an element at once.
     *
     * This is essential for preventing memory leaks when elements are removed
     * from the DOM or when components are destroyed. Without proper cleanup,
     * event handlers and observers can accumulate over time, leading to
     * performance degradation and unexpected behavior.
     *
     * @param el The element to unbind all behaviors from
     *
     * @example
     * // Clean up when removing a component
     * const modal = document.querySelector('.modal');
     * HtmlBehaviors.unbindAll(modal);
     * modal.remove();
     *
     * @example
     * // Clean up in framework lifecycle hooks
     * class MyComponent {
     *     onDestroy() {
     *         HtmlBehaviors.unbindAll(this.element);
     *     }
     * }
     */
    static unbindAll(el: Element): void {

        const unbinders = this.#unbinders.get(el);
        if (!unbinders) {
            this.#warn('No unbinders found for:', el);
            return;
        }

        this.#ok('unbinding all', el);

        unbinders.forEach((_, featureName) => {

            this.unbind(el, featureName);
        });
    }


    /**
     * Enables batch registration and observation of many features at
     * once, reducing boilerplate and ensuring consistent setup.
     * Pass a registry object mapping feature names to init functions
     * or config objects. Optionally auto-observe and auto-prepare.
     * Returns cleanup and dispatch helpers. See example.
     *
     * **NOTE:** `opts.shouldObserve` only automatically applies when
     * `registry.someFeat.els` is a css selector string.
     *
     * @param registry Object mapping feature names to their initialization functions or objects with els, feature, and handler properties.
     * @param opts Configuration options
     * @param opts.shouldObserve Whether to observe the features immediately (default: true)
     * @param opts.shouldDispatch Whether to dispatch the features immediately (default: true)
     * @param opts.debounceMs MutationObserver debounce delay in milliseconds (default: 50)
     *
     * @returns A cleanup function to unregister all registered event listeners
     *
     * @example
     * const { cleanup, dispatch } = html.behaviors.create({
     *     copy: {
     *         els: '[copy]',
     *         feature: 'Copy',
     *         handler: el => {
     *             const copy = new CopyToClipboard(el);
     *             return () => copy.destroy();
     *         }
     *     },
     *     nav: {
     *         els: '[nav]',
     *         feature: 'Nav',
     *         handler: el => {
     *             const nav = new Nav(el);
     *             return () => nav.destroy();
     *         }
     *     },
     *     keyboard: () => html.events.on(
     *         window,
     *         'keydown',
     *         (e) => observer.emit(e.key, e)
     *     )
     * });
     * dispatch(); // Prepare all features
     * cleanup(); // Unregister all
     */
    static create(
        registry: Record<string, BehaviorInit>,
        opts: {
            shouldObserve?: boolean,
            shouldDispatch?: boolean,
            debounceMs?: number
        } = {}
    ) {

        assert(isPlainObject(registry), 'Registry must be an object');
        assert(isPlainObject(opts), 'Opts must be an object');
        assert(
            allKeysValid(registry, (value, key) => {

                if (isFunction(value)) {

                    return true;
                }

                if (isPlainObject(value)) {

                    const {
                        els,
                        handler,
                        shouldDispatch,
                        shouldObserve,
                        debounceMs
                    } = value;

                    const validBools = (
                        isOptional(shouldDispatch, typeof shouldDispatch === 'boolean') &&
                        isOptional(shouldObserve, typeof shouldObserve === 'boolean')
                    );

                    const validEls = (
                        typeof els === 'string' ||
                        Array.isArray(els) ||
                        els instanceof Element
                    );

                    const validDebounceMs = (
                        isOptional(
                            debounceMs,
                            (ms) => typeof ms === 'number' && ms >= 0
                        )
                    );

                    const validHandler = isFunction(handler);

                    const isValid = (

                        validHandler &&
                        validBools &&
                        validEls &&
                        validDebounceMs
                    )

                    if (!isValid) {

                        this.#error('Invalid registry value:', {
                            key,
                            value,
                            validBools,
                            validEls,
                            validDebounceMs,
                            validHandler
                        });
                    }

                    return isValid;
                }

                return false;
            }),
            'Invalid registry values'
        );

        const {
            shouldObserve: _shouldObserve = true,
            shouldDispatch: _shouldDispatch = true,
            debounceMs: _debounceMs = 50
        } = opts;

        assert(typeof _debounceMs === 'number', 'Debounce ms must be a number');
        assert(_debounceMs >= 0, 'Debounce ms must be greater than or equal to 0');
        assert(typeof _shouldObserve === 'boolean', 'Should observe must be a boolean');
        assert(typeof _shouldDispatch === 'boolean', 'Should dispatch must be a boolean');

        const cleanupFunctions: Set<() => void> = new Set();
        const features = Object.keys(registry);

        this.#ok('creating', features);

        for (const feature of features) {

            const init = registry[feature]!;

            if (typeof init === 'function') {

                const cleanup = this.on(feature, init);
                cleanupFunctions.add(cleanup);

                continue;
            }

            const {
                els,
                handler,
                shouldObserve = _shouldObserve,
                shouldDispatch = _shouldDispatch,
                debounceMs = _debounceMs,
            } = init;

            const bind = () => this.bind(els, feature, handler);

            const cleanup = this.on(feature, bind);
            cleanupFunctions.add(cleanup);

            if (shouldObserve && typeof els === 'string') {

                this.observe(feature, els, { debounceMs });
            }

            if (shouldDispatch) {

                this.dispatch(feature);
            }
        }

        const cleanup = () => {
            cleanupFunctions.forEach((cleanup) => cleanup());
        };

        const dispatch = () => {
            features.forEach(feature => this.dispatch(feature as string));
        }

        return {
            cleanup,
            dispatch
        }
    }

    /**
     * Ensures that as new elements are added to the DOM, any relevant
     * behaviors are initialized immediately. This is the core of
     * automatic, dynamic behavior binding.
     *
     * @param mutations Array of MutationRecord objects
     * @param root The root element being observed
     * @private
     */
    static #handleMutations(mutations: MutationRecord[], root: Element): void {

        // Collect all features that need to be checked for this root
        const rootFeatures = Array.from(this.#observedFeatures.values())
            .filter(obs => obs.root === root);

        for (const mutation of mutations) {

            for (let i = 0; i < mutation.addedNodes.length; i++) {

                const node = mutation.addedNodes[i];

                if (!node || node.nodeType !== 1) { // Node.ELEMENT_NODE = 1

                    continue;
                }

                this.#checkNodeForFeatures(node as Element, rootFeatures);
            }
        }
    }

    /**
     * Ensures that only relevant features are triggered for each new
     * node, avoiding unnecessary work and duplicate dispatches.
     *
     * @param node The DOM node to check
     * @param rootFeatures Array of observed features for the current root
     * @private
     */
    static #checkNodeForFeatures(node: Element, rootFeatures: ObservedFeature[]): void {

        const matchedFeatures = new Set<string>();

        for (const observedFeature of rootFeatures) {

            if (matchedFeatures.has(observedFeature.feature)) {

                continue; // Already dispatched for this feature
            }

            if (node.matches(observedFeature.selector) ||
                node.querySelector(observedFeature.selector)) {

                observedFeature.eventDispatcher();
                matchedFeatures.add(observedFeature.feature);
            }
        }
    }

    /**
     * Automatically observes DOM changes and dispatches prepare events
     * when matching elements are added.
     *
     * Solves the core problem of dynamic content in modern web apps—
     * ensuring that behaviors are always bound to new elements as they
     * appear, without manual intervention. Prevents missed features and
     * memory leaks.
     *
     * Call with a feature name and selector. Optionally specify a root
     * and debounce. See example.
     *
     * @param feature The feature name to dispatch prepare events for
     * @param selector CSS selector to watch for new elements
     * @param options Configuration options for the observer
     * @param options.root Root element to observe (defaults to document.body)
     * @param options.debounceMs Debounce delay in milliseconds (defaults to 0)
     *
     * @example
     * html.behaviors.observe('copy', '[copy]');
     * html.behaviors.observe('modal', '[data-modal]', {
     *     root: document.getElementById('app'),
     *     debounceMs: 100
     * });
     */
    static observe<T extends Element>(
        feature: string,
        selector: string,
        options: {
            root?: T;
            debounceMs?: number;
        } = {}
    ): void {

        if (typeof MutationObserver === 'undefined') {

            throw new MutationObserverUnavailableError();
        }

        assert(typeof feature === 'string', 'Feature must be a string');
        assert(typeof selector === 'string', 'Selector must be a string');
        assert(isPlainObject(options), 'Options must be an object');

        const {
            root = document.body,
            debounceMs = 0
        } = options;

        assert(typeof debounceMs === 'number', 'Debounce ms must be a number');
        assert(debounceMs >= 0, 'Debounce ms must be greater than or equal to 0');
        assert(root instanceof Element, 'Root must be an element');

        const observerKey = `${root.tagName}:${feature}:${selector}`;

        // Prevent duplicate feature/selector combinations
        if (this.#observedFeatures.has(observerKey)) {

            return;
        }

        const _dispatchEvent = () => {

            HtmlEvents.emit(window, `init:${feature}`);
        };

        const eventDispatcher = debounceMs > 0 ?
            debounce(_dispatchEvent, { delay: debounceMs })
            : _dispatchEvent;

        // Store the observed feature
        this.#observedFeatures.set(observerKey, {
            feature,
            selector,
            eventDispatcher,
            root
        });

        if (!this.#rootObservers.has(root)) {

            const observer = new MutationObserver(mutations => {

                this.#handleMutations(mutations, root);
            });

            observer.observe(root, {
                childList: true,
                subtree: true
            });

            this.#rootObservers.set(root, observer);
        }
    }

    /**
     * Allows fine-grained cleanup of observers when features are no
     * longer needed, preventing memory leaks and unnecessary DOM
     * observation.
     *
     * Call with the same feature, selector, and root as used in observe().
     *
     * @param feature The feature name to stop observing
     * @param selector The CSS selector to stop watching
     * @param root The root element that was being observed (defaults to document.body)
     *
     * @example
     * html.behaviors.stop('copy', '[copy]');
     * html.behaviors.stop('modal', '[data-modal]', document.getElementById('app'));
     */
    static stop<T extends Element>(feature: string, selector: string, root?: T): void {

        if (!root) {

            root = document.body as unknown as T;
        }

        const observerKey = `${root.tagName}:${feature}:${selector}`;

        if (this.#observedFeatures.has(observerKey)) {

            this.#observedFeatures.delete(observerKey);

            // Check if this root still has any observed features
            const hasRemainingFeatures = Array.from(this.#observedFeatures.values())
                .some(obs => obs.root === root);

            // If no more features for this root, disconnect the observer
            if (!hasRemainingFeatures) {

                const observer = this.#rootObservers.get(root);
                if (observer) {

                    observer.disconnect();
                    this.#rootObservers.delete(root);
                }
            }
        }
    }

    /**
     * Ensures a clean shutdown or reset of all automatic behavior
     * binding, which is important for single-page apps, tests, or when
     * reloading large sections of the UI.
     *
     * @example
     * html.behaviors.stopAll();
     */
    static stopAll(): void {

        // Disconnect all observers
        for (const observer of this.#rootObservers.values()) {

            observer.disconnect();
        }

        // Clear all registries
        this.#rootObservers.clear();
        this.#observedFeatures.clear();
    }
}