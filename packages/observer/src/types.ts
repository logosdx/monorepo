export type Events<Shape> = keyof Shape;

declare module './factory.ts' {
    export namespace ObserverFactory {

        export interface EventCallback<Shape> {
            (
                data: Shape,
                info?: { event: string, listener: Function } | undefined
            ): void
        }

        export type RgxEmitData<Shape> = {
            event: Events<Shape>,
            data: Shape[Events<Shape>]
        }

        export type Cleanup = () => void

        export type Component<Ev> = {
            on: ObserverFactory<Ev>['on'],
            once: ObserverFactory<Ev>['once'],
            emit: ObserverFactory<Ev>['emit'],
            off: ObserverFactory<Ev>['off'],
        };

        export type Child<C, Ev> = C & Component<Ev> & {
            cleanup: Cleanup
        }

        export type Instance<Ev> = Component<Ev> & {
            observe: ObserverFactory<Ev>['observe'],
            $observer: ObserverFactory<Ev>
        }

        export type FuncName = 'on' | 'once' | 'off' | 'emit' | 'cleanup';

        export type SpyAction<Ev> =  {
            event: keyof Ev | RegExp | '*',
            listener?: Function | null | undefined,
            data?: unknown | undefined,
            fn: FuncName,
            context: ObserverFactory<Ev>
        }

        export interface Spy<Ev> {
            (action: SpyAction<Ev>): void
        }

        export interface EmitValidator<Ev> {
            (
                event: keyof Ev,
                data: Ev[keyof Ev],
                context: ObserverFactory<Ev>
            ): void
            (
                event: RegExp,
                data: unknown,
                context: ObserverFactory<Ev>
            ): void
            (
                event: '*',
                data: unknown,
                context: ObserverFactory<Ev>
            ): void
        }

        export type Options<Ev> = {
            name?: string | undefined,
            spy?: Spy<Ev> | undefined,
            emitValidator?: EmitValidator<Ev> | undefined
        };
    }
}