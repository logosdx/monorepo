import { applyDefaults } from '@logos-ui/riot-kit';

export type AppState = {
    //
};

export type ReducerValue = AppState;

export const stateReducer = <S = AppState, V = ReducerValue>(
    newState: S,
    currentState: V,
    // ignore: Symbol
) => {


    return applyDefaults <S>(
        {} as any,
        currentState as any,
        newState
    );
};
