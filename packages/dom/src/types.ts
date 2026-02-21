/** A single element or array of elements */
export type OneOrMany<T> = T | T[];

/** CSS property names from CSSStyleDeclaration (excluding methods) */
export type CssPropNames = Extract<{
    [K in keyof CSSStyleDeclaration]:
        CSSStyleDeclaration[K] extends string ? K : never;
}[keyof CSSStyleDeclaration], string>;

/** CSS property values map */
export type CssProps = { [K in CssPropNames]?: CSSStyleDeclaration[K] };

/** CSS custom property name (--*) */
export type CssCustomProp = `--${string}`;

/** Any CSS property — standard or custom */
export type AnyCssProp = CssPropNames | CssCustomProp;

/** Cleanup function returned by subscriptions and observers */
export type Cleanup = () => void;

/** Options that accept an AbortSignal for cancellation */
export interface SignalOptions {
    signal?: AbortSignal;
}

/** Event types from DocumentEventMap */
export type GlobalEvents = keyof DocumentEventMap;

/** Any event name — known DOM events get type inference, custom strings allowed */
export type EvType = GlobalEvents | (string & {});

/** Typed event listener — infers the correct event object for known DOM events */
export interface EvListener<E extends EvType = EvType> {
    (ev: E extends GlobalEvents ? DocumentEventMap[E] : CustomEvent): void;
}

/** Options for $.create() — declarative element construction */
export interface CreateOptions extends SignalOptions {
    text?: string;
    class?: string[];
    css?: Record<string, string>;
    attrs?: Record<string, string>;
    children?: (HTMLElement | string)[];
    on?: Record<string, EvListener>;
}

/** Options for event delegation and binding */
export interface EventOptions extends AddEventListenerOptions, SignalOptions {
    delegate?: string;
}

/** Options for $() element selection */
export interface SelectOptions extends SignalOptions {
    container?: Element;
}

/** Options for hydrating a single element inside a stamped template clone */
export interface StampOptions {
    text?: string;
    css?: Record<string, string>;
    class?: string[];
    attrs?: Record<string, string>;
    data?: Record<string, string>;
    aria?: Record<string, string>;
    on?: Record<string, EvListener>;
}

/** Map of CSS selectors to hydration options (string shorthand = { text }) */
export type StampMap = Record<string, string | StampOptions>;

/** Configuration for $.template() — base map + signal */
export interface TemplateConfig extends SignalOptions {
    map?: StampMap;
}
