import {
    OneOrMany,
    OneOrManyElements,
    itemsToArray,
    oneOrMany,
    NonFunctionProps
} from '@logos-ui/utils';


export type CssPropNames = Extract<NonFunctionProps<CSSStyleDeclaration>, string>;
export type CssProps = { [K in CssPropNames]?: CSSStyleDeclaration[K] };


/**
 * Sanitize css properties; Kebab case to camel case.
 * @param name css property
 */
function sanitize(name: CssPropNames) {
    const isFloat = name === 'float';

    if (isFloat) {
        return 'cssFloat';
    }

    return (name as string).replace(
        /(.+)-(.)/,
        (_s, m1, m2) => m1 + m2.toUpperCase()
    ) as CssPropNames
}

const cssPropsFor = (el: HTMLElement) => global.window.getComputedStyle(el) as CssProps;
const extractCssProps = (props: CssProps, names: CssPropNames[]) => {

    const list = {} as CssProps;
    names = names.map(sanitize);

    for (const i in names) {

        const key = names[i]!;
        list[key] = props[key] as any;
    }

    return list;
}

const setCss = (el: HTMLElement, propName: CssPropNames, value: string) => {

    el.style[sanitize(propName) as any] = value;
}

export class HtmlCss {

    static get(el: HTMLElement, prop: CssPropNames): string;
    static get(el: HTMLElement[], prop: CssPropNames): string[];
    static get(el: HTMLElement, props: CssPropNames[]): CssProps;
    static get(el: HTMLElement[], props: CssPropNames[]): CssProps[];
    static get(
        els: OneOrMany<HTMLElement>,
        props: OneOrMany<CssPropNames>
    ) {

        if (Array.isArray(els)) {

            if (Array.isArray(props)) {

                return els.map(el => (

                    extractCssProps(
                        cssPropsFor(el),
                        props
                    )
                )) as CssProps[]
            }

            return els.map(el => (

                cssPropsFor(el)[props]
            )) as string[]
        }

        if (Array.isArray(props)) {

            return extractCssProps(
                cssPropsFor(els),
                props
            ) as CssProps
        }

        return cssPropsFor(els)[props] as string
    }

    static set(els: OneOrMany<HTMLElement>, props: CssProps) {

        const entries = Object.entries(props) as [CssPropNames, CssProps[CssPropNames]][];

        if (!Array.isArray(els)) {

            for (const i in entries) {

                const [prop, value] = entries[i]!

                setCss(els, prop, value as string);
            }

            return
        }

        for (const [key, value] of entries) {

            const prop = sanitize(key);
            els.map(el => setCss(el, prop, value as string));
        }
    }
    static remove(
        els: OneOrMany<HTMLElement>,
        propNames: OneOrMany<CssPropNames>
    ) {

        if (!Array.isArray(propNames)) {

            this.set(els, { [propNames]: '' });
            return;
        }

        this.set(els, Object.fromEntries(
            propNames.map(n => [n, ''])
        ));
    }

}