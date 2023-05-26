Any frontend app that grows in complexity eventually needs a to share data across components. This endeavor should be simple, and should allow you to use all the things modern-day javascript has to offer. In comes the State Machine:

- A stream-based mechanism to update application state
- With the ability to move forward and backwards in states
- And manipulate the state as you need it using reducers
- Able to listen for changes
- And make child instance clones of your state manager

```sh
yarn add @logos-ui/state-machine
```

Make sure to look at the [[packages/state-machine/Interfaces|Interfaces]] for this package to get a better idea of what will be available.

### Example

```typescript
import { StateMachine } from '@logos-ui/state-machine';
import { clone, merge } from '@logos-ui/utils';

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