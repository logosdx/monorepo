import { css as cssStandalone } from './css.ts';
import { attr as attrStandalone } from './attr.ts';
import { classify } from './class.ts';
import { data as dataStandalone } from './data.ts';
import { aria as ariaStandalone } from './aria.ts';
import { on as onStandalone, once as onceStandalone, off as offStandalone, emit as emitStandalone } from './events.ts';
import { animate as animateStandalone } from './animate.ts';
import type { SignalOptions, EvType, EvListener, EventOptions } from './types.ts';

type CallableNamespace<F extends Function, M> = F & M;

function makeCallable<F extends Function, M extends object>(
    fn: F,
    methods: M
): CallableNamespace<F, M> {

    return Object.assign(fn, methods);
}

/**
 * Wraps an array of DOM elements and provides chainable methods
 * for CSS, attributes, classes, data, aria, events, and animation.
 *
 * Each method delegates to the standalone functions from the dom package,
 * so DomCollection is a thin orchestration layer rather than a reimplementation.
 *
 * @example
 *     const btns = new DomCollection<HTMLButtonElement>(elements, { signal });
 *     btns.css({ color: 'red' }).class.add('active').on('click', handler);
 */
export class DomCollection<T extends HTMLElement> {

    #elements: T[];
    #signal: AbortSignal | undefined;
    #cssNs: any;
    #attrNs: any;
    #classNs: any;
    #dataNs: any;
    #ariaNs: any;
    #animateNs: any;

    constructor(elements: T[], opts?: SignalOptions) {

        this.#elements = elements;
        this.#signal = opts?.signal;
    }

    get elements(): T[] {

        return this.#elements;
    }

    get length(): number {

        return this.#elements.length;
    }

    get first(): T | undefined {

        return this.#elements[0];
    }

    at(index: number): T | undefined {

        return this.#elements[index];
    }

    each(fn: (el: T, index: number) => void): this {

        this.#elements.forEach(fn);
        return this;
    }

    map<U>(fn: (el: T, index: number) => U): U[] {

        return this.#elements.map(fn);
    }

    filter(fn: (el: T, index: number) => boolean): DomCollection<T> {

        return new DomCollection(this.#elements.filter(fn), {
            ...(this.#signal ? { signal: this.#signal } : {})
        });
    }

    [Symbol.iterator](): Iterator<T> {

        return this.#elements[Symbol.iterator]();
    }

    // --- CSS (callable namespace) ---

    get css(): any {

        if (this.#cssNs) return this.#cssNs;
        const self = this;

        return this.#cssNs = makeCallable(
            function cssCallable(propsOrProp: any) {

                if (typeof propsOrProp === 'string' || Array.isArray(propsOrProp)) {

                    return self.first
                        ? cssStandalone(self.first, propsOrProp as any)
                        : undefined;
                }

                cssStandalone(self.#elements, propsOrProp);
                return self;
            },
            {
                remove: (...props: string[]) => {

                    cssStandalone.remove(self.#elements, ...props as any);
                    return self;
                }
            }
        );
    }

    // --- Attr (callable namespace) ---

    get attr(): any {

        if (this.#attrNs) return this.#attrNs;
        const self = this;

        return this.#attrNs = makeCallable(
            function attrCallable(propsOrProp: any) {

                if (typeof propsOrProp === 'string' || Array.isArray(propsOrProp)) {

                    return self.first
                        ? attrStandalone(self.first, propsOrProp as any)
                        : undefined;
                }

                attrStandalone(self.#elements, propsOrProp);
                return self;
            },
            {
                remove: (...names: string[]) => {

                    attrStandalone.remove(self.#elements, ...names);
                    return self;
                },
                has: (name: string): boolean => {

                    return self.first
                        ? attrStandalone.has(self.first, name)
                        : false;
                }
            }
        );
    }

    // --- Class (namespace) ---

    get class(): any {

        if (this.#classNs) return this.#classNs;
        const self = this;

        return this.#classNs = {

            add: (...names: string[]) => {

                classify.add(self.#elements, ...names);
                return self;
            },

            remove: (...names: string[]) => {

                classify.remove(self.#elements, ...names);
                return self;
            },

            toggle: (name: string) => {

                classify.toggle(self.#elements, name);
                return self;
            },

            has: (name: string): boolean => {

                return self.first
                    ? classify.has(self.first, name)
                    : false;
            },

            swap: (a: string, b: string) => {

                classify.swap(self.#elements, a, b);
                return self;
            }
        };
    }

    // --- Data (callable namespace) ---

    get data(): any {

        if (this.#dataNs) return this.#dataNs;
        const self = this;

        return this.#dataNs = makeCallable(
            function dataCallable(propsOrProp: any) {

                if (typeof propsOrProp === 'string' || Array.isArray(propsOrProp)) {

                    return self.first
                        ? dataStandalone(self.first, propsOrProp as any)
                        : undefined;
                }

                dataStandalone(self.#elements, propsOrProp);
                return self;
            },
            {
                remove: (...keys: string[]) => {

                    dataStandalone.remove(self.#elements, ...keys);
                    return self;
                }
            }
        );
    }

    // --- Aria (callable namespace) ---

    get aria(): any {

        if (this.#ariaNs) return this.#ariaNs;
        const self = this;

        return this.#ariaNs = makeCallable(
            function ariaCallable(propsOrProp: any) {

                if (typeof propsOrProp === 'string' || Array.isArray(propsOrProp)) {

                    return self.first
                        ? ariaStandalone(self.first, propsOrProp as any)
                        : undefined;
                }

                ariaStandalone(self.#elements, propsOrProp);
                return self;
            },
            {
                remove: (attr: string) => {

                    ariaStandalone.remove(self.#elements, attr);
                    return self;
                },

                role: (value?: string) => {

                    if (value === undefined) {

                        return self.first
                            ? ariaStandalone.role(self.first)
                            : null;
                    }

                    for (const el of self.#elements) {

                        ariaStandalone.role(el, value);
                    }

                    return self;
                },

                label: (value?: string) => {

                    if (value === undefined) {

                        return self.first
                            ? ariaStandalone.label(self.first)
                            : null;
                    }

                    for (const el of self.#elements) {

                        ariaStandalone.label(el, value);
                    }

                    return self;
                },

                hide: () => {

                    ariaStandalone.hide(self.#elements);
                    return self;
                },

                show: () => {

                    ariaStandalone.show(self.#elements);
                    return self;
                },

                live: (value: string) => {

                    ariaStandalone.live(self.#elements, value);
                    return self;
                }
            }
        );
    }

    // --- Events ---

    on(event: EvType, handler: EvListener, opts?: EventOptions): this {

        const mergedOpts = this.#signal
            ? { ...opts, signal: opts?.signal ?? this.#signal }
            : opts;

        onStandalone(this.#elements, event, handler, mergedOpts);
        return this;
    }

    once(event: EvType, handler: EvListener, opts?: EventOptions): this {

        const mergedOpts = this.#signal
            ? { ...opts, signal: opts?.signal ?? this.#signal }
            : opts;

        onceStandalone(this.#elements, event, handler, mergedOpts);
        return this;
    }

    off(event: EvType, handler: EventListener): this {

        offStandalone(this.#elements, event, handler);
        return this;
    }

    emit(event: string, detail?: unknown): this {

        emitStandalone(this.#elements, event, detail);
        return this;
    }

    // --- Animate (callable namespace) ---

    get animate() {

        if (this.#animateNs) return this.#animateNs;
        const self = this;

        return this.#animateNs = makeCallable(
            function animateCallable(
                keyframes: Keyframe[] | PropertyIndexedKeyframes,
                options?: number | KeyframeAnimationOptions
            ): Animation {

                return animateStandalone(self.first!, keyframes, options);
            },
            {
                fadeIn: (duration?: number): Animation => {

                    return animateStandalone.fadeIn(self.first!, duration);
                },

                fadeOut: (duration?: number): Animation => {

                    return animateStandalone.fadeOut(self.first!, duration);
                },

                slideTo: (to: { x?: number; y?: number }, duration?: number): Animation => {

                    return animateStandalone.slideTo(self.first!, to, duration);
                }
            }
        );
    }
}
