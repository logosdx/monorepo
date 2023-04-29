import {
    OneOrManyElements,
    BoolProps,
    StringProps,
    itemsToArray,
    oneOrMany
} from '@logos-ui/utils';

const eachAttrItem = (propNames: string[] | string[][], callback: Function) => {

    return propNames.map(item => callback(item));
};

const eachAttrElement = <T, R = T>(
    els: OneOrManyElements,
    propNames: string | string[] | string[][],
    callback: (
        element: Element,
        prop: T
    ) => unknown
): R[][] => {

    const elements = itemsToArray(els) as Element[];
    const props = itemsToArray(propNames as string);

    return elements.map(
        (element) => (
            eachAttrItem(
                props,
                (prop) => callback(element, prop)
            )
        )
    );
}

export const getAttr = <T = StringProps>(
    els: OneOrManyElements,
    propNames: string | string[]
): (
    string | string[] |
    T | T[]
) => {

    const entries = eachAttrElement <string, [string, string]>(
        els,
        propNames,
        function (element, prop) {

            return [prop as string, element.getAttribute(prop as string)];
        }
    );

    if (typeof propNames === 'string') {

        const results = entries.map((props) => props[0][1]);

        return oneOrMany(results);
    }

    if (Array.isArray(propNames)) {

        const results = entries.map(
            (props) => Object.fromEntries(props)
        ) as T[];

        return oneOrMany(results);
    }
}


export function setAttr(
    els: OneOrManyElements,
    props: StringProps
): void {

    eachAttrElement <[string,string]>(
        els,
        Object.entries(props),
        (element, [name, value]) => {

            element.setAttribute(name, value);
        }
    );
}


export function removeAttr(
    els: OneOrManyElements,
    propNames: string | string[]
) {

    eachAttrElement(
        els,
        propNames,
        (element, prop) => {
            element.removeAttribute(prop as string);
        }
    );
}


export function hasAttr(
    els: OneOrManyElements,
    propNames: string | string[]
) {

    const entries = eachAttrElement <string, [string, boolean]>(
        els,
        propNames,
        function (element, prop) {
            return [prop, element.hasAttribute(prop as string)];
        }
    );

    if (typeof propNames === 'string') {

        const results = entries.map((props) => props[0][1]);
        return oneOrMany(results);
    }

    if (Array.isArray(propNames)) {

        const results = entries.map(
            (props) => Object.fromEntries(props)
        ) as BoolProps[];

        return oneOrMany(results);
    }
}
