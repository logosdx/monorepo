import {
    OneOrManyElements,
    itemsToArray,
    oneOrMany
} from '@logos-ui/utils';

/**
 * Sanitize css properties; Kebab case to camel case.
 * @param name css property
 */
function sanitize(name: string): string {
    const isFloat = name === 'float';

    if (isFloat) {
        return 'cssFloat';
    }

    return name.replace(/(.+)-(.)/, (_s, m1, m2) => m1 + m2.toUpperCase())
}

export function getCss(els: OneOrManyElements, propNames: string | string[]): string | Partial<CSSStyleDeclaration> | Partial<CSSStyleDeclaration>[] {
    const elements = itemsToArray(els);
    const properties = itemsToArray(propNames);

    let result = [...elements].map(el => properties.reduce((list, prop) => {
        prop = sanitize(prop);
        const style = global.window.getComputedStyle(el as HTMLElement);
        list[prop] = style[prop];

        return list;
    }, {}))

    if (properties.length === 1) {
        result = result.map(value => value[properties[0]]);
    }

    return oneOrMany(result);
}

export function setCss(els: OneOrManyElements, props: Partial<CSSStyleDeclaration>) {
    const elements = itemsToArray(els);
    const entries = Object.entries(props);

    for (const [key, value] of entries) {
        const prop = sanitize(key);
        elements.map((el) => (el as HTMLElement).style[prop] = value);
    }
}

export function removeCss(els: OneOrManyElements, propNames: string | string[]) {

    propNames = typeof propNames === 'string' ? [propNames] : propNames;

    const props = propNames.reduce((list, prop) => {
        prop = sanitize(prop);
        list[prop] = '';
        return list;
    }, {});

    setCss(els, props);
}

