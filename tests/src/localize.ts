import { describe, it, before, beforeEach, after, afterEach } from 'node:test'

import { expect } from 'chai';

import {
    LocaleFactory,
    LocaleType,
    LocaleOpts,
} from '@logos-ui/localize';

import { DeepOptional } from '@logos-ui/utils';
import { sandbox, stubWarn } from './_helpers';

const english = {

    some: {
        nested: {
            label: 'what'
        },
        more: 'cookies'
    },
    food: {
        breakfast: 'I like {mainDish} with {sideDish} and {juice}.',
        lunch: 'I will usually have a {sandwichType} sandwich with {drink}.',
        dinner: 'Light dinners of {mainDish} and {sideDish} are my go-to.'
    },
};

const spanish: typeof english = {

    some: {
        nested: {
            label: 'que'
        },
        more: 'galletas dulce'
    },
    food: {
        breakfast: 'Me gusta {mainDish} con {sideDish} y {juice}.',
        lunch: 'Yo normalmente como un sandwich de {sandwichType} con {drink}.',
        dinner: 'Comida liviana de {mainDish} con {sideDish} son lo normal para mi.'
    },
};

const portugues: DeepOptional<typeof english> = {

    some: {
        more: 'galletas dulce'
    },
    food: {
        breakfast: 'Eu gusto de {mainDish} com {sideDish} e {juice}.',
        lunch: 'Eu normalmente como um sandwich de {sandwichType} com {drink}.',
        dinner: 'Comida levi de {mainDish} com {sideDish} são normal pra mim.'
    },
}

const labelsByCode = {
    en: english,
    es: spanish,
    pt: portugues
};

type Codes = keyof typeof labelsByCode;
type Lang = typeof english;

const locales: LocaleOpts<Lang, Codes>['locales'] = {
    en: { code: 'en', text: 'English', labels: english },
    es: { code: 'es', text: 'Spanish', labels: spanish },
    pt: { code: 'pt', text: 'Português', labels: portugues }
};

describe('@logos-ui/localize', function () {

    let l10bMngr: LocaleFactory<Lang, Codes>;

    it('requires a proper config', () => {

        expect(
            () => (

                new LocaleFactory <Lang, Codes>({
                    // current: 'en',
                    fallback: 'en',
                    locales
                } as any)
            )
        ).to.throw(/current lang.+not set/i)

        expect(
            () => (

                new LocaleFactory <Lang, Codes>({
                    current: 'en',
                    // fallback: 'en',
                    locales
                } as any)
            )
        ).to.throw(/fallback lang.+not set/i)

        expect(
            () => (

                new LocaleFactory <Lang, Codes>({
                    current: 'en',
                    fallback: 'en',
                    // langs
                } as any)
            )
        ).to.throw(/config.+not set/i)

        expect(
            () => (

                new LocaleFactory <Lang, Codes>({
                    current: 'en',
                    fallback: 'en',
                    locales: 'wee'
                } as any)
            )
        ).to.throw(/config.+not an object/i)

        expect(
            () => (

                new LocaleFactory <Lang, Codes>({
                    current: 'en',
                    fallback: 'en',
                    locales: []
                } as any)
            )
        ).to.throw(/config.+can not.+array/i)
    });

    it('instantiates', () => {

        l10bMngr = new LocaleFactory <Lang, Codes>({
            current: 'en',
            fallback: 'en',
            locales: locales
        })
    });

    it('gets a text label', () => {

        expect(l10bMngr.text('some.more')).to.eq(english.some.more);
        expect(l10bMngr.text('some.nested.label')).to.eq(english.some.nested.label);
    });

    it('changes locale', () => {

        l10bMngr.changeTo('es');

        expect(l10bMngr.text('some.more')).to.eq(spanish.some.more);
        expect(l10bMngr.text('some.nested.label')).to.eq(spanish.some.nested.label);
    });

    it('has events', () => {

        const stub = sandbox.stub();

        l10bMngr.on('locale-change', stub);
        l10bMngr.changeTo('en');

        const [arg] = stub.args;
        const [event] = arg!;

        expect(event.type).to.eq('locale-change');
        expect(event.code).to.eq('en');

        l10bMngr.off('locale-change', stub);
        l10bMngr.changeTo('en');

        expect(stub.calledOnce).to.be.true;
    });

    it('replaces variables', () => {

        const mainDish = 'lamb';
        const sideDish = 'peas';
        const juice = 'orange';
        const sandwichType = 'ham';
        const drink = 'coke';

        const replaceWith = { mainDish, sideDish, juice, sandwichType, drink };

        const tests = {
            en: [

                ['breakfast', `I like ${mainDish} with ${sideDish} and ${juice}.`,],
                ['lunch', `I will usually have a ${sandwichType} sandwich with ${drink}.`,],
                ['dinner', `Light dinners of ${mainDish} and ${sideDish} are my go-to.`],
            ],
            es: [

                ['breakfast', `Me gusta ${mainDish} con ${sideDish} y ${juice}.`,],
                ['lunch', `Yo normalmente como un sandwich de ${sandwichType} con ${drink}.`,],
                ['dinner', `Comida liviana de ${mainDish} con ${sideDish} son lo normal para mi.`],
            ],
            pt: [

                ['breakfast', `Eu gusto de ${mainDish} com ${sideDish} e ${juice}.`,],
                ['lunch', `Eu normalmente como um sandwich de ${sandwichType} com ${drink}.`,],
                ['dinner', `Comida levi de ${mainDish} com ${sideDish} são normal pra mim.`],
            ]
        };

        for (const c in tests) {

            const vals = tests[c as Codes];
            const code = c as Codes;
            l10bMngr.changeTo(code);

            for (const [key, val] of vals) {

                const food = l10bMngr.text(`food.${key}` as any, replaceWith);
                expect(food, code).to.eq(val);
            }
        }
    });

    it('has a fallback locale when labels are missing', () => {

        l10bMngr.changeTo('pt');
        expect(l10bMngr.text('some.more')).to.eq(portugues.some!.more);
        expect(l10bMngr.text('some.nested.label')).to.eq(english.some.nested.label);
    });

    it('gives a list of locales', () => {

        expect(l10bMngr.locales[0]).to.contain({ code: locales.en.code, text: locales.en.text })
        expect(l10bMngr.locales[1]).to.contain({ code: locales.es.code, text: locales.es.text })
        expect(l10bMngr.locales[2]).to.contain({ code: locales.pt.code, text: locales.pt.text })
    });

    it('does not convert null or undefined to string', () => {
        expect(() => { l10bMngr.text('food.breakfast', [null as any]) }).to.not.throw();
        expect(() => { l10bMngr.text('food.breakfast', [undefined as any]) }).to.not.throw();
        expect(() => { l10bMngr.text('food.breakfast', [{ mainDish: null } as any]) }).to.not.throw();
        expect(() => { l10bMngr.text('food.breakfast', { mainDish: null } as any) }).to.not.throw();
    })

    it('falls back to the fallback locale when the current locale is missing', () => {


        l10bMngr.changeTo('fr' as any);

        expect(stubWarn.calledOnce).to.be.true;

        expect(l10bMngr.text('some.more')).to.eq(english.some.more);
    });

    it('accesses non-nested values with dot notation', () => {

        const lang = {
            'some.more': 'cookies',
            'some.nested.label': 'what',
            food: {
                breakfast: 'eggs and cheese',
            }
        }

        const instance = new LocaleFactory <typeof lang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: lang }
            }
        });

        expect(instance.text('some.more')).to.eq(lang['some.more']);
        expect(instance.text('some.nested.label')).to.eq(lang['some.nested.label']);
        expect(instance.text('food.breakfast')).to.eq(lang.food.breakfast);
    });

    it('updates a language', () => {

        const lang = {
            'some.more': 'cookies',
            'some.nested.label': 'what',
            food: {
                breakfast: 'eggs and cheese',
            }
        }

        const instance = new LocaleFactory <typeof lang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: lang }
            }
        });

        expect(instance.text('some.more')).to.eq(lang['some.more']);

        instance.updateLang('en', {
            'some.more': 'chocolate',
        })

        expect(instance.text('some.more')).to.eq('chocolate');
    });
});