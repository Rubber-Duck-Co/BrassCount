import { readFileSync } from 'fs';
import { join } from 'path';

import * as env from '@env';

const ROOT = join(__dirname, '..');

// `import * as` over a CommonJS mock adds Babel's interop `default`, which
// is not a variable.
const mocked = Object.entries(env).filter(([name]) => name !== 'default');

const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

/** Variable names assigned in a dotenv file, ignoring comments and other lines. */
const dotenvNames = (source: string): string[] =>
  source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => line.slice(0, line.indexOf('=')).trim())
    .sort();

/** Names declared as `export declare const NAME` in a declaration file. */
const declaredNames = (source: string): string[] =>
  [...source.matchAll(/^export declare const (\w+)\s*:/gm)]
    .map(match => match[1])
    .sort();

describe('@env', () => {
  const documented = dotenvNames(read('.env.example'));

  it('documents at least one variable in .env.example', () => {
    expect(documented.length).toBeGreaterThan(0);
  });

  it('declares a type for every variable in .env.example', () => {
    expect(declaredNames(read('src/types/env.d.ts'))).toEqual(documented);
  });

  it('mocks every variable in .env.example for Jest', () => {
    expect(mocked.map(([name]) => name).sort()).toEqual(documented);
  });

  it('resolves to the Jest mock rather than a local .env', () => {
    expect(env.APP_ENV).toBe('test');
  });

  it('mocks every variable as a string, as react-native-dotenv inlines it', () => {
    for (const [, value] of mocked) {
      expect(typeof value).toBe('string');
    }
  });
});
