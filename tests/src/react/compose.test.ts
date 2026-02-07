import { describe, it, expect } from 'vitest';
import { createElement, createContext, useContext, type ReactNode } from 'react';

import { composeProviders } from '../../../packages/react/src/index.ts';
import { renderHook } from './_helpers.ts';


const CtxA = createContext('default-a');
const CtxB = createContext('default-b');
const CtxC = createContext('default-c');

const ProviderA = (props: { children?: ReactNode }) =>
    createElement(CtxA.Provider, { value: 'from-a' }, props.children);

const ProviderB = (props: { children?: ReactNode }) =>
    createElement(CtxB.Provider, { value: 'from-b' }, props.children);

const ProviderC = (props: { children?: ReactNode }) =>
    createElement(CtxC.Provider, { value: 'from-c' }, props.children);


describe('@logosdx/react: compose', () => {

    it('compose returns a function component', () => {

        const Composed = composeProviders(ProviderA);
        expect(Composed).to.be.a('function');
    });

    it('single provider wraps children with context', () => {

        const Composed = composeProviders(ProviderA);

        const { result } = renderHook(
            () => useContext(CtxA),
            Composed
        );

        expect(result.current).to.equal('from-a');
    });

    it('multiple providers nest in order (first = outermost)', () => {

        const Composed = composeProviders(ProviderA, ProviderB, ProviderC);

        const { result } = renderHook(
            () => ({
                a: useContext(CtxA),
                b: useContext(CtxB),
                c: useContext(CtxC),
            }),
            Composed
        );

        expect(result.current.a).to.equal('from-a');
        expect(result.current.b).to.equal('from-b');
        expect(result.current.c).to.equal('from-c');
    });

    it('supports [Provider, props] tuples', () => {

        const CtxTheme = createContext('light');

        const ThemeProvider = (props: { theme: string; children?: ReactNode }) =>
            createElement(CtxTheme.Provider, { value: props.theme }, props.children);

        const Composed = composeProviders(
            ProviderA,
            [ThemeProvider, { theme: 'dark' }],
            ProviderB,
        );

        const { result } = renderHook(
            () => ({
                a: useContext(CtxA),
                b: useContext(CtxB),
                theme: useContext(CtxTheme),
            }),
            Composed
        );

        expect(result.current.a).to.equal('from-a');
        expect(result.current.b).to.equal('from-b');
        expect(result.current.theme).to.equal('dark');
    });

    it('empty compose passes children through', () => {

        const Composed = composeProviders();

        const { result } = renderHook(
            () => useContext(CtxA),
            Composed
        );

        // No providers, so context returns the default
        expect(result.current).to.equal('default-a');
    });

    it('works with createObserverContext/createFetchContext providers', () => {

        // Simulates the real use case — LogosDX providers that only take children
        const Composed = composeProviders(ProviderA, ProviderB, ProviderC);

        const { result } = renderHook(
            () => useContext(CtxB),
            Composed
        );

        expect(result.current).to.equal('from-b');
    });
});
