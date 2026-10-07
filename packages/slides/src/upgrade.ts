import { observe } from '@logosdx/dom';

export const DECK = 'slides';
export const SLIDE = 'slide';
export const NOTES = 'notes';
const HORIZONTAL = 'horizontal';
const VERTICAL = 'vertical';

export const isSlide = (node: Node | null): node is Element => (
    node instanceof Element && node.localName === SLIDE
);

export const slideChildren = (parent: Element) => Array.from(parent.children).filter(isSlide);

function childContaining(container: Element, node: Element): Element {

    let current = node;

    while (current.parentElement && current.parentElement !== container) {

        current = current.parentElement;
    }

    return current;
}

/** An explicit `horizontal` sibling stays a column through its own case 1. */
function carriedSiblings(slide: Element): ChildNode[] {

    const stopAtColumn = !slide.hasAttribute(HORIZONTAL);
    const siblings: ChildNode[] = [];
    let sibling = slide.nextSibling;

    while (sibling) {

        if (sibling instanceof Element && sibling.localName === DECK) break;
        if (stopAtColumn && isSlide(sibling) && sibling.hasAttribute(HORIZONTAL)) break;

        siblings.push(sibling);
        sibling = sibling.nextSibling;
    }

    return siblings;
}

/**
 * An explicit axis names the level the author meant; without one, the
 * nearest enclosing slide is the best guess at where the parser nested it.
 */
function misplacedAnchor(slide: Element, root: Element): Element {

    const topLevel = childContaining(root, slide);

    if (slide.hasAttribute(HORIZONTAL)) return topLevel;

    if (slide.hasAttribute(VERTICAL)) {

        return isSlide(topLevel) ? childContaining(topLevel, slide) : topLevel;
    }

    return slide.parentElement?.closest(SLIDE) ?? topLevel;
}

/** Upgrade cases 1-4 in docs/spec/slides.md. */
function repairMisplaced(slide: Element, root: Element): void {

    const parent = slide.parentElement;

    if (!parent || parent === root) return;

    if (isSlide(parent)) {

        if (parent.parentElement === root) return;

        const nested = slideChildren(parent);

        parent.after(...nested);

        for (const moved of nested) {

            console.warn(
                '@logosdx/slides: moved a <slide> nested in a panel out to the next panel',
                moved
            );
        }

        return;
    }

    const anchor = misplacedAnchor(slide, root);

    anchor.after(slide, ...carriedSiblings(slide));
    console.warn(
        '@logosdx/slides: moved a misplaced <slide>; close <p> and <li> tags inside slides',
        slide
    );
}

/** Upgrade cases 5-6. Written back so CSS selects on the attribute, not on nesting. */
function inferAxis(slide: Element, root: Element): void {

    const axis = slide.parentElement === root ? HORIZONTAL : VERTICAL;
    const contradiction = axis === HORIZONTAL ? VERTICAL : HORIZONTAL;

    if (slide.hasAttribute(contradiction)) {

        slide.removeAttribute(contradiction);
        console.warn(
            `@logosdx/slides: rewrote a <slide ${contradiction}> to ${axis} to match its position`,
            slide
        );
    }

    if (!slide.hasAttribute(axis)) slide.setAttribute(axis, '');
}

const isContent = (node: ChildNode) => (
    (node instanceof Element && node.localName !== DECK && node.localName !== NOTES) ||
    (node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim())
);

/**
 * Upgrade case 7. Content above a column's first panel sits outside every
 * snap target, so panel navigation could never reach it.
 */
function wrapLooseContent(column: Element): void {

    const firstPanel = slideChildren(column)[0];
    const leading: ChildNode[] = [];

    if (!firstPanel) return;

    for (const node of Array.from(column.childNodes)) {

        if (node === firstPanel) break;

        leading.push(node);
    }

    const start = leading.findIndex(isContent);
    const end = leading.findLastIndex(isContent);

    if (start === -1) return;

    const wrapper = column.ownerDocument.createElement(SLIDE);

    wrapper.setAttribute(VERTICAL, '');
    wrapper.setAttribute('data-implicit', '');
    column.insertBefore(wrapper, leading[start]!);
    wrapper.append(...leading.slice(start, end + 1));
}

function upgradeSlide(slide: Element, root: Element): void {

    if (slide.parentElement?.closest(DECK) !== root) return;

    repairMisplaced(slide, root);
    inferAxis(slide, root);
    wrapLooseContent(childContaining(root, slide));
}

/**
 * Upgrades every `<slide>` under `root`, now and as slides are added.
 * The returned cleanup stops watching; repairs already made stay.
 */
export function upgradeDeck(root: Element): () => void {

    for (const deck of Array.from(root.ownerDocument.querySelectorAll(DECK))) {

        if (deck !== root) {

            console.error(
                '@logosdx/slides: a document holds one <slides>; ignoring this one',
                deck
            );
        }
    }

    return observe(SLIDE, (slide) => upgradeSlide(slide, root), { root });
}
