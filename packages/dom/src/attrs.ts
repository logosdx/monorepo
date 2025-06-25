import {
    StringProps,
    OneOrMany
} from '@logosdx/utils';

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

    /**
     * Returns attributes on one or many html elements
     * @param els list of html elements
     * @param propNames attribute
     *
     * @example
     *
     * html.attrs.get(form, 'method');
     * // > 'post'
     *
     * html.attrs.get([select, input], 'name');
     * // > ['role', 'full_name']
     *
     * html.attrs.get(form, ['method', 'action']);
     * // > { method: 'post', action: '/' }
     *
     * html.attrs.get([select, input], ['name', 'value']);
     * // > [{ name: '', value: '' }, { name: '', value: '' }]
     */
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

    /**
     *
     * @param els
     * @param propNames
     *
     * html.attrs.has(form, 'method');
     * // > true
     *
     * html.attrs.has([input, textarea], 'required');
     * // > [true, false]
     *
     * html.attrs.has([input, textarea], ['required', 'name']);
     * // > [{ required: true, name: false }, { required: false, name: false }]
     */
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

    /**
     *
     * @param els
     * @param props
     *
     * @example
     *
     * html.attrs.set(input, { name: 'full_name' });
     * html.attrs.set([div, div, div], { 'data-show': 'false' });
     */
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

    /**
     * Removes attributes on one or many html elements
     * @param els list of html elements
     * @param propNames attribute
     *
     * @example
     *
     * html.attrs.remove(form, 'method');
     * html.attrs.remove([select, input], 'name');
     * html.attrs.remove(form, ['method', 'action']);
     * html.attrs.remove([select, input], ['name', 'value']);
     */
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
