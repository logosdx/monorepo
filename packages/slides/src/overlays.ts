import { create } from '@logosdx/dom';

export type OverlayName = 'help' | 'blank';

const HELP_ROWS: [keys: string, action: string][] = [
    ['→ / ←', 'Next / previous column'],
    ['↓ / ↑', 'Scroll the slide, then next / previous slide in the column'],
    ['Space / Shift+Space', 'Next / previous step'],
    ['PageDown / PageUp', 'Next / previous slide, across columns'],
    ['Home / End', 'First / last slide'],
    ['S', 'Open speaker notes; press again to reopen them after closing or reloading'],
    ['F', 'Toggle fullscreen'],
    ['. / B', 'Toggle a blank screen'],
    ['?', 'Toggle this help'],
    ['Esc', 'Close this help or unblank']
];

function helpTable(): HTMLElement {

    const rows = HELP_ROWS.map(([keys, action]) => create('tr', {
        children: [
            create('th', { children: [create('kbd', { text: keys })] }),
            create('td', { text: action })
        ]
    }));

    return create('table', { children: [create('tbody', { children: rows })] });
}

/**
 * Builds a full-viewport overlay. The caller attaches and removes it, so
 * a closed overlay leaves nothing in the document.
 *
 * @example
 *
 *     document.body.append(createOverlay('blank'));
 */
export function createOverlay(name: OverlayName): HTMLElement {

    if (name === 'blank') {

        return create('div', { attrs: { 'data-slides-overlay': name } });
    }

    return create('div', {
        attrs: {
            'data-slides-overlay': name,
            role: 'dialog',
            'aria-label': 'Keyboard shortcuts'
        },
        children: [helpTable()]
    });
}
