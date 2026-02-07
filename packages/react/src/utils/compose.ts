import { createElement, type ReactNode } from 'react';
import type { ProviderProps } from '../types.ts';

type ProviderComponent = (props: ProviderProps) => ReactNode;

type ProviderWithProps<P extends Record<string, unknown> = Record<string, unknown>> = readonly [
    (props: P & ProviderProps) => ReactNode,
    P
];

type ProviderEntry = ProviderComponent | ProviderWithProps;

/**
 * Composes multiple React providers into a single wrapper component,
 * eliminating deeply nested provider trees.
 *
 * Accepts bare providers (children-only) or `[Provider, props]` tuples
 * for providers that need configuration. Providers are nested in the
 * order given — first entry becomes the outermost wrapper.
 *
 *     import { compose } from '@logosdx/react';
 *
 *     // Without compose — the pyramid of doom:
 *     <AppObserver>
 *         <ApiFetch>
 *             <AppStorage>
 *                 <AppLocale>
 *                     <App />
 *                 </AppLocale>
 *             </AppStorage>
 *         </ApiFetch>
 *     </AppObserver>
 *
 *     // With compose:
 *     const Providers = compose(
 *         AppObserver,
 *         ApiFetch,
 *         AppStorage,
 *         AppLocale,
 *     );
 *
 *     <Providers>
 *         <App />
 *     </Providers>
 *
 *     // With props for providers that need configuration:
 *     const Providers = compose(
 *         AppObserver,
 *         [ThemeProvider, { theme: 'dark' }],
 *         ApiFetch,
 *     );
 *
 * @param providers - Provider components or `[Provider, props]` tuples
 * @returns A single component that nests all providers around its children
 */
export function composeProviders(...providers: ProviderEntry[]) {

    return function Composed(props: ProviderProps): ReactNode {

        let node: ReactNode = props.children;

        for (let i = providers.length - 1; i >= 0; i--) {

            const entry = providers[i]!;

            if (typeof entry === 'function') {

                node = createElement(entry, null, node);
            }
            else {

                const [Provider, options] = entry;
                node = createElement(Provider, options as any, node);
            }
        }

        return node;
    };
}
