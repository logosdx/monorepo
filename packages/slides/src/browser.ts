import { Deck } from './index.ts';
import { DECK } from './upgrade.ts';

export * from './index.ts';

function autoInit(): void {

    const root = document.querySelector(DECK);

    if (!root || root.hasAttribute('manual')) return;

    new Deck(root);
}

if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
}
else {

    autoInit();
}
