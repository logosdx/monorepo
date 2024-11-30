---
permalink: '/packages/dom'
aliases: ["DOM", "@logos-ui/dom"]
---
The DOM should be an extension of your programming abilities, and not the thing that is abstracted or hidden by framework X. The idea behind library is to give you a set of utilities for DOM manipulation that saves you time and iteration:
- Instead of `document.querySelectorAll(...)` you can simply call `$(...)`.
- Instead of `elements.forEach(el => el.addEventListener(...))` you can call `html.events.on(elements, ...)`
- and so on...

```bash
npm install @logos-ui/dom
yarn add @logos-ui/dom
pnpm add @logos-ui/dom
```

## Example

```typescript

import { $, html, appendIn, createElWith } from '@logos-ui/dom';

const navs = $('nav');

navs.forEach(nav => {

	if ($('[subnav]', nav).length) {

		const icon = createElWith('i', { class: ['fa', 'fa-chevron-down'] });
		appendIn(nav, icon);

		html.events.on(icon, 'click', () => {

			html.events.trigger(nav, 'open');
		});
	}
});

html.events.on(navs, 'open', (e) => {

	e.target.classList.add('open');
});

html.events.on(navs, 'close', (e) => {

	e.target.classList.add('close');
});
```

## Attribute Manipulation

HTML attributes can be powerful tools. You can do things with them that extend beyond the defaults of the browser. For example, turn any div into a copyable code snippet, or have it open a nav bar, or modal.

```typescript
import { $, html, onceReady, copyToClipboard } from '@logos-ui/dom';

const makeCopyable = () => {

	$('[copy]').forEach(el => {

		const whatToCopy = html.attrs.get(el, 'copy');
		const [elToCopy] = $(whatToCopy);

		// bind click event
		html.events.on(el, 'click', () => {

			elToCopy && copyToClipboard(elToCopy.outerHTML);
		});

		// don't double bind later
		html.attrs.remove(el, 'copy');
	});
}

onceReady(() => {

	makeCopyable();
});

```


### `html.attrs.get(...)`

Get one or many attributes from one or many elements.

```ts
<T = StringProps>(els: OneOrManyElements, propNames: string | string[]) => string | string[] | T | T[];
```

**Examples:**

```ts
html.attrs.get(form, 'method');
// > 'post'

html.attrs.get([select, input], 'name');
// > ['role', 'full_name']

html.attrs.get(form, ['method', 'action']);
// > { method: 'post', action: '/' }



html.attrs.get([select, input], ['name', 'value']);
// > [{ name: '', value: '' }, { name: '', value: '' }]
```

### `html.attrs.set(...)`

Set one or many attributes on one or many elements.

```ts
(els: OneOrManyElements, props: StringProps): void;
```

**Examples:**

```ts
html.attrs.set(input, { name: 'full_name' });

html.attrs.set([div, div, div], { 'data-show': 'false' });
```

**Alternatives:**

- `html.attrs.add(...)`



### `html.attrs.remove(...)`

Remove one or many attributes from one or many elements.

```ts
(els: OneOrManyElements, propNames: string | string[]): void;
```

**Examples:**

```ts
html.attrs.remove(form, 'method');
html.attrs.remove([select, input], 'name');
html.attrs.remove(form, ['method', 'action']);
html.attrs.remove([select, input], ['name', 'value']);
```

**Alternatives:**

- `html.attrs.rm(...)`


### `html.attrs.has(...)`

Get one or many attributes from one or many elements.

```ts
(els: OneOrManyElements, propNames: string | string[]): boolean | boolean[] | BoolProps | BoolProps[]
```

**Examples:**

```ts
html.attrs.has(form, 'method');
// > true

html.attrs.has([input, textarea], 'required');
// > [true, false]

html.attrs.has([input, textarea], ['required', 'name']);
// > [{ required: true, name: false }, { required: false, name: false }]
```




## CSS Manipulation

CSS manipulation is sometimes necessary via programmatic means. For example, if you're making some sort of animation, you might want to manipualte the CSS on a series of items. For any case where you might want to do this, this tool is appropriate.

```ts
import { $, html, onceReady } from '@logos-ui/dom';

onceReady(() => {

	html.css.set($('[hide]'), { display: 'none' });
});

html.events.on(document.body, 'lock', () => {

	html.css.set(document.body, { overflow: 'hidden' });
});

html.events.on(document.body, 'unlock', () => {

	html.css.set(document.body, { overflow: '' });
});

```

### `html.css.get(...)`

Get one or many css styles from one or many elements

```ts
(els: OneOrManyElements, propNames: string | string[]): string | Partial<CSSStyleDeclaration> | Partial<CSSStyleDeclaration>[]
```

**Examples:**

```ts
html.css.get(div, 'color');
// > 'red'

html.css.get([div, span], 'color');
// > ['red', 'blue']

html.css.get(div, ['color', 'fontSize']);
// > { color: 'red', fontSize: '12px' }

html.css.get([div, span], ['color', 'fontSize']);
// > [{ color: 'red', fontSize: '12px' }, { color: 'blue', fontSize: '10px' }]
```


### `html.css.set(...)`

Set one or many css styles on one or many elements

```ts
(els: OneOrManyElements, props: Partial<CSSStyleDeclaration>): void;
```

**Examples:**

```ts
html.css.set([div, span], {
	color: 'blue',
	paddingRight: '10px'
});

html.css.set(div, {
	color: 'blue',
	paddingRight: '10px'
});
```

**Alternatives:**

- `html.css.add(...)`


### `html.css.remove(...)`

Get one or many css styles from one or many elements

```ts
(els: OneOrManyElements, propNames: string | string[]): void;
```

**Examples:**

```ts
css.remove(div, 'color');

css.remove([div, span], 'color');

css.remove(div, ['color', 'fontSize']);

css.remove([div, span], ['color', 'fontSize']);
```

**Alternatives:**

- `html.css.rm(...)`


## Events

The most useful thing on the DOM is the ability to dispatch and hook into events. This is what truly makes your app feel dynamic and reponsive; things' observability are what give websites the ability to become web apps.

```ts
import { $, html, onceReady } from '@logos-ui/dom';
import { observer } from './app';

html.events.on(document.body, 'keyup', (e) => {

	observer.emit(e.code, e);

	// or re-emit
	html.events.emit(document.body, e.code, e);
});

html.events.on(document.body, 'Escape', () => {

	closeModal();
	closeAlerts();
	closeMenu();
})

```

### `html.events.on(...)`

Listen for one or many events on one or many elements

```ts
<E extends GlobalEvents>(els: OneOrManyElements, event: E | E[], callback: HtmlEventListener<E>, opts?: AddEventListenerOptions): void;
```

**Examples:**

```ts
html.events.on(div, 'click', () => {});

html.events.on(div, ['focus', 'blur'], () => {});

html.events.on([div, input], ['focus', 'blur'], () => {});
```

**Alternatives:**

- `html.events.add(...)`
- `html.events.listen(...)`



### `html.events.one(...)`

Listen for one or many events on one or many elements once

```ts
<E extends GlobalEvents>(els: OneOrManyElements, event: E | E[], callback: HtmlEventListener<E>, opts?: AddEventListenerOptions): void;
```

**Examples:**

```ts
html.events.one(div, 'click', () => {});

html.events.one(div, ['focus', 'blur'], () => {});

html.events.one([div, input], ['focus', 'blur'], () => {});
```

**Alternatives:**

- `html.events.once(...)`


### `html.events.off(...)`

Remove listener for one or many events on one or many elements

```ts
(els: OneOrManyElements, event: GlobalEvents | GlobalEvents[], callback: EventListener, opts?: EventListenerOptions): void;
```

**Examples:**

```ts
html.events.off(div, 'click', callback);

html.events.off(div, ['focus', 'blur'], callback);

html.events.off([div, input], ['focus', 'blur'], callback);
```

**Alternatives:**

- `html.events.rm(...)`
- `html.events.remove(...)`
- `html.events.unlisten(...)`


### `html.events.trigger(...)`

Trigger event on one or many elements

```ts
(els: OneOrManyElements, event: GlobalEvents | Event, data?: any): void;
```

**Examples:**

```ts
html.events.trigger(div, 'click', { key: 'Esc' })

html.events.trigger([div, span], 'click', { key: 'Esc' })
```

**Alternatives:**

- `html.events.emit(...)`
- `html.events.send(...)`

## Utilities

Beyond the basic element manipulation, there's always something quirky to be done on the DOM. Provided are utilities to make the life of the day-to-day DOM dev easier.

### `appendIn(...)`

Add HTML elements inside of a parent element

```ts
(parent: Element, ...children: Element[]) => void;
```

**Example:**

```ts
import { $, html, appendIn, createElWith } from '@logos-ui/dom';

const [nav] = $('nav#main');

const makeLink = (id: string, l: { link: string, text: string }) => {

	const { link: href, text } = l;

	const el = createElWith('a', {
		text,
		attrs: { id, href }
	});

	return el;
}

const links = {

	about: { link: '/about', text: 'About' },
	service: { link: '/service', text: 'Service' },
	login: { link: '/login', text: 'Login' },
	logout: { link: '/logout', text: 'Logout' },
	account: { link: '/account', text: 'Account' },
}

const links = Object.entries(links).map(
	e => makeLink(e[0], e[1])
);

appendIn(nav, ...links);
```

Add HTML elements after a particular element

### `appendAfter(...)`

Add HTML elements before a particular element

```ts
(target: Element, ...elements: Element[]) => void;
```

**Example:**

```ts
import { $, html, appendAfter } from '@logos-ui/dom';
import { observer } from './app'

// ...

observer.on('login', () => {

	const serviceLink = $('a#service', nav);

	appendAfter(
		serviceLink,
		makeLink('account', links['account']),
		makeLink('logout', links['logout']),
	);

	$('a#login').forEach(e => e.remove())
});
```


### `appendBefore(...)`

```ts
(target: Element, ...elements: Element[]) => void;
```

Add HTML elements before a particular element

**Example:**

```ts
import { $, html, appendBefore } from '@logos-ui/dom';
import { observer } from './app'

// ...

observer.on('logout', () => {

	const logoutLink = $('a#logout', nav);

	appendBefore(
		logoutLink,
		makeLink('login', links['login']),
	);

	$('a#logout, a#account').forEach(e => e.remove())
});
```

### `createEl(...)`

Shortcut around `document.createElement`. It does the exact same thing.

### `createElWith(...)`

An elaborated version of `createEl(...)` with more configurability. Create an HTML element and attach attributes, css, events, classes. Attaches `cleanup()` function for later detaching event listeners.

```ts

type CreateElWithOpts<CustomHtmlEvents> = {
	text?: string,
    class?: string[],
    attrs?: Record<string, string>,
    domEvents?: { [E in keyof GlobalEventHandlersEventMap]?: HtmlEventListener<E> },
    customEvents?: CustomHtmlEvents,
    css?: Partial<CSSStyleDeclaration>
};

type CustomElements = Record<string, (e: Event) => any>;
type ElName = Parameters<Document['createElement']>[0];

type CreateElReturn<N extends ElName | string> = (

	N extends keyof HTMLElementTagNameMap ?
	HTMLElementTagNameMap[N] :
	HTMLElement
) & { cleanup: () => void }

<CustEvs extends CustomElements, N extends ElName>(name: N, opts: CreateElWithOpts<CustomHtmlEvents> = {}): CreateElReturn<N>
```

**Example:**

```ts
import { createElWith } from '@logos-ui/dom';

const myForm = createElWith('form', {
	text: 'inner text',
    attrs: {
        method: 'post',
        acton: '/login'
    },
    css: {
        background: 'red',
    },
    class: ['form'],
    domEvents: {
        reset: (e) => {},
        submit: (e) => {}
    },
    customEvents: {
        bounce: (e) => {}
    }
});

// unbind events
myForm.cleanup();
```


### `cloneAndSubmitForm(...)`

Allows the changing and submitting of HTML forms dynamically. This util does the following:
- Deep clones an HTML form
- Allows you to manipulate it
- Appends it to the DOM
- Submits it as standard HTML form

```ts
type ChangeCallback<F> = (form: F) => MaybePromise<void>;

<F extends HTMLFormElement>(form: F, changeCb: ChangeCallback<F>) => void;
```

**Example:**

```ts
import { $, html, appendIn, createElWith, cloneAndSubmitForm } from '@logos-ui/dom';
import { observer } from './app'

// ...

const [loginForm] = $('form#login');

cloneAndSubmitForm(loginForm, async (newForm) => {

	const value = await getNonce();
	const nonceInput = createElWith('input', {
		attrs: {
			value,
			type: 'hidden',
			name: 'nonce'
		}
	})

	appendIn(newForm, nonceInput);
});
```


### `onceReady(...)`

Runs function after `DOMContentLoaded` event is triggered by `window`

```ts
(fn: Func) => void;
```


### `copyToClipboard(...)`

Copies the passed text to clopboard

```ts
(text: string) => void;
```


### `scrollbarWidth(...)`

Return the size of the scrollbar that depends on the browser or device used on the client

```ts
(): number;
```


### `documentHeight(...)`

Get the height of the whole page

```ts
(): number;
```

### `documentWidth(...)`

Get the width of the whole page

```ts
(): number;
```


### `scrollTop(...)`

Return amount of px scrolled from the top of the document

```ts
(): number;
```


### `scrollLeft(...)`

Return amount of px scrolled from the left of the document

```ts
(): number;
```


### `elementOffsetTop(...)`

Get the offset top of any DOM element

```ts
(el: HTMLElement): number;
```


### `elementOffsetLeft(...)`

Get the offset left of any DOM element

```ts
(el: HTMLElement): number;
```


### `$(...)`

Wraps `querySelectorAll` and converts a NodeList into an array. It will always return an array

```ts
(selector: string, ctx?: Element) => Element[];
```

