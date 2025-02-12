---
permalink: '/packages/observer'
aliases: ["Observer", "@logos-ui/observer"]
---
ObserverEngine aims to provide a consistent, familiar API that goes beyond just working with events in both Node.js and the browser. Our goal is to enable developers to leverage the observer pattern and create scalable, event-driven architectures that can be extended and adapted with the maturity of a full-feature development tool.

## Features

- [[#Type-safe Events]]
- [[#Regex Events]]
- [[#Event Promises]]
- [[#Event Generators]]
- [[#Event Cleanup]]
- [[#Inheritance and delegation]]
- [[#Validation]]
- [[#Debugging Tools]]

Even though below is a somewhat complete example of how this library can be used, you can [find the typedocs here](https://logos-ui.github.io/modules/_logos_ui_observer.Observable.html)

## Motivations

At its core, observer pattern promotes loose coupling and modular design. It establishes a clear separation between event producers (observables) and event consumers (listeners). This decoupling allows different parts of a system to interact without direct dependencies, enhancing flexibility and maintainability. In fact, observer patterns are the building block of Nodejs and the DOM. The developer experience for it, however, is somewhat broken. This library aims to fix that.

Recent improvements to the builtin `EventEmitter` class in Node.js have made it easier to work with events in JavaScript. Unfortunately, `EventEmitter` only works inside of Node.js and there is no equivalent browser API.

## Installation

```sh
npm install @logos-ui/observer
yarn add @logos-ui/observer
pnpm add @logos-ui/observer
```

## Usage

Simply put, `ObserverEngine` allows you listen for events and emit events. In that regard, it's not much different from `EventEmitter`. In fact, `EventEmitter` even allows you to declare typings for events. The main difference is in the extra features that `ObserverEngine` provides.

Let start with the basic usage of `ObserverEngine`.

```ts
import { ObserverEngine } from '@logos-ui/observer';

type EventType = {
	someEvent: string;
}

// Instantiate the observer
const observer = new ObserverEngine<EventType>();

// Listen for an event
observer.on('someEvent', (data) => {

	doSomethingWith(data)
});

if (condition) {

	// Stop listening for an event
	observer.emit('someEvent', 'some data');
}
```

You might notice `EventType` is passed as a generic to `ObserverEngine`. This is what enables type-safe events. You'll see how this is useful in the next section.

### Type-safe Events

In the example above, we defined a type `EventType` that has a single event `someEvent`. This allows us to listen for `someEvent` and pass data to the callback function. To further illustrate this, let's add more events to `EventType`.

```ts
import { ObserverEngine } from '@logos-ui/observer';

type EventType = {

    something: { id: number, name: string }
    awesome: { id: number, age: string }
    worrisome: { id: number, job: string }
}

const observer = new ObserverEngine<EventType>();
```

Now, we can listen for `something`, `awesome`, and `worrisome` events and pass data to the callback function. Your IDE will also provide you with autocompletion for the event names and data types.

![](types-1.png)

![](types-2.png)

`ObserverEngine`'s implementation, however, is different from `EventEmitter` in that it will only dispatch a single argument to your listeners. The idea is to keep the API simple and consistent. If you need to pass multiple arguments, you can use arrays or objects.

Emitting events is just as simple. You can pass data to the event as the second argument.

```ts
observer.emit('something', { id: 1, name: 'Joab' });
observer.emit('awesome', { id: 1, age: 240 });
observer.emit('worrisome', { id: 1, job: 'Shepherd' });
```

![](types-5.png)

![](types-6.png)

Quite simple, right? But what happens if you want to listen for multiple events that match a certain pattern?

### Regex Events

Perhaps there's a pattern to a certain subset of events that you emit, and you want to listen to all of them. Lets take the previous example and suppose that we want to listen to all events with the word `some` in them. This is where regex events come in.

```ts
observer.on(/some/, ({ event, data }) => {

	if (event === 'something') {
		doSomethingWith(data)
	}

	if (event === 'awesome') {
		doSomethingElseWith(data)
	}

	if (event === 'worrisome') {
		alertSomeoneAbout(data)
	}
});
```

As you might have noticed, the data type for the callback function changed. This is because there is no way to know what the event name will be when using regex. The `event` property will contain the name of the event that was emitted.

![[types-3.png]]
![[types-4.png]]

The same thing can happen when emitting events. Say you want to notify all listeners of events that match a certain pattern of some kind. You can do that with regex events as well.

```ts
observer.on('something', ({ id, name }) => { /* ... */ });
observer.on('awesome', ({ id, age }) => { /* ... */ });
observer.on('worrisome', ({ id, job }) => { /* ... */ });

const user = {
	id: 1,
	name: 'Joab',
	age: 240,
	job: 'Shepherd'
};

observer.emit(/some/, user);
```

But what if you want to wait for an event to be emitted as part of your control flow? This is where event promises come in.

### Event Promises

Event promises allow you to wait for an event to be emitted before continuing with your code. This can be useful when you want to wait for a certain event to be emitted before proceeding with your code.

```ts
const onceReady = observer.once('ready');

const bootup = async () => {

	await onceReady;

	await loadData();
	await somethingElse();
}

bootup().catch(err => {

	console.error(err);
	process.exit(1)
})

database
	.connect()
	.then(() => observer.emit('ready'))
	.catch(err => {
		onceReady.cleanup(); // prevents anything else from triggering
		onceReady.reject(err); // throws the promise
	})
```

In the example above, you'll notice that no listener was passed to the function. The `bootup` function will wait for the `ready` event to be emitted before proceeding with the rest of the code. The `onceReady.cleanup()` function can be called to remove the listener if the event is never emitted. Not only do you receive a Promise, you receive an `EventPromise`.

Perhaps you need the data from the event that was emitted. You can do that as well.

```ts
const data = await observer.once('something');
```

![[types-8.png]]

And if you want to listen to regex events, you can do that as well.

```ts
const { event, data } = await observer.once(/some/);
```

![[types-7.png]]

The same rules that apply when using a callback function applies here as well. You can almost guess that the `Promise` will behave the same way as the callback function.

What if you want this same behavior but you want to persist? But of course! This is where event generators come in.

### Event Generators

Event generators allow you to listen for events and control the flow of how they are handled. This can be useful when you want to listen for events and take different actions based on the data that is emitted.

```ts
const resizeForever = async () => {

	const resize = observer.on('resize');
	const modal = observer.on('open-modal');

	while (resize.done === false) {

		const ev = await resize.next();

		if (ev.size > 800) {

			modal.emit({ which: 'app-store' })
		}

		await wait(10); // debounce

		// end the loop
		if (someCondition) {

			resize.cleanup();
			modal.cleanup();
		}
	}
}
```

In the example above, the `resizeForever` function listens for the `resize` event and takes different actions based on the data that is emitted. The `resize.next()` function returns a Promise that resolves when the `resize` event is emitted.

You can also listen to regex events.

```ts
const runSome = async () => {

	const some = observer.on(/some/);

	const { event, data } = await some.next();

	if (event === 'something') {
		doSomething(data)
	}
}
```

and emit regex events

```ts
const runSome = async () => {

	const some = observer.on(/some/);

	// Emits to all listeners that match the regex
	some.emit({
		id: 1,
		name: 'Joab',
		age: 240,
		job: 'Shepherd'
	});
}
```

The uses for event generators are endless. Lets take another example, something a bit more practical, like a queue:

```ts
const sendMail = observer.on('send-mail');
const sendMailSuccess = observer.on('send-mail-success');
const sendMailFail = observer.on('send-mail-fail');

// Abstract the logic of running a queue
const runForever = (evGen, callback) => {

	while (evGen.done === false) {
		await callback()
	}
}

// Continuously send emails
runForever(
	sendMail,
	async () => {

		try {

			// Use a mail transporter to send the email
			await transporter.send(

				// Wait for the next email message to resolve
				await sendMail.next()
			);

			// Emit the success event
			sendMailSuccess.emit()
		}
		catch (e) {

			// If the email fails to send, emit the error
			sendMailFail.emit(e);
		}
	}
);

runForever(
	sendMailFail,
	async () => sendToKibana(await sendMailFail.next())
);

runForever(
	sendMailSuccess,
	async () => chargeCustomer(await sendMailSuccess.next())
);

// Receive messages from a queue somewhere else
rabbitMqChannel.consume(
	'queue.send-mail',
	(msg) => sendMail.emit(
		JSON.parse(msg.content.toString())
	)
);

process.on('SIGTERM', () => {

	sendMail.destroy()
	sendMailSuccess.destroy();
	sendMailFail.destroy();
});
```

The above is not meant to be the most efficient queue, but it is an email of what can be done. Perhaps other parts of your system will dispatch this `send-mail` event, and external systems will do it via a RabbitMQ message.

### Event Cleanup

One detail that I often developers miss is the importance of cleaning up event listeners. It's an easy thing to forget that will lead to memory leaks. This is why `ObserverEngine` provides a `cleanup()` function that will remove the listener from the event. This is especially useful when you're dealing with frameworks like React, where components are mounted and unmounted, and you want to make sure that you're not updating an instance of a render that no longer exists. This will quickly lead to memory leaks.

```ts
const MyComponent = () => {

	const [counter, setCounter] = useState(0);

	useEffect(() => {

		const cleanup = observer.on('keydown', () => {

			setCounter(counter + 1);
		});

		return () => cleanup();
	}, [counter]);

	return <div>{counter}</div>
}
```

This is one of those things which are not straight forward to do with `EventEmitter`. You would have to keep track of the listeners yourself and remove them when the component is unmounted. `ObserverEngine` was built with this in mind for both frontend and backend systems alike. All the permutations of listening to events have a way to cleanup the listener:

The standard listeners

```ts
const cleanupOn = observer.on('keydown', () => { /* ... */ });
const cleanupOnce = observer.once('keydown', () => { /* ... */ });
const cleanupRegexOn = observer.on(/key/, () => { /* ... */ });
const cleanupRegexOnce = observer.once(/key/, () => { /* ... */ });

cleanupOn();
cleanupOnce();
cleanupRegexOn();
cleanupRegexOnce();
```

Event promises

```ts
const eventPromise = observer.once('keydown');
const eventPromiseRegex = observer.once(/key/);

eventPromise.cleanup();
eventPromiseRegex.cleanup();
```

Event generators

```ts
const eventGenerator = observer.on('keydown');
const eventGeneratorRegex = observer.on(/key/);

eventGenerator.cleanup();
eventGeneratorRegex.cleanup();
```

With proper use, this enhancement will help you avoid memory leaks in your applications.

### Inheritance and delegation

`ObserverEngine` can be extended and delegated to other classes. Event emitters are standard place, and, as stated before, they are the basis of NodeJS and the DOM. This can be useful when you want to create a class that has the ability to listen for events and emit events.

For example, instead of `EventEmitter`, you can use `ObserverEngine` to create a class that can listen for events and emit events.

```ts
import { ObserverEngine } from '@logos-ui/observer';

type Events = {
	openModal: null,
	closeModal: null
}

class MyComponent extends ObserverEngine<Events> {

	constructor() {
		super();
	}

	open() {
		this.emit('open');
	}

	close() {
		this.emit('close');
	}
}
```

Or, perhaps you have a class that you want to delegate the event listening and emitting to.

```ts
import myObserver from './myObserver';

class MyComponent implements ObserverEngine.Child<Events> {

	// ... other class methods

	constructor() {
		myObserver.observe(this);
	}

	open() {
		this.emit('open');
	}

	close() {
		this.emit('close');
	}
}

const myComponent = new MyComponent();

myComponent.on('open', () => { /* ... */ });
```

### Validation

`ObserverEngine` allows you to validate events before they are emitted. Sometimes, you want to make sure bad data doesn't get to parts of your system. This is where the `emitValidator` option comes in handy.

```ts
import Joi from 'joi';
import { ObserverEngine } from '@logos-ui/observer';

type Shape = {
	connect: null,
	error: Error,
	message: { ... },
	send: { ... }
}

const schemas: {
	[key: keyof Shape]?: Joi.Schema
} = {
	message: Joi.object({
		content: Joi.string().required(),
		fields: Joi.object().required(),
		properties: Joi.object().required(),
	}).required(),
	send: Joi.object().required()
}

const schema = Joi.object({
	content: Joi.binary().required(),
	fields: Joi.object().required()
});

const observer = new ObserverEngine<Shape>({
	emitValidator: (event, data, self) => {

		if (schemas[event]) {

			Joi.assert(data, schemas[event]);
		}
	}
});

rabbitMqChannel.consume(
	'queue.send-mail',
	(msg) => observer.emit('message', msg)
);

observer.on('send', (data) => {

	rabbitMqChannel.sendToQueue(
		'queue.send-mail',
		Buffer.from(JSON.stringify(data))
	);
});
```

### Instance Options

Very simply put, the observer instance has few options, and we just covered one of them:

```ts
export class ObserverEngine <Shape> {

	constructor (opts?: {
		name?: string;
		spy?: ObserverEngine.Spy<Shape>;
		emitValidator?: ObserverEngine.EmitValidator<Shape>;
	});
}
```

| Option          | Description                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `name`          | The name of the observer instance. This is useful for debugging, especially if you're using multiple instances.          |
| `spy`           | A function that will be called whenever an event is listened to, emitted, or triggered.                                  |
| `emitValidator` | A function that will be called before an event is emitted. This is useful for validating the data that is being emitted. |

And if you're wondering what the `spy` is in the options, we'll cover that in the next section.

### Debugging Tools

Another "gotcha" about working with event emitters is losing track of where events are being listened to, triggered, or emitted. In order to remedy this problem, we've provided a set of debugging tools that will help to obtain information about your event emitter.

#### `options.spy`

`ObserverEngine` accepts a `spy` function in the options to facilitate telemetry and debugging. This function will be called whenever an event is listened to, emitted, or triggered. This is specifically for logging, tracking, or debugging your event emitter.

```ts
import { ObserverEngine } from '@logos-ui/observer';

const debugFn: ObserverEngine.Spy<Shape> = (action) => {

	const {
		event,
		listener,
		data,
		fn,
		context
	} = action;

	if (fn === 'emit' && !context.$has(event)) {

		// Logs:
		// > send event has no listeners
		console.warn(event, 'is emitting but has no listeners');
		return;
	}

	// Logs:
	// > on connect () => {}
	// > emit message { ... }
	console.log(fn, event, listener || data);
}

const observer = new ObserverEngine<Shape>({
	name: 'app',
	spy: debugFn,
})
```

And with this, you have the ability to trace events to their origins. When you're working with a large codebase and you want to know where events are being coming and going, this is a priceless tool.

#### `instance.debug()`

The `debug()` function is a simple way to turn debugging on and off. When debugging is turned on, you'll see where events are being listened to, triggered, or emitted. A stack trace will be logged into console with the relevant information about the event. This options should not override the `spy` function, but rather work in conjunction with it.

```ts
const observer = new ObserverEngine<Shape>();

observer.debug(true);
observer.debug(false);
```

#### `instance.$facts()`

The `$facts()` function returns parsed information about the internal state of the observable instance. This can be useful when you want to know how many listeners are listening to a certain event, or how many listeners are listening to events in general.

```ts
const observer = new ObserverEngine<Shape>();

console.log(observer.$facts());
```

And should output something like:

```ts
{
	listeners: ['connect', 'error', 'message', 'send'],
	rgxListeners: [/some/],
	listenerCounts: {
		connect: 1,
		error: 1,
		message: 10,
		send: 1,
		'/some/': 3
	},
	hasSpy: false
}
```

#### `instance.$has(event | RegExp)`

The `$has()` function returns `true` if the instance has the given event or regex event. This can be useful when you want to know if an event is being listened to or not.

```ts
const observer = new ObserverEngine<Shape>();

console.log(observer.$has('connect'));
console.log(observer.$has(/some/));
```

#### `instance.$internals()`

> WARNING: This function is for debugging purposes only. Do not mess with the internals of the observer instance.

The `$internals()` function returns a clone of the internal mappings the instance uses. This can be useful when you want to know what the instance is doing internally, such as tracking down any listeners that might still be bound to an event.

```ts
const observer = new ObserverEngine<Shape>();

console.log(observer.$internals());
```

And should output something like:

```ts
{
	listenerMap: Map(4) {
		'connect' => Set(1) { [Function: functionStub] },
		'error' => Set(1) { [Function: functionStub] },
		'message' => Set(10) { [Function: functionStub] },
		'send' => Set(1) { [Function: functionStub] }
	},
	rgxListenerMap: Map(1) {
		'/some/' => Set(3) { [Function: functionStub] }
	},
	internalListener: EventTarget {},
	name: 'app',
	spy: [Function: debugFn]
}
```

## Conclusion

We hope that this library will help you build better, more scalable applications. The observer pattern is a powerful algorithm that can be used to create dynamic, event-driven architectures. We believe that `ObserverEngine` will help you leverage the observer pattern and create scalable, event-driven architectures that can be extended and adapted with the maturity of a full-feature development tool.

If you have any questions, comments, or suggestions, please feel free to reach out to us. We're always looking for ways to improve our libraries and make them more useful for developers like you.
