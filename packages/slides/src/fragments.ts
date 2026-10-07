import type { Deck } from './deck.ts';

export type FragmentEvent = 'fragment:show' | 'fragment:hide';

export type FragmentNotify = (event: FragmentEvent, change: Deck.FragmentChange) => void;

export function fragmentsOf(panel: Element): Element[] {

    return Array.from(panel.querySelectorAll('[fragment]'));
}

/** The DOM is the state, so a panel keeps its count while the reader is elsewhere. */
export function revealedCount(panel: Element): number {

    return fragmentsOf(panel).filter((fragment) => fragment.hasAttribute('revealed')).length;
}

/**
 * Shows the first `count` fragments (`Infinity` for all) and hides the rest. Pass `notify`
 * only for a fragment step; entering a panel sets its fragments silently.
 */
export function revealFragments(panel: Element, count: number, notify?: FragmentNotify): void {

    fragmentsOf(panel).forEach((fragment, index) => {

        const reveal = index < count;

        if (reveal === fragment.hasAttribute('revealed')) return;

        fragment.toggleAttribute('revealed', reveal);
        notify?.(reveal ? 'fragment:show' : 'fragment:hide', { slide: panel, fragment, index });
    });
}

/** @returns false when no fragment is left to step, so the caller moves panels instead */
export function stepFragment(panel: Element, direction: 1 | -1, notify: FragmentNotify): boolean {

    const count = revealedCount(panel) + direction;

    if (count < 0 || count > fragmentsOf(panel).length) return false;

    revealFragments(panel, count, notify);

    return true;
}
