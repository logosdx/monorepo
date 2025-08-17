---
title: Localize
description: Localization utilities for everything from languages to customer-specific strings
---

# Localize

Not every app needs a heavyweight i18n framework. `@logosdx/localize` is a minimal localization utility with TypeScript-validated keys - no more typos in translation paths. Organize translations in nested objects, access with dot notation, interpolate variables with placeholders. When translations are missing, it falls back to your default language. Fire events when language changes so you can update your UI however you want. It's just the core i18n features with type safety, nothing more.

[[toc]]

## Installation

::: code-group

```bash [npm]
npm install @logosdx/localize
```

```bash [yarn]
yarn add @logosdx/localize
```

```bash [pnpm]
pnpm add @logosdx/localize
```

:::

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/localize@latest/dist/browser.min.js"></script>
<script>
  const { LocaleManager } = LogosDx.Localize;
</script>
```

## Quick Start

```typescript
import { LocaleManager } from '@logosdx/localize'

const english = {
    welcome: 'Welcome to the app, {name}!',
    goodbye: 'Goodbye, {name}!'
};

const spanish = {
    welcome: '¡Bienvenido a la app, {name}!',
    goodbye: '¡Adiós, {name}!'
};

const langMngr = new LocaleManager({
    current: 'en',
    fallback: 'en',
    locales: { en: english, es: spanish }
});

// Get translated text
const greeting = langMngr.t('welcome', { name: 'John' });
// "Welcome to the app, John!"

// Switch languages
langMngr.changeTo('es');
const spanishGreeting = langMngr.t('welcome', { name: 'John' });
// "¡Bienvenido a la app, John!"
```

## Core Concepts

LocaleManager provides type-safe keys that prevent typos in translation keys, supports nested object structures for organized translations, and enables dynamic language switching at runtime with automatic fallback support.

## `text(...)` or `t(...)`

The `t` method of the `LocaleManager` class is a shorthand alias for the `text` method. It allows you to retrieve a translated text string based on the specified language and key. The `t` method provides a convenient way to access localized strings without explicitly referencing the `text` method. Both do exactly the same thing.

**Example**

```ts
const greeting = langMngr.t('my.nested.key', ['Hello', 'World']);
console.log(greeting);
// > "Hello, I like bacon. World, I like eggs."

const greeting = langMngr.t('my.nested.key2', {
	first: 'Thomas',
	second: 'Jacob'
});
// > "Thomas, I like steak. Jacob, I like rice."

const greeting = langMngr.t('welcome', {
	users: [
		{
			fullName: 'Peter Paul'
		}
	]
})
// > "Welcome to the app, Peter Paul!"
```

**Interface**

```ts
declare class LocaleManager /* ... */ {

	text <K extends PathsToValues<Locale>>(
		key: K,
		values?: LocaleFormatArgs
	): string;

	t: LocaleManager<Locale, Code>['text'];
}
```

## `changeTo(...)`

By calling the `changeTo(code)` method on the `LocaleManager` instance, you can switch to a different language.

**Example**

```ts

const langMngr = new LocaleManager({
    current: 'en',
    fallback: 'en',
    locales: {
        en: americanEnglish,
        'en-us': americanEnglish,
        'en-gb': britishEnglish,
        'en-ca': canadianEnglish,
        es: spainSpanish,
        'es-es': spainSpanish,
        'es-mx': mexicanSpanish,
        'es-ar': argentinianSpanish,
    }
});

langMngr.changeTo('es');
langMngr.changeTo('en-gb');
langMngr.changeTo('es-ar');
langMngr.changeTo('en-ca');
```

**Interface**

```ts
declare class LocaleManager<LocType, LocCode> /* ... */ {

	changeTo(code: LocCode): void
}
```

## `updateLang(...)`

The `updateLang` function allows users to dynamically update the available localization data for a specified language code. This enables the application to incorporate new or updated translations without needing to reload or reinitialize the entire localization manager. By providing the language code and the corresponding locale data, developers can ensure that the application remains up-to-date with the latest translations, enhancing the user experience and supporting multilingual environments effectively.

**Example**

```ts
const fetchLang = (code: string) => fetch.get(`/lang/${code}`);

langMngr.updateLang(
	'fr',
	await fetchLang('fr')
);
```

**Interface**

```ts
declare class LocaleManager<LocType, LocCode> extends EventTarget {

    updateLang<C extends Code>(
	    code: C,
	    locale: DeepOptional<Locale>
	): void;

}
```


## Events

The `LocaleManager` class is event-based, allowing you to subscribe to language change events and perform actions accordingly. By using the on method, you can register event listeners to be notified when the language is changed. Here's an example:


## `on(...)` and `off(...)`

**Example**

```ts
const onChange = (e) => sendToAnalytics(e.code);

langMngr.on('locale-change', onChange);

// remove later
langMngr.off('locale-change', onChange);
```

**Interface**

```ts

class LocaleEvent<LocCode> extends Event {
    code!: Code;
}

type LocaleEventName = (
    'locale-change'
);

type LocaleListener<LocCode> = (e: LocaleEvent<LocCode>) => void;

declare class LocaleManager<LocType, LocCode> extends EventTarget {

    on(
        ev: LocaleEventName,
        listener: LocaleListener<Code>,
        once = false
    ): void;

    off(
	    ev: LocaleEventName,
	    listener: EventListenerOrEventListenerObject
	): void;

}
```

## Interfaces

```ts
type LocaleType = {
	[K in StrOrNum]: StrOrNum | LocaleType;
};

type ManyLocales<
	Locale extends LocaleType,
	Code extends string
> = {
	[P in Code]: {
		code: Code;
		text: string;
		labels: Locale | DeepOptional<Locale>;
	};
};

type LocaleOpts<
	Locale extends LocaleType,
	Code extends string = string
> = {
	current: Code;
	fallback: Code;
	locales: ManyLocales<Locale, Code>;
};

class LocaleEvent<LocCode> extends Event {
    code!: Code;
}

type LocaleEventName = (
    'locale-change'
);

type LocaleListener<LocCode> = (e: LocaleEvent<LocCode>) => void;


declare class LocaleManager<
	Locale extends LocaleType,
	Code extends string = string
> extends EventTarget {

	constructor(opts: LocaleOpts<Locale, Code>);

	fallback: Code;
	current: Code;

	on(
		ev: LocaleEventName,
		listener: LocaleListener<Code>,
		once?: boolean
	): void;

	off(
		ev: LocaleEventName,
		listener: EventListenerOrEventListenerObject
	): void;

	locales: {

		code: Code;

		text: string;

	}[];

    updateLang<C extends Code>(
	    code: C,
	    locale: DeepOptional<Locale>
	): void;

	text <K extends PathsToValues<Locale>>(
		key: K,
		values?: LocaleFormatArgs
	): string;

	t: LocaleManager<Locale, Code>['text'];

	changeTo(code: Code): void;
}
```
