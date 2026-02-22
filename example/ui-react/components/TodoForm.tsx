import { useState } from 'react';
import { useMachine, useLocale } from '../providers.ts';
import { saveTodos } from '../../core/index.ts';

export function TodoForm() {

    const [title, setTitle] = useState('');
    const { send, context } = useMachine();
    const { t } = useLocale();

    const handleAdd = () => {

        if (!title.trim()) return;

        send('ADD', { title: title.trim() });
        saveTodos(context.todos);
        setTitle('');
    };

    return (
        <div className="flex gap-2 mb-4">
            <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder={t('todo.placeholder')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
                onClick={handleAdd}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
                {t('todo.add')}
            </button>
        </div>
    );
}
