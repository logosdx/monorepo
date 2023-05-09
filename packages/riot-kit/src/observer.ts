import { Observable, ObservableInstanceChild } from "@logos-ui/kit"
import { makeOnBeforeUnmount } from "@logos-ui/riot-utils";
import { RiotComponent } from "riot";

export type ObservableComponent<E, R> = Partial<
    ObservableInstanceChild<R, E>
> & { observable?: true };

type MakeObservableOpts<C> = {
    component: C,
    observer: Observable<any, any>
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