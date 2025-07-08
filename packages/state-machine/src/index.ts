import {
    clone,
    definePrivateProps,
    assert,
    isUndefined,
    isNonIterable,
    Func,
    equals,
    generateId
} from '@logosdx/utils'

const assertFunction = (fn: Func, msg: string) => {

    assert(typeof fn === 'function', `${msg} must be a function`);
}

export const deepFreeze = (target: object) => {

    if (isNonIterable(target)) {
        return;
    }

    Object.freeze(target);

    for (const key in target) {

        deepFreeze(target[key as keyof typeof target]);
    }
};


export type StateMachineOptions = {

    /** How many states changes to keep in memory */
    statesToKeep?: number | undefined;

    /** Removes states after reading */
    flushOnRead?: boolean | undefined;

    /** Parent stream */
    parent?: StateMachine | undefined;

    /** Child stream should update parent stream */
    bidirectional?: boolean | undefined;
};

export type StateMachineState<State = any> = {

    state?: Readonly<State> | undefined;
    currentState?: number | null | undefined;
    latestState?: number | null | undefined;
    parentListener?: Function | null | undefined;
    childListener?: Function | null | undefined;
};

export interface ReducerFunction<State = any, Value = State> {
    (value: Partial<Value> | Partial<State>, state?: State, ignore?: symbol): State | symbol
}

export type ListenerFunction<S = any, R = any> = (newState: S, oldState: S, flow?: StateMachine<S, R>[]) => void

// For skipping state modification
const IGNORE = Symbol();

const DEFAULT_OPTIONS: StateMachineOptions = {
    statesToKeep: 5
};

export class StateMachine<State = any, ReducerValue = any> {

    _options!: StateMachineOptions;

    // @ts-ignore
    private _id!: number;
    private _sid = 0;

    private _stateId(): number {
        return this._sid++;
    }

    _internals!: StateMachineState<State>;
    _states!: Map<number, State>;

    _reducers!: Set<ReducerFunction<State, ReducerValue>>;
    _listeners!: Set<ListenerFunction<State, ReducerValue>>;

    _parent!: StateMachine|null;

    constructor(initialState: Partial<State> = {}, options: StateMachineOptions = {}) {

        definePrivateProps(this, {

            // Holds state reducers
            _reducers: new Set(),

            // Holds listeners
            _listeners: new Set(),

            // Holds states
            _states: new Map(),

            _options: {
                ...DEFAULT_OPTIONS,
                ...options
            },

            _parent: options.parent || null,

            _id: generateId()
        })

        if (options.statesToKeep) {
            assert(
                isNaN(options.statesToKeep) === false,
                'StateMachine options.statesToKeep is not a number'
            );
        }

        this._setupClone();
        this._addState(initialState as State);
    }

    private _setInternals(updates: StateMachineState<State>) {

        this._internals = {
            ...this._internals,
            ...updates
        };

        deepFreeze(this._internals);
    }

    private _addState(state: State) {

        const { statesToKeep } = this._options!;
        const { _states } = this;

        if (statesToKeep && _states!.size >= statesToKeep) {

            _states!.delete(
                _states!.keys().next().value!
            );
        }

        const currentState = this._stateId();

        // Initialize state to state holder
        _states!.set(currentState, state);

        this._setInternals({
            currentState,
            latestState: currentState,
            state
        });
    }

    private _notifyListeners(newState: State, oldState: State, flow?: StateMachine[]) {

        // Notify listeners
        for (const listener of this._listeners!) {
            listener(newState, oldState, flow);
        }
    };

    /**
     * Pushes an update to the state.
     * @param value New state
     * @param {Array} flow This can be ignored. Tracks flow of incoming updates to prevent double updates on clones.
     */
    dispatch(value: Partial<State>|ReducerValue, flow?: StateMachine[]) {

        /**
         * If the update is coming back to itself, do not update.
         */
        if (flow?.includes(this)) {
            return
        }

        const {
            _reducers,
            _listeners
        } = this;

        const {
            flushOnRead
        } = this._options;

        const valueIsUndefined = isUndefined(value);

        const currentState = this.state();
        let prevState: State | symbol = this.state();
        let nextState = valueIsUndefined ? prevState : value;

        // If no reducers present, state will be overwritten
        if (!valueIsUndefined && _reducers.size) {

            for (const reducer of _reducers) {

                const _modified = reducer(
                    nextState,
                    prevState as State,
                    IGNORE
                );

                // Ignore modification if ignore symbol
                if (_modified === IGNORE) {

                    continue;
                }

                if (!isUndefined(_modified)) {

                    prevState = _modified;
                }
            }

            nextState = prevState as any;
        }

        if (equals(nextState, currentState)) {
            return;
        }

        // Save new state to holder
        if (!valueIsUndefined) {
            this._addState(nextState as State);
        }


        // Notify listeners
        if (_listeners.size) {
            this._notifyListeners(nextState as State, currentState, flow);

            if (flushOnRead) {
                this.flushStates();
            };
        }

        return this;
    }

    /**
     * Adds a function that modifies the dispatched state before registering it as a new state item.
     * You can add as many of these as you want.
     * @param {function} fn
     * @returns {StateMachine} manager instance
     */
    addReducer(...fns: ReducerFunction <State, ReducerValue>[]){

        for (const fn of fns) {

            assertFunction(fn as Func, 'reducer');

            // Save reducer to holder
            this._reducers.add(fn);
        }

        return this;
    }


    /**
     * Removes reducers from the state stream.
     * They will not longer modify the state once they are removed.
     * @param {function} fn
     * @returns {StateMachine} manager instance
     */
    removeReducer(...fns: ReducerFunction[]) {

        for (const fn of fns) {

            if (this._reducers.has(fn)) {

                this._reducers.delete(fn);
            }
        }

        return this;
    };


    /**
     * Adds a listener that runs when updates are dispatched
     * @param {function} fns
     * @returns {StateMachine} manager instance
     */
    addListener(...fns: ListenerFunction <State, ReducerValue>[]) {

        for (const fn of fns) {
            assertFunction(fn as Func, 'listener');

            // Save listener to holder
            this._listeners.add(fn);
        }

        return this;
    }


    /**
     * Removes any attached listeners
     * @param {function} func
     * @returns {StateMachine} manager instance
     */
    removeListener(...fns: ListenerFunction <State, ReducerValue>[]) {

        for (const fn of fns) {

            if (this._listeners.has(fn)) {

                this._listeners.delete(fn);
            }
        }

        return this;
    }


    /**
     * Returns an array of all stored states
     * @returns {array} Array of states
     */
    states() {

        return clone(Array.from(this._states.values()));
    }

    /**
     * Returns current state
     * @returns {*} Current state
     */
    state(): State {

        return clone(this._internals.state!);
    }

    /**
     * Cleans all stored states, except current state.
     * State is reset if it wasn't on the current state
     */
    flushStates() {

        for (const key of this._states.keys()) {

            if (key === this._internals.currentState) {
                continue;
            }

            this._states.delete(key);
        }

        this.resetState();
    };

    /**
     * Sets the current state back to whatever it was. Useful for
     * where stepping forward and backwards between states and then
     * returning to your original state.
     */
    resetState() {

        const { _states, _internals } = this;
        const {
            currentState,
            latestState,
            state
        } = _internals;

        if (currentState === latestState) {
            return;
        }

        const oldState = state;
        const newState = _states.get(latestState!);

        this._notifyListeners(newState!, oldState!);

        this._setInternals({
            currentState: latestState,
            state: newState
        });
    }

    /**
     * Travel to a particular state
     * @param sid state ID
     */
    goToState(sid: number) {

        const { _internals, _states } = this;
        const { state } = _internals;
        const { flushOnRead } = this._options;

        if (flushOnRead) {
            console.warn('cannot traverse states when flushOnRead option is set');
            return;
        }

        if (_states.has(sid)) {

            const oldState = state;
            const newState = _states.get(sid);

            this._notifyListeners(
                newState!,
                oldState!
            );

            this._setInternals({
                currentState: sid,
                state: newState
            });
        }
        else {

            console.warn(`state #${sid} does not exist`);
        }
    }

    /**
     * Go back 1 state. Does not work if `flushOnRead` is true.
     */
    prevState() {

        const { currentState } = this._internals;
        this.goToState(currentState! - 1);
    }

    /**
     * Go forward 1 state. Does not work if `flushOnRead` is true.
     */
    nextState() {

        const { currentState } = this._internals;
        this.goToState(currentState! + 1);
    }

    /**
     * Creates a child instance of manager. Receives parent's reducers
     * and will update whever parent is updated. Adding reducers and
     * listeners will not affect parent manager instance.
     *
     * @param {StateMachineOptions} options
     *
     * @returns {StateMachine} manager instance
     */
    clone(options: StateMachineOptions = {}) {

        return new StateMachine<State, ReducerValue>(
            this.state(),
            {
                ...this._options,
                ...options,
                parent: this
            }
        );
    }

    private _setupClone() {

        const self = this;
        const { _parent, _options } = this;

        if (!_parent) {
            return;
        }

        for (const reducer of _parent._reducers) {

            self._reducers.add(reducer);
        }

        /**
         * Add listener to parent to pass updates to cloned instance
         */
        const updateChild = (
            value: ReducerValue,
            _: State,
            flow?: StateMachine[]
        ) => {

            if (flow) {
                flow.push(self);
            }

            self.dispatch(value, flow || [_parent]);
        };


        _parent.addListener(updateChild);

        self._setInternals({ parentListener: updateChild });


        if (_options.bidirectional) {

            /**
             * Add listener to child to pass updates to the parent.
             * This should notify parent that update is coming from
             * child in order to prevent maximum call stack.
             * @param value
             */
            const updateParent = (value: State, _: State, flow?: StateMachine[]) => {

                if (flow) {
                    flow.push(self);
                }

                return _parent.dispatch(value, flow || [self]);
            };

            _parent._setInternals({ childListener: updateParent });

            self.addListener(updateParent);
        }
    }
}

export default StateMachine;