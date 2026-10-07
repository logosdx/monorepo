import { attemptSync } from '@logosdx/utils';

import type { Deck } from './deck.ts';

const POSITIONAL = /^#\/(\d+)\/(\d+)(?:\/(\d+))?$/;

/**
 * `#/<column>/<panel>[/<fragment>]` is a position; any other `#<text>` is an element id.
 * Returns null for an empty hash or a positional one that does not parse.
 */
export function parseHash(hash: string): Deck.Target | null {

    if (hash.length < 2) return null;

    if (!hash.startsWith('#/')) {

        const id = hash.slice(1);
        const [decoded] = attemptSync(() => decodeURIComponent(id));

        return decoded ?? id;
    }

    const match = POSITIONAL.exec(hash);

    if (!match) return null;

    const [, column, panel, fragment] = match;
    const position = { column: Number(column), panel: Number(panel) };

    return fragment === undefined ? position : { ...position, fragment: Number(fragment) };
}

/** Pass `fragment` only for a panel that has fragments, so a plain panel keeps the short form. */
export function formatHash({ column, panel, fragment }: Deck.Position): string {

    const hash = `#/${column}/${panel}`;

    return fragment === undefined ? hash : `${hash}/${fragment}`;
}
