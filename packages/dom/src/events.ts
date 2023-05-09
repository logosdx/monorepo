import { Func, OneOrMany, OneOrManyElements, itemsToArray } from '@logos-ui/utils';

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
                    ev as any,
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

    static trigger(

        els: TargetsOrWin,
        event: EvType | Event,
        data?: any
    ) {

        eachElEachEv(
            els,
            event,
            (ev, el) => {

                if (typeof ev === "string") {
                    ev = new window.CustomEvent(ev, { detail: data });
                }

                el.dispatchEvent(ev);
            },
        );
    }
}