---
permalink: '/packages/localize'
aliases: ["Localize", "@logos-ui/localize"]
---
The `LocaleManager` class offers a type-safe solution for managing localization in applications. It utilizes locale configurations and language codes to facilitate easy switching between languages, ensuring a seamless user experience. Users can retrieve translated strings using keys and dynamic values, which simplifies the integration of localization into UI elements as well as its integration with backend elements.

The class also allows for language changes at runtime, providing flexibility to adapt to user preferences. It also allows for updating language dictionaries dynamically. This design maintains clarity and type safety, reducing the likelihood of errors when accessing localized content. Overall, `LocaleManager` streamlines the implementation of internationalization in TypeScript applications.

```sh
npm install @logos-ui/localize
yarn add @logos-ui/localize
pnpm add @logos-ui/localize
```

## Example

``` ts
const english = {
    my: {
        nested: {
            key: '{0}, I like bacon. {1}, I like eggs.',
            key2: '{first}, I like steak. {second}, I like rice.'
        }
    },
    welcome: 'Welcome to the app, {users.0.fullName}!'
};

const spanish = {
    my: {
        nested: {
            key: '{0}, me gusta el bacon. {1}, me gustan los huevos.',
            key2: '{first}, me gusta la carne de res. {second}, me gusta el arroz.'
        }
    },
    welcome: '¡Bienvenidos al app, {users.0.fullName}!'
};

type LangType = typeof english;

const locales = {
	en: english,
	es: spanish
};

type LangCodes = keyof typeof locales;

const langMngr = new LocaleManager<LangType, LangCodes>({
    current: 'en',
    fallback: 'en',
    locales: {
        en: english,
        es: spanish
    }
});
```

### `text(...)` or `t(...)`

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

### `changeTo(...)`

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

### `updateLang(...)`

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


### `on(...)` and `off(...)`

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

