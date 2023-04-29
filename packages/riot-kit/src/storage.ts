import { makeOnBeforeMount, makeOnMounted, makeOnUpdated } from '@logos-ui/riot-utils';
import { StorageFactory, StorageImplementation } from '@logos-ui/storage';
import { RiotComponent } from 'riot';

export type StoragableComponent<Storage> = {
    saveInKey?: keyof Storage,
    loadStorage?: (keyof Storage)[]
};

type MakeStoragableOpts<Storage, C> = {
    component: C & StoragableComponent<Storage>,
    storage: StorageFactory<any>
}
export const makeComponentStoragable = <
    Storage,
    C extends RiotComponent & StoragableComponent<Storage>
>(opts: MakeStoragableOpts<Storage, C>) => {

    makeOnBeforeMount({
        component: opts.component,
        callback: async function (this: C, _, state) {

            this.state = (state || {}) as C['state'];

            if (opts.component.saveInKey) {

                const stored = opts.storage.get(opts.component.saveInKey!);

                this.state = Object.assign(state || {}, stored);
            }

            if (opts.component.loadStorage) {

                Object.assign(
                    this.state,
                    opts.storage.get(opts.component.loadStorage)
                );
            }
        },
    });

    makeOnUpdated({

        component: opts.component,
        callback: async function (this: C, _, state) {

            if (opts.component.saveInKey) {
                opts.storage.set(
                    opts.component.saveInKey!,
                    state
                );
            }
        },
    });
};
