---
permalink: '/tools-for-sane-people'
---
Frameworks are exhaustive. The amount of things you have to add to frameworks is exhausting. The learning curve of those frameworks and the things you have to add to them is exhausting. For this reason, Logos UI was created. It is the all-in-one toolkit for building web applications. It gives you everything in a tiny package. Building web apps should be simple, not exhausting.

## Taking a step back

Sometimes, progress is good; other times, we seem to forget what we're progressing towards. We have all been sucked into the frameworks that the Facebooks and Googles of the world have made for us. They are popular, new, and smite our front-end problems with a bomb of complexity.

You might ask: well, what's wrong the matter with those frameworks? Nothing! If you've ever been squirrel hunting, it's like hunting squirrels with a .50 BMG. Will you kill the squirrel? Yes, but you didn't need a 2 inch munition to do so; a tiny .22 LR would suffice.

Let us break down web apps from a logical standpoint:

- Webapps take the form of a website, therefore, they are composed of `HTML`, `CSS`, and `JS`.
- All modern browsers implement standardized `ECMAScript`, `CSS`, and the `DOM`.
    - They have done so for years now.
    - These are the primary languages and APIs used to create all modern frameworks.
- All web apps are `state machines`.
- All web apps are `observer` patterns.
- All web apps receive input and produce output.
- All web apps render data.

In summary: Web apps, and therefore, websites, are simple or complex programs built on top of standardized `HTML`, `CSS`, and `JS` that is compiled and rendered by browsers.

Therefore, you only ever need the following to build web apps:

- A thing to manipulate the DOM
- A thing to render data into HTML elements
- A thing to style your screens and components
- A thing to manage the current web page's state
- An event emitter
- A thing to handle user input
- Meta-programming utilities

## The modern way

Let us take the example of the most popular framework to date: `React`. In order for you to do React, you need to first become familiar with the following:

- HTML, CSS, JS, DOM
- JSX
- Hooks
- Contexts or Prop-drilling
- Webpack / Next.js / Gatsby / etc

Next, the community is going to push you to use a series of tools to unlock more functionality:

- Redux / Redux Toolkit / Redux Sagas
- Styled components
- React-Query / Axios
- React Bootstrap / MaterialUI
- Lodash

And viola! You're ready to start building webapps 🤪

## A simpler approach

As previously stated, the web has progressed a lot from the days of jQuery, but the popular, big-tech-backed frameworks are not the answer to all your problems; they are the metaphoric 50 caliber BMG machine gun on your squirrel hunting weekend trip. One can make the case that these frameworks are good for larger corporations because of XYZ; but then again, that's all debatable and relative. The biggest hurdle to jump is: understand the `DOM`, `HTML`, `CSS`, and `JS`; because if you never do, you're never understand what React is doing for you anyway, and will forever depend on stackoverflow.com.

This toolkit is predicated on the following:

- A thing to manipulate the DOM
    - [@logos-ui/dom](DOM.md)
        - Utilities for managing inline `CSS`, html attributes, `DOM` events, and viewport
- A thing to render data into HTML elements
        - [Riot.js — Simple and elegant component-based UI library](https://riot.js.org/)
- A thing to style your screens and components (these might shock you)
    - [CSS: Cascading Style Sheets | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS)
    - [Sass: Syntactically Awesome Style Sheets](https://sass-lang.com/)
- A things to manage the current web page's state
    - [@logos-ui/state-machine](Packages/State%20Machine.md)
        - A stream-based state manager
- An event emitter
        - [[Packages/Observer|@logos-ui/observer]]
            - An event emitter with advanced functionality
- A thing to handle user input
    - [Final Form](https://final-form.org/)
- Meta-programming utilities
    - [[Packages/Utils|@logos-ui/utils]]
        - Well tested utilities used throughout all `@logos-ui` libraries
    - [[Riot Utils|@logos-ui/riot-utils]]
        - RiotJS meta-programming tools
- A thing to fetch remote data
    - [[Packages/Fetch|@logos-ui/fetch]]
        - A wrapper around [Fetch API - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- A thing to handle localization
    - [[Packages/Localize|@logos-ui/localize]]
        - A localized labels handler that allows you to switch between langauges and return translated, variable-replaceable text
- A thing to handle `localStorage`
    - [[Packages/Storage|@logos-ui/storage]]
        - A storage handler that allows for scoped storage and stores everything in `JSON.stringify(...)` format
- And more
    - [[Packages/Kit|@logos-ui/kit]]
        - A boilerplate for quick-starting your web app
    - [[Riot Kit|@logos-ui/riot-kit]]
        - A RiotJS boilerplate that uses [[Packages/Kit|@logos-ui/kit]] to get you started faster

## Get started

### BYOTR

Bring your own template renderer

```shell
yarn add @logos-ui/kit
```

`app.js`

```js
const LogosUI = require('@logos-ui/kit');

const composition = LogosUI.appKit({

    // pass observer options
    observer: {
        spy: console.log
    },

    // initialize the state machine
    stateMachine: {
        initial: {
            clickTimes: 0,
            name: 'Jesus',
            age: 33
        },
        reducer: (newState, currentState, ignore) => {

            return LogosUI.deepMerge(currentState, newState);
        }
    },

    // add your storage config
    storage: {
        implementation: localStorage || sessionStorage,
        prefix: 'my-app'
    },

    fetch: {
        type: 'json',
        baseUrl: 'http://example.com',
        headers: {
            app: 'the-webapp'
        },
        modifyOptions(opts, fetchState) {

            // add auth headers if fetch has token in its state
            if (fetchState.token) {

                const time = new Date();

                opts.headers = Object.assign(opts.headers, {

                    authorization: `Bearer ${fetchState.token}`,
                    hmac: generateHmac(fetchState.token, time),
                    time
                });
            }
        }
    }
});

// send clicks to the observer
LogosUI.html.events.on(window, 'click', (e) => {

    composition.observer.emit('click', e);
});

// send keyboard events to the observer
LogosUI.html.events.on(window, 'mouseup', (e) => {

    composition.observer.emit('keyboard', e);
});

// restore from the most recent app state
composition.stateMachine.dispatch(

    composition.storage.get()
);

// save the app state whenever it changes
composition.stateMachine.addListener(

    debounce((state) => {

        composition.storage.set(state);
    }, 50)
);

// capture all frontend events
composition.observer.on(/.+/, (data) => {

    composition.fetch.post('/logs/event-capture', data);
});


// Export your app kit to use it anywhere in your app
export default composition;
```

### Sample Riot project

The fastest way for you to get started experimenting is as follows:

```sh
git clone git@github.com:riot/parcel-template.git my-app
cd my-app
yarn add @logos-ui/riot-kit
```

`my-app/src/app.js`
```js
const LogosUI = require('@logos-ui/riot-kit');
const Riot = require('riot');

const composition = LogosUI.riotKit({

    riotInstallFunction: Riot.install,

    // pass observer options
    observer: {
        spy: console.log
    },

    // initialize the state machine
    stateMachine: {
        initial: {
            clickTimes: 0,
            name: 'Jesus',
            age: 33
        },
        reducer: (newState, currentState, ignore) => {

            return LogosUI.deepMerge(currentState, newState);
        }
    },

    // add your storage config
    storage: {
        implementation: localStorage || sessionStorage,
        prefix: 'my-app'
    },

    fetch: {
        type: 'json',
        baseUrl: 'http://example.com',
        headers: {
            app: 'the-webapp'
        },
        modifyOptions(opts, fetchState) {

            // add auth headers if fetch has token in its state
            if (fetchState.token) {

                const time = new Date();

                opts.headers = Object.assign(opts.headers, {

                    authorization: `Bearer ${fetchState.token}`,
                    hmac: generateHmac(fetchState.token, time),
                    time
                });
            }
        }
    }
});

// send clicks to the observer
LogosUI.html.events.on(window, 'click', (e) => {

    composition.observer.emit('click', e);
});

// send keyboard events to the observer
LogosUI.html.events.on(window, 'mouseup', (e) => {

    composition.observer.emit('keyboard', e);
});

// restore from the most recent app state
composition.stateMachine.dispatch(
    composition.storage.get()
);

// save the app state whenever it changes
composition.stateMachine.addListener(
    debounce((state) => {

        composition.storage.set(state);
    }, 50)
);

// capture all frontend events
composition.observer.on(/.+/, (data) => {

    composition.fetch.post('/logs/event-capture', data);
});

// Export your riot app kit to use it anywhere in your app
export default composition;
```

`my-app/src/components/some-component.riot`

```html
<some-component>
    ...

    <script>
        import { deepMerge } from '@logos-ui/riot-kit';
        import { fetch } from '../app'
        export default {

            aync getTheThings() {

                await fetch('/events');
            }

            // binds component to state machine and updates whenever
            // there are changes only
            mapToState(appState, thisState, theseProps) {

                return deepMerge(appState, thisState);
            },

            // observes this component and adds observer functions to it
            observable: true,

            // adds `t(...)` function tied to translations
            translatable: true,

            // loads and saves the state of this component
            // using this key in local storage
            saveInKey: 'some-component',

            // loads the follow keys from storage into state
            // as an object
            loadStorage: ['name', 'age'],

            // adds querying functionality to the component, and
            // wraps the following functions as queryable (isQuerying | Error)
            queryable: ['getTheThings']
        }
    </script>
</some-component>
```