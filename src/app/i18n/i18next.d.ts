import 'i18next';
import type { resources } from './config';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'common';
        resources: typeof resources.ko;
        returnNull: false;
    }
}
