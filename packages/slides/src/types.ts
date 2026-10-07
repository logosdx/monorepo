declare module './deck.ts' {

    export namespace Deck {

        export interface SlideChange {
            slide: Element;
            column: number;
            panel: number;
        }

        export interface FragmentChange {
            slide: Element;
            fragment: Element;
            index: number;
        }

        export interface EventMap {
            'deck:ready': { slide: Element };
            'slide:leave': SlideChange;
            'slide:enter': SlideChange;
            'fragment:show': FragmentChange;
            'fragment:hide': FragmentChange;
        }

        export type Event = keyof EventMap;

        export type Listener<E extends Event> = (payload: EventMap[E]) => void;

        /** 0-based; `fragment` is the revealed count, omitted reveals all. */
        export interface Position {
            column: number;
            panel: number;
            fragment?: number;
        }

        /** An element id resolves to the panel containing that element. */
        export type Target = string | Position;
    }
}

export {};
