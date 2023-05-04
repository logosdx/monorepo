import { Func, OneOrMany, OneOrManyElements, itemsToArray } from '@logos-ui/utils';

export type GlobalEvents = keyof DocumentEventMap;

export interface HtmlEventListener<E extends GlobalEvents | string> {
    (ev: E extends GlobalEvents ? DocumentEventMap[E] : Event): void;
}

interface EachElementCb {
    <EL extends Element>(el: EL): void
}

type OneOrManyTargets = OneOrManyElements<EventTarget>

function eventEachElement(els: OneOrManyTargets, callback: EachElementCb) {
    const elements = itemsToArray<Element>(els as Element);
    for (const element of elements) {
        callback(element);
    }
}


export function eventOn <E extends GlobalEvents | string>(
    els: OneOrManyTargets,
    event: E | E[],
    callback: HtmlEventListener<E>,
    opts?: AddEventListenerOptions
) {
    eventEachElement(
        els,
        (element) => {
            if (Array.isArray(event)) {
                for (const ev of event) {
                    element.addEventListener(ev as any, callback, opts || false);
                }
            } else {
                element.addEventListener(event as any, callback, opts || false);
            }
        }
    );
}


export function eventOne <E extends GlobalEvents>(
    els: OneOrManyTargets,
    event: E | E[],
    callback: HtmlEventListener<E>,
    opts?: AddEventListenerOptions
) {
    eventEachElement(
        els,
        (element) => {
            opts = {
                ...(opts || {}),
                once: true,
            };
            if (Array.isArray(event)) {
                for (const ev of event) {
                    element.addEventListener(ev, callback, opts);
                }
            } else {
                element.addEventListener(event, callback, opts);
            }
        }
    );
}


export function eventOff(
    els: OneOrManyTargets,
    event: OneOrMany<GlobalEvents | string>,// GlobalEvents | GlobalEvents[],
    callback: Func,
    opts?: EventListenerOptions
) {
    eventEachElement(
        els,
        (element) => {
            if (Array.isArray(event)) {
                for (const ev of event) {
                    element.removeEventListener(ev, callback, opts || false);
                }
            } else {
                element.removeEventListener(event, callback, opts || false);
            }
        }
    );
}


export function eventTrigger(
    els: OneOrManyTargets,
    event: GlobalEvents | Event,
    data?: any
) {
    const elements = itemsToArray(els) as HTMLElement[];
    for (const element of elements) {
        if (typeof event === "string") {
            event = new window.CustomEvent(event, { detail: data });
        }
        element.dispatchEvent(event);
    }
}
