import { describe, it, expect } from 'vitest';
import { act } from 'react';

import { LocaleManager } from '@logosdx/localize';
import { createLocalizeContext } from '@logosdx/react';
import { renderHook } from './_helpers.ts';


const english = {
    greeting: 'Hello, {name}!',
    nav: { logout: 'Log out' },
};

const spanish: typeof english = {
    greeting: '¡Hola, {name}!',
    nav: { logout: 'Cerrar sesión' },
};

type Lang = typeof english;
type Codes = 'en' | 'es';

const makeManager = () => new LocaleManager<Lang, Codes>({
    current: 'en',
    fallback: 'en',
    locales: {
        en: { code: 'en', text: 'English', labels: english },
        es: { code: 'es', text: 'Español', labels: spanish },
    },
});

describe('@logosdx/react: localize', () => {

    it('createLocalizeContext returns [Provider, useHook] tuple', () => {

        const result = createLocalizeContext(makeManager());

        expect(result).to.be.an('array').with.lengthOf(2);
        expect(result[0]).to.be.a('function');
        expect(result[1]).to.be.a('function');
    });

    it('useHook returns the expected API shape', () => {

        const manager = makeManager();
        const [, useLocale] = createLocalizeContext(manager);

        const { result } = renderHook(() => useLocale());

        expect(result.current.t).to.be.a('function');
        expect(result.current.locale).to.equal('en');
        expect(result.current.changeTo).to.be.a('function');
        expect(result.current.locales).to.be.an('array');
        expect(result.current.instance).to.equal(manager);
    });

    it('t() translates keys with the current locale', () => {

        const manager = makeManager();
        const [, useLocale] = createLocalizeContext(manager);

        const { result } = renderHook(() => useLocale());

        expect(result.current.t('greeting', { name: 'World' })).to.equal('Hello, World!');
        expect(result.current.t('nav.logout')).to.equal('Log out');
    });

    it('changeTo() switches locale and triggers re-render', () => {

        const manager = makeManager();
        const [, useLocale] = createLocalizeContext(manager);

        let renderCount = 0;
        const { result } = renderHook(() => {

            renderCount++;
            return useLocale();
        });

        const before = renderCount;

        act(() => { result.current.changeTo('es'); });

        expect(result.current.locale).to.equal('es');
        expect(result.current.t('greeting', { name: 'Mundo' })).to.equal('¡Hola, Mundo!');
        expect(result.current.t('nav.logout')).to.equal('Cerrar sesión');
        expect(renderCount).to.be.greaterThan(before);
    });

    it('locales returns all available locales', () => {

        const manager = makeManager();
        const [, useLocale] = createLocalizeContext(manager);

        const { result } = renderHook(() => useLocale());

        expect(result.current.locales).to.have.lengthOf(2);
        expect(result.current.locales).to.deep.include({ code: 'en', text: 'English' });
        expect(result.current.locales).to.deep.include({ code: 'es', text: 'Español' });
    });

    it('external locale change triggers re-render', () => {

        const manager = makeManager();
        const [, useLocale] = createLocalizeContext(manager);

        const { result } = renderHook(() => useLocale());

        expect(result.current.locale).to.equal('en');

        act(() => { manager.changeTo('es'); });

        expect(result.current.locale).to.equal('es');
        expect(result.current.t('nav.logout')).to.equal('Cerrar sesión');
    });

    it('cleans up event listener on unmount', () => {

        const manager = makeManager();
        const [, useLocale] = createLocalizeContext(manager);

        let renderCount = 0;
        const { unmount } = renderHook(() => {

            renderCount++;
            return useLocale();
        });

        const before = renderCount;
        unmount();

        manager.changeTo('es');

        expect(renderCount).to.equal(before);
    });

    it('Provider wraps children with context', () => {

        const manager = makeManager();
        const [Provider, useLocale] = createLocalizeContext(manager);

        const { result } = renderHook(
            () => useLocale(),
            Provider
        );

        expect(result.current.instance).to.equal(manager);
    });
});
