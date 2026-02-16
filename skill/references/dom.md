---
description: Usage patterns for the @logosdx/dom package.
globs: *.ts
---

# @logosdx/dom Package Summary

Cross-browser DOM manipulation utilities providing type-safe, consistent APIs for CSS, attributes, events, behaviors, and viewport operations.

## Main API Surface

```ts
// Primary exports
export const $: <R extends Element = HTMLElement>(selector: string, ctx?: Element) => R[]
export const html: {
  css: typeof HtmlCss
  attrs: typeof HtmlAttr
  events: typeof HtmlEvents
  behaviors: typeof HtmlBehaviors
}

// Individual module exports
export const css: typeof HtmlCss
export const attrs: typeof HtmlAttr
export const events: typeof HtmlEvents
export const behaviors: typeof HtmlBehaviors

// Core types
export type { CssPropNames, CssProps } from './css'
export type { GlobalEvents, EvListener } from './events'
```

## Core Modules

### HtmlCss - Style Manipulation

```ts
class HtmlCss {
  // Get computed styles (supports single/multiple elements and properties)
  static get<T extends HTMLElement, P extends CssPropNames>(el: T, prop: P): CssProps[P]
  static get<T extends HTMLElement, P extends CssPropNames>(el: T[], prop: P): CssProps[P][]
  static get<T extends HTMLElement, P extends CssPropNames>(el: T, props: P[]): { [K in P]: CssProps[K] }
  static get<T extends HTMLElement, P extends CssPropNames>(el: T[], props: P[]): { [K in P]: CssProps[K] }[]

  // Set inline styles
  static set<T extends OneOrMany<HTMLElement>, P extends CssPropNames>(
    els: T,
    props: { [K in P]?: CssProps[K] | null }
  ): void

  // Remove styles (sets to empty string)
  static remove<T extends HTMLElement>(els: OneOrMany<T>, propNames: OneOrMany<CssPropNames>): void
}

// Types
type CssPropNames = Extract<NonFunctionProps<CSSStyleDeclaration>, string>
type CssProps = { [K in CssPropNames]?: CSSStyleDeclaration[K] }
```

### HtmlAttr - Attribute Management

```ts
class HtmlAttr {
  // Get attributes (supports single/multiple elements and attributes)
  static get<T extends string>(el: HTMLElement, attr: T): string
  static get<T extends string>(el: HTMLElement[], attr: T): string[]
  static get<T extends string>(el: HTMLElement, attr: T[]): Record<T, string | null>
  static get<T extends string>(el: HTMLElement[], attr: T[]): Record<T, string | null>[]

  // Check attribute existence
  static has(el: HTMLElement, attr: string): boolean
  static has(el: HTMLElement[], attr: string): boolean[]
  static has<T extends string>(el: HTMLElement, attr: string[]): Record<T, boolean>
  static has<T extends string>(el: HTMLElement[], attr: string[]): Record<T, boolean>[]

  // Set attributes
  static set(els: OneOrMany<HTMLElement>, props: StringProps): void

  // Remove attributes
  static remove(els: OneOrMany<HTMLElement>, attrs: OneOrMany<string>): void
}
```

### HtmlEvents - Event Handling

```ts
class HtmlEvents {
  // Add event listeners (returns cleanup function)
  static on<E extends EvType>(
    targets: TargetsOrWin,
    events: Events<E>,
    cb: EvListener<E>,
    opts?: AddEventListenerOptions
  ): () => void

  // Add one-time event listeners
  static once<E extends EvType>(
    targets: TargetsOrWin,
    event: Events<E>,
    cb: EvListener<E>,
    opts?: AddEventListenerOptions
  ): () => void

  // Remove event listeners
  static off(
    targets: TargetsOrWin,
    events: Events,
    cb: Func,
    opts?: EventListenerOptions
  ): void

  // Dispatch custom events
  static emit(els: TargetsOrWin, event: EvType | Event, data?: unknown): void
}

// Types
type GlobalEvents = keyof DocumentEventMap
type EvType = GlobalEvents | string
type Events<E extends EvType = EvType> = OneOrMany<E>
type TargetsOrWin = OneOrMany<EventTarget> | Window
interface EvListener<E extends EvType> extends EventListener {
  (ev: E extends GlobalEvents ? DocumentEventMap[E] : Event): void
}
```

### HtmlBehaviors - Declarative Behavior System

```ts
class HtmlBehaviors {
  // Behavior state management
  static isBound<T extends Element>(el: T, feature: string): boolean
  static allBound(el: Element): string[]

  // Event-driven behavior initialization
  static on(feature: string, init: BehaviorCb): () => void
  static dispatch(...features: string[]): void

  // Core behavior binding (returns cleanup function)
  static bind<T extends Element>(
    el: T | T[] | string,
    featureName: string,
    handler: BehaviorHandler
  ): (() => void) | undefined

  // Behavior cleanup
  static unbind(el: Element, featureName: string): void
  static unbindAll(el: Element): void

  // Batch behavior management
  static create(
    registry: Record<string, BehaviorInit>,
    opts?: {
      shouldObserve?: boolean
      shouldDispatch?: boolean
      debounceMs?: number
    }
  ): { cleanup: () => void; dispatch: () => void }

  // Automatic DOM observation
  static observe<T extends Element>(
    feature: string,
    selector: string,
    options?: { root?: T; debounceMs?: number }
  ): void

  static stop<T extends Element>(feature: string, selector: string, root?: T): void
  static stopAll(): void

  // Debug utilities
  static debug(on: boolean): void
}

// Types
type BehaviorHandler = (el: Element) => Unbind | void
type Unbind = () => void
type BehaviorCb = () => Unbind | void
type BehaviorInit = BehaviorCb | {
  els: string | Element | Element[]
  handler: BehaviorHandler
  shouldObserve?: boolean
  shouldDispatch?: boolean
  debounceMs?: number
}

// Custom error
class MutationObserverUnavailableError extends Error
```

## Viewport & Scroll Utilities

```ts
// Document measurements
function scrollbarWidth(): number
function documentHeight(): number
function documentWidth(): number
function viewportWidth(): number
function viewportHeight(): number
function devicePixelRatio(): number

// Scroll position
function scrollTop(): number
function scrollLeft(): number
function scrollProgress(element?: Element): number
function horizontalScrollProgress(element?: Element): number

// Scroll state detection
function isAtBottom(threshold?: number): boolean
function isAtTop(threshold?: number): boolean

// Element positioning
function elementOffsetTop<T extends Element>(el: T): number
function elementOffsetLeft<T extends Element>(el: T): number
function elementVisibility<T extends Element>(el: T): number
function isPartiallyVisible<T extends Element>(el: T, threshold?: number): boolean
function elementViewportDistances<T extends Element>(el: T): {
  top: number; bottom: number; left: number; right: number
}

// Smooth scrolling
function scrollToElement<T extends Element, S extends Element>(
  el: T,
  opts?: { offset?: number; behavior?: ScrollBehavior; scrollElement?: S }
): void

function scrollToPosition(
  x: number,
  y: number,
  opts?: { behavior?: ScrollBehavior; scrollElement?: HTMLElement }
): void
```

## DOM Utilities

```ts
// Element manipulation
const appendIn: (parent: Element, ...children: (Element | Node)[]) => void
const appendAfter: (target: Element, ...elements: Element[]) => void
const appendBefore: (target: Element, ...elements: Element[]) => void

// Element creation
const createEl: Document['createElement']
const createElWith: <CustomHtmlEvents extends Record<string, (e: Event) => any>, N extends Parameters<Document["createElement"]>[0]>(
  name: N,
  opts?: CreateElWithOpts<CustomHtmlEvents>
) => (HTMLElement & { cleanup: () => any })

// Form handling
const cloneAndSubmitForm: <T extends HTMLFormElement>(
  form: T,
  changeCb: (form: T) => MaybePromise<void>
) => void

// Lifecycle
const onceReady: (fn: Func) => void

// Utilities
const copyToClipboard: (text: string) => void
const isInViewport: (element: HTMLElement, refHeight?: number, refWidth?: number) => boolean
const isScrolledIntoView: (el: HTMLElement, inRelationTo?: HTMLElement | Window) => boolean
const swapClasses: (el: HTMLElement, one: string, two: string) => void

// Types for createElWith
type CreateElWithOpts<CustomHtmlEvents> = {
  text?: string
  children?: (string | HTMLElement)[]
  class?: string[]
  attrs?: Record<string, string>
  domEvents?: { [E in keyof GlobalEventHandlersEventMap]?: EvListener<E> }
  customEvents?: CustomHtmlEvents
  css?: Partial<CSSStyleDeclaration>
}
```

## Usage Patterns

### Basic Operations
```ts
// Element selection and manipulation
const buttons = $<HTMLButtonElement>('button', container)
html.css.set(buttons, { color: 'red', fontSize: '16px' })
html.attrs.set(buttons, { 'data-active': 'true' })

// Event handling with cleanup
const cleanup = html.events.on(buttons, 'click', (e) => console.log('clicked'))
cleanup() // Remove listeners

// Element creation with full configuration
const form = createElWith('form', {
  attrs: { method: 'post', action: '/submit' },
  css: { padding: '1rem' },
  domEvents: { submit: (e) => e.preventDefault() },
  customEvents: { validate: (e) => console.log('validating') }
})
```

### Behavior System
```ts
// Register behaviors
const { cleanup, dispatch } = html.behaviors.create({
  tooltip: {
    els: '[data-tooltip]',
    handler: (el) => {
      const tooltip = new Tooltip(el)
      return () => tooltip.destroy()
    }
  },
  modal: () => html.events.on(window, 'keydown', handleEscape)
})

// Auto-observe DOM changes
html.behaviors.observe('tooltip', '[data-tooltip]')
dispatch() // Initialize all behaviors
```

### Viewport Operations
```ts
// Scroll-based interactions
const progress = scrollProgress()
const isVisible = isPartiallyVisible(element, 0.5)
const distances = elementViewportDistances(modal)

// Smooth navigation
scrollToElement(target, { offset: 20, behavior: 'smooth' })
if (isAtBottom(10)) loadMoreContent()
```

The package provides a comprehensive, type-safe DOM manipulation library with consistent APIs across all modules, automatic cleanup patterns, and cross-browser compatibility.