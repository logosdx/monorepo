# @logos-ui/dom

Utilities for DOM manipulation.

## Interfaces

```typescript
declare const getAttr: <T = StringProps>(els: OneOrManyElements, propNames: string | string[]) => string | string[] | T | T[];

declare function setAttr(els: OneOrManyElements, props: StringProps): void;

declare function removeAttr(els: OneOrManyElements, propNames: string | string[]): void;

declare function hasAttr(els: OneOrManyElements, propNames: string | string[]): boolean | boolean[] | BoolProps | BoolProps[];


declare function getCss(els: OneOrManyElements, propNames: string | string[]): string | Partial<CSSStyleDeclaration> | Partial<CSSStyleDeclaration>[];

declare function setCss(els: OneOrManyElements, props: Partial<CSSStyleDeclaration>): void;

declare function removeCss(els: OneOrManyElements, propNames: string | string[]): void;

type GlobalEvents = keyof DocumentEventMap;

interface HtmlEventListener<E extends GlobalEvents> {

    (ev: DocumentEventMap[E]): void;
}

declare function eventOn<E extends GlobalEvents>(els: OneOrManyElements, event: E | E[], callback: HtmlEventListener<E>, opts?: AddEventListenerOptions): void;

declare function eventOne<E extends GlobalEvents>(els: OneOrManyElements, event: E | E[], callback: HtmlEventListener<E>, opts?: AddEventListenerOptions): void;

declare function eventOff(els: OneOrManyElements, event: GlobalEvents | GlobalEvents[], callback: EventListener, opts?: EventListenerOptions): void;

declare function eventTrigger(els: OneOrManyElements, event: GlobalEvents | Event, data?: any): void;

declare const appendIn: (parent: Element, ...children: Element[]) => void;

declare const appendAfter: (target: Element, ...elements: Element[]) => void;

declare const appendBefore: (target: Element, ...elements: Element[]) => void;

declare const changeAndSubmitClonedForm: (form: HTMLFormElement, changeCb: Function) => void;

declare function scrollbarWidth(): number;


declare function documentHeight(): number;


declare function documentWidth(): number;

declare function scrollTop(): number;

declare function scrollLeft(): number;

declare function elementOffsetTop(el: any): number;

declare function elementOffsetLeft(el: any): number;

declare const $: (selector: string, ctx?: Element) => Element[];

declare const html: {

    css: {

        get: typeof getCss;
        set: typeof setCss;
        remove: typeof removeCss;
        rm: typeof removeCss;
    };

    attrs: {

        get: typeof getAttr;
        set: typeof setAttr;
        has: typeof hasAttr;
        remove: typeof removeAttr;
        rm: typeof removeAttr;

    };

    events: {
        on: typeof eventOn;
        listen: typeof eventOn;

        one: typeof eventOne;
        once: typeof eventOne;

        off: typeof eventOff;
        remove: typeof eventOff;
        rm: typeof eventOff;

        trigger: typeof eventTrigger;
        emit: typeof eventTrigger;
        send: typeof eventTrigger;
    };

};

export {
    appendIn,
    appendAfter,
    appendBefore,
    changeAndSubmitClonedForm,
    scrollbarWidth,
    documentHeight,
    documentWidth,
    scrollTop,
    scrollLeft,
    elementOffsetTop,
    elementOffsetLeft,
    $,
    html
}
```