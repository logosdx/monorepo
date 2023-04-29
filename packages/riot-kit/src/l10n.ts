import { L10nFactory, L10nLocale } from "@logos-ui/localize"
import { makeOnBeforeMount } from "@logos-ui/riot-utils"
import { definePrivateProps } from "@logos-ui/utils"


export type TranslatableComponent<
    Locales extends L10nLocale,
    LocaleCodes extends string
> = { t?: L10nFactory<Locales, LocaleCodes>['t'] }

type MakeTranslatableOpts<C> = {
    component: C,
    l10n: L10nFactory<any, any>
}

export const makeComponentTranslatable = <C>(opts: MakeTranslatableOpts<C>) => {

    definePrivateProps(opts.component, {
        t: (...args: Parameters<typeof opts.l10n.text>) => opts.l10n.text(...args)
    })
}