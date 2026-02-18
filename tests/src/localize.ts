import { describe, it, expect } from 'vitest'


import {
    LocaleManager
} from '@logosdx/localize';

import { DeepOptional } from '@logosdx/utils';
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

const locales: LocaleManager.LocaleOpts<Lang, Codes>['locales'] = {
    en: { code: 'en', text: 'English', labels: english },
    es: { code: 'es', text: 'Spanish', labels: spanish },
    pt: { code: 'pt', text: 'Português', labels: portugues }
};

describe('@logosdx/localize', function () {

    let l10bMngr: LocaleManager<Lang, Codes>;

    it('requires a proper config', () => {

        expect(
            () => (

                new LocaleManager <Lang, Codes>({
                    // current: 'en',
                    fallback: 'en',
                    locales
                } as any)
            )
        ).to.throw(/current lang.+not set/i)

        expect(
            () => (

                new LocaleManager <Lang, Codes>({
                    current: 'en',
                    // fallback: 'en',
                    locales
                } as any)
            )
        ).to.throw(/fallback lang.+not set/i)

        expect(
            () => (

                new LocaleManager <Lang, Codes>({
                    current: 'en',
                    fallback: 'en',
                    // langs
                } as any)
            )
        ).to.throw(/config.+not set/i)

        expect(
            () => (

                new LocaleManager <Lang, Codes>({
                    current: 'en',
                    fallback: 'en',
                    locales: 'wee'
                } as any)
            )
        ).to.throw(/config.+not an object/i)

        expect(
            () => (

                new LocaleManager <Lang, Codes>({
                    current: 'en',
                    fallback: 'en',
                    locales: []
                } as any)
            )
        ).to.throw(/config.+can not.+array/i)
    });

    it('instantiates', () => {

        l10bMngr = new LocaleManager <Lang, Codes>({
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

        l10bMngr.on('change', stub);
        l10bMngr.changeTo('en');

        const [arg] = stub.args;
        const [event] = arg!;

        expect(event.type).to.eq('change');
        expect(event.code).to.eq('en');

        l10bMngr.off('change', stub);
        l10bMngr.changeTo('en');

        expect(stub.calledOnce).to.be.true;
    });

    it('on() returns an unsubscribe function', () => {

        const stub = sandbox.stub();

        const unsub = l10bMngr.on('change', stub);
        l10bMngr.changeTo('es');

        expect(stub.calledOnce).to.be.true;

        unsub();
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

        expect(l10bMngr.text('some.more')).to.eq(english.some.more);
    });

    it('filters out undefined and null from array values', () => {

        const lang = { msg: 'Hello {0} and {1}' };

        const instance = new LocaleManager<typeof lang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: lang } }
        });

        // The bug: || instead of && means nothing gets filtered
        const result = instance.text('msg', ['World', undefined as any]);
        expect(result).to.eq('Hello World and {1}');
    });

    it('handles empty object values without error', () => {

        const lang = { msg: 'Hello {name}' };

        const instance = new LocaleManager<typeof lang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: lang } }
        });

        // The bug: values.length on object is undefined, not 0
        const result = instance.text('msg', {} as any);
        expect(result).to.eq('Hello {name}');
    });

    it('accesses non-nested values with dot notation', () => {

        const lang = {
            'some.more': 'cookies',
            'some.nested.label': 'what',
            food: {
                breakfast: 'eggs and cheese',
            }
        }

        const instance = new LocaleManager <typeof lang, 'en'>({
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

        const instance = new LocaleManager <typeof lang, 'en'>({
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

    it('returns [key] for missing translation keys', () => {

        const lang = { greeting: 'Hello' };

        const instance = new LocaleManager<typeof lang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: lang } }
        });

        const result = instance.text('nonexistent.key' as any);
        expect(result).to.eq('[nonexistent.key]');
    });

    it('warns in dev mode when key is missing', () => {

        const lang = { greeting: 'Hello' };

        const instance = new LocaleManager<typeof lang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: lang } }
        });

        instance.text('missing.key' as any);

        expect(stubWarn.called).to.be.true;
        expect(stubWarn.lastCall.args[0]).to.match(/missing.key/);
    });

    it('clones itself', () => {

        const lang = {
            'some.more': 'cookies',
            'some.nested.label': 'what',
            food: {
                breakfast: 'eggs and cheese',
            }
        }

        const instance = new LocaleManager <typeof lang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: lang }
            }
        });

        const clone = instance.clone();

        const cloneText = clone.text('some.more');
        const langText = lang['some.more'];
        const cloneNested = clone.text('some.nested.label');
        const instanceNested = instance.text('some.nested.label');

        expect(clone).to.not.eq(instance);
        expect(cloneText).to.eq(langText);
        expect(cloneNested).to.eq(instanceNested);

        const updated = {
            ...lang,
            'some.more': 'chocolate',
        }

        instance.updateLang('en', updated);

        expect(clone.text('some.more')).to.eq(langText);
        expect(instance.text('some.more')).to.eq('chocolate');
    });
});

describe('localize: pluralization', () => {

    const lang = {
        items: '{count, plural, one {# item} other {# items}}',
        inbox: '{count, plural, zero {No messages} one {# message} other {# messages}}',
        mixed: 'You have {count, plural, one {# notification} other {# notifications}} from {name}',
    };

    type PluralLang = typeof lang;

    let instance: LocaleManager<PluralLang, 'en'>;

    it('instantiates with plural strings', () => {

        instance = new LocaleManager<PluralLang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: lang } }
        });
    });

    it('resolves singular plural form', () => {

        expect(instance.t('items', { count: 1 })).to.eq('1 item');
    });

    it('resolves other plural form', () => {

        expect(instance.t('items', { count: 5 })).to.eq('5 items');
    });

    it('resolves zero plural form', () => {

        expect(instance.t('inbox', { count: 0 })).to.eq('No messages');
    });

    it('resolves one from inbox', () => {

        expect(instance.t('inbox', { count: 1 })).to.eq('1 message');
    });

    it('resolves plural mixed with regular variables', () => {

        expect(instance.t('mixed', { count: 3, name: 'Alice' } as any)).to.eq('You have 3 notifications from Alice');
    });

    it('resolves plural mixed with singular and regular variables', () => {

        expect(instance.t('mixed', { count: 1, name: 'Bob' } as any)).to.eq('You have 1 notification from Bob');
    });

    it('handles string without plural syntax unchanged', () => {

        const simpleLang = { hello: 'Hello {name}' };

        const simple = new LocaleManager<typeof simpleLang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: simpleLang } }
        });

        expect(simple.t('hello', { name: 'World' })).to.eq('Hello World');
    });
});

describe('localize: intl formatters', () => {

    const lang = { greeting: 'Hello' };

    let instance: LocaleManager<typeof lang, 'en' | 'de'>;

    it('instantiates with intl support', () => {

        instance = new LocaleManager<typeof lang, 'en' | 'de'>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: lang },
                de: { code: 'de', text: 'Deutsch', labels: lang },
            }
        });
    });

    it('formats numbers', () => {

        const result = instance.intl.number(1499.99);
        expect(result).to.eq('1,499.99');
    });

    it('formats currency', () => {

        const result = instance.intl.number(1499.99, { style: 'currency', currency: 'USD' });
        expect(result).to.eq('$1,499.99');
    });

    it('formats percentages', () => {

        const result = instance.intl.number(0.75, { style: 'percent' });
        expect(result).to.eq('75%');
    });

    it('formats dates', () => {

        const date = new Date(2026, 1, 18);
        const result = instance.intl.date(date);
        expect(result).to.be.a('string');
        expect(result).to.include('2026');
    });

    it('formats relative time', () => {

        const result = instance.intl.relative(-3, 'day');
        expect(result).to.eq('3 days ago');
    });

    it('updates formatters when locale changes', () => {

        const before = instance.intl.number(1499.99);
        instance.changeTo('de');
        const after = instance.intl.number(1499.99);

        expect(before).to.not.eq(after);

        instance.changeTo('en');
    });
});

describe('localize: async loading', () => {

    const english = { greeting: 'Hello', farewell: 'Goodbye' };
    const spanish: typeof english = { greeting: 'Hola', farewell: 'Adiós' };

    type AsyncLang = typeof english;
    type AsyncCodes = 'en' | 'es' | 'fr';

    let instance: LocaleManager<AsyncLang, AsyncCodes>;

    it('instantiates with register()', () => {

        instance = new LocaleManager<AsyncLang, AsyncCodes>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: english }
            } as any
        });

        instance.register('es', {
            text: 'Español',
            loader: () => Promise.resolve(spanish)
        });
    });

    it('includes registered locales in locales list', () => {

        const list = instance.locales;
        expect(list).to.have.lengthOf(2);
        expect(list.find(l => l.code === 'es')).to.deep.include({ code: 'es', text: 'Español' });
    });

    it('isLoaded returns false for unloaded locale', () => {

        expect(instance.isLoaded('es')).to.be.false;
    });

    it('changeTo loads and switches to registered locale', async () => {

        await instance.changeTo('es');
        expect(instance.current).to.eq('es');
        expect(instance.text('greeting')).to.eq('Hola');
    });

    it('isLoaded returns true after loading', () => {

        expect(instance.isLoaded('es')).to.be.true;
    });

    it('emits loading event before load starts', async () => {

        const loadingStub = sandbox.stub();

        await instance.changeTo('en');
        instance.register('fr', {
            text: 'Français',
            loader: () => Promise.resolve({ greeting: 'Bonjour', farewell: 'Au revoir' })
        });

        instance.on('loading', loadingStub);
        await instance.changeTo('fr');

        expect(loadingStub.calledOnce).to.be.true;
    });

    it('emits error event and stays on current locale when loader fails', async () => {

        const errInstance = new LocaleManager<AsyncLang, 'en' | 'bad'>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: english }
            } as any
        });

        errInstance.register('bad', {
            text: 'Bad',
            loader: () => Promise.reject(new Error('Network error'))
        });

        const errorStub = sandbox.stub();
        errInstance.on('error', errorStub);

        try {
            await errInstance.changeTo('bad');
        }
        catch (e) {
            // expected
        }

        expect(errInstance.current).to.eq('en');
        expect(errorStub.calledOnce).to.be.true;
    });

    it('changeTo resolves immediately for already-loaded locale', async () => {

        const start = performance.now();
        await instance.changeTo('en');
        const elapsed = performance.now() - start;

        expect(elapsed).to.be.lessThan(50);
        expect(instance.current).to.eq('en');
    });
});

describe('localize: namespace scoping', () => {

    const lang = {
        auth: {
            login: { title: 'Sign In', submit: 'Log In' },
            errors: { invalid: 'Invalid credentials' },
        },
        dashboard: {
            greeting: 'Welcome back, {name}!',
            stats: '{count, plural, one {# item} other {# items}}',
        },
    };

    type NsLang = typeof lang;

    let instance: LocaleManager<NsLang, 'en'>;

    it('instantiates for namespace tests', () => {

        instance = new LocaleManager<NsLang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: lang } }
        });
    });

    it('creates a scoped translator with ns()', () => {

        const authT = instance.ns('auth');
        expect(authT).to.be.an('object');
        expect(authT.t).to.be.a('function');
    });

    it('scoped t() prepends prefix', () => {

        const authT = instance.ns('auth');
        expect(authT.t('login.title')).to.eq('Sign In');
        expect(authT.t('login.submit')).to.eq('Log In');
        expect(authT.t('errors.invalid')).to.eq('Invalid credentials');
    });

    it('supports nested scoping', () => {

        const loginT = instance.ns('auth').ns('login');
        expect(loginT.t('title')).to.eq('Sign In');
        expect(loginT.t('submit')).to.eq('Log In');
    });

    it('scoped t() supports variable substitution', () => {

        const dashT = instance.ns('dashboard');
        expect(dashT.t('greeting', { name: 'Alice' })).to.eq('Welcome back, Alice!');
    });

    it('scoped t() supports pluralization', () => {

        const dashT = instance.ns('dashboard');
        expect(dashT.t('stats', { count: 1 })).to.eq('1 item');
        expect(dashT.t('stats', { count: 5 })).to.eq('5 items');
    });

    it('scoped intl delegates to parent', () => {

        const authT = instance.ns('auth');
        expect(authT.intl.number(42)).to.eq(instance.intl.number(42));
    });
});

describe('localize: additional coverage', () => {

    it('concurrent changeTo() for the same unloaded locale only loads once', async () => {

        const english = { greeting: 'Hello' };
        const french = { greeting: 'Bonjour' };
        let loaderCallCount = 0;

        const instance = new LocaleManager<typeof english, 'en' | 'fr'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: english } } as any
        });

        instance.register('fr', {
            text: 'Français',
            loader: async () => {

                loaderCallCount++;
                await new Promise(r => setTimeout(r, 10));
                return french;
            }
        });

        await Promise.all([
            instance.changeTo('fr'),
            instance.changeTo('fr')
        ]);

        expect(instance.current).to.eq('fr');
        expect(instance.text('greeting')).to.eq('Bonjour');
        expect(loaderCallCount).to.eq(1);
    });

    it('updateLang() on non-current locale is reflected when switched to', async () => {

        const lang = { greeting: 'Hello', farewell: 'Goodbye' };
        const spanish = { greeting: 'Hola', farewell: 'Adiós' };

        const instance = new LocaleManager<typeof lang, 'en' | 'es'>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: lang },
                es: { code: 'es', text: 'Español', labels: spanish }
            }
        });

        instance.updateLang('es', { greeting: 'Buenas' });
        await instance.changeTo('es');

        expect(instance.text('greeting')).to.eq('Buenas');
        expect(instance.text('farewell')).to.eq('Adiós');
    });

    it('scoped translator reflects locale changes after switch', async () => {

        const lang = {
            auth: { login: { title: 'Sign In' } },
        };

        const langEs = {
            auth: { login: { title: 'Iniciar sesión' } },
        };

        const instance = new LocaleManager<typeof lang, 'en' | 'es'>({
            current: 'en',
            fallback: 'en',
            locales: {
                en: { code: 'en', text: 'English', labels: lang },
                es: { code: 'es', text: 'Español', labels: langEs }
            }
        });

        const authT = instance.ns('auth');
        expect(authT.t('login.title')).to.eq('Sign In');

        await instance.changeTo('es');
        expect(authT.t('login.title')).to.eq('Iniciar sesión');
    });

    it('changeTo() unknown locale fires event with fallback code', async () => {

        const lang = { greeting: 'Hello' };

        const instance = new LocaleManager<typeof lang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: lang } }
        });

        // Force a different current so changeTo fallback actually triggers
        instance.current = 'xx' as any;

        const changeStub = sandbox.stub();
        instance.on('change', changeStub);

        await instance.changeTo('zz' as any);

        expect(instance.current).to.eq('en');
        expect(changeStub.calledOnce).to.be.true;

        const [event] = changeStub.args[0]!;
        expect(event.code).to.eq('en');
    });

    it('plural zero category with # replacement resolves correctly', () => {

        const lang = {
            cart: '{count, plural, zero {# items in cart} one {# item in cart} other {# items in cart}}',
        };

        const instance = new LocaleManager<typeof lang, 'en'>({
            current: 'en',
            fallback: 'en',
            locales: { en: { code: 'en', text: 'English', labels: lang } }
        });

        expect(instance.t('cart', { count: 0 })).to.eq('0 items in cart');
        expect(instance.t('cart', { count: 1 })).to.eq('1 item in cart');
        expect(instance.t('cart', { count: 5 })).to.eq('5 items in cart');
    });
});