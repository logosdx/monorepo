import { toArray, eachEl, getMany } from './helpers.ts';
import type { OneOrMany } from './types.ts';

/**
 * Get or set `data-*` attributes on one or more elements.
 * Uses the native `dataset` API for camelCase key access.
 *
 * @example
 *     data(el, { userId: '123', role: 'admin' });
 *     data(el, 'userId');              // → '123'
 *     data(el, ['userId', 'role']);     // → { userId: '123', role: 'admin' }
 *     data.remove(el, 'userId');
 */
function data(
    els: OneOrMany<HTMLElement>,
    props: Record<string, string>
): void;
function data(
    el: HTMLElement,
    key: string
): string | undefined;
function data(
    el: HTMLElement,
    keys: string[]
): Record<string, string | undefined>;
function data(
    els: OneOrMany<HTMLElement>,
    props: string | string[] | Record<string, string>
): void | string | undefined | Record<string, string | undefined> {

    if (typeof props === 'string') {

        return (els as HTMLElement).dataset[props];
    }

    if (Array.isArray(props)) {

        const el = els as HTMLElement;
        return getMany(props, key => el.dataset[key]);
    }

    const elements = toArray(els);

    for (const el of elements) {

        for (const [key, value] of Object.entries(props)) {

            el.dataset[key] = value;
        }
    }
}

/**
 * Remove `data-*` attributes from one or more elements.
 *
 * @example
 *     data.remove(el, ['userId', 'role']);
 *     data.remove([el1, el2], 'role');
 */
data.remove = function remove(
    els: OneOrMany<HTMLElement>,
    keys: string | string[]
): void {

    eachEl(els, keys, (el, key) => { delete el.dataset[key]; });
};

export { data };
