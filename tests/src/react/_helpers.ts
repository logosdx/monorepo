import {
    type ReactNode,
    createElement,
    act,
} from 'react';

import { createRoot, type Root } from 'react-dom/client';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;


type RenderHookResult<T> = {
    result: { current: T };
    rerender: () => void;
    unmount: () => void;
};

type Wrapper = (props: { children?: ReactNode }) => ReactNode;

/**
 * Minimal renderHook — mounts a component that calls `hookFn` on every render,
 * storing the return value in `result.current`. Uses react-dom/client + act().
 */
export function renderHook<T>(
    hookFn: () => T,
    wrapper?: Wrapper
): RenderHookResult<T> {

    const result = {} as { current: T };

    function TestComponent() {

        result.current = hookFn();
        return null;
    }

    const container = document.createElement('div');
    let root: Root;

    const build = () => {

        const test = createElement(TestComponent);
        return wrapper ? createElement(wrapper, null, test) : test;
    };

    act(() => {

        root = createRoot(container);
        root.render(build());
    });

    return {
        result,
        rerender: () => act(() => { root.render(build()); }),
        unmount: () => act(() => { root.unmount(); }),
    };
}

/**
 * Flushes pending microtasks and lets React process async state updates.
 * Call after triggering async operations (fetch, promise-based events, etc.).
 */
export const flush = async () => {

    await act(async () => {

        await new Promise(r => setTimeout(r, 0));
    });
};
