
export type AnyConstructor = (
    ArrayConstructor |
    ObjectConstructor |
    MapConstructor |
    SetConstructor |
    DateConstructor |
    RegExpConstructor |
    FunctionConstructor
);

export interface DeepEqualFunc {
    (a: any, b: any): boolean;
}

export interface TypeCloneFunc<T> {
    (a: T): T;
}

export type MapType = Map<
    AnyConstructor,
    DeepEqualFunc
>;


export interface TypeMergeFunc {
    (a: any, b: any, opts?: any): any;
}

export type MapTypeMerge = Map<
    AnyConstructor,
    TypeMergeFunc
>

export type ConstructorCheckOptions = {
    constructor: any,
    treatAs?: AnyConstructor,
    deepEqualFunc?: DeepEqualFunc
};
