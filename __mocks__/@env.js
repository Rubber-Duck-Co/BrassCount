/**
 * Jest stand-in for `@env` (mapped in jest.config.js; babel.config.js skips
 * the dotenv plugin under test), so tests never read a developer's `.env`.
 *
 * One export per variable in `.env.example`, as the string react-native-dotenv
 * would inline. `__tests__/env.test.ts` keeps this file, `.env.example` and
 * `src/types/env.d.ts` in step.
 */
module.exports = {
  APP_ENV: 'test',
  API_BASE_URL: 'https://api.example.com',
  API_TIMEOUT_MS: '15000',
  ENABLE_ANALYTICS: 'false',
};
