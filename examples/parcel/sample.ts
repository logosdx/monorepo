import { fetch } from './setup';

export const someComponent: RiotComponent =  {

    state: { numOfPapitas: 0 },

    observable: true,
    translatable: true,
    queryable: ['orderPapitas'],
    mapToState(aState, cState){

        return {
            numOfPapitas: aState.papitas.size
        }
    },
    loadPapitas() {

        this.trigger('fetch-papitas');
    },
    orderPapitas() {

        return fetch.post('/papitas');
    },
    onMounted() {

        this.trigger('some-component-loaded');
    }
}