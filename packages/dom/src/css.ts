import {
    OneOrMany,
    NonFunctionProps
} from '@logosdx/utils';


export type CssPropNames = Extract<NonFunctionProps<CSSStyleDeclaration>, string>;
export type CssProps = { [K in CssPropNames]?: CSSStyleDeclaration[K] };


/**
 * Sanitize css properties; Kebab case to camel case.
 * Handles special cases like 'float' which becomes 'cssFloat'.
 * @param name css property name to sanitize
 * @returns sanitized CSS property name
 */
function sanitize(name: CssPropNames) {
    const isFloat = name === 'float';

    if (isFloat) {
        return 'cssFloat';
    }

    return (name as string).replace(
        /(.+)-(.)/,
        (_s, m1: string, m2: string) => m1 + m2.toUpperCase()
    ) as CssPropNames
}

/**
 * Get computed styles for an element
 * @param el HTML element to get styles from
 * @returns computed CSS properties object
 */
const cssPropsFor = (el: HTMLElement) => window?.getComputedStyle(el) as CssProps;

/**
 * Extract specific CSS properties from a computed styles object
 * @param props computed CSS properties object
 * @param names array of CSS property names to extract
 * @returns object containing only the requested CSS properties
 */
const extractCssProps = (props: CssProps, names: CssPropNames[]) => {

    const list = {} as CssProps;
    names = names.map(sanitize);

    for (const i in names) {

        const key = names[i]!;
        list[key] = props[key]! as never;
    }

    return list;
}

/**
 * Set a single CSS property on an element
 * @param el HTML element to set style on
 * @param propName CSS property name
 * @param value CSS property value
 */
const setCss = (el: HTMLElement, propName: CssPropNames, value: string) => {

    el.style[sanitize(propName) as any] = value;
}

export class HtmlCss {

    /**
     * Gets one or many css properties from one or many html elements.
     * Returns computed styles, not inline styles.
     * @param els HTML element or array of elements
     * @param propNames CSS property name or array of property names
     * @returns CSS property value(s) or object(s) with property values
     *
     * @example
     *
     * html.css.get(div, 'color');
     * // > 'red'
     *
     * html.css.get([div, span], 'color');
     * // > ['red', 'blue']
     *
     * html.css.get(div, ['color', 'fontSize']);
     * // > { color: 'red', fontSize: '12px' }
     *
     * html.css.get([div, span], ['color', 'fontSize']);
     * // > [{ color: 'red', fontSize: '12px' }, { color: 'blue', fontSize: '10px' }]
     *
     */
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

    /**
     * Sets css properties on one or many html elements.
     * Applies inline styles directly to elements.
     * @param els HTML element or array of elements
     * @param props CSS style properties object
     *
     * @example
     *
     * html.css.set([div, span], {
     *      color: 'blue',
     *      paddingRight: '10px'
     * });
     *
     * html.css.set(div, {
     *      color: 'blue',
     *      paddingRight: '10px'
     * });
     */
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


    /**
     * Removes CSS properties from html elements by setting them to empty string.
     * This effectively resets the properties to their default values.
     * @param els HTML element or array of elements
     * @param propNames CSS property name or array of property names to remove
     *
     * @example
     *
     * html.css.remove(div, 'color');
     * html.css.remove([div, span], 'color');
     * html.css.remove(div, ['color', 'fontSize']);
     * html.css.remove([div, span], ['color', 'fontSize']);
     */
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