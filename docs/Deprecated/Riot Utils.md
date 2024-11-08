---
permalink: '/packages/riot-utils'
aliases: ["RiotUtils", "@logos-ui/riot-utils"]
---

A set of utilities and enhancements for working with RiotJS apps and its' components.

```bash
npm install @logos-ui/riot-utils
yarn install @logos-ui/riot-utils
pnpm install @logos-ui/riot-utils
```

## Lifecycle utils

### `makeOnBeforeMount(...)`

Makes an [`onBeforeMount`](https://riot.js.org/api/#lifecycle) function on your Riot component without interfering with whatever original or previous `onBeforeMount` function you may have.

**Example**

```ts
const makeComponentTranslatable = <C>(opts: MakeTranslateOpts<C>) => {

    const onBeforeMount: MkHookOpts<C, any, any> = {
        component: opts.component,
        callback: function () {
            update = () => this.update!();

            opts.locale.on('locale-change', update);
        },
    }

}
```

**Interfaces**

```ts
interface MakeOnBeforeMount<T, P, S> {
    component: T,
    callback: (this: T, prop: P, state: S) => void,
    runAfterOriginal?: boolean
}
```

### `makeOnMounted(...)`

Makes an [`onMounted`](https://riot.js.org/api/#lifecycle) function on your Riot component without interfering with whatever original or previous `onMounted` function you may have.

**Example**

```ts
const makeFormValidator = <C>(opts: MakeFormValidatorOpts<C>) => {

	const {
		component,
		validator,
		displayErrors,
	} = opts;

	const callback = () => {


		html.events.on(
			$('form', this.root),
			'submit',
			(e) => {

				const isValid = validator(e.target);

				if (!isValid) {

					e.preventDefault();
					displayErrors(e.target);
				}
			}
		)
	};

    makeOnMounted({ component, callback, runAfterOriginal: true });
}
```

**Interfaces**

```ts
interface MakeOnMounted<T, P, S> {
    component: T,
    callback: (this: T, prop: P, state: S) => void,
    runAfterOriginal?: boolean
}
```

### `makeOnBeforeUpdate(...)`

Makes an [`makeOnBeforeUpdate`](https://riot.js.org/api/#lifecycle) function on your Riot component without interfering with whatever original or previous `makeOnBeforeUpdate` function you may have.

**Example**

```ts
const makeComponentPersistent = <C>(opts: MakePersistentOpts<C>) => {

    makeOnBeforeUpdate({
        component: opts.component,
        callback(props, state) {

            opts.storage.set('mycomponent', state);
        },
    });
}
```

**Interfaces**

```ts
interface MakeOnBeforeUpdate<T, P, S> {
    component: T,
    callback: (this: T, prop: P, state: S) => void,
    runAfterOriginal?: boolean
}
```

### `makeOnUpdated(...)`

Makes an [`makeOnUpdated`](https://riot.js.org/api/#lifecycle) function on your Riot component without interfering with whatever original or previous `makeOnUpdated` function you may have.

**Example**

```ts
const makeComponentStated = <C>(opts: MakeStatedOpts<C>) => {

    makeOnUpdated({
        component: opts.component,
        callback(props, state) {

            opts.storage.set('mycomponent', state);
        },
    });
}
```

**Interfaces**

```ts
interface MakeOnUpdated<T, P, S> {
    component: T,
    callback: (this: T, prop: P, state: S) => void,
    runAfterOriginal?: boolean
}
```

### `makeOnBeforeUnmount(...)`

Makes an [`makeOnBeforeUnmount`](https://riot.js.org/api/#lifecycle) function on your Riot component without interfering with whatever original or previous `makeOnBeforeUnmount` function you may have.

**Example**

```ts
const makeComponentObservable = <C>(opts: MakeObservableOpts<C>) => {

    const observed = opts.observer.observe(opts.component);

    makeOnBeforeUnmount({
        component: opts.component,
        callback() {

            observed.cleanup()
        },
    })
}
```

**Interfaces**

```ts
interface MakeOnBeforeUnmount<T, P, S> {
    component: T,
    callback: (this: T, prop: P, state: S) => void,
    runAfterOriginal?: boolean
}
```

### `makeOnUnmounted(...)`

Makes an [`makeOnUnmounted`](https://riot.js.org/api/#lifecycle) function on your Riot component without interfering with whatever original or previous `makeOnUnmounted` function you may have.

**Example**

```ts
const makeComponentObservable = <C>(opts: MakeObservableOpts<C>) => {

    const observed = opts.observer.observe(opts.component);

    makeOnBeforeUnmount({
        component: opts.component,
        callback() {

            observed.cleanup()
        },
    })
}
```

**Interfaces**

```ts
interface MakeOnUnmounted<T, P, S> {
    component: T,
    callback: (this: T, prop: P, state: S) => void,
    runAfterOriginal?: boolean
}
```

## Riot Helpers

### `makeQueryable(...)`

Enhances a component with a queryable state, and functions to set a component into a querying state. Useful for when making API calls, or any other sort of asynchronous activity that requires the display of a loader of some sort.

**Example**

`components/nav/script.ts`
```ts
import { makeQueryable } from '@logos-ui/riot-utils';

export myComponent = makeQueryable({

	// will have `isQuerying`, `queryData`, and `queryError`
	state: { username: null, fullname: null },

	/* auto make queryable */
	async getUser () {

		/* ... */
		return whateverGoesOnQueryData;
	},

	queryable: ['getUser'],

	async manualQuery() {

		try {
			this.toggleQuerying(true);
			/* fetch stuff ... */
			this.toggleQuerying(false);
		}
		catch (e) {

			/* handle error ... */
			this.toggleQuerying(false);
		}
	},

	async notAutoQueried () { /* ... */ },

	onMounted() {
		this.getUser();

		this.fnWillQuery(this.notAutoQueried);
	}
})
```

`components/nav/mainNav.riot`
```html
<mycomponent>

	<alert if={state.queryError}>{ state.queryError }</alert>

	<p if={ state.isQuerying }>
		<spinner />
	</p>

	<p if={ state.fullname && !state.isQuerying }>
		Welcome { state.fullname } aka { state.username }!
	</p>

	<button onclick={ manualQuery }>Do the thing!</button>

	<script>
		import { myComponent } from './script';
		export default myComponent;
	</script>
</mycomponent>
```

**Interface**

```ts
declare type QueryableState<S> = S & {
	isQuerying?: boolean;
	queryError?: Error | null;
	queryData?: any;
};

declare interface QueryableComponent<C, S> {

	state: QueryableState<S>;

	toggleQuerying(isQuerying?: boolean): void;
	setQuerying<T extends Func>(fn: T): ReturnType<T>;
	fnWillQuery: <T extends Func>(fn: T) => ReturnType<T>;

	queryable: (FunctionProps<C>)[];
}

declare const makeQueryable: <T extends unknown, State = any>(
	component: RiotComponentExport<T, unknown, State>
) => T & QueryableComponent<T, State>;

```

#### Query State

Query state gets updated to include:

- `queryError` - error emitted by the queryable function
- `queryData` - response returned by the queryable function
- `isQuerying` - A toggle-able boolean that sets query state to true when called

#### `toggleQuerying(...)`

Set `isQuerying` to true or false.

#### `setQuerying(...)`

Try-catches functions and automatically sets queryable variables. Under the hood, this runs [[Riot Utils#`toggleQuerying(...)`|`toggleQuerying(...)`]] and captures the return stated to assign to `queryData`. If there is an error, it will assign to `queryError`.

#### `fnWillQuery(...)`

Set the passed function as a toggle-able query. It will be overwritten to make it queryable. Under the hood, this passes the original function to [[Riot Utils#`setQuerying(...)`|`setQuerying(...)`]] and replaces it with a new function

#### `queryable`

An array property that references your component's functions. It will wrap these functions in a try-catch and set `state.isQuerying` while the function is fetching information. Under the hood, it simply runs [[Riot Utils#`fnWillQuery(...)`|`fnWillQuery(...)`]] to make the function queryable.



## Interfaces

```ts
type RiotComponentExport<C, P = any, S = any> = (
	RiotComponentWithoutInternals<
		RiotComponent<P, S>
	> & C
);

type QueryableState<S> = S & {
	isQuerying?: boolean;
	queryError?: Error | null;
	queryData?: any;
};

interface QueryableComponent<C, S> {
	state: QueryableState<S>;
	queryable: (FunctionProps<C>)[];
	toggleQuerying(isQuerying?: boolean): void;
	setQuerying<T extends Func>(fn: T): ReturnType<T>;
	fnWillQuery: <T extends Func>(fn: T) => ReturnType<T>;
}

declare const makeQueryable: <T extends unknown, State = any>(
	component: RiotComponentExport<T, unknown, State>
) => T & QueryableComponent<T, State>;

type HookKeys = (
	'onBeforeMount' |
	'onMounted' |
	'onBeforeUpdate' |
	'onUpdated' |
	'onBeforeUnmount' |
	'onUnmounted'
);

type MkHookOpts<T, P, S> = {

	component: T;
	callback: (this: T, prop: P, state: S) => void;
	runAfterOriginal?: boolean;
};

interface MakeHook<T, P, S> {
	(opts: MkHookOpts<T, P, S>): void;
}

declare const mkHook: <T = any, P = any, S = any>(hook: HookKeys) => MakeHook<T, P, S>;

declare const makeOnBeforeMount: MakeHook<any, any, any>;
declare const makeOnMounted: MakeHook<any, any, any>;
declare const makeOnBeforeUpdate: MakeHook<any, any, any>;
declare const makeOnUpdated: MakeHook<any, any, any>;
declare const makeOnBeforeUnmount: MakeHook<any, any, any>;
declare const makeOnUnmounted: MakeHook<any, any, any>;

declare const mergeState: <
	Component extends Partial<
		RiotComponent<any, any>
	>,
	State = any
>(
	component: Component,
	state: State
) => void;
```