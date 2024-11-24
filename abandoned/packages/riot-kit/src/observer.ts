import { ObserverFactory, Observable } from '@logos-ui/kit'
import { makeOnBeforeUnmount } from '@logos-ui/riot-utils';

export type ObservableComponent<E, R> = Partial<
    Observable.Child<R, E>
> & { observable?: true };

type MakeObservableOpts<C> = {
    component: C,
    observer: ObserverFactory<any, any>
}

export const makeComponentObservable = <C>(opts: MakeObservableOpts<C>) => {

    const observed = opts.observer.observe(opts.component);

    makeOnBeforeUnmount({
        component: opts.component,
        callback() {

            observed.cleanup()
        },
    })
}