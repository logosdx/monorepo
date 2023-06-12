---
permalink: '/packages/storage'
aliases: ["Storage", "@logos-ui/storage"]
---

The `StorageFactory` class provides a convenient way to interact with browser storage APIs, such as `localStorage` or `sessionStorage`. It allows you to store and retrieve data using key-value pairs and provides additional features like prefixing keys, event handling, and type checking.

```bash
npm install @logos-ui/storage
yarn add @logos-ui/storage
pnpm add @logos-ui/storage
```

## Example

```ts
import { StorageFactory } from '@logos-ui/storage'

type StorageItems = {
	favoriteItems?: Item[],
	savedForLater?: Product[],
	jwtToken?: string,
	refreshToken?: string,
	user: UserType
}

const storage = new StorageFactory<StorageItems>(localStorage, 'my-app');

storage.set('favoriteItems', [{ name: 'apples' }]);
storage.set('savedForLater', [{ sku: '751248' }]);
storage.set('jwtToken', 'adsc41807t');

const entireStorage = storage.get();

const {
	favoriteItems,
	savedForLater
} = storage.get(['favoriteItems', 'savedForLater']);

const jwtToken = storage.get('jwtToken');

storage.set('user', { id: 'abc123' });
storage.assign('user', { name: 'Peter', age: 56 })

if (!storage.has('refreshToken')) {
	storage.remove('user');
	storage.remove(['jwtToken', 'refreshToken']);
}

storage.on('storage-before-set', () => { /* ... */});
storage.on('storage-after-set', () => { /* ... */});
storage.on('storage-before-unset', () => { /* ... */});
storage.on('storage-after-unset', () => { /* ... */});
storage.on('storage-reset', () => { /* ... */});

storage.off('storage-reset', () => { /* ... */});

storage.clear();

const jwt = storage.wrap('jwtToken');

jwt.set('adsc41807t');
jwt.get() === 'adsc41807t';
jwt.remove();

const user = jwt.wrap('user');

user.set({ id: 'abc123' });
user.assign({ name: 'Peter', age: 56 });

// and more!
```

## Basic Usage

When you instantiate a StorageFactory, you can optionally setup types for the storage instance to help validate what you're putting in. You can also add a prefix, so to not mix other tools' usage of local storage with your app's.

```ts
import { StorageFactory } from '@logos-ui/storage'

type StorageItems = {
	favoriteItems?: Item[],
	savedForLater?: Product[],
	jwtToken?: string,
	refreshToken?: string,
	user: UserType
}

const storage = new StorageFactory<StorageItems>(localStorage, 'my-app');
```

This will store keys as `my-app:nameOfKey`.


### `get(...)`

**Returns all items:**

```ts
const allItems = storage.get();
```

**Return one item:**

```ts
const oneItem = storage.get('somekey');
```

**Return some items:**

```ts
const someItems = storage.get(['key1', 'key2']);
```

**Interface:**

```ts
class StorageFactory<Values> extends EventTarget {

	get<K extends keyof Values>(): Values;
	get<K extends keyof Values>(key: K): Values[K];
	get<K extends keyof Values>(keys: K[]): Partial<NullableObject<Values>>;

}
```

### `set(...)`

**Set an object as the entire store:**

```ts
storage.set({
	jwtToken: '...',
	resetToken: '...',
	user: { ... }
});
```

This would set 3 keys:

- `my-app:jwtToken`
- `my-app:resetToken`
- `my-app:user`

**Set a single value:**

```ts
storage.set('favoriteItems', [{ ... }]);
```

**Interface**

```ts
class StorageFactory<Values> extends EventTarget {

	set(values: Partial<Values> & Record<string, any>): void;
	set<K extends keyof Values>(
		key: K | Partial<Values> & Record<string, any>,
		value: Values[K]
	): void;

}
```

### `rm(...)`

**Remove a single key:**

```ts
storage.rm('jwtToken');
```

**Remove a multiple keys:**

```ts
storage.rm(['jwtToken', 'resetToken']);
```

**Alternatives:**

`storage.remove(...)` is the same as `storage.rm(...)`

**Interface**

```ts
class StorageFactory<Values> extends EventTarget {

	rm<K extends keyof Values>(keyOrKeys: K | K[]): void;
	remove: StorageFactory<Values>['rm'];

}
```

### `has(...)`

**Returns a boolean if key has been set:**

```ts
storage.has('user') === true;
```

**Returns an array of boolean for given keys:**

```ts
storage.has(['jwtToken', 'resetToken', 'user']);
```

**Interface**

```ts
class StorageFactory<Values> extends EventTarget {

	has(keys: (keyof Values)[]): boolean[];
	has(keys: string[]): boolean[];
	has(keys: (keyof Values)[]): boolean;
	has(key: string): boolean;

}
```


### `clear()`

Removes all values scoped to the configured prefix.

**Alternatives:**

`storage.reset()` is the same as `storage.clear()`

**Interface**

```ts
class StorageFactory<Values> extends EventTarget {

	clear(): void;
	reset: StorageFactory<Values>['clear'];

}
```

## Elaborated Usage


### `assign(...)`

`Object.assign()` a value into given key. If the key is not an object, an error will be thrown.

```ts
storage.assign('user', { name: 'Peter', age: 56 });
```

**Interface**

```ts
class StorageFactory<Values> extends EventTarget {

	assign<K extends keyof Values>(key: K, val: Partial<Values[K]>): void;

}
```

### `wrap(...)`

Wraps a single key and returns functions to get, set, remove, assign

```ts
const jwt = storage.wrap('user');

jwt.set({ id: 5 });
jwt.get();
jet.assign({ name: 'Joseph' });

// these are all the same
jwt.remove();
jwt.rm();
jwt.clear();
```

**Interface**

```ts
class StorageFactory<Values> extends EventTarget {

	wrap<K extends keyof Values>(key: K): {
		set: (val: Values[K]) => void;
		get: () => Values[K];
		remove: () => void;
		assign: (val: object) => void;
		rm: () => void;
		clear: () => void;
	};

}
```


### `keys()`

Returns all keys scoped by prefix

**Interface**

```ts
class StorageFactory<Values> extends EventTarget {

	keys(): (keyof Values)[];

}
```

### `entries()`

`Object.entries()` against the entire store as an object

**Interface**

```ts
class StorageFactory<Values> extends EventTarget {

	entries(): [keyof Values, Values[keyof Values]][];

}
```

### `values()`

`Object.values()` against the entire store as an object

**Interface**

```ts
class StorageFactory<Values> extends EventTarget {

	values(): Values[keyof Values][];

}
```

### Events

`StorageFactory` is built on top of `EventTarget` and emits events on certain actions. The list of events is as follows:

- `storage-before-set`: Before saving a value to the storage implementation.
- `storage-after-set`: After saving a value to the storage implementation.
- `storage-before-unset`: Before removing a value to the storage implementation.
- `storage-after-unset`: After removing a value to the storage implementation.
- `storage-reset`: After clearing and removing all keys.

```ts
storage.on('storage-before-set', (event) => {

	console.log(event.key, event.value);
});


function runsOnce() {};

storage.on('storage-reset', runsOnce, true);
storage.off('storage-reset', runsOnce)
```

**Interface**

```ts
declare class StorageEvent<Values> extends Event {
	key?: keyof Values | (keyof Values)[];
	value: Values[keyof Values] | {
		[K in keyof Values]: Values[K];
	};
}

declare enum StorageEventNames {
	'storage-before-set' = "storage-before-set",
	'storage-after-set' = "storage-after-set",
	'storage-before-unset' = "storage-before-unset",
	'storage-after-unset' = "storage-after-unset",
	'storage-reset' = "storage-reset"
}

type L10nListener<Values> = (e: StorageEvent<Values>) => void;

class StorageFactory<Values> extends EventTarget {

	on(
		ev: keyof typeof StorageEventNames,
		listener: L10nListener<Values>,
		once?: boolean
	): void;

	off(
		ev: keyof typeof StorageEventNames,
		listener: EventListenerOrEventListenerObject
	): void;
}
```


## All Interfaces

```ts
type StorageImplementation = {
	clear(): void;
	getItem(key: string, callback?: any): string | null;
	removeItem(key: string): void;
	setItem(key: string, value: string): void;
};

declare class StorageEvent<Values> extends Event {
	key?: keyof Values | (keyof Values)[];
	value: Values[keyof Values] | {
		[K in keyof Values]: Values[K];
	};
}

declare enum StorageEventNames {
	'storage-before-set' = "storage-before-set",
	'storage-after-set' = "storage-after-set",
	'storage-before-unset' = "storage-before-unset",
	'storage-after-unset' = "storage-after-unset",
	'storage-reset' = "storage-reset"
}

type L10nListener<Values> = (e: StorageEvent<Values>) => void;

declare class StorageFactory<Values> extends EventTarget {

	constructor(
		storage: StorageImplementation,
		prefixOrOptions?: string
	);

	readonly storage: StorageImplementation;
	readonly prefix?: string;

	on(
		ev: keyof typeof StorageEventNames,
		listener: L10nListener<Values>,
		once?: boolean
	): void;

	off(
		ev: keyof typeof StorageEventNames,
		listener: EventListenerOrEventListenerObject
	): void;

	get<K extends keyof Values>(): Values;
	get<K extends keyof Values>(key: K): Values[K];
	get<K extends keyof Values>(keys: K[]): Partial<NullableObject<Values>>;

	set(values: Partial<Values> & Record<string, any>): void;
	set<K extends keyof Values>(
		key: K | Partial<Values> & Record<string, any>,
		value: Values[K]
	): void;

	assign<K extends keyof Values>(key: K, val: Partial<Values[K]>): void;

	rm<K extends keyof Values>(keyOrKeys: K | K[]): void;
	remove: StorageFactory<Values>['rm'];

	has(keys: (keyof Values)[]): boolean[];
	has(keys: string[]): boolean[];
	has(keys: (keyof Values)[]): boolean;
	has(key: string): boolean;

	clear(): void;
	reset: StorageFactory<Values>['clear'];

	keys(): (keyof Values)[];
	entries(): [string, unknown][];
	values(): unknown[];

	wrap<K extends keyof Values>(key: K): {
		set: (val: Values[K]) => void;
		get: () => Values[K];
		remove: () => void;
		assign: (val: object) => void;
		rm: () => void;
		clear: () => void;
	};
}
```