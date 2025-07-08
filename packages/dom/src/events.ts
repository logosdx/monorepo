import {
    Func,
    OneOrMany,
    itemsToArray
} from '@logosdx/utils';

export type GlobalEvents = keyof DocumentEventMap;

type EvOpts = AddEventListenerOptions

type TargetsOrWin = OneOrMany<EventTarget> | Window
type EvType = GlobalEvents | string;
type Events<E extends EvType = EvType> = OneOrMany<E>;

export interface EvListener<E extends EvType> extends EventListener {
    (ev: E extends GlobalEvents ? DocumentEventMap[E] : Event): void;
}

interface EachElementCb {
    <E extends EventTarget>(ev: EvType | Event, el: E): void
}

/**
 * Helper function to iterate over elements and events
 * @param els target elements or window
 * @param evs events to handle
 * @param callback function to execute for each element/event combination
 */
function eachElEachEv (
    els: TargetsOrWin,
    evs: Events | Event,
    callback: EachElementCb
) {
    const elements = itemsToArray<Element>(els as Element);
    for (const element of elements) {

        if (Array.isArray(evs)) {
            for (const ev of evs) {
                callback(ev, element);
            }
        } else {
            callback(evs, element);
        }
    }
}

type EventCleanupCb = () => void

export class HtmlEvents {

    /**
     * Adds event listeners to DOM elements or window.
     * Supports single or multiple elements and events.
     * @param targets HTML elements, array of elements, or window
     * @param events event name, array of event names, or Event object
     * @param cb event listener callback function
     * @param opts options to pass to addEventListener (capture, once, passive, etc.)
     * @returns cleanup function to remove all added event listeners
     *
     * @example
     *
     * html.events.on(div, 'click', () => {});
     * html.events.on(div, ['focus', 'blur'], () => {});
     * html.events.on([div, input], ['focus', 'blur'], () => {});
     *
     * // returns a cleanup function
     *
     * const cleanup = html.events.on(div, 'click', () => {});
     * setTimeout(cleanup, 1000);
     */
    static on <E extends EvType>(
        targets: TargetsOrWin,
        events: Events<E>,
        cb: EvListener<E>,
        opts?: EvOpts
    ): EventCleanupCb {

        eachElEachEv(
            targets,
            events,
            (ev, el) => (

                el.addEventListener(
                    ev as string,
                    cb,
                    opts || false
                )
            )
        );

        function cleanup () {

            eachElEachEv(
                targets,
                events,
                (ev, el) => (el.removeEventListener(ev as any, cb))
            );
        }

        return cleanup;
    };

    /**
     * Adds event listeners that only execute once then automatically remove themselves.
     * @param targets HTML elements, array of elements, or window
     * @param event event name, array of event names, or Event object
     * @param cb event listener callback function
     * @param opts options to pass to addEventListener (capture, passive, etc.)
     * @returns cleanup function to remove all added event listeners
     *
     * @example
     *
     * html.events.once(div, 'click', () => {});
     * html.events.once(div, ['focus', 'blur'], () => {});
     * html.events.once([div, input], ['focus', 'blur'], () => {});
     *
     * // returns a cleanup function
     *
     * const cleanup = html.events.once(div, 'click', () => {});
     * setTimeout(cleanup, 1000);
     */
    static once <E extends EvType>(
        targets: TargetsOrWin,
        event: Events<E>,
        cb: EvListener<E>,
        opts?: EvOpts
    ): EventCleanupCb {

        return this.on(targets, event, cb, {
            ...(opts || {}),
            once: true
        });
    }

    /**
     * Removes event listeners from DOM elements or window.
     * @param targets HTML elements, array of elements, or window
     * @param events event name, array of event names, or Event object
     * @param cb event listener callback function to remove
     * @param opts options that were used when adding the listener
     *
     * @example
     *
     * html.events.off(div, 'click', callback);
     * html.events.off(div, ['focus', 'blur'], callback);
     * html.events.off([div, input], ['focus', 'blur'], callback);
     */
    static off (
        targets: TargetsOrWin,
        events: Events,
        cb: Func,
        opts?: EventListenerOptions
    ) {

        eachElEachEv(
            targets,
            events,
            (ev, el) => (el.removeEventListener(ev as any, cb, opts || false)),
        );
    }

    /**
     * Dispatches custom events on DOM elements or window.
     * Creates CustomEvent with optional data if string event name is provided.
     * @param els HTML elements, array of elements, or window
     * @param event event name or Event object to dispatch
     * @param data optional data to pass via event.detail
     *
     * @example
     *
     * html.events.emit(div, 'click', { key: 'Esc' })
     * html.events.emit([div, span], 'click', { key: 'Esc' })
     */
    static emit(

        els: TargetsOrWin,
        event: EvType | Event,
        data?: unknown
    ) {

        eachElEachEv(
            els,
            event,
            (ev, el) => {

                if (typeof ev === "string") {
                    ev = new (window?.CustomEvent || Event)(ev, { detail: data });
                }

                el.dispatchEvent(ev);
            },
        );
    }
}