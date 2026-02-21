import { css } from './css.ts';
import { attr } from './attr.ts';
import { classify } from './class.ts';
import { data } from './data.ts';
import { aria } from './aria.ts';
import { on } from './events.ts';
import { DomCollection } from './collection.ts';
import type { StampOptions, StampMap, TemplateConfig, EvListener } from './types.ts';

/**
 * Normalize a stamp map entry — string shorthand becomes { text }.
 */
function normalize(entry: string | StampOptions): StampOptions {

    return typeof entry === 'string' ? { text: entry } : entry;
}

/**
 * Shallow-merge two StampOptions — stamp values override base.
 */
function mergeOptions(base: StampOptions, stamp: StampOptions): StampOptions {

    return { ...base, ...stamp };
}

/**
 * Apply StampOptions to a single element using standalone DOM functions.
 */
function applyOptions(el: HTMLElement, opts: StampOptions, signal?: AbortSignal): void {

    if (opts.text) el.textContent = opts.text;
    if (opts.class) classify.add(el, opts.class);
    if (opts.css) css(el, opts.css);
    if (opts.attrs) attr(el, opts.attrs);
    if (opts.data) data(el, opts.data);
    if (opts.aria) aria(el, opts.aria);

    if (opts.on) {

        for (const [event, handler] of Object.entries(opts.on)) {

            on(el, event, handler as EvListener,
                signal ? { signal } : undefined);
        }
    }
}

/**
 * Reusable template stamper — configure once, stamp many.
 *
 * Caches an HTML `<template>` element and a base configuration map.
 * Each `stamp()` call clones the template, merges per-instance data
 * over the base config, and returns a {@link DomCollection}.
 *
 * @example
 *     const card = new TemplateStamper('#user-card', {
 *         map: {
 *             '.username': { css: { fontWeight: 'bold' } },
 *             '.view-btn': { on: { click: handler } }
 *         }
 *     });
 *
 *     card.stamp({ '.username': 'Alice' }).into(container);
 *
 *     card.stamp(users, u => ({
 *         '.username': u.name
 *     })).into(container);
 */
export class TemplateStamper {

    #template: HTMLTemplateElement;
    #baseMap: StampMap;
    #signal: AbortSignal | undefined;

    constructor(source: string | HTMLTemplateElement, config?: TemplateConfig) {

        if (typeof source === 'string') {

            const el = document.querySelector<HTMLTemplateElement>(source);

            if (!el || !(el instanceof HTMLTemplateElement)) {

                throw new Error(`Template not found: ${source}`);
            }

            this.#template = el;
        }
        else {

            this.#template = source;
        }

        this.#baseMap = config?.map ?? {};
        this.#signal = config?.signal;
    }

    stamp(map: StampMap): DomCollection<HTMLElement>;
    stamp<T>(data: T[], mapper: (item: T) => StampMap): DomCollection<HTMLElement>;
    stamp<T>(
        mapOrData: StampMap | T[],
        mapper?: (item: T) => StampMap
    ): DomCollection<HTMLElement> {

        if (Array.isArray(mapOrData) && mapper) {

            const elements: HTMLElement[] = [];

            for (const item of mapOrData) {

                const collection = this.#stampOne(mapper(item));

                for (const el of collection.elements) {

                    elements.push(el);
                }
            }

            return new DomCollection(elements,
                this.#signal ? { signal: this.#signal } : undefined);
        }

        return this.#stampOne(mapOrData as StampMap);
    }

    #stampOne(instanceMap: StampMap): DomCollection<HTMLElement> {

        const clone = this.#template.content.cloneNode(true) as DocumentFragment;

        const allSelectors = new Set([
            ...Object.keys(this.#baseMap),
            ...Object.keys(instanceMap)
        ]);

        for (const selector of allSelectors) {

            const el = clone.querySelector<HTMLElement>(selector);
            if (!el) continue;

            const base = this.#baseMap[selector]
                ? normalize(this.#baseMap[selector])
                : {};
            const instance = instanceMap[selector]
                ? normalize(instanceMap[selector])
                : {};

            applyOptions(el, mergeOptions(base, instance), this.#signal);
        }

        const elements = Array.from(clone.children) as HTMLElement[];

        return new DomCollection(elements,
            this.#signal ? { signal: this.#signal } : undefined);
    }
}
