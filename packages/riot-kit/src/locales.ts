import type { RiotComponent } from "riot"
import { LocaleFactory, LocaleType } from "@logos-ui/localize"
import { MkHookOpts, makeOnBeforeMount, makeOnBeforeUnmount } from "@logos-ui/riot-utils"
import { Func, definePrivateProps } from "@logos-ui/utils"


export type TranslatableComponent<
    Locales extends LocaleType,
    LocaleCodes extends string
> = {
    t?: LocaleFactory<Locales, LocaleCodes>['t'],
    translatable?: true
}

type MakeTranslatableOpts<C> = {
    component: C,
    locale: LocaleFactory<any, any>
}

export const makeComponentTranslatable = <C extends Partial<RiotComponent>>(opts: MakeTranslatableOpts<C>) => {

    definePrivateProps(opts.component, {
        t: (...args: Parameters<typeof opts.locale.text>) => opts.locale.text(...args)
    });

    let update: Func;

    const onBeforeMount: MkHookOpts<C, any, any> = {
        component: opts.component,
        callback: function () {
            update = () => this.update();

            opts.locale.on('locale-change', update);
        },
    }

    const onBeforeUnmount: MkHookOpts<C, any, any> = {
        component: opts.component,
        callback: function() {

            opts.locale.off('locale-change', update);
        }
    }

    makeOnBeforeMount(onBeforeMount);
    makeOnBeforeUnmount(onBeforeUnmount);


}