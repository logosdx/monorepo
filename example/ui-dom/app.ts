import { $, on } from '@logosdx/dom';
import {
    createAppMachine,
    initializeStore,
    saveTodos,
    deleteTodoFromServer,
    startSyncTimer,
    i18n,
} from '../core/index.ts';
import type { Todo, TodoFilter } from '../core/types.ts';
import type { LocaleCodes } from '../core/locale-types.ts';

const machine = createAppMachine();
const controller = new AbortController();
const { signal } = controller;

const stamper = $.template('#todo-item', {
    signal,
    map: {
        '.todo-delete': {
            aria: { label: 'Delete' },
        },
    },
});

function render() {

    const { todos, filter, error } = machine.context;

    const filtered = todos.filter(t => {

        if (filter === 'active') return t.status === 'active';
        if (filter === 'completed') return t.status === 'completed';
        return true;
    });

    const app = $('#app').first!;
    const remaining = todos.filter(t => t.status === 'active').length;

    app.innerHTML = '';

    // Header
    const header = $.create('div', {
        children: [
            $.create('h1', {
                text: i18n.t('app.title'),
                class: ['text-2xl', 'font-bold', 'text-gray-800'],
            }).first!,
            $.create('p', {
                text: i18n.t('app.subtitle'),
                class: ['text-sm', 'text-gray-500', 'mb-4'],
            }).first!,
        ],
    });

    // Locale switcher
    const localeDiv = $.create('div', {
        class: ['flex', 'gap-2', 'mb-4', 'items-center'],
        children: [
            $.create('span', {
                text: i18n.t('locale.label') + ':',
                class: ['text-sm', 'text-gray-500'],
            }).first!,
            ...i18n.locales.map(loc => {

                const isActive = loc.code === i18n.current;

                const btn = $.create('button', {
                    text: loc.text,
                    class: [
                        'px-3', 'py-1', 'rounded-md', 'text-xs',
                        'cursor-pointer', 'border-0',
                        ...(isActive
                            ? ['bg-blue-500', 'text-white']
                            : ['bg-gray-200', 'text-gray-700']),
                    ],
                    on: {
                        click: async () => {

                            await i18n.changeTo(
                                loc.code as LocaleCodes
                            );
                            render();
                        },
                    },
                });

                return btn.first!;
            }),
        ],
    });

    // Input form
    const input = $.create('input', {
        attrs: { type: 'text', placeholder: i18n.t('todo.placeholder') },
        class: [
            'flex-1', 'px-3', 'py-2', 'border', 'border-gray-300',
            'rounded-lg', 'focus:outline-none', 'focus:ring-2',
            'focus:ring-blue-400',
        ],
    }).first! as HTMLInputElement;

    const addBtn = $.create('button', {
        text: i18n.t('todo.add'),
        class: [
            'px-4', 'py-2', 'bg-blue-500', 'text-white',
            'rounded-lg', 'hover:bg-blue-600',
        ],
    }).first!;

    const form = $.create('div', {
        class: ['flex', 'gap-2', 'mb-4'],
        children: [input, addBtn],
    });

    on(addBtn, 'click', () => {

        const title = input.value.trim();

        if (!title) return;

        machine.send('ADD', { title });
        saveTodos(machine.context.todos);
        render();
        $('#app input').first?.focus();
    }, { signal });

    on(input, 'keydown', (e: Event) => {

        if ((e as KeyboardEvent).key === 'Enter') addBtn.click();
    }, { signal });

    // Filter buttons
    const filters: TodoFilter[] = ['all', 'active', 'completed'];

    const filterDiv = $.create('div', {
        class: ['flex', 'gap-2', 'mb-4'],
        children: filters.map(f => {

            const isActive = f === filter;

            const btn = $.create('button', {
                text: i18n.t(`todo.filters.${f}`),
                class: [
                    'px-3', 'py-1', 'rounded-md', 'text-sm',
                    'cursor-pointer', 'border-0',
                    ...(isActive
                        ? ['bg-blue-500', 'text-white']
                        : ['bg-gray-200', 'text-gray-700']),
                ],
                on: {
                    click: () => {

                        machine.send('FILTER', { filter: f });
                        render();
                    },
                },
            });

            return btn.first!;
        }),
    });

    // Todo list
    const list = $.create('ul', {
        class: ['space-y-2'],
    }).first!;

    if (filtered.length === 0) {

        const empty = $.create('p', {
            text: i18n.t('todo.empty'),
            class: ['text-center', 'text-gray-400', 'py-8'],
        });

        list.appendChild(empty.first!);
    }
    else {

        stamper.stamp(filtered, (todo: Todo) => ({
            '.todo-toggle': {
                attrs: {
                    ...(todo.status === 'completed'
                        ? { checked: '' }
                        : {}),
                },
                on: {
                    change: () => {

                        machine.send('TOGGLE', { id: todo.id });
                        saveTodos(machine.context.todos);
                        render();
                    },
                },
            },
            '.todo-title': {
                text: todo.title,
                class: [
                    todo.status === 'completed'
                        ? 'line-through'
                        : '',
                    todo.status === 'completed'
                        ? 'text-gray-400'
                        : 'text-gray-800',
                ].filter(Boolean),
            },
            '.todo-delete': {
                on: {
                    click: () => {

                        machine.send('DELETE', { id: todo.id });
                        saveTodos(machine.context.todos);
                        deleteTodoFromServer(todo.id);
                        render();
                    },
                },
            },
        })).into(list);
    }

    // Footer
    const footer = $.create('div', {
        class: [
            'flex', 'justify-between', 'items-center',
            'mt-2', 'text-sm', 'text-gray-500',
        ],
        children: [
            $.create('span', {
                text: i18n.t('todo.remaining', [String(remaining)]),
            }).first!,
            $.create('span', {
                text: machine.state === 'syncing'
                    ? i18n.t('sync.syncing')
                    : (error
                        ? i18n.t('sync.error')
                        : i18n.t('sync.synced')),
            }).first!,
        ],
    });

    // Assemble
    app.appendChild(header.first!);
    app.appendChild(localeDiv.first!);
    app.appendChild(form.first!);
    app.appendChild(filterDiv.first!);
    app.appendChild(list);
    app.appendChild(footer.first!);
}

async function boot() {

    await initializeStore(machine);
    render();

    machine.on('*', () => render());
    startSyncTimer(machine);
}

boot();
