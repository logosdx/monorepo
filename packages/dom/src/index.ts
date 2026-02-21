import { DomCollection } from './collection.ts';
import { create } from './dom.ts';
import { TemplateStamper } from './template.ts';
import type { SelectOptions, CreateOptions, TemplateConfig } from './types.ts';

/**
 * Query the DOM and return a {@link DomCollection} wrapping matched elements.
 *
 * @example
 *     const buttons = $<HTMLButtonElement>('.btn');
 *     const scoped = $('.item', { container: sidebar });
 *     const managed = $('.chat', { signal: controller.signal });
 *     const both = $('.btn', { container: sidebar, signal: ctrl.signal });
 *     const wrapped = $(element);
 *     const wrapped = $([el1, el2], { signal: ctrl.signal });
 */
export function $<T extends HTMLElement = HTMLElement>(
    selector: string | T | T[],
    opts?: SelectOptions
): DomCollection<T> {

    if (Array.isArray(selector)) {

        return new DomCollection<T>(selector, opts);
    }

    if (typeof selector !== 'string') {

        return new DomCollection<T>([selector], opts);
    }

    const context = opts?.container ?? document.documentElement;
    const elements = Array.from(context.querySelectorAll<T>(selector));
    return new DomCollection<T>(elements, opts);
}

/**
 * Create a DOM element and return it wrapped in a {@link DomCollection}.
 *
 * @example
 *     const card = $.create('div', { text: 'Hello', class: ['card'] });
 */
$.create = function createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    opts?: CreateOptions
): DomCollection<HTMLElementTagNameMap[K]> {

    const el = create(tag, opts);
    return new DomCollection([el], opts);
} as <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    opts?: CreateOptions
) => DomCollection<HTMLElementTagNameMap[K]>;

/**
 * Create a reusable {@link TemplateStamper} for an HTML `<template>` element.
 *
 * @example
 *     const card = $.template('#user-card', {
 *         map: { '.name': { css: { fontWeight: 'bold' } } }
 *     });
 *     card.stamp({ '.name': 'Alice' }).into(container);
 */
$.template = function templateFn(
    source: string | HTMLTemplateElement,
    config?: TemplateConfig
): TemplateStamper {

    return new TemplateStamper(source, config);
} as (
    source: string | HTMLTemplateElement,
    config?: TemplateConfig
) => TemplateStamper;

// --- Re-exports ---
export { DomCollection } from './collection.ts';
export { css } from './css.ts';
export { attr } from './attr.ts';
export { classify } from './class.ts';
export { data } from './data.ts';
export { aria } from './aria.ts';
export { on, once, off, emit } from './events.ts';
export { animate } from './animate.ts';
export { observe } from './observe.ts';
export { watchVisibility, watchResize } from './watch.ts';
export { viewport } from './viewport.ts';
export { create, append, prepend, remove, replace } from './dom.ts';
export { TemplateStamper } from './template.ts';

export type * from './types.ts';
export type { AnimateOptions } from './animate.ts';
