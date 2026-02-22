import { StorageAdapter, IndexedDBDriver } from '@logosdx/storage';
import { attempt } from '@logosdx/utils';
import { api } from './api.ts';
import type { Todo, TodoStore } from './types.ts';
import type { AppMachine } from './todo-machine.ts';

export const todoStorage = new StorageAdapter<TodoStore>({
    driver: new IndexedDBDriver('todo-app', 'todos'),
    prefix: 'todo',
    structured: true,
});

export async function saveTodos(todos: Todo[]): Promise<void> {

    console.log('[store] saving', todos.length, 'todos to IndexedDB');

    const currentKeys = await todoStorage.keys();
    const newKeys = new Set(todos.map(t => t.id));
    const removed = currentKeys.filter(k => !newKeys.has(k as string));

    if (removed.length > 0) {

        await todoStorage.rm(removed);
    }

    const entries: Partial<TodoStore> = {};

    for (const todo of todos) {

        entries[todo.id] = todo;
    }

    await todoStorage.set(entries);
    console.log('[store] saved successfully');
}

export async function loadTodosFromStorage(): Promise<Todo[]> {

    const all = await todoStorage.get();
    const todos = Object.values(all ?? {});
    console.log('[store] loaded', todos.length, 'todos from IndexedDB');
    return todos;
}

export async function deleteTodoFromServer(id: string): Promise<void> {

    await attempt(() => api.delete(`/todos/${id}`));
}

export async function loadTodosFromServer(): Promise<Todo[]> {

    console.log('[store] fetching todos from server...');
    const [res, err] = await attempt(() => api.get<Todo[]>('/todos'));

    if (err) {

        console.error('[store] server fetch failed:', err);
        throw err;
    }

    console.log('[store] fetched', res.data.length, 'todos from server');
    return res.data;
}

export async function syncToServer(todos: Todo[]): Promise<void> {

    const unsynced = todos.filter(t => !t.synced);

    if (unsynced.length === 0) return;

    const [, err] = await attempt(
        () => api.post('/todos/batch', { todos: unsynced })
    );

    if (err) throw err;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startSyncTimer(machine: AppMachine): () => void {

    syncInterval = setInterval(async () => {

        const { todos } = machine.context;
        const unsynced = todos.filter(t => !t.synced);

        if (unsynced.length === 0) return;

        machine.send('SYNC');
        console.log('[sync] syncing', unsynced.length, 'todos...');

        const [, err] = await attempt(() => syncToServer(todos));

        if (err) {

            machine.send('SYNC_ERROR', { error: String(err) });
            return;
        }

        await saveTodos(
            todos.map(t => ({ ...t, synced: true }))
        );
        machine.send('SYNC_DONE');
    }, 5000);

    return () => {

        if (syncInterval) {

            clearInterval(syncInterval);
            syncInterval = null;
        }
    };
}

export async function initializeStore(
    machine: AppMachine
): Promise<void> {

    const stored = await loadTodosFromStorage();

    if (stored.length > 0) {

        machine.send('LOADED', { todos: stored });
        return;
    }

    machine.send('LOAD');

    const [todos, err] = await attempt(() => loadTodosFromServer());

    if (err) {

        machine.send('LOAD_ERROR', { error: String(err) });
        return;
    }

    await saveTodos(todos);
    machine.send('LOADED', { todos });
}
