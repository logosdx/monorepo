export interface StorageDriver {

    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
    keys(): Promise<string[]>;
    clear(): Promise<void>;
}

export type StorageEventName =
    | 'before-set'
    | 'after-set'
    | 'before-remove'
    | 'after-remove'
    | 'clear';

export interface StorageEventPayload<V, K extends keyof V = keyof V> {
    key: K;
    value?: V[K] | null;
}

export type StorageEventListener<V> = (
    payload: StorageEventPayload<V>
) => void;

export interface ScopedKey<V, K extends keyof V> {
    get(): Promise<V[K]>;
    set(value: V[K]): Promise<void>;
    assign(val: Partial<V[K]>): Promise<void>;
    rm(): Promise<void>;
    remove(): Promise<void>;
    clear(): Promise<void>;
}
