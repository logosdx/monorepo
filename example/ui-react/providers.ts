import {
    createStateMachineContext,
    createLocalizeContext,
    composeProviders,
} from '@logosdx/react';
import { createAppMachine, i18n } from '../core/index.ts';

export const machine = createAppMachine();

export const [MachineProvider, useMachine] = createStateMachineContext(machine);
export const [LocaleProvider, useLocale] = createLocalizeContext(i18n);

export const Providers = composeProviders(MachineProvider, LocaleProvider);
