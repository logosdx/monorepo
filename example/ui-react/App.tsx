import { useEffect } from 'react';
import { useMachine, useLocale, machine } from './providers.ts';
import {
    initializeStore,
    saveTodos,
    startSyncTimer,
} from '../core/index.ts';
import { TodoItem } from './components/TodoItem.tsx';
import { TodoForm } from './components/TodoForm.tsx';
import { TodoFilters } from './components/TodoFilters.tsx';
import { LocaleSwitcher } from './components/LocaleSwitcher.tsx';

export function App() {

    const { state, context } = useMachine();
    const { t } = useLocale();

    useEffect(() => {

        initializeStore(machine);
        const stopSync = startSyncTimer(machine);
        return stopSync;
    }, []);

    const filtered = context.todos.filter(todo => {

        if (context.filter === 'active') return todo.status === 'active';
        if (context.filter === 'completed') {

            return todo.status === 'completed';
        }
        return true;
    });

    const remaining = context.todos.filter(
        t => t.status === 'active'
    ).length;

    return (
        <>
            <h1 className="text-2xl font-bold text-gray-800">
                {t('app.title')}
            </h1>
            <p className="text-sm text-gray-500 mb-4">
                {t('app.subtitle')}
            </p>
            <LocaleSwitcher />
            <TodoForm />
            <TodoFilters />
            <ul className="space-y-2">
                {filtered.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">
                        {t('todo.empty')}
                    </p>
                ) : (
                    filtered.map(todo => (
                        <TodoItem key={todo.id} todo={todo} />
                    ))
                )}
            </ul>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                <span>
                    {t('todo.remaining', [String(remaining)])}
                </span>
                <span>
                    {state === 'syncing'
                        ? t('sync.syncing')
                        : context.error
                            ? t('sync.error')
                            : t('sync.synced')}
                </span>
            </div>
        </>
    );
}
