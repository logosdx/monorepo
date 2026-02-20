interface ScrollToOpts {
    offset?: number;
    behavior?: ScrollBehavior;
    scrollElement?: HTMLElement;
}

function scrollToImpl(
    elOrX: Element | number,
    optsOrY?: ScrollToOpts | number,
    opts?: ScrollToOpts
): void {

    if (typeof elOrX === 'number') {

        const y = optsOrY as number;
        const scrollOpts = opts ?? {};
        const target = scrollOpts.scrollElement ?? window;
        target.scrollTo({ left: elOrX, top: y, ...(scrollOpts.behavior ? { behavior: scrollOpts.behavior } : {}) });
    }
    else {

        const scrollOpts = (optsOrY as ScrollToOpts) ?? {};
        elOrX.scrollIntoView({ ...(scrollOpts.behavior ? { behavior: scrollOpts.behavior } : {}), block: 'start' });
    }
}

export const viewport = {

    width(): number {

        return window.innerWidth ?? 0;
    },

    height(): number {

        return window.innerHeight ?? 0;
    },

    scrollX(): number {

        return window.scrollX ?? window.pageXOffset ?? 0;
    },

    scrollY(): number {

        return window.scrollY ?? window.pageYOffset ?? 0;
    },

    scrollProgress(el?: Element): number {

        if (el) {

            const { scrollTop, scrollHeight, clientHeight } = el as HTMLElement;
            const max = scrollHeight - clientHeight;
            return max <= 0 ? 0 : scrollTop / max;
        }

        const scrollTop = window.scrollY ?? 0;
        const docHeight = document.documentElement.scrollHeight;
        const viewHeight = window.innerHeight;
        const max = docHeight - viewHeight;
        return max <= 0 ? 0 : scrollTop / max;
    },

    pixelRatio(): number {

        return window.devicePixelRatio ?? 1;
    },

    isAtTop(threshold = 0): boolean {

        return (window.scrollY ?? 0) <= threshold;
    },

    isAtBottom(threshold = 0): boolean {

        const scrollY = window.scrollY ?? 0;
        const viewHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        return scrollY + viewHeight >= docHeight - threshold;
    },

    scrollTo: scrollToImpl,
};
