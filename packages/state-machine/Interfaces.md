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
		value: Partial<Value> | Partial<State>, 
		state?: State, 
		ignore?: symbol
	): State | symbol;
}

type ListenerFunction<S = any, R = any> = (
	newState: S, 
	oldState: S, 
	flow?: StateMachine<S, R>[]
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

export default StateMachine;
```