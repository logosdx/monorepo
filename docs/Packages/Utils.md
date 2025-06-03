---
permalink: '/packages/utils'
aliases: ["@logosdx/utils", "Utils", "utilities"]
---
## Value manipulation and comparisons

Modern javascript has new data types. The existing set of utilities that exist out there do not offer anything to handle the manipulation, comparison, and merging of the newer data types, and as such, these tools were built.

A good reason for this is, there are many times when an API returns an array of objects with some sort of IDs associated with them. With an array, one can easily add, but removing can be quite tricky, and slow, because we have to iterate each time through the entire array and filter the value we want to update, or remove. A good alternative to this is mapping IDs to an object; but then we lose some of the convenient functionality we have with Arrays (length, contains, etc). Maps and Sets solve a lot of problems for how we program. Why wouldn't we use them to manage state?

```bash
npm install @logosdx/utils
yarn add @logosdx/utils
pnpm add @logosdx/utils
```


### `deepClone(...)`

Recursively clones a given value. Accepts all data types, including `Map` and `Set`.

**Example**

```ts
const { deepClone } from '@logosdx/utils';

const a = new Set([1, 2]);
const b = deepClone(b);

const x = new Map([[1, 2]]);
const y = deepClone(x);

const g = {
	a: new Set([1, 2]),
	b: new Map([[1, 2]])
};
const h = deepClone(g);

console.log(a === b); // false
console.log(x === y); // false
console.log(g === h); // false
console.log(g.a === h.a); // false
console.log(g.b === h.b); // false
```

**Interface**

```ts
const clone: <T>(original: T) => T;
```

### `deepEqual(...)`

Recursively checks two values to check if they are equal.

**Example**
[[
]]```ts
const { deepEqual } from '@logosdx/utils';

const stateListener = (newState, oldState) => {

	if (!deepEqual(newState, oldState)) {
		return;
	}

	observer.emit('state-changed', newState);
};
```

**Interface**

```ts
const deepEqual: (change: any, current: any) => boolean;
```


### `deepMerge(...)`

Recursively merges a source value to a target. Accepts all data types, including `Map` and `Set`.

**Example**

```ts
const { deepMerge } from '@logosdx/utils';

const target = {
	a: new Set([1, 2]),
	b: new Map([[1, 2]])
};

const source = {
	c: true,
	b: new Map([[3,4]])
};

const result = deepMerge(target, source);
// {
// 	   a: Set(2) { 1, 2 },
// 	   b: Map(2) { 1 => 2, 3 => 4 },
//     c: true
// }

deepMerge([1, 2], [3, 4]);
// [1, 2, 3, 4]

deepMerge(new Set([1, 2]), new Set(3, 4));
// Set(4) { 1, 2, 3, 4 }

deepMerge([1, 2], [3, 4], { mergeArrays: false });
// [3, 4]

deepMerge(new Set([1, 2]), new Set(3, 4), { mergeSets: false });
// Set(2) { 3, 4 }

```

**Interface**

```ts
type MergeOptions = {
	mergeArrays?: Boolean;
	mergeSets?: Boolean;
};

interface DeepMerge {

	<C = any, I = any>(
		current: C,
		incoming: I,
		options?: MergeOptions
	): C & I;
	_defaults: MergeOptions;
	setDefaults(options: MergeOptions): void;
}

const deepMerge: DeepMerge;
```

### `addHandlerFor(...)`

Adds the ability to handle manipulating or comparing existing or custom data types in whatever way is deemed necessary for you.

**Example**

```ts
const equateTriangle = (target: Triangle, source: Triangle) => {

	return target.hypotenuse === source.hypotenuse;
};

const cloneTriangle = (target: Triangle) => {
	return new Triangle(
		target.a,
		target.b,
		target.hypotenuse
	);
};

const mergeTriangle = (target: Triangle, source: Triangle) => {

	target.a = source.a;
	target.b = source.b;
	target.hypotenuse = source.hypotenuse;

	return target;
};

addHandlerFor('deepClone', Triangle, cloneTriangle);
addHandlerFor('deepEqual', Triangle, equateTriangle);
addHandlerFor('deepMerge', Triangle, mergeTriangle);
```

**Interface**

```ts

type AddHandleForClone<T extends AnyConstructor> = (
	target: InstanceType<T>
) => InstanceType<T>;

type AddHandlerForMerge<T extends AnyConstructor> = (
	target: InstanceType<T>,
	source: InstanceType<T>,
	opts?: MergeOptions
) => InstanceType<T>;

type AddHandlerForEquals<T extends AnyConstructor> = (
	target: InstanceType<T>,
	source: InstanceType<T>
) => boolean

const addHandlerFor = <
    T extends AnyConstructor,
    F extends ('deepClone' | 'deepEqual' | 'deepMerge')
>(
    fn: F,
    cnstr: T,
    handler: (
        F extends 'deepClone'
        ? AddHandleForClone<T>
        : F extends 'deepMerge'
        ? AddHandlerForMerge<T>
        : AddHandlerForEquals<T>
    )
): vod
```

## Miscellaneous utilities

### `definePublicProps(...)`

A helper around `Object.defineProperty` that makes them enumerable and NOT writable.

**Example**

```ts
function Person (opts) {

	definePublicProps(this, {
		name: opts.name,
		age: opts.age,
		dob: opts.dob
	});

	return this;
}
```

**Interface**

```ts
const definePublicProps: <T, U extends Record<string, unknown>>(
	target: T,
	props: U,
	configurable?: boolean
) => void;
```


### `definePrivateProps(...)`

A helper around `Object.defineProperty` that makes them NOT enumerable and NOT writable.

**Example**

```ts
function Person (opts) {

	definePrivateProps(this, {
		associateParent() { /* ... */ },
		associateChild() { /* ... */ }
	});

	return this;
}
```

**Interface**

```ts
const definePrivateProps: <T, U extends Record<string, unknown>>(
	target: T,
	props: U,
	configurable?: boolean
) => void;
```

### `definePrivateGetters(...)`

A helper around `Object.defineProperty` that makes them enumerable and not-writable.

**Example**

```ts

function Person (opts) {

	definePrivateGetters(this, {
		parentIds: () => this._parents.map(i => i.id),
		childrenIds: () => this._children.map(i => i.id)
	});

	return this;
}

```

**Interface**

```ts
const definePrivateGetters: <T, U extends Record<string, Func>>(
	target: T,
	props: U,
	configurable?: boolean
) => void;
```


### `assert(...)`

Assert that a given `test` is true or throw an error with given `message`. An optional `ErrorClass` can be passed as the type of error to throw (defaults to `AssertionError`).

**Example**

```ts
function Person (opts) {

	assert(!!opts.name, 'name is required', ReferenceError);
	assert(!!opts.age, 'age is required', ReferenceError);

	assert(typeof opts.name === 'string', 'name is must be a string', TypeError);
	assert(typeof opts.age === 'number', 'age is must be a number', TypeError);

	assert(opts.name.length > 3, 'not a real name');
	assert(opts.age > 0, 'not a real age');

	return this;
}
```

**Interface**

```ts
const assert: (
	test: boolean,
	message?: string,
	ErrorClass?: typeof Error
) => void;
```

### `applyDefaults(...)`

Merges `sources` into `target`, using `target` as a default fallback. Only merges Objects and Arrays.

**Example**

```ts
const currentLanguage = getLanguage('spanish');
const language = applyDefaults({}, english, currentLanguage);

const components = {

	mapToState(appState, compState) {

		return applyDefaults({}, compState, appState);
	}
};
```

**Interface**

```ts
const applyDefaults: <T>(target: T, ...sources: T[]) => T;
```

### `itemsToArray(...)`

Takes an item or an array of items and returns an array containing those items. If the input is already an array, it is returned as is. If the input is a single item, it is wrapped in an array and returned.

**Example**

```ts
const x = itemsToArray(1);
// [1]
```

**Interface**

```ts
const itemsToArray: <T>(items: T | T[]) => T[];
```

### `oneOrMany(...)`

Takes an array of items and returns a single item if the array contains only one item. If the array contains multiple items, it is returned as is.

**Example**

```ts
const x = oneOrMany([1]);
// 1

const y = oneOrMany([1, 2]);
// [1, 2]
```

**Interface**

```ts
const oneOrMany: <T>(items: T[]) => T | T[];
```

### `isNonIterable(...)`

Checks if a value is non-iterable. It returns `true` if the value is `null`, `undefined`, a `String`, a `Number`, a `Boolean`, or a `Symbol`. Otherwise, it returns `false`.

**Example**

```ts
isNonIterable(null); // false
isNonIterable(undefined); // false
isNonIterable('jesus'); // false
isNonIterable(33); // false
isNonIterable(true); // false
isNonIterable(Symbol()); // false

isNonIterable([]); // true
isNonIterable({}); // true
isNonIterable(new Set()); // true
isNonIterable(new Map()); // true
```

**Interface**

```ts
const isNonIterable: (val: any) => boolean;
```

### `hasNoConstructor(...)`

Checks if a value is a type that does not have a constructor. It returns `true` if the value is `null` or `undefined`. Otherwise, it returns `false`.

**Example**

```ts
hasNoConstructor(null); // true
hasNoConstructor(undefined); // true
```

**Interface**

```ts
const hasNoConstructor: (val: any) => boolean;
```

### `oneIsNonIterable(...)`

Checks if either of the given values is non-iterable. It returns `true` if either `value` or `compare` is non-iterable. Otherwise, it returns `false`.

**Example**

```ts
if (oneIsNonIterable([1,2], true)) {
	console.log('cannot merge');
}
```

**Interface**

```ts
const oneIsNonIterable: (value: any, compare: any) => boolean;
```

### `hasSameConstructor(...)`

Checks if both values have the same constructor. It returns `true` if the constructors of `value` and `compare` are the same. Otherwise, it returns `false`.

**Example**

```ts
if (!hasSameConstructor(new Person(), new Map())) {

	console.log('what are you doing?');
}
```

**Interface**

```ts
const hasSameConstructor: (value: any, compare: any) => boolean;
```

### `isSameLength(...)`

Checks if both values are of the same length. It can be used with arrays or objects that have the `length` or `size` property. It returns `true` if the lengths of `a` and `b` are the same. Otherwise, it returns `false`.

**Example**

```ts
isSameLength([], [1]); // false
isSameLength([2], [1]); // true

isSameLength(new Set([]), new Set([1])); // false
isSameLength(new Set([2]), new Set([1])); // true

isSameLength(new Map([]), new Map([[1, 2]])); // false
isSameLength(new Map([[2,3]]), new Map([[1,2]])); // true
```

**Interface**

```ts
const isSameLength: (a: any, b: any) => boolean;
```

### `isFunction(...)`

Checks if a value is an instance of a function. It returns `true` if the value is a function, and `false` otherwise.

**Example**

```ts
if (isFunction(console.log)) {

	console.log('console.log is defined!');
}
```

**Interface**

```ts
const isFunction: (a: any) => boolean;
```

### `forInEvery(...)`

Performs a `for-in` loop on an object or array and breaks when the instance `check` function returns `false`. It can be used to check if a value is present in another object or array. It returns `true` if the check passed for all items in the object or array, and `false` otherwise.

**Example**

```ts
const original = [1, 2, 3];
const modified = [1, 2, 3, 4];


const check = (item, key) => {

	return original[key] === item;
};

forInEvery([1, 2, 3], check); // true
forInEvery(modified, check); // false
```

**Interface**

```ts
const forInEvery: (
	item: any,
	check: (v: any, i: number | string) => boolean
) => boolean;
```

### `forOfEvery(...)`

Performs a `for-of` loop on an array, set, or map and breaks when the instance `check` function returns `false`. It can be used to check if a value is present in another array, set, or map. It returns `true` if the check passed for all items in the array, set, or map, and `false` otherwise.

**Example**

```ts
const original = new Map([[1, 'ie'], [2, 'so'], [3, 'us']]);
const modified = new Map([[1, 'ie'], [2, 'so'], [3, 'us'], [4, 'cr'], [5, 'is']]);

const check = (item, key) => {

	return original[key] === item;
};

forOfEvery(original.entries(), ([key, val]) => original.get(key) === val); // true
forOfEvery(modified.entries(), ([key, val]) => original.get(key) === val); // false
```

**Interface**

```ts
const forOfEvery: (
	item: any,
	check: (v: any) => boolean
) => boolean;
```

### `isFunctionOrObject(...)`

Checks if a value is a function or an object. It returns `true` if the value is an instance of a function or an object, and `false` otherwise.

**Interface**

```ts
const isFunctionOrObject: <T extends Object | Function>(
	val: T
) => boolean;
```

### `isUndefined(...)`

Checks if a value is specifically `undefined`. It returns `true` if the value is `undefined`, and `false` otherwise.

**Interface**

```ts
const isUndefined: (val: any) => boolean;
```

## Interfaces

```ts
declare const deepClone: <T>(original: T) => T;

declare const deepEqual: (change: any, current: any) => boolean;

type MergeOptions = {
	mergeArrays?: Boolean;
	mergeSets?: Boolean;
};

declare const deepMerge: <T = any, S = T>(
	target: C, source: S, opts?: MergeOptions
) => T & S;


type AddHandleForClone<T extends AnyConstructor> = (
	target: InstanceType<T>
) => InstanceType<T>;

type AddHandlerForMerge<T extends AnyConstructor> = (
	target: InstanceType<T>,
	source: InstanceType<T>,
	opts?: MergeOptions
) => InstanceType<T>;

type AddHandlerForEquals<T extends AnyConstructor> = (
	target: InstanceType<T>,
	source: InstanceType<T>
) => boolean

declare const addHandlerFor = <
    T extends AnyConstructor,
    F extends ('deepClone' | 'deepEqual' | 'deepMerge')
>(
    fn: F,
    cnstr: T,
    handler: (
        F extends 'deepClone'
        ? AddHandleForClone<T>
        : F extends 'deepMerge'
        ? AddHandlerForMerge<T>
        : AddHandlerForEquals<T>
    )
): vod


declare const definePublicProps: <T, U extends Record<string, unknown>>(
	target: T,
	props: U,
	configurable?: boolean
) => void;

declare const definePrivateProps: <T, U extends Record<string, unknown>>(
	target: T,
	props: U,
	configurable?: boolean
) => void;

declare const definePrivateGetters: <T, U extends Record<string, Func>>(
	target: T,
	props: U,
	configurable?: boolean
) => void;

declare const assert: (
	test: boolean,
	message?: string,
	ErrorClass?: typeof Error
) => void;

declare const applyDefaults: <T>(target: T, ...sources: T[]) => T;

declare const itemsToArray: <T>(items: T | T[]) => T[];

declare const oneOrMany: <T>(items: T[]) => T | T[];

declare const isNonIterable: (val: any) => boolean;

declare const isNonObject: (val: any) => boolean;

declare const oneIsNonIterable: (value: any, compare: any) => boolean;

declare const hasSameConstructor: (value: any, compare: any) => boolean;

declare const isSameLength: (a: any, b: any) => boolean;

declare const isFunction: (a: any) => boolean;

declare const forInEvery: (
	item: any,
	check: (v: any, i: number | string) => boolean
) => boolean;

declare const forOfEvery: (
	item: any,
	check: (v: any) => boolean
) => boolean;

declare const isFunctionOrObject: <T extends Object | Function>(
	val: T
) => boolean;

declare const isUndefined: (val: any) => boolean;

type Func = (...args: any) => any | Function;
type Klass = { new: Func; };

type NonFunctionProps<T> = {
	[K in keyof T]: T[K] extends Func | Klass ? never : K;
}[keyof T];

type FunctionProps<T> = {
	[K in keyof T]: K extends NonFunctionProps<T> ? K : never;
}[keyof T];


type DeepOptional<T> = {

	[K in keyof T]?: (
		T[K] extends object
		? DeepOptional<T[K]>
		: T[K]
	);
};

type NullableObject<T> = {
	[K in keyof T]: T[K] | null;
};

type PathsToValues<
	T,
	Depth extends number = 5
> = (
	[Depth] extends [never]
	? never
	: T extends object
		? {
			[K in keyof T]-?: _Join<K, PathsToValues<T[K], _Prev[Depth]>>;
		}[keyof T]
		: ''
);

type StrOrNum = string | number;

type OneOrMany<T> = T | T[];

type OneOrManyElements<T extends Node | EventTarget = Element> = T | T[];

interface StringProps {
	[key: string]: string;
}

interface BoolProps {
	[key: string]: boolean;
}

type MaybePromise<T> = T | Promise<T>;
```