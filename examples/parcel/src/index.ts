import { onceReady } from '@logos-ui/riot-kit';
import { RiotComponent, mount, register } from 'riot'

import * as kit from './kit';

const registerComponents = () => {
    Object.entries(
        require('./components/**/*.riot') as Record<string, any>
    ).map(([name, component]) => {

        register(name, component[name].default)

        return {
            name,
            component
        }
    })
}


(window as any).kit = kit;

kit.observer.debug(true);
registerComponents();

onceReady(() => {

    mount('[is]');
});