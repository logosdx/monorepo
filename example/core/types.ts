export interface Todo {
    id: string;
    title: string;
    status: 'active' | 'completed';
    synced: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface TodoStore {
    [id: string]: Todo;
}

export type TodoFilter = 'all' | 'active' | 'completed';
