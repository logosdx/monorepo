import { useMachine } from '../providers.ts';
import { saveTodos, deleteTodoFromServer } from '../../core/index.ts';
import type { Todo } from '../../core/types.ts';

export function TodoItem({ todo }: { todo: Todo }) {

    const { send, context } = useMachine();

    return (
        <li className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm mb-2">
            <input
                type="checkbox"
                checked={todo.status === 'completed'}
                onChange={() => {

                    send('TOGGLE', { id: todo.id });
                    saveTodos(context.todos);
                }}
                className="w-5 h-5 rounded"
            />
            <span
                className={`flex-1 ${
                    todo.status === 'completed'
                        ? 'line-through text-gray-400'
                        : 'text-gray-800'
                }`}
            >
                {todo.title}
            </span>
            <button
                onClick={() => {

                    send('DELETE', { id: todo.id });
                    saveTodos(context.todos);
                    deleteTodoFromServer(todo.id);
                }}
                className="text-red-400 hover:text-red-600 text-sm"
            >
                ✕
            </button>
        </li>
    );
}
