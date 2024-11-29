---
permalink: '/packages/riot-kit'
aliases: ["RiotKit", "@logos-ui/riot-kit"]
---

This library uses [[Kit|App Kit]] and implements its functionality to work with RiotJS components. It enhances components via Riot's `riot.install(...)` function and unlocks the features of your tooling to components.

> **NOTE!**: `riotAppKit` already includes every library in LogosUI as a dependency, INCLUDING riot-related packages. You do not have to `npm install` the other packages.

```bash
npm install @logos-ui/riot-kit
yarn add @logos-ui/riot-kit
pnpm add @logos-ui/riot-kit
```

## Example

First, declare your app kit by passing it to `riotAppKit`. The API is identical to `appKit`, plus passing `riot.install` function.

`./kit.ts`:
```ts
import { riotAppKit, AppKitOpts, LogosUIRiotComponent } from '@logos-ui/riot-kit';
import { install } from 'riot';

/*
* ...
* See example from Kit package
*/


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

// Declare a custom component type that can
// be re-utilized throughout your app
export type AppComponent<C, P, S> = LogosUIRiotComponent<MyAppKit, C, P, S>

const appKitOpts: AppKitOpts<MyAppKit> = {
	/* ... */
}

const kit = riotAppKit <MyAppKit>({
	riotInstallFunction: install,
	...appKitOpts
});

```

Next we're going to create a script for our Riot component where we are better guided with typescript.

`./component/nav/script.ts`
```ts
import { fetch, observer, stateMachine } from '../../kit'

type NavComponent<P,S> = AppComponent<{

	loadUser(): void
}, P, S>


type MainNavState = {
	profile?: { name: string },
	jwtToken?: string,
	refreshToken?: string
}

observer.on('profile-fetched', (profile) => {

	stateMachine.dispatch({ profile });
});

export mainNav: NavComponent<any, MainNavState> = {

	state: { profile: null },

	async loadUser() {

		fetch.setState({ jwtToken: this.state.jwtToken});
		const profile = await fetch.get('/profile');

		this.trigger('profile-fetched', profile);
	},

	onMounted() {

		this.loadUser();

		this.on('logout', () => {

			this.update({
				jwtToken: null,
				resetToken: null,
				profile: null
			});
		})
	},

	// enables observer functions
	observable: true,

	// listens for changes on statemachine
	// and rerenders component if there are
	// changes that change component state
	mapToState(appState, componentState, props) {

		return {
			...componentState,
			profile: appState.profile
		}
	},

	// enables localization functions
	translatable: true,

	// saves and loads component state to StorageFactory
	saveInKey: 'main-nav',

	// loads the following keys into storage
	loadStorage: ['jwtToken', 'refreshToken'],

	// Makes a component Queryable and wraps the
	// array of passed functions to update component
	// state when fetching. See Queryable for more detail.
	queryable: ['loadUser']
}
```

Finally, we get to implement all the javascript into our Riot component in HTML

`./components/nav/mainNav.riot`
```html
<main-nav>

	<nav id="links">

	</nav>

	<!-- loadStorage && queryable -->
	<nav if={ state.jwtToken && !state.isLoading } id="user">
		<img src={ state.profile.avatar } />

		<!-- translatable -->
		<span>{ t('nav.hello', state.profile) }</span>
	</nav>


	<!-- queryable -->
	<nav if={ state.isLoading }>
		<i class="fa fa-spinner fa-spin" />
	</nav>

	<script>
		import { mainNav } from './script';
		export default mainNav;
	</script>
</main-nav>
```

## Enabling functionality

How to enable the `appKit` features in your Riot components.

## Component Functions

### Observer

By adding `{observable: true}` to your component, it will become an [[Observer#`observe(...)`|observer instance child]] and acquire its API.

**Example**

```html
<mycomponent>
	...
	<script>
		export default {
			...,
			observable: true,

			onMounted() {

				this.once('ready', () => {

					this.loadData();
				});
			}
		}
	</script>
</mycomponent>
```

### StateMachine

By adding `mapToState()` function to your component, it will listen for changes on your app state and update the component's state with whatever you use to extract the state.

**Example**

```html
<mycomponent>
	...
	<script>
		import { applyDefaults } from '@logos-ui/utils';

		export default {
			...,

			// component extracts `profile` from appState
			// into component state
			mapToState(appState, compState, compProps) {

				return applyDefaults(
					{},
					compState,
					{ profile: appState.profile }
				);
			},

			onClickButton() {

				// can use dispatch within component
				this.dispatch({ buttonClicked: true });
			}
		}
	</script>
</mycomponent>
```

**Interface**

```ts
interface MapToStateFunction<A, P, S> {
    (appState: A, componentState: S, componentProps: P): S
};

/*
 * A = App State
 * R = Reducer Value
 * P = Riot Props
 * S = Riot State
 */
type StateMachineComponent<A, R, P, S> = {
    dispatch?: (value: A | R) => void
    mapToState?: MapToStateFunction<A, P, S>
};

```

### Localization

By adding `translatable` to your component, it will be enhanced with [[Localize#`text(...)` or `t(...)`|localization functions]]. Whenever language changes, your component will be updated.

**Example**

```html
<mycomponent>
	<p>{ t('user.name', state.profile) }</p>

	<script>
		export default {
			...,
			translatable: true
		}
	</script>
</mycomponent>
```

**Interface**

```ts
type TranslatableComponent<
	Locales extends LocaleType,
	LocaleCodes extends string
> = {
    t?: LocaleFactory<Locales, LocaleCodes>['t'];
    translatable?: true;
};
```

### Storage

By adding `saveInKey` or `loadStorage` to your component, it will be enhanced with [[Storage|storage implementation capabilities]]. When your component first mounts, the passed keys will be loaded into the component's state. In the case of `saveInKey`, whenever the component is updated, its' state will be saved to your storage implementation.

**Example**

```html
<mycomponent>
	...
	<script>
		export default {
			...,
			saveInKey: 'mycomponent',

			// will assign `{ jwtToken: '', resetToken: '' }`
			// to your component state
			loadStorage: ['jwtToken', 'resetToken']
		}
	</script>
</mycomponent>
```

**Interface**

```ts
type StoragableComponent<Storage> = {
    saveInKey?: keyof Storage;
    loadStorage?: (keyof Storage)[];
};
```


### Queryable

By adding `queryable: []` to your component, it will be automatically wrapped by [[Riot Utils#`makeQueryable(...)`|`makeQueryable(...)`]] and make all the functions from that helper available to your component. See the [[Riot Utils#`queryable`|`queryable`]] API for more info.

**Example**

```html
<mycomponent>
	...
	<script>
		export default {
			// will have `isQuerying`, `queryData`, and `queryError`
			state: { username: null, fullname: null },

			/* auto make queryable */
			async getUser () {

				/* ... */
				return whateverGoesOnQueryData;
			},

			queryable: ['getUser'],
		}
	</script>
</mycomponent>
```

### RiotComponent Type

The kit comes with a type that allows you to pass your `AppKit` type to compose another generic that will include all of your kit enhancements as optional keys. You can use to override and make your own type-safe components as follows:

**Example**

```ts
import { LogosUIRiotComponent } from '@logos-ui/riot-kit';

import { MyAppKit } from './kit';

/* Generic component that will be used to compose
 * all other components throughout your app
 * * C is your component
 * * P is props
 * * S is state
 */
export type GenericComponent<C, P, S> = LogosUIRiotComponent<MyAppKit, C, P, S>;


// Declare the non-riot functions and keys
interface SomeSpecificComponentItf {
	getUser(): void,
	login(user: string, pass: string): void,
	logout(): void,
	register(user: string, pass: string): void,
}

// Pass the interface to your generic component
type SpecificComponent = GenericComponent<

	SomeSpecificComponentItf,

	// props
	{},

	// state
	{
		isLoggedIn: boolean,
		username: string,
		email: string
	}
>

// Implementation
export const specificComponentScript: SpecificComponent = {}
```

This should facilitate the typing of your components such that you keep strong typing, and can develop a workflow for declaring component types. The separation of interface from the generic component here is a matter of preference and can simply be done all in one long-form type.

This type unions the following:

- `QueryableComponent`
- `ObservableComponent`
- `TranslatableComponent`
- `StateMachineComponent`
- `StoragableComponent`

## Main Interfaces

```ts
import {
	LogosUiObservable,
	LocaleFactory,
	StateMachine,
	StorageFactory,
	FetchFactory,

	AppKitType,
} from '@logos-ui/kit';

export * from '@logos-ui/kit';

type LogosUIRiotComponent<
	KitType extends AppKitType,
	Component extends object,
	RiotCompProps = any,
	RiotCompState = any
> = (
 	QueryableRC<
	 	Component,
	 	RiotCompProps,
	 	RiotCompState
	 > &
 	QueryableComponent<Component, RiotCompState> &
 	LogosUiObservable.Component<
	 	KitType['eventsType'],
	 	QueryableRC<
		 	Component,
		 	RiotCompProps,
		 	RiotCompState
		 >
	 > &
	TranslatableComponent<
		KitType['locales']['localeType'],
		KitType['locales']['codes']
	> &
	StateMachineComponent<
		KitType['stateMachine']['stateType'],
		KitType['stateMachine']['reducerValType'],
		RiotCompProps,
		QueryableState<RiotCompState>
	> &
	StoragableComponent<Storage>
);


declare const riotKit: <KitType extends AppKitType>(
	opts: AppKitOpts<KitType> & {
		riotInstallFunction: typeof install;
	}
) => {

	observer: Observable<
		{},
		KitType["eventsType"],
		never
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

## Supporting Interfaces

```ts
import {
	LocaleFactory,
	LocaleType,
	Observable,
	ObservableChild,
	StateMachine,
	StorageFactory
} from '@logos-ui/kit';

import { QueryableComponent, QueryableState } from '@logos-ui/riot-utils';

type QueryableRC<C, P, S> = C & RiotComponent<P, QueryableState<S>>;


type TranslatableComponent<
	Locales extends LocaleType,
	LocaleCodes extends string
> = {

	t?: LocaleFactory<Locales, LocaleCodes>['t'];
	translatable?: true;
};

type MakeTranslatableOpts<C> = {

	component: C;
	locale: LocaleFactory<any, any>;
};

declare const makeComponentTranslatable: <
	C extends Partial<RiotComponent<any, any>>
>(
	opts: MakeTranslatableOpts<C>
) => void;


type ObservableComponent<E, R> = (
	Partial<ObservableChild<R, E>> &
	{
		observable?: true;
	}
);

type MakeObservableOpts<C> = {

	component: C;
	observer: Observable<any, any>;
};

declare const makeComponentObservable: <C>(
	opts: MakeObservableOpts<C>
) => void;


type AnyState = Object | Array<any> | String | Map<any, any> | Set<any>;

interface MapToStateFunction<A, P, S> {
	(
		appState: A,
		componentState: S,
		componentProps: P
	): S;
}

interface MapToComponentFunction<P = any, S = any> {
	(
		props: P,
		state: S
	): Partial<P>;
}

type StateMachineComponent<A, R, P, S> = {

	dispatch?: (value: A | R) => void;
	mapToState?: MapToStateFunction<A, P, S>;
	mapToComponent?: MapToComponentFunction<P, S>;
};

type ConnectedComponent<A, R, P, S> = (
	Partial<
		StateMachineComponent<A, R, P, S>> &
		Partial<RiotComponent<P, S>
	>
);

declare const makeComponentStateable: <A, R, P, S, C extends ConnectedComponent<A, R, P, S>>(
	opts: {
		stateMachine: StateMachine<any>;
		component: C;
		mapToState: MapToStateFunction<A, P, S>;
		mapToComponent?: MapToComponentFunction<P, S> | undefined;
	}
) => C;

type StoragableComponent<Storage> = {
	saveInKey?: keyof Storage;
	loadStorage?: (keyof Storage)[];
};

type MakeStoragableOpts<Storage, C> = {
	component: C & StoragableComponent<Storage>;
	storage: StorageFactory<any>;
};

declare const makeComponentStoragable: <
	Storage,
	C extends RiotComponent<any, any> &
		StoragableComponent<Storage>
>(
	opts: MakeStoragableOpts<Storage, C>
) => void;
```