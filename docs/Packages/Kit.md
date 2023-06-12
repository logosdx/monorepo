---
permalink: '/packages/kit'
aliases: ["App Kit", "@logos-ui/kit"]
---

This library combines all the packages provided by LogosUI into one (1) library. By bringing together all tools into a single library, `appKit` streamlines the instantiation process and enhances the overall development experience. With its strong typing capabilities, developers can enjoy the benefits of TypeScript, ensuring code correctness, improved maintainability, and enhanced productivity. Whether you're building a small application or a large-scale project, `appKit` equips you with a comprehensive set of tools to create robust and efficient solutions.

> **NOTE!**: `appKit` already includes every library in LogosUI as a dependency, except for riot-related packages. You do not have to `npm install` the other packages.

```bash
npm install @logos-ui/kit
pnpm add @logos-ui/kit
pnpm add @logos-ui/kit
```

## Example

```ts
import { appKit, AppKitOpts } from '@logos-ui/kit';

import { AllEvents } from './types/events';
import { StorageTypes } from './types/storage';
import { FetchState, FetchHeaders } from './types/storage';

import { LangType, english, spanish, portugues } from './languages';
import { StateType, ReducerValType, initialState } from './state'

// Instantiate your locales in a `{ [code]: lang }` fashion
const locales = {
	en: english,
	es: spanish,
	pt: portugues
};

// This is the generic type that composes all your
// appKit's types
type MyAppKit = {
	eventsType: AllEvents,
	storageType: StorageTypes,
	locales: {
		localeType: LangType,
		codes: keyof typeof locales
	},
	stateMachine: {
		stateType: StateType,
		reducerValType: ReducerValType
	},
	fetch: {
		stateType: FetchState,
		headersType: FetchHeaders
	}
}

// All values in options are optional.
// If a value is not passed, the tool will
// not be instantiated and will return null.
const appKitOpts: AppKitOpts<MyAppKit> = {

	observer: {
		spy: (...args) => { /*...*/ }
	},
	stateMachine: {
		initial: initialState,
		reducer: (...args) => { /* ... */ },
		options: { /* ... */ }
	},
	locales: {
		current: 'en',
		fallback: 'en',
		locales
	},
	storage: {
		implementation: localStorage || sessionStorage || customStorage,
		prefix: 'my-web-app'
	},
	fetch: {
		baseUrl: 'http://my.api.com/' || window.location.origin,
		type: 'json',
		headers: {}
	}
}

const kit = appKit <MyAppKit>(appKitOpts);

export const observer = kit.observer!;
export const stateMachine = kit.stateMachine!;
export const locales = kit.locales!;
export const storage = kit.storage!;
export const fetch = kit.fetch!;
```

## Interfaces

```ts
export * from '@logos-ui/dom';
export * from '@logos-ui/fetch';
export * from '@logos-ui/localize';
export * from '@logos-ui/observer';
export * from '@logos-ui/state-machine';
export * from '@logos-ui/storage';
export * from '@logos-ui/utils';

type AppKitLocale = {
	localeType: LocaleType;
	codes: string;
};

type AppKitStateMachine = {
	stateType: unknown
	reducerValType: unknown;
};

type AppKitFetch = {
	stateType: unknown;
	headersType: Record<string, string>;
};

type AppKitType = {
	eventsType: Record<string, any>;
	storageType: Record<string, any>;
	locales: AppKitLocale;
	stateMachine: AppKitStateMachine;
	fetch: AppKitFetch;
};

type AppKitOpts<KitType extends AppKitType> = {

	observer?: ObservableOptions<{}, KitType['eventsType']>;

	stateMachine?: {
		initial: KitType['stateMachine']['stateType'];
		options?: StateMachineOptions;
		reducer: ReducerFunction<
			KitType['stateMachine']['stateType'],
			KitType['stateMachine']['reducerValType']
		>;
	};

	locales?: LocaleOpts<
		KitType['locales']['localeType'],
		KitType['locales']['codes']
	>;

	storage?: {
		implementation: StorageImplementation;
		prefix?: string;
	};

	fetch?: FetchFactoryOptions<
		KitType['fetch']['stateType'],
		KitType['fetch']['headersType']
	>;
};

declare const appKit: <KitType extends AppKitType = any>(
	opts: AppKitOpts<KitType>
) => {

	observer: Observable<
		{},
		KitType["eventsType"]
	> | null;

	locale: LocaleFactory<
		KitType["locales"]["localeType"],
		KitType["locales"]["codes"]
	> | null;

	stateMachine: StateMachine<
		KitType["stateMachine"]["stateType"],
		KitType["stateMachine"]["reducerValType"]
	> | null;

	storage: StorageFactory<KitType["storageType"]> | null;

	fetch: FetchFactory<
		KitType["fetch"]["stateType"],
		KitType["fetch"]["headersType"]
	> | null;

};
```