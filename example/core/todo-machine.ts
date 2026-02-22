import { StateMachine } from '@logosdx/state-machine';
import type { Todo, TodoFilter } from './types.ts';

interface AppContext {
    todos: Todo[];
    filter: TodoFilter;
    error: string | null;
}

interface AppEvents {
    ADD: { title: string };
    TOGGLE: { id: string };
    DELETE: { id: string };
    FILTER: { filter: TodoFilter };
    SYNC: void;
    SYNC_DONE: void;
    SYNC_ERROR: { error: string };
    LOAD: void;
    LOADED: { todos: Todo[] };
    LOAD_ERROR: { error: string };
}

export function createAppMachine() {

    return new StateMachine<AppContext, AppEvents>({
        initial: 'idle',
        context: {
            todos: [],
            filter: 'all',
            error: null,
        },
        transitions: {
            idle: {
                on: {
                    ADD: {
                        target: 'idle',
                        action: (ctx, { title }) => ({
                            ...ctx,
                            error: null,
                            todos: [...ctx.todos, {
                                id: crypto.randomUUID(),
                                title,
                                status: 'active' as const,
                                synced: false,
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                            }],
                        }),
                    },
                    TOGGLE: {
                        target: 'idle',
                        action: (ctx, { id }) => ({
                            ...ctx,
                            todos: ctx.todos.map(t =>
                                t.id === id
                                    ? {
                                        ...t,
                                        status: (t.status === 'active'
                                            ? 'completed'
                                            : 'active') as Todo['status'],
                                        synced: false,
                                        updatedAt: Date.now(),
                                    }
                                    : t
                            ),
                        }),
                    },
                    DELETE: {
                        target: 'idle',
                        action: (ctx, { id }) => ({
                            ...ctx,
                            todos: ctx.todos.filter(t => t.id !== id),
                        }),
                    },
                    FILTER: {
                        target: 'idle',
                        action: (ctx, { filter }) => ({ ...ctx, filter }),
                    },
                    LOADED: {
                        target: 'idle',
                        action: (ctx, { todos }) => ({
                            ...ctx,
                            todos,
                            error: null,
                        }),
                    },
                    SYNC: 'syncing',
                    LOAD: 'loading',
                },
            },
            syncing: {
                on: {
                    SYNC_DONE: {
                        target: 'idle',
                        action: (ctx) => ({
                            ...ctx,
                            error: null,
                            todos: ctx.todos.map(t => ({ ...t, synced: true })),
                        }),
                    },
                    SYNC_ERROR: {
                        target: 'idle',
                        action: (ctx, { error }) => ({ ...ctx, error }),
                    },
                    ADD: {
                        target: 'syncing',
                        action: (ctx, { title }) => ({
                            ...ctx,
                            todos: [...ctx.todos, {
                                id: crypto.randomUUID(),
                                title,
                                status: 'active' as const,
                                synced: false,
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                            }],
                        }),
                    },
                    TOGGLE: {
                        target: 'syncing',
                        action: (ctx, { id }) => ({
                            ...ctx,
                            todos: ctx.todos.map(t =>
                                t.id === id
                                    ? {
                                        ...t,
                                        status: (t.status === 'active'
                                            ? 'completed'
                                            : 'active') as Todo['status'],
                                        synced: false,
                                        updatedAt: Date.now(),
                                    }
                                    : t
                            ),
                        }),
                    },
                    DELETE: {
                        target: 'syncing',
                        action: (ctx, { id }) => ({
                            ...ctx,
                            todos: ctx.todos.filter(t => t.id !== id),
                        }),
                    },
                },
            },
            loading: {
                on: {
                    LOADED: {
                        target: 'idle',
                        action: (ctx, { todos }) => ({
                            ...ctx,
                            todos,
                            error: null,
                        }),
                    },
                    LOAD_ERROR: {
                        target: 'idle',
                        action: (ctx, { error }) => ({ ...ctx, error }),
                    },
                },
            },
        },
    });
}

export type AppMachine = ReturnType<typeof createAppMachine>;
export type { AppContext, AppEvents };
