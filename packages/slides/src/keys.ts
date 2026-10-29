export type KeyAction =
    | 'nextColumn' | 'prevColumn'
    | 'down' | 'up'
    | 'next' | 'prev'
    | 'nextPanel' | 'prevPanel'
    | 'first' | 'last'
    | 'notes' | 'fullscreen' | 'blank' | 'help' | 'dismiss';

const KEY_ACTIONS = new Map<string, KeyAction>([
    ['ArrowRight', 'nextColumn'],
    ['ArrowLeft', 'prevColumn'],
    ['ArrowDown', 'down'],
    ['ArrowUp', 'up'],
    ['PageDown', 'nextPanel'],
    ['PageUp', 'prevPanel'],
    ['Home', 'first'],
    ['End', 'last'],
    ['s', 'notes'],
    ['S', 'notes'],
    ['f', 'fullscreen'],
    ['F', 'fullscreen'],
    ['.', 'blank'],
    ['b', 'blank'],
    ['B', 'blank'],
    ['?', 'help'],
    ['Escape', 'dismiss']
]);

const GUARDED = [
    'input',
    'textarea',
    'select',
    'button',
    'summary',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])'
].join(', ');

/**
 * Decks embed live demos, so keys typed into a control belong to the
 * control, not to navigation.
 *
 * @example
 *
 *     if (isGuardedTarget(event.target)) return;
 */
export function isGuardedTarget(target: EventTarget | null): boolean {

    return target instanceof Element && isGuardedElement(target);
}

/**
 * The guard for an element already known to be an element, which the speaker
 * notes need: their elements come from another window, where `instanceof Element`
 * against this one's fails.
 *
 * @example
 *
 *     if (target instanceof popup.Element && isGuardedElement(target)) return;
 */
export function isGuardedElement(element: Element): boolean {

    return !!element.closest(GUARDED);
}

/**
 * Resolves a keydown to a deck action. Ctrl, Meta, and Alt combinations
 * are left to the browser so shortcuts like Ctrl+F keep working.
 *
 * @example
 *
 *     keyAction(new KeyboardEvent('keydown', { key: ' ', shiftKey: true })); // 'prev'
 */
export function keyAction(
    event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>
): KeyAction | null {

    if (event.ctrlKey || event.metaKey || event.altKey) return null;

    if (event.key === ' ') return event.shiftKey ? 'prev' : 'next';

    return KEY_ACTIONS.get(event.key) ?? null;
}
