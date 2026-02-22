# LogosDX Example: Todo App

A full-stack todo application demonstrating every `@logosdx` package working together.


## Quick Start

```bash
pnpm install
pnpm dev
```

This starts the Hapi.js API server on `http://localhost:3001` and Vite dev server on `http://localhost:5173`.

- Vanilla JS (dom): http://localhost:5173/index-dom.html
- React: http://localhost:5173/index-react.html


## Architecture

```
example/
├── server/          # Hapi.js REST API with Joi validation
├── core/            # Shared logic (state machine, store, i18n, API client)
├── locales/         # Translation files (EN, ES, FR)
├── ui-dom/          # Vanilla JS UI using @logosdx/dom
├── ui-react/        # React UI using @logosdx/react
├── index-dom.html   # Entry point for vanilla JS bundle
└── index-react.html # Entry point for React bundle
```


## Package Usage

| Package | Where | What |
|---------|-------|------|
| `@logosdx/utils` | `core/store.ts` | `attempt` for error handling |
| `@logosdx/fetch` | `core/api.ts` | `FetchEngine` HTTP client |
| `@logosdx/state-machine` | `core/todo-machine.ts` | App state (idle/syncing/loading) |
| `@logosdx/storage` | `core/store.ts`, `server/` | `IndexedDBDriver` (client), `FileSystemDriver` (server) |
| `@logosdx/localize` | `core/i18n.ts` | `LocaleManager` with lazy-loaded ES/FR |
| `@logosdx/dom` | `ui-dom/app.ts` | `$()` queries, `$.create()`, `$.template()` stamping |
| `@logosdx/react` | `ui-react/` | `composeProviders`, `createStateMachineContext`, `createLocalizeContext` |
| `@logosdx/observer` | via state-machine, storage | Event-driven state change notifications |
| `@logosdx/hooks` | via fetch engine | Request lifecycle hooks |


## Features

- **Two UI bundles** built from one shared core via Vite multi-page
- **IndexedDB persistence** on the client with batch sync to server every 5 seconds
- **File system storage** on the server (`data/todos.json`)
- **Localization** in English (inline), Spanish and French (lazy-loaded)
- **State machine** managing idle, syncing, and loading states
- **Tailwind CSS** styling


## Type Generation

Locale types are generated from JSON files using the `@logosdx/localize` CLI:

```bash
node ../packages/localize/src/cli.ts extract \
    --dir ./locales \
    --out ./core/locale-types.ts \
    --locale en \
    --name Locale
```

This produces `core/locale-types.ts` with a typed `Locale` interface and `LocaleCodes` union.


## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/todos` | List all todos |
| `POST` | `/api/todos` | Create a todo |
| `POST` | `/api/todos/batch` | Batch upsert todos |
| `DELETE` | `/api/todos/:id` | Delete a todo |


## Build

```bash
pnpm build
```

Outputs to `dist/` with separate bundles for each UI.
