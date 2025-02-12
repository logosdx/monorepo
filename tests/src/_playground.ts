import { ObserverEngine } from '@logos-ui/observer';

type EventType = {

    something: { id: number, name: string }
    awesome: { id: number, age: string }
    worrisome: { id: number, job: string }
}

const observer = new ObserverEngine<EventType>({
    name: 'test',
    emitValidator: (event, data) => {},
    spy: (action) => {}
});

async function main() {

    const awesomeData = await observer.once('awesome');

    // or
    const { event, data } = await observer.once(/some/);
}
