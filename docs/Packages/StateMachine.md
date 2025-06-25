---
permalink: '/packages/state-machine'
aliases: ["StateMachine", "@logosdx/state-machine"]
---

Any frontend app that grows in complexity eventually needs a to share data across components. This endeavor should be simple, and should allow you to use all the things modern-day javascript has to offer. In comes the State Machine:

- A stream-based mechanism to update application state
- With the ability to move forward and backwards in states
- And manipulate the state as you need it using reducers
- Able to listen for changes
- And make child instance clones of your state manager

```sh
npm install @logosdx/state-machine
yarn add @logosdx/state-machine
pnpm add @logosdx/state-machine
```

With jsdeliver:

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/state-machine@latest/dist/browser/bundle.js"></script>
```

```html
<script>
	const { StateMachine } = LogosDx.StateMachine;
</script>
```

## Example

```typescript
import { StateMachine } from '@logosdx/state-machine';
import { clone, merge } from '@logosdx/utils';

type Pet = {
	type: 'dog' | 'cat' | 'sheep' | 'cattle',
	color: string,
	name: string
};

// Type your app's state for re-use everywhere
type AppState = {
	name: string,
	age: number,
	phone: string,
	pets: Map<string, Pet>
};

// Type the values you will pass into the reducer
type ReducerValue = Partial<AppState> | Pet | Pet[];

const initialState: AppState = {
	name: 'Jesus',
	age: 33,
	phone: 3050432836
	pets: new Map()
}

const stateMachine = new StateMachine<AppState, ReducerValue>(initialState, {

	// 10 versions of the state to rewind from
	statesToKeep: 10,

	// If you only ever want one state
	flushOnRead: true
});

// Handle all your different state dispatches
stateMachine.addReducer((newState, oldState, ignoreUpdate) => {

	if (isPet(newState)) {

		const pet = newState;
		oldState.pets.add(pet.name, pet);

		// Return a cloned state for immutability
		return clone(oldState);
	}

	if (isManyPets(newState)) {

		const pets = newState;

		for (const pet of pets) {
			oldState.pets.add(pet.name, pet);
		}

		return clone(oldState);
	}

	// Ignore changes given certain conditions
	if (newState.someCondition) {
		return ignoreUpdate;
	}

	return merge(oldState, newState);
});

// Listen for changes
stateMachine.addListener((newState, oldState) => {

	console.log(newState);
});

// Dispatch one reducer value
stateMachine.dispatch(await fetchPetFor('Jesus'));

// Dispatch another
stateMachine.dispatch({ name: 'John' });
stateMachine.dispatch({ name: 'Jacob' });
stateMachine.dispatch({ name: 'Peter' });

stateMachine.dispatch(await fetchAllPetsFor('Peter'));

// Travel backwards in state
stateMachine.prevState(); // pets = fetchPetsFor('Jesus')
stateMachine.prevState(); // name: Jacob
stateMachine.prevState(); // name: John

// Travel forward in state
stateMachine.nextState(); // name: Jacob
stateMachine.nextState(); // name: Peter
stateMachine.nextState(); // pets = fetchAllPetsFor('Peter')

// Go to a specific state
stateMachine.goToState(3); // name: Jacob

// Go back to original state
stateMachine.resetState();

// Remove all saved states
stateMachine.flushStates();

// and more!
```

## Basic Usage

### Declaring and reducing state

State Machine allows for flexible manipulation of state. It is built using a custom [[Packages/Utils#`equals(a, b)`|state differ]] to allow for the use of new data types as the things to manage state, such as `Map` and `Set`. The idea is as follows:

First, you want to strongly type your application's state

```ts
type AppState = {
	person?: Person,
	children?: Person[],
	spouse?: Person,
	hobbies?: Set<string>
};
```

Next, you want to strongly type the values you are going to dispatch into your state instance.

```ts
type ReducerValue = (
	Person |
	{ wife?: Person, husband?: Person } |
	{ kids: Person[] } |
	{ activity: string }
);
```

Next, we're going to declare an initial state, and create our state instance.

```ts
const initialState: AppState = {
	person: null
}

const stateMachine = new StateMachine<AppState, ReducerValue>(initialState);
```

Finally, we add our reducers in order to generate our final state product

```ts
stateMachine.addReducer((newState, oldState, ignore) => {

	// a person was passed as the newState
	if (newState instanceof Person) {
		return { ...oldState, person: newState };
	}

	// else ignore
	return ignore;
});

stateMachine.addReducer((newState, oldState, ignore) => {

	// a spouse was passed as the newState
	if (newState.wife || newState.husband) {
		return { ...oldState, spouse: newState.wife || newState.husband };
	}

	// else ignore
	return ignore;
});

stateMachine.addReducer((newState, oldState, ignore) => {

	// children were passed as the newState
	if (newState.kids) {
		return {
			...oldState,
			children: [
				...(oldState.children || []),
				...newState.kids
			]
		}
	}

	// else ignore
	return ignore;
});

stateMachine.addReducer((newState, oldState, ignore) => {

	// a hobby was passed as the newState
	if (newState.activity) {

		const hobbies = oldState.hobbies || new Set();
		hobbies.add(newState.activity);

		return {
			...oldState,
			hobbies
		}
	}

	// else ignore
	return ignore;
})
```

Alternatively, you can do a simpler single reducer that merges the entire state.

```ts
import { merge } from '@logosdx/utils';

stateMachine.addReducer((newState, oldState, ignore) => {

	// conditional states
	if (something) {
		return { ...oldState, somethingChanged };
	}

	// default condition
	return merge(newState, oldState);
});
```


Now we can begin dispatching changes to our app state

```ts
stateMachine.dispatch(new Person());
stateMachine.dispatch({ wife: new Person() });
stateMachine.dispatch({ husband: new Person() });
stateMachine.dispatch({ children: [new Person()] });
stateMachine.dispatch({ activity: 'chess' });
stateMachine.dispatch({ hobbies: new Set(['guitar', 'bass', 'drums']) });
```


#### `addReducer(...)`

Adds a callback that will manipulate the application state (unless ignored). There is no limit to the number of reducers your can add.

**Example**

```ts
stateMachine.addReducer((newState, oldState, ignore) => {

	if (aReallyGoodReason) {
		return ignore; // ignore this reducer
	}

	// conditional states
	if (something) {
		return { ...oldState, somethingChanged };
	}

	// default condition
	return merge(newState, oldState);
});


stateMachine.addReducer(reducer1, reducer2, reducer3);
```

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	addReducer(...fns: ReducerFunction<State, ReducerValue>[]): this;
}
```

#### `removeReducer(...)`

Removes a reducer callback so that it no longer changes application state.

**Example**

```ts
stateMachine.removeReducer(reducer1, reducer2, reducer3);
```

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	removeReducer(...fns: ReducerFunction[]): this;
}
```

#### `dispatch(...)`

Send changes to your state manager.

### Listening for changes in state

Once you have your reducers in place, listeners will be called upon there being changes to your state. If there are no changes to your state, there will be no changes dispatched.

```ts
stateMachine.addListener((newState, oldState) => {
	// ...
});
```

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {


	dispatch(
		value: Partial<State> | ReducerValue,
		flow?: StateMachine[]
	): this | undefined;
}
```

#### `addListener(...)`

Adds listeners to your state manager. There is no limit to the number of listeners you can add.

**Example**

```ts
stateMachine.addListener(listener1, listener2, listener3);
```

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	addListener(...fns: ListenerFunction<State, ReducerValue>[]): this;
}
```


#### `removeListener(...)`

Remove listeners from your state manager.

**Example**

```ts
stateMachine.removeListener(listener1, listener2, listener3);
```

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	removeListener(...fns: ListenerFunction<State, ReducerValue>[]): this;
}
```

## Elaborated Usage

### `states()`

Returns an array of all saved application states

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	states(): State[];
}
```

### `state()`

Returns the current state

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	state(): State;
}
```

### `flushStates()`

Removes all historical states, except the current state.

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	flushStates(): void;
}
```

### `resetState()`

Puts state back to the most recent state in the history.

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	resetState(): void;
}
```

### `goToState(...)`

Sets the current state to a historical state, if it exists.

**Example**

```ts
stateMachine.dispatch(stateA);
stateMachine.dispatch(stateB);
stateMachine.dispatch(stateC);
stateMachine.dispatch(stateD);
stateMachine.dispatch(stateE);

stateMachine.goToState(3); // stateC
```

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	goToState(sid: number): void;
}
```

### `prevState()`

Go to the immediate previous state.

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	prevState(): void;
}
```

### `nextState()`

Go to the immediate next state.

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	nextState(): void;
}
```

### `clone(...)`

Makes a clone of the existing state machine. This is useful when you want to carry the state to an ephemeral version of your app. Let's say you're making a document editor app of some sort; you are able to maintain all of the same functionality of listening, reducing, and dispatching the state of the document, without affecting the parent. If you decide to cancel the action, the parent state is not affected. If you decide to commit, you can dispatch on the parent, and the child will receive the parent's updated state.

Changes will flow from the parent to the child, but not from the child to the parent, unless specifically expressed using the `bidirectional` option.

**Example**

```ts
const stateMachine = new StateMachine({ /* ... */ });

const someComponent = stateMachine.clone();

// Will NOT affect parent
someComponent.dispatch(/* ... */);

// Affects child
stateMachine.dispatch(/* ... */);

const bothWays = stateMachine.clone({ bidirectional: true });

// Affects parent
bothWays.dispatch(/* ... */);

// Affects child
stateMachine.dispatch(/* ... */);

```

Listeners come with the ability to peek into who's sending the update by checking the `flow` parameter

```ts
stateChild.addListener((nState, cState, flow) => {

	const parentReducer = flow[flow.length - 1];

	if (parentReducer === stateMachine) {
		console.log('this was dispatched by the parent state machine!');
	}
})
```

**Interface**

```ts
class StateMachine<State = any, ReducerValue = any> {

	clone(options?: StateMachineOptions): StateMachine<State, ReducerValue>;
}
```

## Interfaces

```typescript
type StateMachineOptions = {
	statesToKeep?: number;
	flushOnRead?: boolean;
	parent?: StateMachine;
	bidirectional?: boolean;
};

type StateMachineState<State = any> = {
	state?: Readonly<State>;
	currentState?: number | null;
	latestState?: number | null;
	parentListener?: Function | null;
	childListener?: Function | null;
};

interface ReducerFunction<State = any, Value = State> {

	(
		value: Value | Partial<State>,
		state?: State,
		ignore?: symbol
	): State | symbol;
}

type ListenerFunction<State = any, Value = any> = (
	newState: S,
	oldState: S,
	flow?: StateMachine<State, Value>[]
) => void;

export declare class StateMachine<State = any, ReducerValue = any> {

	constructor(initialState?: any, options?: StateMachineOptions);

	dispatch(
		value: Partial<State> | ReducerValue,
		flow?: StateMachine[]
	): this | undefined;

	addReducer(...fns: ReducerFunction<State, ReducerValue>[]): this;
	removeReducer(...fns: ReducerFunction[]): this;
	addListener(...fns: ListenerFunction<State, ReducerValue>[]): this;
	removeListener(...fns: ListenerFunction<State, ReducerValue>[]): this;

	states(): State[];
	state(): State;

	flushStates(): void;
	resetState(): void;
	goToState(sid: number): void;
	prevState(): void;
	nextState(): void;

	clone(options?: StateMachineOptions): StateMachine<State, ReducerValue>;
}
```