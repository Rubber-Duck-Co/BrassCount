/**
 * Types for `import { … } from '@env'` (mapped here in tsconfig.json).
 *
 * react-native-dotenv inlines these from `.env` when the bundle is built,
 * so every value ships inside the APK: public configuration only, never a
 * secret. Each one is a string, or `undefined` when `.env` leaves it out
 * (`allowUndefined` in babel.config.js), so a caller checks before use.
 *
 * Declare one export per variable in `.env.example`, and add it to
 * `__mocks__/@env.js`; `__tests__/env.test.ts` fails when they drift.
 */
export declare const APP_ENV: string | undefined;
export declare const API_BASE_URL: string | undefined;
export declare const API_TIMEOUT_MS: string | undefined;
export declare const ENABLE_ANALYTICS: string | undefined;
