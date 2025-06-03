---
permalink: '/packages/kit'
aliases: ["App Kit", "@logosdx/kit"]
---

This library combines all the packages provided by LogosDX into one (1) library. By bringing together all tools into a single library, `appKit` streamlines the instantiation process and enhances the overall development experience. With its strong typing capabilities, developers can enjoy the benefits of TypeScript, ensuring code correctness, improved maintainability, and enhanced productivity. Whether you're building a small application or a large-scale project, `appKit` equips you with a comprehensive set of tools to create robust and efficient solutions.

> **NOTE!**: `appKit` already includes every library in LogosDX as a dependency, except for riot-related packages. You do not have to `npm install` the other packages.

```bash
npm install @logosdx/kit
pnpm add @logosdx/kit
pnpm add @logosdx/kit
```

## Example

```ts
import { appKit, AppKitOpts, MakeKitType, assertOptional } from '@logosdx/kit';

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
type MyAppKit = MakeKitType<{
	eventsType: AllEvents,
	storageType: StorageTypes,
	locales: {
		locale: LangType,
		codes: keyof typeof locales
	},
	stateMachine: {
		stat: StateType,
		reducerValue: ReducerValType
	},
	fetch: {
		state: FetchState,
		headers: FetchHeaders
	},
	apis: {
		stripe: {
			state: {},
			headers: { Authorization: string }
		},
		facebook: {
			state: {},
			params: {
				access_token: string
			},
		}
	}
}>

// All values in options are optional.
// If a value is not passed, the tool will
// not be instantiated and will return null.
const appKitOpts: AppKitOpts<MyAppKit> = {

	observer: {
		name: '...'
		spy: (...args) => { /* ... */ },
		emitValidator: (...args) => { /* ... */ }
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
		defaultType: 'json',
		headers: {},
		formatHeaders: false
	},
	apis: {
		stripe: {
			baseUrl: 'https://graph.facebook.com',
		},
		facebook: {
			baseUrl: 'https://graph.facebook.com',
			validate: {

				params: (p) => {

					const isValid = (
						typeof p.access_token === 'string' &&
						p.access_token.length > 13
					);

					assertOptional(
						p.access_token,
						isValid,
						'invalid access token'
					);
				}
			}
		}
	}
}

const kit = appKit <MyAppKit>(appKitOpts);

export const observer = kit.observer;
export const stateMachine = kit.stateMachine;
export const locales = kit.locales;
export const storage = kit.storage;
export const fetch = kit.fetch;
export const apis = kit.apis;
```
