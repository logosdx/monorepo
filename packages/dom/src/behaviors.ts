import { attemptSync, debounce } from '@logosdx/utils';
import { HtmlEvents } from './events.ts';

/**
 * Symbols used to mark elements as bound to a feature and to store teardown functions
 */
export const BINDING_SYMBOL = Symbol('bindings');

/**
 * Symbol used to store teardown functions
 */
export const TEARDOWN_SYMBOL = Symbol('teardowns');

/**
 * Interface for elements that are bound to a feature
 */
interface BoundElement extends Element {

    [BINDING_SYMBOL]?: Set<string>;
    [TEARDOWN_SYMBOL]?: Map<string, () => void>;
}

type BehaviorHandler = (el: Element) => void;
type BehaviorInit = () => void;

/**
 * Registry to track observed feature/selector combinations
 */
interface ObservedFeature {
    feature: string;
    selector: string;
    eventDispatcher: () => void;
    root: Element;
}

/**
 * Registry of all observed features across different roots
 */
const observedFeatures = new Map<string, ObservedFeature>();

/**
 * Registry of MutationObservers per root element
 */
const rootObservers = new Map<Element, MutationObserver>();

export class HtmlBehaviors {

    /**
     * Checks if an element has been bound to a specific feature
     * @param el The element to check
     * @param feature The feature name
     * @returns true if the element is already bound to the feature
     *
     * @example
     * if (html.behaviors.isBound(button, 'CopyToClipboard')) {
     *     return; // Already bound, skip
     * }
     */
    static isBound(el: Element, feature: string): boolean {

        const boundEl = el as BoundElement;
        return boundEl[BINDING_SYMBOL]?.has(feature) ?? false;
    }

    /**
     * Marks an element as bound to a specific feature
     * @param el The element to mark
     * @param feature The feature name
     *
     * @example
     * html.behaviors.markBound(button, 'CopyToClipboard');
     */
    static markBound(el: Element, feature: string): void {

        const boundEl = el as BoundElement;
        boundEl[BINDING_SYMBOL] ??= new Set();
        boundEl[BINDING_SYMBOL].add(feature);
    }

    /**
     * Registers a prepare event listener for a behavior
     * @param feature The feature name (will listen to `prepare:${feature}`)
     * @param init The initialization function to run when the event is triggered
     * @returns A cleanup function to unregister the event listener
     *
     * @example
     * const cleanup = html.behaviors.registerPrepare('copy', () => {
     *     $('[copy]').forEach(el => {
     *         if (html.behaviors.isBound(el, 'Copy')) return;
     *         new CopyToClipboard(el);
     *         html.behaviors.markBound(el, 'Copy');
     *     });
     * });
     *
     * // Later, to unregister:
     * cleanup();
     */
    static registerPrepare(feature: string, init: BehaviorInit): () => void {

        return HtmlEvents.on(window, `prepare:${feature}`, init);
    }

    /**
     * Dispatches prepare events for one or more features
     * @param features The feature names to prepare
     *
     * @example
     * html.behaviors.dispatchPrepare('copy', 'nav', 'modal');
     */
    static dispatchPrepare(...features: string[]): void {

        features.forEach(feature => {

            HtmlEvents.emit(window, `prepare:${feature}`);
        });
    }

    /**
     * Safely binds a behavior to an element with error handling and duplicate prevention
     * @param el The element to bind the behavior to
     * @param feature The feature name
     * @param handler The behavior handler function
     *
     * @example
     * $('[copy]').forEach(el => {
     *     html.behaviors.bindBehavior(el, 'Copy', el => new CopyToClipboard(el));
     * });
     */
    static bindBehavior(el: Element, feature: string, handler: BehaviorHandler): void {

        if (this.isBound(el, feature)) {

            return;
        }

        const [_result, err] = attemptSync(() => handler(el));

        if (err) {

            console.warn(`Failed to bind ${feature}:`, err);
            return;
        }

        this.markBound(el, feature);
    }

    /**
     * Registers multiple prepare event listeners from an object map
     * @param registry Object mapping feature names to their initialization functions
     * @returns A cleanup function to unregister all registered event listeners
     *
     * @example
     * const cleanup = html.behaviors.createBehaviorRegistry({
     *     copy: () => { ... },
     *     nav: () => { ... },
     *     modal: () => { ... },
     * });
     *
     * // Later, to unregister all:
     * cleanup();
     */
    static createBehaviorRegistry(registry: Record<string, BehaviorInit>): () => void {

        const cleanupFunctions: (() => void)[] = [];

        for (const [feature, init] of Object.entries(registry)) {

            const cleanup = this.registerPrepare(feature, init);
            cleanupFunctions.push(cleanup);
        }

        return () => {

            cleanupFunctions.forEach(cleanup => cleanup());
        };
    }

    /**
     * Sets up a teardown callback for a feature on an element
     * @param el The element to attach the teardown to
     * @param key The feature key for the teardown
     * @param teardown The teardown function
     *
     * @example
     * html.behaviors.setupLifecycle(modal, 'Modal', () => {
     *     // cleanup modal observers, timers, etc.
     * });
     */
    static setupLifecycle(el: Element, key: string, teardown: () => void): void {

        const boundEl = el as BoundElement;
        boundEl[TEARDOWN_SYMBOL] ??= new Map();
        boundEl[TEARDOWN_SYMBOL].set(key, teardown);
    }

    /**
     * Executes the teardown function for a feature on an element.
     * Safely handles cases where no teardown function exists.
     * @param el The element to teardown
     * @param key The feature key to teardown
     *
     * @example
     * html.behaviors.teardownFeature(modal, 'Modal');
     */
    static teardownFeature(el: Element, key: string): void {

        const boundEl = el as BoundElement;
        const teardownFn = boundEl[TEARDOWN_SYMBOL]?.get(key);

        if (typeof teardownFn === 'function') {

            teardownFn();
        }
    }

    /**
     * Queries for elements while ignoring hidden, template, or inert elements.
     * Filters out elements that are hidden, have data-template attribute, or aria-hidden="true".
     * @param selector CSS selector string to match elements
     * @param root Root element to search within (defaults to document)
     * @returns Array of live elements matching the selector
     *
     * @example
     * const liveButtons = html.behaviors.queryLive('[data-action]');
     * const liveButtonsInContainer = html.behaviors.queryLive('[data-action]', container);
     */
        static queryLive(selector: string, root: Document | Element = document): Element[] {

        const elements = root.querySelectorAll(selector);

        if (elements.length === 0) {

            return [];
        }

        return (Array.from(elements) as Element[]).filter(el => {

            return !el.closest('[hidden],[data-template],[aria-hidden="true"]');
        });
    }

    /**
     * Automatically observes DOM changes and dispatches prepare events when matching elements are added.
     * Uses a shared MutationObserver per root for optimal performance with many features.
     * Requires MutationObserver support (not available in Node.js environments).
     * @param feature The feature name to dispatch prepare events for
     * @param selector CSS selector to watch for new elements
     * @param options Configuration options for the observer
     * @param options.root Root element to observe (defaults to document.body)
     * @param options.debounceMs Debounce delay in milliseconds (defaults to 0)
     *
     * @example
     * // Watch for any new [copy] elements
     * html.behaviors.observePrepare('copy', '[copy]');
     *
     * // Watch only within a specific container with debouncing
     * html.behaviors.observePrepare('modal', '[data-modal]', {
     *     root: document.getElementById('app'),
     *     debounceMs: 100
     * });
     */
    static observePrepare(
        feature: string,
        selector: string,
        options: {
            root?: Element;
            debounceMs?: number;
        } = {}
    ): void {

        const {
            root = document.body,
            debounceMs = 0
        } = options;

        const observerKey = `${root.tagName}:${feature}:${selector}`;

        // Prevent duplicate feature/selector combinations
        if (observedFeatures.has(observerKey)) {

            return;
        }

        const dispatchEvent = () => {

            HtmlEvents.emit(window, `prepare:${feature}`);
        };

        const eventDispatcher = debounceMs > 0 ?
            debounce(dispatchEvent, debounceMs) :
            dispatchEvent;

        // Store the observed feature
        observedFeatures.set(observerKey, {
            feature,
            selector,
            eventDispatcher,
            root
        });

        // Create or reuse shared observer for this root
        if (!rootObservers.has(root)) {

            // Check if MutationObserver is available (not in all environments like Node.js)
            if (typeof MutationObserver === 'undefined') {

                console.warn('MutationObserver not available in this environment. observePrepare will not work.');
                return;
            }

            const observer = new MutationObserver(mutations => {

                // Collect all features that need to be checked for this root
                const rootFeatures = Array.from(observedFeatures.values())
                    .filter(obs => obs.root === root);

                for (const mutation of mutations) {

                    for (let i = 0; i < mutation.addedNodes.length; i++) {

                        const node = mutation.addedNodes[i];

                        if (!(node instanceof Element)) {

                            continue;
                        }

                        // Check all selectors for this root in a single pass
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
                }
            });

            observer.observe(root, {
                childList: true,
                subtree: true
            });

            rootObservers.set(root, observer);
        }
    }

    /**
     * Stops observing prepare events for a specific feature and selector combination.
     * Automatically disconnects the MutationObserver if no more features are being observed for that root.
     * @param feature The feature name to stop observing
     * @param selector The CSS selector to stop watching
     * @param root The root element that was being observed (defaults to document.body)
     *
     * @example
     * html.behaviors.stopObserving('copy', '[copy]');
     * html.behaviors.stopObserving('modal', '[data-modal]', document.getElementById('app'));
     */
    static stopObserving(feature: string, selector: string, root: Element = document.body): void {

        const observerKey = `${root.tagName}:${feature}:${selector}`;

        if (observedFeatures.has(observerKey)) {

            observedFeatures.delete(observerKey);

            // Check if this root still has any observed features
            const hasRemainingFeatures = Array.from(observedFeatures.values())
                .some(obs => obs.root === root);

            // If no more features for this root, disconnect the observer
            if (!hasRemainingFeatures) {

                const observer = rootObservers.get(root);
                if (observer) {

                    observer.disconnect();
                    rootObservers.delete(root);
                }
            }
        }
    }

    /**
     * Stops all active mutation observers and clears all observed features.
     * Useful for cleanup when the application is shutting down or when you want to stop all automatic behavior binding.
     *
     * @example
     * // Stop all automatic behavior observation
     * html.behaviors.stopAllObserving();
     */
    static stopAllObserving(): void {

        // Disconnect all observers
        for (const observer of rootObservers.values()) {

            observer.disconnect();
        }

        // Clear all registries
        rootObservers.clear();
        observedFeatures.clear();
    }
}