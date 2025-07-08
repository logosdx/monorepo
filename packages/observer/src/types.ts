export type Events<Shape> = keyof Shape;

declare module './engine.ts' {
    export namespace ObserverEngine {

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

        export type Component<Ev extends Record<string, any>> = {
            on: ObserverEngine<Ev>['on'],
            once: ObserverEngine<Ev>['once'],
            emit: ObserverEngine<Ev>['emit'],
            off: ObserverEngine<Ev>['off'],
        };

        export type Child<C, Ev extends Record<string, any>> = C & Component<Ev> & {
            cleanup: Cleanup
        }

        export type Instance<Ev extends Record<string, any>> = Component<Ev> & {
            observe: ObserverEngine<Ev>['observe'],
            $observer: ObserverEngine<Ev>
        }

        export type FuncName = 'on' | 'once' | 'off' | 'emit' | 'cleanup';

        export type SpyAction<Ev extends Record<string, any>> =  {
            event: keyof Ev | RegExp | '*',
            listener?: Function | null | undefined,
            data?: unknown | undefined,
            fn: FuncName,
            context: ObserverEngine<Ev>
        }

        export interface Spy<Ev extends Record<string, any>> {
            (action: SpyAction<Ev>): void
        }

        export interface EmitValidator<Ev extends Record<string, any>> {
            (
                event: keyof Ev,
                data: Ev[keyof Ev],
                context: ObserverEngine<Ev>
            ): void
            (
                event: RegExp,
                data: unknown,
                context: ObserverEngine<Ev>
            ): void
            (
                event: '*',
                data: unknown,
                context: ObserverEngine<Ev>
            ): void
        }

        export type Options<Ev extends Record<string, any>> = {
            name?: string | undefined,
            spy?: Spy<Ev> | undefined,
            emitValidator?: EmitValidator<Ev> | undefined
        };
    }
}