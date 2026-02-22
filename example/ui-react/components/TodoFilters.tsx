import { useMachine, useLocale } from '../providers.ts';
import type { TodoFilter } from '../../core/types.ts';

const FILTERS: TodoFilter[] = ['all', 'active', 'completed'];

export function TodoFilters() {

    const { send, context } = useMachine();
    const { t } = useLocale();

    return (
        <div className="flex gap-2 mb-4">
            {FILTERS.map(f => (

                <button
                    key={f}
                    onClick={() => send('FILTER', { filter: f })}
                    className={`px-3 py-1 rounded-md text-sm cursor-pointer border-0 ${
                        f === context.filter
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    {t(`todo.filters.${f}`)}
                </button>
            ))}
        </div>
    );
}
