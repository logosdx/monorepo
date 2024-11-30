export type AppEvents = {
    click: MouseEvent,
    resize: UIEvent,
    scroll: Event,
    keyboard: KeyboardEvent,

    Escape: KeyboardEvent,
    Enter: KeyboardEvent,
    Tab: KeyboardEvent,
    ArrowUp: KeyboardEvent,
    ArrowDown: KeyboardEvent,
    ArrowLeft: KeyboardEvent,
    ArrowRight: KeyboardEvent,



    notify: {
        type: string,
        msg: string,
        timeout?: number
    },

    ready: any
    done: any
};

