import Hapi from '@hapi/hapi';
import Joi from 'joi';
import { StorageAdapter, FileSystemDriver } from '@logosdx/storage';
import { attempt } from '@logosdx/utils';
import { resolve } from 'path';
import { mkdirSync, existsSync } from 'fs';

interface Todo {
    id: string;
    title: string;
    status: 'active' | 'completed';
    synced: boolean;
    createdAt: number;
    updatedAt: number;
}

interface TodoStore {
    todos: Todo[];
}

const dataDir = resolve(import.meta.dirname, '../data');

if (!existsSync(dataDir)) {

    mkdirSync(dataDir, { recursive: true });
}

const storage = new StorageAdapter<TodoStore>({
    driver: new FileSystemDriver(resolve(dataDir, 'todos.json')),
    prefix: 'app',
});

async function getTodos(): Promise<Todo[]> {

    const [data] = await attempt(() => storage.get('todos'));
    return data ?? [];
}

async function saveTodos(todos: Todo[]): Promise<void> {

    await storage.set('todos', todos);
}

const todoSchema = Joi.object({
    title: Joi.string().min(1).max(200).required(),
    status: Joi.string().valid('active', 'completed').default('active'),
});

const todoUpdateSchema = Joi.object({
    title: Joi.string().min(1).max(200),
    status: Joi.string().valid('active', 'completed'),
}).min(1);

const batchSchema = Joi.object({
    todos: Joi.array().items(
        Joi.object({
            id: Joi.string().uuid().required(),
            title: Joi.string().min(1).max(200).required(),
            status: Joi.string().valid('active', 'completed').required(),
            synced: Joi.boolean().required(),
            createdAt: Joi.number().required(),
            updatedAt: Joi.number().required(),
        })
    ).required(),
});

async function start() {

    const server = Hapi.server({
        port: 3001,
        host: 'localhost',
        routes: {
            cors: { origin: ['*'] },
        },
    });

    server.ext('onPostResponse', (request, h) => {

        const { method, path } = request;
        const response = request.response;
        const status = 'statusCode' in response
            ? response.statusCode
            : response.output.statusCode;

        const line = `${method.toUpperCase()} ${path} → ${status}`;

        if (status >= 400 && 'output' in response) {

            console.log(line, response.output.payload);
        }
        else {

            console.log(line);
        }
        return h.continue;
    });

    server.route({
        method: 'GET',
        path: '/',
        handler: () => {

            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LogosDX Example — Todo App</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 1rem; color: #1f2937; }
        h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
        p { color: #6b7280; margin-bottom: 2rem; }
        a { display: block; padding: 1rem; margin-bottom: 0.75rem; border-radius: 0.5rem; background: #f3f4f6; color: #1f2937; text-decoration: none; }
        a:hover { background: #e5e7eb; }
        a span { display: block; font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem; }
        code { font-size: 0.75rem; background: #e5e7eb; padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
    </style>
</head>
<body>
    <h1>LogosDX Todo App</h1>
    <p>Choose a frontend implementation:</p>
    <a href="http://localhost:5173/index-dom.html">
        Vanilla JS <code>@logosdx/dom</code>
        <span>Template stamping, event binding, DOM manipulation</span>
    </a>
    <a href="http://localhost:5173/index-react.html">
        React <code>@logosdx/react</code>
        <span>Providers, hooks, composition</span>
    </a>
    <p style="font-size: 0.75rem; margin-top: 2rem;">API server running on port 3001. Vite dev server on port 5173.</p>
</body>
</html>`;
        },
    });

    server.route({
        method: 'GET',
        path: '/api/todos',
        handler: async () => {

            return getTodos();
        },
    });

    server.route({
        method: 'POST',
        path: '/api/todos',
        options: {
            validate: {
                payload: todoSchema,
            },
        },
        handler: async (request) => {

            const { title, status } = request.payload as {
                title: string;
                status: string;
            };
            const todos = await getTodos();

            const todo: Todo = {
                id: crypto.randomUUID(),
                title,
                status: status as Todo['status'],
                synced: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            todos.push(todo);
            await saveTodos(todos);
            return todo;
        },
    });

    server.route({
        method: 'PUT',
        path: '/api/todos/{id}',
        options: {
            validate: {
                params: Joi.object({
                    id: Joi.string().uuid().required(),
                }),
                payload: todoUpdateSchema,
            },
        },
        handler: async (request) => {

            const { id } = request.params;
            const updates = request.payload as Partial<Todo>;
            const todos = await getTodos();
            const index = todos.findIndex(t => t.id === id);

            if (index === -1) {

                return request
                    .generateResponse({ error: 'Not found' })
                    .code(404);
            }

            todos[index] = {
                ...todos[index],
                ...updates,
                updatedAt: Date.now(),
            };
            await saveTodos(todos);
            return todos[index];
        },
    });

    server.route({
        method: 'DELETE',
        path: '/api/todos/{id}',
        options: {
            validate: {
                params: Joi.object({
                    id: Joi.string().uuid().required(),
                }),
            },
        },
        handler: async (request) => {

            const { id } = request.params;
            const todos = await getTodos();
            const filtered = todos.filter(t => t.id !== id);

            if (filtered.length === todos.length) {

                return request
                    .generateResponse({ error: 'Not found' })
                    .code(404);
            }

            await saveTodos(filtered);
            return { deleted: true };
        },
    });

    server.route({
        method: 'POST',
        path: '/api/todos/batch',
        options: {
            validate: {
                payload: batchSchema,
            },
        },
        handler: async (request) => {

            const { todos: incoming } = request.payload as {
                todos: Todo[];
            };
            const existing = await getTodos();

            const existingMap: Record<string, number> = {};

            for (let i = 0; i < existing.length; i++) {

                existingMap[existing[i].id] = i;
            }

            for (const todo of incoming) {

                const idx = existingMap[todo.id];

                if (idx !== undefined) {

                    existing[idx] = { ...todo, synced: true };
                }
                else {

                    existing.push({ ...todo, synced: true });
                }
            }

            await saveTodos(existing);
            return { synced: incoming.length };
        },
    });

    const [, err] = await attempt(() => server.start());

    if (err) {

        console.error('Failed to start server:', err);
        process.exit(1);
    }

    console.log('Server running at', server.info.uri);
}

start();
