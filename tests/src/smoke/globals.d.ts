import type { Deck } from '../../../packages/slides/src/index.ts';

declare global {

    /** IIFE bundles loaded by `__loadBundle`, keyed by their `browserNamespace` member. */
    interface LogosDxBundles {
        Slides: { Deck: typeof Deck };
    }

    interface Window {
        LogosDx: LogosDxBundles;
    }
}

export {};
