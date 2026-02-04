const ns = () => (window as any).LogosDx.StateMachine;

describe('smoke: @logosdx/state-machine', () => {

    beforeAll(async () => {

        await (window as any).__loadBundle('state-machine');
    });

    it('namespace is loaded', () => {

        expect(ns()).toBeDefined();
    });

    it('instantiates with initial state', () => {

        const sm = new (ns().StateMachine)({ count: 0 });
        expect(sm.state()).toEqual({ count: 0 });
    });

    it('dispatch() updates state', () => {

        const sm = new (ns().StateMachine)({ count: 0 });

        sm.dispatch({ count: 5 });
        expect(sm.state()).toEqual({ count: 5 });
    });

    it('addReducer() transforms dispatched values', () => {

        const sm = new (ns().StateMachine)({ count: 0 });

        sm.addReducer((value: any, state: any) => {

            return { count: state.count + value.amount };
        });

        sm.dispatch({ amount: 3 });
        expect(sm.state()).toEqual({ count: 3 });

        sm.dispatch({ amount: 7 });
        expect(sm.state()).toEqual({ count: 10 });
    });

    it('addListener() notifies on state change', () => {

        const sm = new (ns().StateMachine)({ value: '' });
        const history: any[] = [];

        sm.addListener((newState: any) => { history.push(newState); });

        sm.dispatch({ value: 'a' });
        sm.dispatch({ value: 'b' });

        expect(history).toEqual([{ value: 'a' }, { value: 'b' }]);
    });

    it('states() returns accumulated history', () => {

        const sm = new (ns().StateMachine)({ n: 0 });

        sm.dispatch({ n: 1 });
        sm.dispatch({ n: 2 });
        sm.dispatch({ n: 3 });

        const all = sm.states();
        expect(all.length).toBeGreaterThanOrEqual(3);
    });

    it('prevState() and nextState() navigate history', () => {

        const sm = new (ns().StateMachine)({ step: 0 });

        sm.dispatch({ step: 1 });
        sm.dispatch({ step: 2 });

        sm.prevState();
        expect(sm.state()).toEqual({ step: 1 });

        sm.nextState();
        expect(sm.state()).toEqual({ step: 2 });
    });

    it('clone() creates an independent child machine', () => {

        const parent = new (ns().StateMachine)({ x: 1 });
        const child = parent.clone();

        child.dispatch({ x: 99 });

        expect(child.state()).toEqual({ x: 99 });
        expect(parent.state()).toEqual({ x: 1 });
    });
});
