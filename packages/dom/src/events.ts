import { OneOrManyElements, itemsToArray } from '@logos-ui/utils';

type GlobalEvents = keyof DocumentEventMap;

interface HtmlEventListener<E extends GlobalEvents> {
    (ev: DocumentEventMap[E]): void;
}

interface EachElementCb {
    <EL extends Element>(el: EL): void
}

function eventEachElement(els: OneOrManyElements, callback: EachElementCb) {
    const elements = itemsToArray<Element>(els);
    for (const element of elements) {
        callback(element);
    }
}


export function eventOn <E extends GlobalEvents>(
    els: OneOrManyElements,
    event: E | E[],
    callback: HtmlEventListener<E>,
    opts?: AddEventListenerOptions
) {
    eventEachElement(
        els,
        (element) => {
            if (Array.isArray(event)) {
                for (const ev of event) {
                    element.addEventListener(ev, callback, opts || false);
                }
            } else {
                element.addEventListener(event, callback, opts || false);
            }
        }
    );
}


export function eventOne <E extends GlobalEvents>(
    els: OneOrManyElements,
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
    els: OneOrManyElements,
    event: GlobalEvents | GlobalEvents[],
    callback: EventListener,
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
    els: OneOrManyElements,
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
