import AsyncStorage from '@react-native-async-storage/async-storage';

import { createStorageNamespace } from '../src/services/storage';

describe('storage namespace entries', () => {
  const things = createStorageNamespace<unknown>({ name: 'things' });

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns every value with the id of the key it is stored under', async () => {
    await things.setItem('a', { n: 1 });
    await things.setItem('b:c', { n: 2 });

    const entries = await things.getAllEntries();

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        { id: 'a', value: { n: 1 } },
        { id: 'b:c', value: { n: 2 } },
      ]),
    );
  });

  it('skips corrupt values and other namespaces', async () => {
    await things.setItem('a', { n: 1 });
    await AsyncStorage.setItem(things.keyFor('bad'), '{not-json');
    await AsyncStorage.setItem('@BrassCount:other:v1:x', '{"n":9}');

    expect(await things.getAllEntries()).toEqual([
      { id: 'a', value: { n: 1 } },
    ]);
  });

  it('resolves to an empty list when nothing is stored', async () => {
    expect(await things.getAllEntries()).toEqual([]);
  });

  it('keeps getAll returning just the values', async () => {
    await things.setItem('a', { n: 1 });

    expect(await things.getAll()).toEqual([{ n: 1 }]);
  });
});
