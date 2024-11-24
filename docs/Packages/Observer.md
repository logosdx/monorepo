---
permalink: '/packages/observer'
aliases: ["Observer", "@logos-ui/observer"]
---

At its core, `Observable` promotes loose coupling and modular design. It establishes a clear separation between event producers (observables) and event consumers (listeners). This decoupling allows different parts of a system to interact without direct dependencies, enhancing flexibility and maintainability.

The strength of the `Observable` class lies in its ability to enforce a structured event system. The use of a `Shape` interface ensures that events are defined with specific names and corresponding data types. This type safety empowers developers to handle events with confidence, reducing the risk of runtime errors and promoting robust event handling throughout the system.

By embracing the abstract concept of observability and events, the `Observable` class serves as a powerful tool for designing systems that rely on asynchronous communication and reactive behavior. It enables developers to leverage the observer pattern and create scalable, event-driven architectures that can be extended and adapted with ease.

```sh
npm install @logos-ui/observer
yarn add @logos-ui/observer
pnpm add @logos-ui/observer
```

## Example

```ts
import { ObservableFactory } from '@logos-ui/observer';

// Make many types that dispatch the same data
type AppKeys = Record<
	'Escape' | 'Enter' | 'Tab' | 'Backspace' |
	'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown',
	KeyboardEvent
>

// Combine all your types into one
type AppEvents = AppKeys & {

	click: MouseEvent;
	resize: UIEvent;
	keyboard: KeyboardEvent;
	'open-modal': { which: string },
	'close-modal': { which: string },
}

// Instantiate your typed observer
const observer = new ObserverFactory <AppEvents>({});

// Event names will be type-safe
observer.on('Escape', () => thing.close());
observer.on('Enter', (e) => {

	const form = findFormFor(e.target);

	if (isValid(form)) {
		form.submit();
		return;
	}

	displayErrorsFor(form);
});

// Data passed into the events will be type-safe
observer.on('open-modal', ({ which }) => modal.show(which));
observer.on('close-modal', ({ which }) => modal.hide(which));

window.addEventListener('keyup', (e) => {

	observer.emit(e.key, e);
});

window.addEventListener('click', e => observer.trigger('click', e));

window.addEventListener(
	'keydown',
	debounce(e => observer.trigger('keyboard', e), 30)
);

window.addEventListener(
	'resize',
	debounce(e => observer.trigger('click', e), 30)
);

// Use event generators to better control the flow of
// how events are handled
const resizeForever = async () => {

	const resize = observer.on('resize');
	const modal = observer.on('open-modal');

	while (true) {

		const ev = await resize.next();

		console.log(...);

		if (ev.size > 400) {

			modal.emit({ which: 'prices' })
		}

		if (ev.size < 1500) {

			resize.cleanup();
			modal.cleanup();
			break;
		}
	}
}

const [btn] = $('.btn');

btn.onclick = () => observer.trigger('open-modal');

const person = new Person();

observer.observe(person);

person.on('Backspace', (e) => {

	if (e.target?.id === person.id) {
		person.remove();
		person.cleanup();
	}
});
```

## Basic Usage

### Instance Options

ObserverFactory accepts a set of options to facilitate telemetry and debugging, as well as validation:

```ts
import { ObservableFactory, Observable } from '@logos-ui/observer';

type Shape = {
  connect: null,
  error: Error,
  message: { ... },
  send: { ... }
}

const debugFn: Observable.Spy<Shape> = (action) => {

	const { event, listener, data, fn, context } = action;

	if (fn === 'emit' && !context.$has(event)) {

		// Logs:
		// > send event has no listeners
		console.warn(event, 'event has no listeners');
		return;
	}

	// Logs:
	// > on connect () => {}
	// > emit message { ... }
	console.log(fn, event, listener || data);

}

const validateEvent: Observable.EmitValidator<Shape> = (
	event,
	data,
	context
) => {

	// Listeners exist
	if (context.$has('message')) {

		validateMsg(data);
	}
}

const observer = new ObserverFactory<Shape>({
	name: 'app',
	spy: debugFn,
	emitValidator: validateEvent
})
```

**Interface**

```ts

declare namespace Observable {

    type Options<Shape> = {
        name?: string;
        spy?: Spy<Shape>,
        emitValidator?: EmitValidator<Shape>
    };

    type FuncName = 'on' | 'once' | 'off' | 'emit';

    type SpyAction<Shape> = {
        event: keyof Shape | RegExp | '*',
        listener?: Function | null,
        data?: unknown,
        fn: FuncName,
        context: ObserverFactory<Shape>
    }

    interface Spy<Shape> {
        (action: SpyAction<Shape>): void
    }

    interface EmitValidator<Shape> {
        (
            event: keyof U,
            data: U[keyof U],
            context: ObserverFactory<Shape>
        ): void
        (
            event: RegExp,
            data: any,
            context: ObserverFactory<Shape>
        ): void
        (
            event: '*',
            data: any,
            context: ObserverFactory<Shape>
        ): void
    }
}
```

### `on(...)`

Listen for an event. Returns an object with a `cleanup()` function that will remove the passed callback.

**Example**

```ts
const cleanup = observer.on('keydown', () => { /* ... */ });

if (condition) {
	cleanup();
}

// Listen to any events that match 'key'
observer.on(/key.+/, (e) => { /* ... */ })
```

**Usage without listeners**

If for whatever reason you want to handle the events later, like a promise, and bind to a single event for a period of time, you can use the EventGenerator feature provided by this utility to do so.

```ts
const keyEvent = observer.on('keydown');

// or regex
const keyEvent = observer.on(/key.+/);

async function alwaysListen() {

	while (keyEvent.done === false) {

		const event = await keyEvent.next();

		if (event.key)
			sendToTracker(event.key, event.metaKey, event.shiftKey);
	}
}

alwaysListen();

html.events.on($('input'), (e) => keyEvent.emit(e));

form.onsubmit = () => keyEvent.destroy();
```

Perhaps event implement a queue

```ts
const sendMail = observer.on('send-mail');
const sendMailSuccess = observer.on('send-mail-success');
const sendMailFail = observer.on('send-mail-fail');

const runForever = (evGen, callback) => {

	while (evGen.done === false) {
		await callback()
	}
}

runForever(sendMail, async () => {

	try {

		await transporter.send(
			await sendMail.next()
		);

		sendMailSuccess.emit()
	}
	catch (e) {

		sendMailFail.emit(e);
	}

});

runForever(sendMailFail, async () => {

	sendToKibana(await sendMailFail.next());
});

process.on('SIGTERM', () => {

	sendMail.destroy()
	sendMailSuccess.destroy();
	sendMailFail.destroy();
});
```

**Interface**

```ts
export class ObserverFactory /* ... */ {
	/**
     * Returns an event generator that will
     * listen for all events
     */
    on(event: '*'): EventGenerator<Shape, '*'>;

    /**
     * Listens for all events and executes the
     * given callback
     */
    on(
        event: '*',
        listener: Observable.EventCallback<Shape[Events<Shape>]>
    ): Observable.Cleanup;

    /**
     * Returns an event generator that will listen
     * for the specified event
     */
    on<E extends Events<Shape>>(event: E): EventGenerator<Shape, E>;

    /**
     * Listens for the specified event and executes
     * the given callback
     */
    on<E extends Events<Shape>>(
        event: E,
        listener: Observable.EventCallback<Shape[E]>
    ): Observable.Cleanup;

    /**
     * Returns an event generator that will listen
     * for all events matching the regex
     */
    on(event: RegExp): EventGenerator<Shape, RegExp>;

    /**
     * Listens for all events matching the regex and
     * executes the given callback
     */
    on(
        event: RegExp,
        listener: Observable.EventCallback<
            Observable.RgxEmitData<Shape>
        >
    ): Observable.Cleanup;

}
```


**Alternatives**

- `listen(...)`


### `once(...)`

Listen for an event once.Returns an object with a `cleanup()` function that will remove the passed callback.

**Example**

```ts
const cleanup = observer.once('keydown', () => { /* ... */ });

if (condition) {
	cleanup();
}

// Listen once to any events that match 'key'
observer.once(/key/, (e) => { /* ... */ })
```

**Usage without listeners**

Similarly to `.on(...)`, the `once(...)` function can be used without a handler. It returns a cancellable promise that cleans up listeners if aborted early.

```ts
const onceReady = observer.once('ready');

const bootup = async () => {

	await onceReady;

	await loadData();
	await somethingElse();
}

bootup();

database
	.connect()
	.then(() => observer.emit('ready'))
	.catch(() => onceReady.cleanup())
;
```

This can, of course, be used with regex

```ts
const runSome = async () => {

	await observer.once(/some/);

	doSomething();
}

runSome();

observer.emit('something'); // runs
observer.emit('awesome'); // runs
```

**Interface**

```ts
export class ObserverFactory /* ... */ {
	/**
     * Returns an event promise that resolves when
     * any event is emitted
     */
    once(event: '*'): EventPromise<Shape[Events<Shape>]>;

    /**
     * Executes a callback once when any event is
     * emitted
     */
    once(
	    event: '*',
	    listener: Observable.EventCallback<Shape[Events<Shape>]>
	): Observable.Cleanup;

    /**
     * Returns an event promise that resolves when
     * the specified event is emitted
     */
    once<E extends Events<Shape>>(event: E): EventPromise<Shape[E]>;

    /**
     * Executes a callback once when the specified
     * event is emitted
     */
    once<E extends Events<Shape>>(
	    event: E,
	    listener: Observable.EventCallback<Shape[E]>
	): Observable.Cleanup;

    /**
     * Returns an event promise that resolves when
     * any events matching the regex are emitted
     */
    once(event: RegExp): EventPromise<
	    Observable.RgxEmitData<Shape>
	>;

    /**
     * Executes a callback once when any events
     * matching the regex are emitted
     */
    once(
	    event: RegExp,
	    listener: Observable.EventCallback<
		    Observable.RgxEmitData<Shape>
		>
	): Observable.Cleanup;
}
```


**Alternatives**

- `one(...)`

### `off(...)`

Stop listening for an event

**Example**

```ts
const keyAction = () => { /* ... */ };

observer.on('keydown', keyAction);

if (condition) {

	observer.off('keydown', keyAction);
}

// Remove listener from all events that match 'key'
observer.off(/key/, keyAction);
```

**Interface**

```ts
export class ObserverFactory /* ... */ {

	off (
        event: Events<Shape> | RegExp | '*',
        listener?: Function
    ): void;
}
```

### `emit(...)`

Emits an event

**Example**

```ts
observer.on('Escape', () => { /* ... */ });

window.addEventListener('keydown', (e) => {

	if (e.key === 'Escape') {
		observer.emit('Escape', e);
	}
});

// emit to all listens on any events that match 'key'
observer.trigger(/key/, (e) => { /* ... */ })
```

**Interface**

```ts
export class ObserverFactory /* ... */ {

	emit<E extends Events<Shape> | RegExp | '*'>(
        event: E | '*',
        data?: E extends '*'
	        ? Shape[Events<Shape>]
	        : E extends Events<Shape>
		        ? Shape[E]
		        : unknown
    ): void;
}
```


### `observe(...)`

Observes given component as an extension of this observable instance.

**Example**

```ts
const obs = new ObserverFactory();
const modal = new Modal({ /* ... */ });

obs.observe(modal);
modal.on('modal-open', () => {});

obs.trigger('modal-open'); // opens modal
modal.trigger('modal-open'); // opens modal

modal.cleanup(); // clears all event listeners
```

**Interface**

```ts
export class ObserverFactory /* ... */ {

	observe<C>(component: C): ObservableChild<C, Shape>
}
```

## Debugging

One of the bigger challenges with event emitted systems is debugging. Observable gives us various options for debugging our event emitter, such as a stack trace, or a function that intercepts all incoming listeners and outgoing events.

### `debug(...)`

Turn debugging on and off and see where events are being listened to, triggered, or emitted. This result stack trace filters out lines from `node_modules`, `node:internals`, and anything related to this library so that what you trace is only your code.

**Example**

```ts
const obs = new ObserverFactory();

obs.on(/a/i, () => {});
// EventStack (/a/i on):
//     at .../tests/src/observable.ts:204:26
//     at doToBoth (.../tests/src/observable.ts:14:5)
//     at Context.<anonymous> (.../tests/src/observable.ts:199:13) {
//   listener: [Function: functionStub],
//   data: null,
//   func: 'on',
//   event: /a/i
// }

obs.trigger('aa', 'works');
// EventStack (aa trigger):
//     at .../tests/src/observable.ts:205:26
//     at doToBoth (.../tests/src/observable.ts:14:5)
//     at Context.<anonymous> (.../tests/src/observable.ts:199:13) {
//   listener: null,
//   data: 'works',
//   func: 'trigger',
//   event: 'aa'
// }

obs.off('test1', () => {});
// EventStack (test1 off):
//     at .../tests/src/observable.ts:160:26
//     at doToBoth (.../tests/src/observable.ts:14:5)
//     at Context.<anonymous> (.../tests/src/observable.ts:156:13) {
//   listener: [Function: functionStub],
//   data: null,
//   func: 'off',
//   event: 'test1'
// }

obs.off('*');
// EventStack (* off):
//     at doToBoth (.../tests/src/observable.ts:16:19)
//     at Context.<anonymous> (.../tests/src/observable.ts:156:13) {
//   listener: null,
//   data: undefined,
//   func: 'off',
//   event: '*'
// }
```

**Interface**

```ts
export class ObserverFactory <{}> {

	debug(on?: boolean): void;
}
```

### `spy` function option

Optionally, you can pass a spy function that allows you to introspect your observer and take actions with it. This can be useful for finding function references, tracing events, logging, tracking, or whatever else you can think of.

**Example**

```ts
const obs = new ObserverFactory({
	spy: (action) => {

		if (action.fn === 'emit') {
			sendToTracker(action.event, action.data);
		}

		if (/on(ce)?/.test(action.fn)) {
			sendToDebugger(action.event, action.listener);
		}

		if (action.fn === 'off') {
			removeFromDebugger(action.event, action.listener);
		}
	}
})
```

**Interface**

```ts
declare namespace Observable {

	type FuncName = 'on' | 'once' | 'off' | 'emit' | 'cleanup';

    type SpyAction<Shape> = {
        event: keyof Shape | RegExp | '*',
        listener?: Function | null,
        data?: unknown,
        fn: FuncName,
        context: ObserverFactory<Shape>
    }

	interface Spy<Shape> {
		(action: SpyAction<Shape>): void;
	}
}
```

### Inspect helpers

Provided are also the functions `$internals`, `$facts`, and `$has`. With these, you can peek into your observable instance and make sure things are working as normal, or make programming decisions based on the feedback given.

- `observer.$facts()` Gives you parsed information about your instances
- `observer.$internals()` Gives you a clone of the internal mappings the instance uses.
- `observer.$has(event | RegExp)` Returns if the instance has the given event or regex event.

## Main Interfaces

```ts
export declare class ObserverFactory<Shape = Record<string, any>> {
    constructor(options?: Observable.Options<Shape>);
    name: string;

    /**
     * Returns facts about the the internal state of the observable instance.
     */
    $facts(): {
        listeners: (keyof Shape)[];
        rgxListeners: string[];
        listenerCounts: Record<string, number>;
        hasSpy: boolean;
    };

    /**
     * The internals of the observable instance.
     */
    $internals(): {
        listenerMap: Map<keyof Shape, Set<Func>>;
        rgxListenerMap: Map<string, Set<Func>>;
        internalListener: EventTarget;
        name: string;
        spy: Observable.Spy<Shape> | undefined;
    };

    /**
     * Returns if the observable instance has the given event
     */
    $has(event: Events<Shape>): boolean;

    /**
     * Returns if the observable instance has a regex event
     */
    $has(event: RegExp): boolean;

    /**
     * Returns if the observable instance has the given event
     */
    $has(event: '*' | string): boolean;

    debug(on?: boolean): void;

    /**
     * Observes given component as an extension of this observable instance.
     * @param component Component to wrap events around
     *
     * @example
     *
     * const obs = new ObserverFactory();
     *
     * const modal = {};
     *
     * obs.observe(modal);
     *
     * modal.on('modal-open', () => {});
     *
     * obs.trigger('modal-open'); // opens modal
     * modal.trigger('modal-open'); // opens modal
     *
     * modal.cleanup(); // clears all event listeners
     */
    observe<C>(component: C): Observable.Child<C, Shape>;

    /**
     * Returns an event generator that will listen for all events
     */
    on(event: '*'): EventGenerator<Shape, '*'>;

    /**
     * Listens for all events and executes the given callback
     */
    on(event: '*', listener: Observable.EventCallback<Shape[Events<Shape>]>): Observable.Cleanup;

    /**
     * Returns an event generator that will listen for the specified event
     */
    on<E extends Events<Shape>>(event: E): EventGenerator<Shape, E>;

    /**
     * Listens for the specified event and executes the given callback
     */
    on<E extends Events<Shape>>(event: E, listener: Observable.EventCallback<Shape[E]>): Observable.Cleanup;

    /**
     * Returns an event generator that will listen for all events matching the regex
     */
    on(event: RegExp): EventGenerator<Shape, RegExp>;

    /**
     * Listens for all events matching the regex and executes the given callback
     */
    on(event: RegExp, listener: Observable.EventCallback<Observable.RgxEmitData<Shape>>): Observable.Cleanup;

    /**
     * Used internally
     */
    on(event: unknown, listener?: Func, opts?: object): Observable.Cleanup | EventGenerator<any>;

    /**
     * Returns an event promise that resolves when
     * any event is emitted
     */
    once(event: '*'): EventPromise<Shape[Events<Shape>]>;

    /**
     * Executes a callback once when any event is
     * emitted
     */
    once(event: '*', listener: Observable.EventCallback<Shape[Events<Shape>]>): Observable.Cleanup;

    /**
     * Returns an event promise that resolves when
     * the specified event is emitted
     */
    once<E extends Events<Shape>>(event: E): EventPromise<Shape[E]>;

    /**
     * Executes a callback once when the specified
     * event is emitted
     */
    once<E extends Events<Shape>>(event: E, listener: Observable.EventCallback<Shape[E]>): Observable.Cleanup;

    /**
     * Returns an event promise that resolves when
     * any events matching the regex are emitted
     */
    once(event: RegExp): EventPromise<Observable.RgxEmitData<Shape>>;

    /**
     * Executes a callback once when any events
     * matching the regex are emitted
     */
    once(event: RegExp, listener: Observable.EventCallback<Observable.RgxEmitData<Shape>>): Observable.Cleanup;

    /**
     * Stop listening for an event
     * @param event
     * @param listener
     */
    off(event: Events<Shape> | RegExp | '*', listener?: Function): void;

    /** Emits an event */
    emit<E extends Events<Shape> | RegExp | '*'>(event: E, data?: E extends '*' ? Shape[Events<Shape>] : E extends Events<Shape> ? Shape[E] : unknown): void;

}

```

## Secondary Interfaces

```ts
type Events<Shape> = keyof Shape;

export namespace Observable {

    export interface EventCallback<Shape> {
        (data: Shape): void
    }

    export type RgxEmitData<Shape> = {
        event: Events<Shape>,
        data: Shape[Events<Shape>]
    }

    export type Cleanup = () => void

    export type Component<Shape> = {
        on: ObserverFactory<Shape>['on'],
        once: ObserverFactory<Shape>['once'],
        emit: ObserverFactory<Shape>['emit'],
        off: ObserverFactory<Shape>['off'],
    };

    export type Child<C, Shape> = C & Component<Shape> & {
        cleanup: Cleanup
    }

    export type Instance<Shape> = Component<Shape> & {
        observe: ObserverFactory<Shape>['observe'],
        $observer: ObserverFactory<Shape>
    }

    export type FuncName = 'on' | 'once' | 'off' | 'emit' | 'cleanup';

    type SpyAction<Shape> = {
        event: keyof Shape | RegExp | '*',
        listener?: Function | null,
        data?: unknown,
        fn: FuncName,
        context: ObserverFactory<Shape>
    }

    export interface Spy<Shape> {
        (action: SpyAction<Shape>): void
    }

    export interface EmitValidator<Shape> {
        (
            event: keyof Ev,
            data: Ev[keyof Ev],
            context: ObserverFactory<Shape>
        ): void
        (
            event: RegExp,
            data: any,
            context: ObserverFactory<Shape>
        ): void
        (
            event: '*',
            data: any,
            context: ObserverFactory<Shape>
        ): void
    }

    export type Options<Shape> = {
        name?: string,
        spy?: Spy<Shape>,
        emitValidator?: EmitValidator<Shape>
    };
}


export const makeEventTracer = (
    event: string,
    caller: any,
    listenerOrData?: Function | any
) => EventTrace
```
