import {
    OneOrManyElements,
    BoolProps,
    StringProps,
    itemsToArray,
    oneOrMany,
    OneOrMany
} from '@logos-ui/utils';

type HasAttrObj<T extends string> = Record<T, boolean>;
type GetAttrObj<T extends string> = Record<T, string>;



const getAttrsObj = <T extends string>(el: HTMLElement, attrs: string[]) => {

    return Object.fromEntries(
        attrs.map(a => [a, el.getAttribute(a)])
    ) as GetAttrObj<T>
};

const hasAttrsObj = <T extends string>(el: HTMLElement, attrs: string[]) => {

    return Object.fromEntries(
        attrs.map(a => [a, el.hasAttribute(a)])
    ) as HasAttrObj<T>
}


const setEachAttr = (el: HTMLElement, props: StringProps) => {

    for (const key in props) {

        el.setAttribute(key, props[key]!);
    }
}

const rmEachAttr = (el: HTMLElement, attrs: OneOrMany<string>) => {

    if (Array.isArray(attrs)) {

        for (const i in attrs) {

            el.removeAttribute(attrs[i]!);
        }

        return;
    }

    el.removeAttribute(attrs)
}


export class HtmlAttr {

    static get(el: HTMLElement, attr: string): string;
    static get(el: HTMLElement[], attr: string): string[];
    static get <T extends string = string>(el: HTMLElement, attr: string[]): GetAttrObj<T>;
    static get <T extends string = string>(el: HTMLElement[], attr: string[]): GetAttrObj<T>[];
    static get <T extends string = string>(
        els: OneOrMany<HTMLElement>,
        attrs: OneOrMany<string>
    ) {

        if (Array.isArray(els)) {

            if (Array.isArray(attrs)) {

                return  els.map(
                    el => getAttrsObj <T>(el, attrs)
                ) as GetAttrObj<T>[];
            }

            return els.map(
                el => el.getAttribute(attrs)
            ) as string[]
        }

        if (Array.isArray(attrs)) {

            return getAttrsObj <T>(els, attrs) as GetAttrObj<T>
        }

        return els.getAttribute(attrs)
    }

    static has(el: HTMLElement, attr: string): boolean;
    static has(el: HTMLElement[], attr: string): boolean[];
    static has <T extends string = string>(el: HTMLElement, attr: string[]): HasAttrObj<T>;
    static has <T extends string = string>(el: HTMLElement[], attr: string[]): HasAttrObj<T>[];
    static has <T extends string = string>(
        els: OneOrMany<HTMLElement>,
        attrs: OneOrMany<string>
    ) {

        if (Array.isArray(els)) {

            if (Array.isArray(attrs)) {

                return  els.map(
                    el => hasAttrsObj <T>(el, attrs)
                );
            }

            return els.map(
                el => el.hasAttribute(attrs)
            );
        }

        if (Array.isArray(attrs)) {

            return hasAttrsObj <T>(els, attrs) as HasAttrObj<T>;
        }

        return els.hasAttribute(attrs);
    }

    static set(
        els: OneOrMany<HTMLElement>,
        props: StringProps
    ): void {

        if (Array.isArray(els)) {

            els.forEach(el => setEachAttr(el, props));
            return;
        }

        setEachAttr(els, props)
    }

    static remove(
        els: OneOrMany<HTMLElement>,
        attrs: OneOrMany<string>
    ) {

        if (Array.isArray(els)) {

            els.forEach(el => rmEachAttr(el, attrs));
            return;
        }

        rmEachAttr(els, attrs);
    }


}
