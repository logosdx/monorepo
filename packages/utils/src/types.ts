
/** Generic Function */
export type Func = (...args: any) => any | Function;

/** Generic Class */
export type Klass = { new: Func }

/** Extract only props that are not functions */
export type NonFunctionProps<T> = { [K in keyof T]: T[K] extends Func | Klass ? never : K }[keyof T];

/** Extract only props that are functions */
export type FunctionProps<T>    = { [K in keyof T]: T[K] extends Func | Klass ? K : never }[keyof T];


/** Make a nested object optional all the way down the tree */
export type DeepOptional<T> = {
    [K in keyof T]?: T[K] extends object ? DeepOptional<T[K]> : T[K]
};

export type NullableObject<T> = {
    [K in keyof T]: T[K] | null
};

type FieldWithPossiblyUndefined<T, Key> = GetFieldType<Exclude<T, undefined>, Key> | Extract<T, undefined>

type GetIndexedField<T, K> = K extends keyof T
    ? T[K]
    : K extends `${number}`
        ? '0' extends keyof T // tuples have string keys, return undefined if K is not in tuple
            ? undefined
            : number extends keyof T
                ? T[number]
                : undefined
        : undefined

export type GetFieldType<T, P> = P extends `${infer Left}.${infer Right}`
    ? Left extends keyof T
        ? FieldWithPossiblyUndefined<T[Left], Right>
        : Left extends `${infer FieldKey}[${infer IndexKey}]`
            ? FieldKey extends keyof T
                ? FieldWithPossiblyUndefined<GetIndexedField<Exclude<T[FieldKey], undefined>, IndexKey> | Extract<T[FieldKey], undefined>, Right>
                : undefined
            : undefined
    : P extends keyof T
        ? T[P]
        : P extends `${infer FieldKey}[${infer IndexKey}]`
            ? FieldKey extends keyof T
                ? GetIndexedField<Exclude<T[FieldKey], undefined>, IndexKey> | Extract<T[FieldKey], undefined>
                : undefined
            : undefined


export type PathNames<T> = T extends object ? { [K in keyof T]:
    `${Exclude<K, symbol>}${"" | `.${PathNames<T[K]>}`}`
}[keyof T] : never

export type PathLeaves<T> = T extends object ? { [K in keyof T]:
    `${Exclude<K, symbol>}${PathLeaves<T[K]> extends never ? "" : `.${PathLeaves<T[K]>}`}`
}[keyof T] : never

export type StrOrNum = string | number

export type OneOrMany<T> = T | T[];
export type OneOrManyElements<T extends Node | EventTarget = Element> = T | T[];

export interface StringProps { [key: string]: string };

export interface BoolProps { [key: string]: boolean };

export type MaybePromise<T> = T | Promise<T>;
