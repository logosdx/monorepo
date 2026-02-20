import { toArray } from './helpers.ts';
import type { OneOrMany, EvType, EvListener, EventOptions } from './types.ts';

/**
 * Attach an event listener to one or more elements for one or more events.
 * Supports delegation, capture, signal-based removal, and one-shot listeners.
 *
 * @example
 *     on(button, 'click', handler);
 *     on([el1, el2], ['mouseenter', 'focus'], handler);
 *     on(parent, 'click', handler, { delegate: '.item' });
 */
export function on(
    els: OneOrMany<EventTarget>,
    events: EvType | EvType[],
    cb: EvListener,
    opts?: EventOptions
): void {

    const targets = toArray(els);
    const eventNames = toArray(events);
    const { delegate, ...nativeOpts } = opts ?? {} as EventOptions;

    const listener = delegate
        ? wrapDelegate(cb, delegate)
        : cb as EventListener;

    for (const target of targets) {

        for (const event of eventNames) {

            target.addEventListener(event, listener, nativeOpts);
        }
    }
}

/**
 * Attach a one-time event listener. The handler fires at most once per element/event.
 *
 * @example
 *     once(button, 'click', handler);
 */
export function once(
    els: OneOrMany<EventTarget>,
    events: EvType | EvType[],
    cb: EvListener,
    opts?: EventOptions
): void {

    on(els, events, cb, { ...opts, once: true });
}

/**
 * Remove an event listener from one or more elements.
 *
 * @example
 *     off(button, 'click', handler);
 *     off([el1, el2], 'click', handler);
 */
export function off(
    els: OneOrMany<EventTarget>,
    events: EvType | EvType[],
    cb: EventListener
): void {

    const targets = toArray(els);
    const eventNames = toArray(events);

    for (const target of targets) {

        for (const event of eventNames) {

            target.removeEventListener(event, cb);
        }
    }
}

/**
 * Dispatch a CustomEvent on one or more elements.
 * The event bubbles by default so parent listeners can catch it.
 *
 * @example
 *     emit(el, 'widget:open', { chatId: 123 });
 *     emit([el1, el2], 'ping');
 */
export function emit(
    els: OneOrMany<EventTarget>,
    event: string,
    detail?: unknown
): void {

    const targets = toArray(els);
    const customEvent = new CustomEvent(event, { detail, bubbles: true });

    for (const target of targets) {

        target.dispatchEvent(customEvent);
    }
}

/**
 * Wrap a callback for event delegation.
 * Only fires when event.target matches the delegate selector.
 */
function wrapDelegate(cb: EvListener, selector: string): EventListener {

    return function delegateHandler(event: Event) {

        const target = (event.target as Element)?.closest?.(selector);

        if (target) {

            (cb as EventListener)(event);
        }
    };
}
